DROP TABLE IF EXISTS users;

-- =========================================================================
-- 1. TABEL BUSINESSES (Owner Pusat)
-- =========================================================================
CREATE TABLE businesses (
    id              VARCHAR(8)   PRIMARY KEY,
    serial_business VARCHAR(100) NOT NULL UNIQUE, -- Auto-generate: 3 char name + 2 char owner + dd-mm-yy
    email           VARCHAR(255) NOT NULL UNIQUE, -- Login akun owner pusat
    password        VARCHAR(255) NOT NULL,
    name            VARCHAR(150) NOT NULL,
    owner_name      VARCHAR(100),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. TABEL OUTLETS (Cabang Toko)
-- =========================================================================
CREATE TABLE outlets (
    id            VARCHAR(6)   PRIMARY KEY,        -- 6 Digit Kode Unik (misal: 'TEN999')
    business_id   VARCHAR(8)   NOT NULL,           -- Terhubung ke tabel businesses
    serial_tenant VARCHAR(10)  NOT NULL UNIQUE,    -- Auto-generate: 5 digit serial_business + 3 digit nomor unik
    name          VARCHAR(150) NOT NULL,           -- Nama Cabang Toko
    address       TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Relasi
    CONSTRAINT fk_outlets_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- =========================================================================
-- 3. TABEL USERS (Staff / Kasir)
-- =========================================================================
CREATE TABLE users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(), -- ID internal sistem
    outlet_id        VARCHAR(6)   NOT NULL,                              -- Terhubung ke tabel outlets
    staff_identifier VARCHAR(50)  NOT NULL,                              -- ID/Username Kasir untuk login 
    name             VARCHAR(100) NOT NULL,                              -- Nama lengkap kasir
    pin_hash         VARCHAR(255) NOT NULL,                              -- PIN (4-6 angka) terenkripsi Bcrypt
    role             VARCHAR(20)  NOT NULL DEFAULT 'CASHIER',
    is_active        BOOLEAN      DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Relasi
    CONSTRAINT fk_users_outlet FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    
    -- Memastikan staff_identifier (username kasir) tidak kembar dalam satu outlet yang sama
    CONSTRAINT uq_outlet_staff UNIQUE (outlet_id, staff_identifier)
);
