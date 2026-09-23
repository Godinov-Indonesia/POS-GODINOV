ALTER TABLE stock_opnames 
ADD COLUMN input_type VARCHAR(50) DEFAULT 'base_unit',
ADD COLUMN system_package_quantity FLOAT DEFAULT 0,
ADD COLUMN actual_package_quantity FLOAT DEFAULT 0,
ADD COLUMN difference_value FLOAT DEFAULT 0,
ADD COLUMN notes TEXT;
