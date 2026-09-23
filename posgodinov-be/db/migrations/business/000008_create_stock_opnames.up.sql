CREATE TABLE stock_opnames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id VARCHAR(6) NOT NULL,
    raw_material_id UUID NOT NULL,
    system_stock DECIMAL(12, 4) NOT NULL,
    actual_stock DECIMAL(12, 4) NOT NULL,
    difference DECIMAL(12, 4) NOT NULL,
    fraud_flag BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_opname_outlet FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    CONSTRAINT fk_opname_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
);
