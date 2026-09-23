DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS outlets;

CREATE TABLE outlets (
    id            VARCHAR(6)   PRIMARY KEY,
    business_id   VARCHAR(8)   NOT NULL,
    serial_outlet VARCHAR(10)  NOT NULL UNIQUE,
    name          VARCHAR(150) NOT NULL,
    address       TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id        VARCHAR(6)   NOT NULL,
    staff_identifier VARCHAR(50)  NOT NULL,
    name             VARCHAR(100) NOT NULL,
    pin_hash         VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL DEFAULT 'CASHIER',
    is_active        BOOLEAN      DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_outlet FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    CONSTRAINT uq_outlet_staff UNIQUE (outlet_id, staff_identifier)
);
