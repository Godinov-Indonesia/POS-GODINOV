ALTER TABLE shifts DROP CONSTRAINT IF EXISTS ck_shift_master_version;

DROP INDEX IF EXISTS uq_shift_open_per_staff;
DROP INDEX IF EXISTS uq_shift_open_per_device;

ALTER TABLE shifts
    DROP COLUMN IF EXISTS device_id,
    DROP COLUMN IF EXISTS master_data_version,
    DROP COLUMN IF EXISTS closed_by,
    DROP COLUMN IF EXISTS blind_close,
    DROP COLUMN IF EXISTS reconciled_at,
    DROP COLUMN IF EXISTS qris_variance,
    DROP COLUMN IF EXISTS edc_variance,
    DROP COLUMN IF EXISTS cash_variance,
    DROP COLUMN IF EXISTS expected_qris_total,
    DROP COLUMN IF EXISTS expected_edc_total,
    DROP COLUMN IF EXISTS expected_cash,
    DROP COLUMN IF EXISTS declared_qris_total,
    DROP COLUMN IF EXISTS declared_edc_total,
    DROP COLUMN IF EXISTS declared_cash;
