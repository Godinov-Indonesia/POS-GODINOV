CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id VARCHAR(6) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_category_outlet FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE
);

ALTER TABLE products 
ADD COLUMN category_id UUID,
ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;
