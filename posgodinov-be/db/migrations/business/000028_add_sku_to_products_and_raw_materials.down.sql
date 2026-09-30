DROP INDEX IF EXISTS idx_raw_materials_outlet_sku;
DROP INDEX IF EXISTS idx_products_outlet_sku;

ALTER TABLE raw_materials DROP COLUMN IF EXISTS sku;
ALTER TABLE products DROP COLUMN IF EXISTS sku;
