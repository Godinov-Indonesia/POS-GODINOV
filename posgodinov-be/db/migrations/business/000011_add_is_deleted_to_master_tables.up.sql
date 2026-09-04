ALTER TABLE outlets ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE raw_materials ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE product_categories ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT false;
