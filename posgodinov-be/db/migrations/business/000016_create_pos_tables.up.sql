CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY,
    outlet_id VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id VARCHAR(8) NOT NULL,
    staff_id UUID NOT NULL REFERENCES users(id),
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    expected_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    discrepancy DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    client_opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    client_closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    shift_id UUID NOT NULL REFERENCES shifts(id),
    outlet_id VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id VARCHAR(8) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    cancel_notes TEXT,
    client_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS product_wastes (
    id UUID PRIMARY KEY,
    outlet_id VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id VARCHAR(8) NOT NULL,
    staff_id UUID NOT NULL REFERENCES users(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    reason TEXT NOT NULL,
    client_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
