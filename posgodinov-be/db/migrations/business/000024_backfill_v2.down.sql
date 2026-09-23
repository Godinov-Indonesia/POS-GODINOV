-- Membalik backfill: hanya menyentuh baris yang memang DIBUAT oleh 000024.
--
-- Kolomnya sendiri dihapus oleh down-migration 000017/000018/000021, sehingga
-- berkas ini cukup membersihkan baris tender hasil rekonstruksi agar
-- `migrate down` lalu `migrate up` menghasilkan keadaan yang sama.
DELETE FROM transaction_payments WHERE is_reconstructed;

UPDATE transactions
SET    short_code         = NULL,
       receipt_printed_at = NULL,
       tender_count       = 1,
       cash_amount        = 0,
       noncash_amount     = 0;

UPDATE shifts
SET    declared_cash = 0,
       expected_cash = NULL,
       cash_variance = NULL;
