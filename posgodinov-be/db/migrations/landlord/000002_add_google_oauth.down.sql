ALTER TABLE businesses
    DROP COLUMN IF EXISTS google_id,
    ALTER COLUMN password SET NOT NULL;
