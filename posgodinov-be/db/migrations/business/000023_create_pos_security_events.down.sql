ALTER TABLE product_wastes
    DROP COLUMN IF EXISTS reason_code,
    DROP COLUMN IF EXISTS device_id,
    DROP COLUMN IF EXISTS shift_id,
    DROP COLUMN IF EXISTS printed_at,
    DROP COLUMN IF EXISTS receipt_printed;

ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_staff_role;
ALTER TABLE users DROP COLUMN IF EXISTS permissions;

DROP TABLE IF EXISTS pos_security_events;
