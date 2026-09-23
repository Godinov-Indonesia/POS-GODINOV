-- ============================================================================
-- M11.1 · butir 8 — Multi-tender ([11 §3.2])
--
-- Menggantikan asumsi "satu transaksi = satu metode bayar".
--
-- KEPUTUSAN: butir 8 menyebut "Nominal Gesek", yang secara implisit mengakui
-- pembayaran sebagian (mis. Rp 200.000 tunai + Rp 300.000 gesek). Satu kolom
-- `trace_number` di `transactions` tidak dapat merepresentasikan dua kartu pada
-- satu struk, dan tidak dapat merepresentasikan nominal gesek yang berbeda dari
-- total transaksi. Karena itu data tender dipindah ke tabel anak; `transactions`
-- tetap menyimpan RINGKASAN terdenormalisasi agar laporan v1 tidak pecah.
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_payments (
    id              UUID PRIMARY KEY,
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    sequence        INT NOT NULL DEFAULT 1,
    method          VARCHAR(50) NOT NULL,
    amount          DECIMAL(15,2) NOT NULL,

    -- Wajib untuk kartu (butir 8). NULL untuk CASH/QRIS/TRANSFER.
    trace_number    VARCHAR(32),
    card_last4      CHAR(4),

    -- Opsional, diisi bila EDC/operator menyediakannya.
    card_network    VARCHAR(20),
    approval_code   VARCHAR(32),
    edc_terminal_id VARCHAR(32),

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Baris hasil REKONSTRUKSI, BUKAN kesaksian perangkat.
    --
    -- Dua sumber mengisinya:
    --   1. migrasi 000024, untuk transaksi yang lahir sebelum v2;
    --   2. jalur sinkronisasi v1 yang masih hidup selama jendela deprekasi —
    --      klien v1 mengirim `payment_method: "DEBIT"` tanpa trace number sama
    --      sekali, karena kolomnya memang belum ada saat ia dirilis.
    --
    -- Transaksi DEBIT yang lahir sebelum v2 tidak pernah memiliki trace number
    -- maupun 4 digit akhir — kolomnya belum ada saat uang itu diterima.
    -- Ada tiga jalan dan hanya satu yang jujur:
    --   (a) tidak membackfill sama sekali → penjualan kartu lama kehilangan
    --       seluruh baris tendernya, invarian "setiap transaksi punya >= 1
    --       tender" pecah, dan laporan settlement diam-diam salah;
    --   (b) mengisi trace number dengan sentinel seperti 'LEGACY' → MEMALSUKAN
    --       bukti audit, tepat pada kolom yang dibuat untuk mencegah pemalsuan;
    --   (c) menandai barisnya apa adanya sebagai hasil rekonstruksi.
    -- Kolom ini adalah jalan (c). Ia dapat dikueri: "tender kartu mana yang
    -- rincian kartunya memang tidak pernah kita miliki".
    --
    -- ⚠️ API TIDAK PERNAH boleh menerima nilai ini dari klien. Hanya migrasi
    -- dan lapisan service yang menulisnya; `json:"-"` pada struct Go membuang
    -- kuncinya saat dekode. Bila klien dapat mengisinya, seluruh butir 8 dapat
    -- dilewati hanya dengan menambahkan satu field ke payload.
    is_reconstructed   BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_txn_payment_seq UNIQUE (transaction_id, sequence),
    CONSTRAINT ck_payment_amount_positive CHECK (amount > 0),

    CONSTRAINT ck_payment_method CHECK (
        method IN ('CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER')
    ),

    -- INTI BUTIR 8: kartu tanpa trace number & 4 digit akhir ditolak DATABASE,
    -- bukan sekadar ditolak form. Perangkat yang dimodifikasi tetap terbentur.
    CONSTRAINT ck_card_requires_trace CHECK (
        is_reconstructed
        OR method NOT IN ('DEBIT', 'CREDIT')
        OR (trace_number IS NOT NULL AND btrim(trace_number) <> ''
            AND card_last4 IS NOT NULL)
    ),

    -- Aturan R8: hanya 4 digit, dan hanya digit. PAN penuh mustahil masuk.
    CONSTRAINT ck_card_last4_shape CHECK (
        card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'
    )
);

CREATE INDEX IF NOT EXISTS idx_txn_payments_parent ON transaction_payments (transaction_id);
CREATE INDEX IF NOT EXISTS idx_txn_payments_trace  ON transaction_payments (trace_number)
    WHERE trace_number IS NOT NULL;
-- Laporan "tender kartu tanpa rincian kartu" — sisa utang audit dari era v1.
CREATE INDEX IF NOT EXISTS idx_txn_payments_reconstructed ON transaction_payments (is_reconstructed)
    WHERE is_reconstructed;

-- Ringkasan terdenormalisasi pada induk — kompatibilitas laporan v1.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS tender_count         INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS cash_amount          DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS noncash_amount       DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS primary_trace_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS primary_card_last4   CHAR(4);

COMMENT ON COLUMN transactions.payment_method IS
    'v1-compat. Nilai: CASH|QRIS|DEBIT|CREDIT|TRANSFER|SPLIT. Sumber kebenaran = transaction_payments.';
