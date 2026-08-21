DROP INDEX IF EXISTS idx_txn_shift_created;
DROP INDEX IF EXISTS uq_txn_short_code;

ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS ck_void_requires_unprinted,
    DROP CONSTRAINT IF EXISTS ck_txn_return_state,
    DROP CONSTRAINT IF EXISTS ck_txn_status;

ALTER TABLE transactions
    DROP COLUMN IF EXISTS void_reason_code,
    DROP COLUMN IF EXISTS voided_by,
    DROP COLUMN IF EXISTS voided_at,
    DROP COLUMN IF EXISTS device_id,
    DROP COLUMN IF EXISTS return_state,
    DROP COLUMN IF EXISTS short_code,
    DROP COLUMN IF EXISTS reprint_count,
    DROP COLUMN IF EXISTS receipt_printed_at;
