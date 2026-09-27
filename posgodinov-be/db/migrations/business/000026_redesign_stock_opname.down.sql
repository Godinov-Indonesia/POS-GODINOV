-- Rollback: Redesign Stock Opname

-- Revert status data
UPDATE opname_sessions SET status = 'DRAFT' WHERE status IN ('OPEN', 'PUBLISHED', 'COUNTING');
UPDATE opname_sessions SET status = 'LOCKED', locked_at = closed_at WHERE status = 'CLOSED';

-- Drop new tables
DROP TABLE IF EXISTS opname_count_entries;
DROP TABLE IF EXISTS opname_form_items;

-- Revert constraint
ALTER TABLE opname_sessions DROP CONSTRAINT IF EXISTS ck_opname_status;
ALTER TABLE opname_sessions ADD CONSTRAINT ck_opname_status
    CHECK (status IN ('DRAFT', 'LOCKED', 'APPROVED', 'REJECTED'));

ALTER TABLE opname_sessions ADD CONSTRAINT ck_opname_locked_ts CHECK (
    (status = 'DRAFT' AND locked_at IS NULL) OR
    (status <> 'DRAFT' AND locked_at IS NOT NULL)
);

-- Drop new columns
ALTER TABLE opname_sessions
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS closed_by,
    DROP COLUMN IF EXISTS closed_at,
    DROP COLUMN IF EXISTS published_at,
    DROP COLUMN IF EXISTS recount_of,
    DROP COLUMN IF EXISTS recount_number;
