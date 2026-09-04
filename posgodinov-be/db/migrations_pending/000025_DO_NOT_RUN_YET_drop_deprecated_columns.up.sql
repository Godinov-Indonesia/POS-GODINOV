-- ════════════════════════════════════════════════════════════════════════════
--
--   ⛔⛔⛔  J A N G A N   J A L A N K A N   M I G R A S I   I N I  ⛔⛔⛔
--
--   Berkas ini SENGAJA diberi nama `DO_NOT_RUN_YET`. Nama itu adalah bagian
--   dari pengamanannya, bukan hiasan: `migrate up` menjalankan SELURUH berkas
--   yang belum diterapkan tanpa bertanya, dan satu-satunya hal yang membuat
--   seseorang berhenti adalah membaca namanya di daftar.
--
--   ⚠️  JANGAN mengubah nama berkas ini menjadi `000025_drop_deprecated_columns`
--       sampai SELURUH gerbang di bawah terpenuhi. Mengganti namanya adalah
--       tindakan yang HARUS disengaja, ditinjau, dan disetujui — persis
--       sebagaimana `DROP COLUMN` seharusnya.
--
-- ════════════════════════════════════════════════════════════════════════════
--
-- M18.4 · Pembersihan kolom warisan v1 ([11 §M18.4])
--
-- ── APA YANG DIHAPUS ────────────────────────────────────────────────────────
--
--   shifts.expected_balance     → digantikan `expected_cash`     (butir 9)
--   shifts.discrepancy          → digantikan `cash_variance`     (butir 9)
--   transactions.cancel_notes   → digantikan `void_logs.reason_notes` (butir 15)
--
-- ── MENGAPA PENGHAPUSAN INI TIDAK DAPAT DIBATALKAN ──────────────────────────
--
--   `DROP COLUMN` di PostgreSQL **membuang datanya**, bukan menyembunyikannya.
--   Berkas `.down.sql` pasangannya dapat mengembalikan KOLOMNYA, tetapi
--   nilainya kembali sebagai NULL/'' — seluruh riwayat selisih kas dan seluruh
--   catatan pembatalan v1 lenyap permanen.
--
--   Tidak ada endpoint, tidak ada cadangan aplikasi, dan tidak ada jalan lain
--   untuk memulihkannya selain restore basis data penuh.
--
-- ══════════════════════════════════════════════════════════════════════════
--   GERBANG WAJIB — kelimanya, tanpa kecuali
-- ══════════════════════════════════════════════════════════════════════════
--
--   [ ] 1. Kontrak v1 sudah resmi DICABUT (`426 UPGRADE_REQUIRED` aktif).
--          Jadwal rencana: ~6 minggu setelah rilis v2 ([11 §M18.2] Minggu 6).
--
--   [ ] 2. 100 % outlet berjalan pada klien v2 selama ≥ 30 hari berturut-turut.
--          Diverifikasi dari log header `X-POS-Contract-Version`, BUKAN dari
--          asumsi bahwa pembaruan sudah tersebar.
--
--   [ ] 3. Laporan pemilik dipastikan TIDAK lagi membaca ketiga kolom.
--          Jalankan audit di bawah dan pastikan hasilnya KOSONG:
--
--            grep -rn "expected_balance\|discrepancy\|cancel_notes" \
--              internal/ --include="*.go"
--
--          Catatan per 2026-08-21, ketiganya MASIH dipakai:
--            · internal/domain/pos_transaction.go  — Shift.ExpectedBalance,
--              Shift.Discrepancy, Transaction.CancelNotes (tag JSON aktif)
--            · internal/repository/shift_reconcile_repository.go — mengisi
--              ganda `expected_balance` & `discrepancy` selama jendela deprekasi
--            · internal/repository/pos_repository.go — menulis `cancel_notes`
--          Ketiga tempat itu HARUS dibersihkan lebih dulu; menjalankan migrasi
--          ini sebelum itu membuat setiap INSERT/UPDATE gagal dengan
--          `column ... does not exist` dan MENGHENTIKAN SINKRONISASI SELURUH
--          ARMADA.
--
--   [ ] 4. Cadangan basis data lengkap diambil DAN pemulihannya diuji pada
--          staging — bukan sekadar file cadangan yang ada.
--
--   [ ] 5. Dijalankan di dalam jendela pemeliharaan, bukan pada jam operasional.
--
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Pengaman waktu-jalan ────────────────────────────────────────────────────
--
-- Blok ini menggagalkan migrasi bila `pos_contract_v1_retired` belum disetel.
-- Ia BUKAN pengganti kelima gerbang di atas — ia hanya menangkap kasus paling
-- sering: seseorang menjalankan `migrate up` tanpa membaca apa pun.
--
-- Cara menonaktifkannya (SETELAH kelima gerbang terpenuhi):
--
--   INSERT INTO app_flags (key, value) VALUES ('pos_contract_v1_retired', 'true')
--   ON CONFLICT (key) DO UPDATE SET value = 'true';
CREATE TABLE IF NOT EXISTS app_flags (
    key   VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app_flags
        WHERE key = 'pos_contract_v1_retired' AND value = 'true'
    ) THEN
        RAISE EXCEPTION
            E'\n\n'
            '  ============================================================\n'
            '  MIGRASI 000025 DIHENTIKAN — INI BUKAN GALAT, INI PENGAMAN.\n'
            '  ============================================================\n\n'
            '  Migrasi ini menghapus kolom warisan v1 SECARA PERMANEN:\n'
            '    - shifts.expected_balance\n'
            '    - shifts.discrepancy\n'
            '    - transactions.cancel_notes\n\n'
            '  Ia hanya boleh dijalankan setelah kontrak v1 resmi dicabut\n'
            '  (~6 minggu setelah rilis v2) DAN seluruh gerbang di kepala\n'
            '  berkas ini terpenuhi.\n\n'
            '  Bila Anda memang bermaksud menjalankannya, setel penanda:\n'
            '    INSERT INTO app_flags (key, value)\n'
            '    VALUES (''pos_contract_v1_retired'', ''true'')\n'
            '    ON CONFLICT (key) DO UPDATE SET value = ''true'';\n\n'
            '  Baca dulu: docs/11-v2-implementation-plan.md - M18.4\n';
    END IF;
END $$;

-- ── Penghapusan ─────────────────────────────────────────────────────────────
--
-- `IF EXISTS` supaya migrasi tetap idempoten bila sebagian sudah terhapus
-- lewat jalur lain.

ALTER TABLE shifts
    DROP COLUMN IF EXISTS expected_balance,
    DROP COLUMN IF EXISTS discrepancy;

ALTER TABLE transactions
    DROP COLUMN IF EXISTS cancel_notes;

-- Jejak agar operator berikutnya tahu kapan dan mengapa kolomnya hilang.
COMMENT ON TABLE shifts IS
    'v2: angka kas ada di declared_*/expected_*/*_variance. Kolom v1 '
    'expected_balance & discrepancy dihapus migrasi 000025 setelah kontrak v1 '
    'dicabut.';
COMMENT ON TABLE transactions IS
    'v2: alasan pembatalan ada di void_logs.reason_notes. Kolom v1 cancel_notes '
    'dihapus migrasi 000025 setelah kontrak v1 dicabut.';

COMMIT;
