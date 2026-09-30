ALTER TABLE opname_session_items DROP COLUMN IF EXISTS system_loose_stock;
ALTER TABLE opname_session_items DROP COLUMN IF EXISTS system_package_stock;
ALTER TABLE opname_session_items DROP COLUMN IF EXISTS actual_loose;
ALTER TABLE opname_session_items DROP COLUMN IF EXISTS actual_packages;
ALTER TABLE opname_session_items ADD COLUMN IF NOT EXISTS system_package_quantity DOUBLE PRECISION;
ALTER TABLE opname_session_items ADD COLUMN IF NOT EXISTS actual_package_quantity DOUBLE PRECISION;
ALTER TABLE opname_session_items ADD COLUMN IF NOT EXISTS input_type VARCHAR(50) NOT NULL DEFAULT 'base_unit';

ALTER TABLE opname_count_entries DROP COLUMN IF EXISTS actual_loose;
ALTER TABLE opname_count_entries DROP COLUMN IF EXISTS actual_packages;
ALTER TABLE opname_count_entries ADD COLUMN IF NOT EXISTS actual_package_quantity FLOAT;
ALTER TABLE opname_count_entries ADD COLUMN IF NOT EXISTS input_type VARCHAR(50) NOT NULL DEFAULT 'base_unit';

ALTER TABLE raw_materials DROP COLUMN IF EXISTS unit_stock;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS stock DECIMAL(12,4) NOT NULL DEFAULT 0;
UPDATE raw_materials SET stock = package_stock * COALESCE(quantity_per_package, 0) + loose_stock;
ALTER TABLE raw_materials DROP COLUMN IF EXISTS package_stock;
ALTER TABLE raw_materials DROP COLUMN IF EXISTS loose_stock;
