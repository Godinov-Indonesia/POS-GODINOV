CREATE TABLE restock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id VARCHAR(6) NOT NULL,
    raw_material_id UUID NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    cost_per_unit DECIMAL(12, 4) NOT NULL,
    total_cost DECIMAL(12, 4) NOT NULL,
    supplier_name VARCHAR(255),
    recorded_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_restock_outlet FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    CONSTRAINT fk_restock_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
);
