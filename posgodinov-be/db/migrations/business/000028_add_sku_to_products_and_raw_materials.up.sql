-- Add nullable sku column to products and raw_materials
ALTER TABLE products 
    ADD COLUMN sku VARCHAR(100) NULL;

ALTER TABLE raw_materials 
    ADD COLUMN sku VARCHAR(100) NULL;

-- Create partial unique indexes per outlet for active items
CREATE UNIQUE INDEX idx_products_outlet_sku 
    ON products (outlet_id, sku) 
    WHERE sku IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX idx_raw_materials_outlet_sku 
    ON raw_materials (outlet_id, sku) 
    WHERE sku IS NOT NULL AND is_deleted = false;
