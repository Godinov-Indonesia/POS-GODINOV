-- ════════════════════════════════════════════════════════════════════════════
--
--   ⚠️  ROLLBACK INI MENGEMBALIKAN KOLOM, BUKAN DATA.
--
--   Ini bukan peringatan formalitas. `DROP COLUMN` di PostgreSQL membuang
--   nilainya; tidak ada apa pun di dalam berkas ini yang dapat memulihkannya.
--   Setelah `down` dijalankan, ketiga kolom kembali ada dan SELURUHNYA berisi
--   nilai bawaan:
--
--     shifts.expected_balance    → 0      (bukan selisih kas historis)
--     shifts.discrepancy         → 0      (bukan selisih kas historis)
--     transactions.cancel_notes  → ''     (bukan alasan pembatalan v1)
--
--   Satu-satunya cara memulihkan NILAINYA adalah restore basis data penuh dari
--   cadangan sebelum 000025 dijalankan.
--
-- ════════════════════════════════════════════════════════════════════════════
--
-- M18.4 · Rollback pembersihan kolom warisan v1 ([11 §M18.4])
--
-- ── KAPAN INI BERGUNA ───────────────────────────────────────────────────────
--
--   Hanya satu kasus: `migrate up` sudah menghapus kolomnya, lalu ternyata ada
--   kode yang masih membacanya dan aplikasi mulai gagal dengan
--   `column ... does not exist`.
--
--   Berkas ini menghentikan pendarahan — aplikasi berjalan lagi — sambil
--   menunggu keputusan apakah akan restore penuh demi memulihkan datanya.
--
-- ── YANG HARUS DILAKUKAN SETELAHNYA ─────────────────────────────────────────
--
--   1. Putuskan apakah data historisnya dibutuhkan. Bila ya → restore penuh;
--      berkas ini TIDAK cukup.
--   2. Perbaiki kode yang masih membaca kolom v1 sebelum mencoba 000025 lagi.
--   3. Setel ulang penanda pengaman menjadi `false` supaya `up` tidak berjalan
--      tanpa sengaja untuk kedua kalinya:
--
--        UPDATE app_flags SET value = 'false'
--        WHERE key = 'pos_contract_v1_retired';
--
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Tipe dan DEFAULT dikembalikan PERSIS seperti skema v1, supaya kode lama yang
-- menulisnya tidak menemui kejutan kedua. Lihat migrasi 000021 untuk asalnya.
ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS expected_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discrepancy      DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS cancel_notes TEXT NOT NULL DEFAULT '';

-- Menandai dengan jujur bahwa isinya BUKAN data historis. Tanpa komentar ini,
-- laporan pemilik akan menampilkan "selisih kas Rp 0" untuk setiap shift lampau
-- dan tidak ada yang tahu bahwa angka itu artefak rollback, bukan kenyataan.
COMMENT ON COLUMN shifts.expected_balance IS
    'DIPULIHKAN oleh rollback 000025 — nilainya NOL, bukan data historis. '
    'Data sesungguhnya hanya dapat dipulihkan lewat restore basis data penuh.';
COMMENT ON COLUMN shifts.discrepancy IS
    'DIPULIHKAN oleh rollback 000025 — nilainya NOL, bukan data historis.';
COMMENT ON COLUMN transactions.cancel_notes IS
    'DIPULIHKAN oleh rollback 000025 — nilainya KOSONG, bukan data historis. '
    'Alasan pembatalan v2 ada di void_logs.reason_notes.';

COMMIT;
