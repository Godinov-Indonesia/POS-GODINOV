-- ============================================================================
-- M11.1 · Backfill v2 ([11 §M11.1])
--
-- Migrasi ini TIDAK mengubah struktur. Ia mengisi kolom v2 untuk baris yang
-- lahir di era v1, sehingga invarian v2 berlaku sejak baris pertama dan sisi
-- server tidak perlu mengenal dua bentuk data.
--
-- Idempoten: setiap pernyataan memakai penjaga `WHERE ... IS NULL` atau
-- `NOT EXISTS`, sehingga menjalankannya dua kali aman.
-- ============================================================================

-- ── 1. receipt_printed_at ───────────────────────────────────────────────────
--
-- ⚠️ KEPUTUSAN YANG TIDAK BOLEH DIBALIK TANPA DISKUSI.
--
-- Struk v1 SELALU dicetak saat commit, jadi setiap transaksi lama memang sudah
-- berpindah tangan sebagai kertas. Membiarkan kolom ini kosong akan membuka
-- jalur VOID untuk SELURUH transaksi lampau — persis yang butir 15 larang, dan
-- persis lubang yang v2 dibangun untuk menutupnya ([11 §2.1]).
UPDATE transactions
SET    receipt_printed_at = client_created_at
WHERE  receipt_printed_at IS NULL;

-- ── 2. Ringkasan tender pada induk ─────────────────────────────────────────
UPDATE transactions
SET    tender_count   = 1,
       cash_amount    = CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END,
       noncash_amount = CASE WHEN payment_method = 'CASH' THEN 0 ELSE total_amount END
WHERE  tender_count = 1 AND cash_amount = 0 AND noncash_amount = 0;

-- ── 3. Satu baris tender per transaksi lama ────────────────────────────────
--
-- `id` sengaja MEMAKAI ULANG UUID transaksi: deterministik, sehingga migrasi
-- yang diulang tidak menyisipkan tender ganda. Tabelnya berbeda dari
-- `transactions`, jadi tidak ada tabrakan kunci.
--
-- Yang DILEWATI dan alasannya:
--   • total_amount <= 0 → melanggar `ck_payment_amount_positive`; tender bernilai
--     nol bukan pembayaran, dan mengarang nilainya lebih buruk daripada absen.
--   • payment_method di luar kontrak beku → data v1 yang memang sudah rusak;
--     memasukkannya hanya memindahkan kerusakan ke tabel baru.
-- Keduanya dilaporkan oleh blok verifikasi di bagian 6.
INSERT INTO transaction_payments (
    id, transaction_id, sequence, method, amount, is_reconstructed
)
SELECT t.id, t.id, 1, t.payment_method, t.total_amount, TRUE
FROM   transactions t
WHERE  t.total_amount > 0
  AND  t.payment_method IN ('CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER')
  AND  NOT EXISTS (
         SELECT 1 FROM transaction_payments p WHERE p.transaction_id = t.id
       );

-- ── 4. short_code (butir 16) ───────────────────────────────────────────────
--
-- Format: <outlet_id>-<YYMMDD>-<5 hex uppercase dari UUID>
-- Contoh:  AB1234-250820-K7QF1
--
-- Ruang tabrakan 16^5 = 1.048.576 per outlet per hari — identik dengan 4 karakter
-- Base32 yang disebut [11 §3.2], tetapi dapat dibangkitkan langsung di SQL murni
-- tanpa fungsi bantu. Klien WAJIB memakai format yang sama.
--
-- Segmen tanggal bersifat KOSMETIK (memudahkan mata manusia mengurutkan struk);
-- keunikan datang dari kode utuh per outlet. Baris lama memakai tanggal UTC.
--
-- Baris yang kodenya bertabrakan DIBIARKAN NULL, bukan dipaksakan: indeks unik
-- parsial mengabaikan NULL, dan transaksi lama tanpa kode masih dapat dicari
-- lewat UUID penuh.
WITH candidate AS (
    SELECT id,
           outlet_id,
           outlet_id || '-' ||
           to_char(client_created_at AT TIME ZONE 'UTC', 'YYMMDD') || '-' ||
           upper(substr(replace(id::text, '-', ''), 1, 5)) AS code
    FROM   transactions
    WHERE  short_code IS NULL
),
ranked AS (
    SELECT id, code,
           row_number() OVER (PARTITION BY outlet_id, code ORDER BY id) AS rn
    FROM   candidate
)
UPDATE transactions t
SET    short_code = r.code
FROM   ranked r
WHERE  t.id = r.id AND r.rn = 1;

-- ── 5. Shift: kolom v1 → kolom v2 ──────────────────────────────────────────
--
-- Kasir v1 menghitung DAN MELIHAT angka penutupan. Nilainya tetap dipakai
-- sebagai deklarasi historis agar shift lama tidak kosong di laporan, tetapi
-- `blind_close` DIPAKSA FALSE: menandai shift itu sebagai kesaksian buta berarti
-- berbohong pada audit. Perbedaan itulah yang menentukan nilai auditnya.
UPDATE shifts
SET    declared_cash = closing_balance,
       expected_cash = expected_balance,
       cash_variance = discrepancy,
       blind_close   = FALSE
WHERE  expected_cash IS NULL;

-- ── 6. Verifikasi — menggagalkan migrasi bila hasilnya tidak utuh ──────────
--
-- Backfill yang diam-diam melewatkan baris jauh lebih berbahaya daripada
-- backfill yang gagal keras: yang pertama baru ketahuan berbulan-bulan kemudian
-- lewat laporan yang angkanya tidak masuk akal.
DO $$
DECLARE
    unprinted    BIGINT;
    no_tender    BIGINT;
    no_code      BIGINT;
    bad_method   BIGINT;
    zero_amount  BIGINT;
BEGIN
    SELECT count(*) INTO unprinted FROM transactions WHERE receipt_printed_at IS NULL;

    SELECT count(*) INTO no_tender
    FROM   transactions t
    WHERE  NOT EXISTS (SELECT 1 FROM transaction_payments p WHERE p.transaction_id = t.id);

    SELECT count(*) INTO no_code   FROM transactions WHERE short_code IS NULL;
    SELECT count(*) INTO zero_amount FROM transactions WHERE total_amount <= 0;
    SELECT count(*) INTO bad_method
    FROM   transactions
    WHERE  payment_method NOT IN ('CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER');

    IF unprinted > 0 THEN
        RAISE EXCEPTION 'Backfill 000024 gagal: % transaksi masih tanpa receipt_printed_at.', unprinted;
    END IF;

    -- Transaksi tanpa tender hanya boleh sebanyak yang memang sengaja dilewati.
    IF no_tender > (zero_amount + bad_method) THEN
        RAISE EXCEPTION
            'Backfill 000024 gagal: % transaksi tanpa baris tender, padahal hanya % yang layak dilewati '
            '(% bernilai <= 0, % bermetode di luar kontrak).',
            no_tender, zero_amount + bad_method, zero_amount, bad_method;
    END IF;

    IF zero_amount > 0 OR bad_method > 0 THEN
        RAISE NOTICE
            'Backfill 000024: % transaksi dilewati (nilai <= 0) dan % dilewati (metode di luar kontrak). '
            'Keduanya adalah data v1 yang memang sudah bermasalah dan perlu ditinjau manual.',
            zero_amount, bad_method;
    END IF;

    IF no_code > 0 THEN
        RAISE NOTICE
            'Backfill 000024: % transaksi tanpa short_code akibat tabrakan kode. '
            'Baris tersebut tetap dapat dicari lewat UUID penuh.', no_code;
    END IF;
END $$;
