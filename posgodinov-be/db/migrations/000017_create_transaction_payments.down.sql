ALTER TABLE transactions
    DROP COLUMN IF EXISTS primary_card_last4,
    DROP COLUMN IF EXISTS primary_trace_number,
    DROP COLUMN IF EXISTS noncash_amount,
    DROP COLUMN IF EXISTS cash_amount,
    DROP COLUMN IF EXISTS tender_count;

DROP TABLE IF EXISTS transaction_payments;
