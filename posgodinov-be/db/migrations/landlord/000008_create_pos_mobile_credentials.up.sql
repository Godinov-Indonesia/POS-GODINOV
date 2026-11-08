-- 8. Kredensial POS Mobile (Kode acak verifikasi aplikasi POS Mobile / Handheld / Kiosk)
CREATE TABLE IF NOT EXISTS pos_mobile_credentials (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(64) NOT NULL UNIQUE,
    label         VARCHAR(150) NOT NULL,
    notes         TEXT,
    business_id   VARCHAR(8) REFERENCES businesses(id) ON DELETE SET NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    usage_count   INT NOT NULL DEFAULT 0,
    max_usage     INT NOT NULL DEFAULT 0, -- 0 = Unlimited
    last_used_at  TIMESTAMP WITH TIME ZONE,
    expires_at    TIMESTAMP WITH TIME ZONE,
    created_by    UUID REFERENCES landlord_users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pos_mobile_credentials_code ON pos_mobile_credentials(code);
CREATE INDEX IF NOT EXISTS idx_pos_mobile_credentials_is_active ON pos_mobile_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_pos_mobile_credentials_business_id ON pos_mobile_credentials(business_id);
