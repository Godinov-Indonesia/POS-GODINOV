-- ============================================================================
-- M11.1 · butir 15, 16, 12 — State machine Void/Retur ([11 §2, §3.2])
-- ============================================================================

ALTER TABLE transactions
    -- DISKRIMINATOR VOID vs RETUR ([11 §2.1]). NULL = belum pernah tercetak.
    ADD COLUMN IF NOT EXISTS receipt_printed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reprint_count      INT NOT NULL DEFAULT 0,

    -- BUTIR 16: kode struk yang dapat diketik manusia untuk pencarian lintas shift.
    ADD COLUMN IF NOT EXISTS short_code         VARCHAR(20),

    -- Turunan, dihitung server setiap kali `returns` berubah. NONE|PARTIAL|FULL.
    ADD COLUMN IF NOT EXISTS return_state       VARCHAR(10) NOT NULL DEFAULT 'NONE',

    -- BUTIR 12: identitas perangkat, dasar penguncian sesi.
    ADD COLUMN IF NOT EXISTS device_id          VARCHAR(64) NOT NULL DEFAULT 'legacy',

    ADD COLUMN IF NOT EXISTS voided_at          TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS voided_by          UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS void_reason_code   VARCHAR(50);

-- Status v2. 'CANCELLED' DIPERTAHANKAN sebagai nilai warisan; baris baru
-- memakai 'VOIDED'. Perangkat lapangan yang mati dua minggu akan kembali
-- membawa antrean berisi nilai lama, dan menolaknya berarti membuang
-- pembatalan yang benar-benar terjadi.
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS ck_txn_status;
ALTER TABLE transactions
    ADD CONSTRAINT ck_txn_status CHECK (
        status IN ('COMPLETED', 'VOIDED', 'CANCELLED')
    );

ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS ck_txn_return_state;
ALTER TABLE transactions
    ADD CONSTRAINT ck_txn_return_state CHECK (
        return_state IN ('NONE', 'PARTIAL', 'FULL')
    );

-- INTI BUTIR 15, ditegakkan di lapisan penyimpanan: transaksi yang struknya
-- sudah terbit TIDAK BOLEH berstatus VOIDED. Struk yang sudah keluar dari
-- printer adalah dokumen yang berpindah tangan ke pelanggan; mengubahnya
-- setelah itu berarti menerbitkan realitas kedua yang bertentangan dengan
-- kertas di tangan pelanggan.
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS ck_void_requires_unprinted;
ALTER TABLE transactions
    ADD CONSTRAINT ck_void_requires_unprinted CHECK (
        status <> 'VOIDED' OR receipt_printed_at IS NULL
    );

-- Kode struk unik per outlet. Dibuat KLIEN (offline-first), divalidasi server.
CREATE UNIQUE INDEX IF NOT EXISTS uq_txn_short_code
    ON transactions (outlet_id, short_code) WHERE short_code IS NOT NULL;

-- BUTIR 16: riwayat default difilter shift aktif.
CREATE INDEX IF NOT EXISTS idx_txn_shift_created
    ON transactions (shift_id, client_created_at DESC);
