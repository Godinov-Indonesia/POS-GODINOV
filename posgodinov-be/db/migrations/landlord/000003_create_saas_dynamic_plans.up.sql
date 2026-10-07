-- 1. Pengguna Khusus Landlord (Internal Godinov Team)
CREATE TABLE landlord_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(30)  NOT NULL DEFAULT 'SUPPORT', -- 'SUPERADMIN', 'FINANCE', 'SUPPORT'
    is_active     BOOLEAN      DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Audit Log Landlord (Mencatat segala tindakan sensitif internal)
CREATE TABLE landlord_audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES landlord_users(id),
    action      VARCHAR(50) NOT NULL, -- 'SUSPEND_TENANT', 'IMPERSONATE', 'OVERRIDE_PLAN', 'RUN_MIGRATION'
    target_type VARCHAR(50) NOT NULL, -- 'BUSINESS', 'PLAN', 'SUBSCRIPTION'
    target_id   VARCHAR(100) NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Master Katalog Fitur Platform (Dynamic Feature Registry)
CREATE TABLE saas_features (
    key          VARCHAR(50) PRIMARY KEY, -- 'max_outlets', 'max_products', 'staff_transfer', dll.
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    category     VARCHAR(50) NOT NULL DEFAULT 'CORE', -- 'CORE', 'INVENTORY', 'STAFF', 'REPORTS', 'INTEGRATION'
    value_type   VARCHAR(20) NOT NULL,                -- 'NUMERIC_LIMIT' atau 'BOOLEAN_FLAG'
    unit         VARCHAR(30),                         -- 'Outlet', 'Produk', 'Staf', 'Hari', NULL
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Master Katalog Paket Langganan
CREATE TABLE plans (
    id            VARCHAR(32) PRIMARY KEY, -- 'plan_free', 'plan_pro_monthly', 'plan_enterprise'
    code          VARCHAR(50) NOT NULL UNIQUE, -- 'FREE', 'PRO', 'ENTERPRISE', 'PROMO_RAMADAN'
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    price_minor   BIGINT NOT NULL DEFAULT 0,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY', 'YEARLY', 'LIFETIME'
    is_public     BOOLEAN NOT NULL DEFAULT TRUE,          -- Apakah terlihat di katalog upgrade merchant
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Matriks Relasi Paket vs Fitur (Matrix Rules yang dikendalikan dari Dashboard)
CREATE TABLE plan_features (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id      VARCHAR(32) NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_key  VARCHAR(50) NOT NULL REFERENCES saas_features(key) ON DELETE CASCADE,
    is_enabled   BOOLEAN NOT NULL DEFAULT FALSE,       -- Nilai aktif jika value_type = 'BOOLEAN_FLAG'
    limit_value  BIGINT NOT NULL DEFAULT 0,            -- Angka batas jika value_type = 'NUMERIC_LIMIT' (-1 = Unlimited)
    extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,   -- Konfigurasi lanjutan jika dibutuhkan
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_plan_feature UNIQUE (plan_id, feature_key)
);

-- 6. Tabel Langganan Aktif Bisnis
CREATE TABLE subscriptions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id       VARCHAR(32) NOT NULL REFERENCES plans(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED'
    started_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP WITH TIME ZONE,              -- NULL = Lifetime (Free Tier)
    auto_renew    BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_business_subscription UNIQUE (business_id)
);

-- 7. Tabel Kustomisasi Khusus per Tenant (Add-ons & VIP Perks)
CREATE TABLE tenant_feature_overrides (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    feature_key   VARCHAR(50) NOT NULL REFERENCES saas_features(key) ON DELETE CASCADE,
    override_type VARCHAR(20) NOT NULL, -- 'ADD_LIMIT', 'SET_LIMIT', 'ENABLE_FLAG', 'DISABLE_FLAG'
    value_bool    BOOLEAN,
    value_numeric BIGINT,
    expires_at    TIMESTAMP WITH TIME ZONE, -- NULL = Selamanya selama tenant aktif
    reason        TEXT,
    created_by    UUID REFERENCES landlord_users(id),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabel Log Riwayat Mutasi Paket
CREATE TABLE subscription_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    business_id     VARCHAR(8) NOT NULL,
    event           VARCHAR(50) NOT NULL, -- 'PROVISIONED', 'UPGRADED', 'DOWNGRADED', 'RENEWED', 'OVERRIDE_ADDED'
    from_plan_id    VARCHAR(32),
    to_plan_id      VARCHAR(32) NOT NULL,
    remarks         TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Master Kampanye Iklan In-App Native (Anti-AdBlock Native Promo Engine)
CREATE TABLE saas_campaigns (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                VARCHAR(150) NOT NULL,
    subtitle             TEXT,
    format               VARCHAR(30) NOT NULL, -- 'POPUP_MODAL', 'CAROUSEL_SLIDE', 'HEADER_BANNER'
    placement            VARCHAR(50) NOT NULL DEFAULT 'DASHBOARD_HOME', -- 'DASHBOARD_HOME', 'REPORTS_PAGE', 'ON_LOGIN'
    image_url            TEXT NOT NULL,
    action_type          VARCHAR(30) NOT NULL DEFAULT 'INTERNAL_UPGRADE', -- 'INTERNAL_UPGRADE', 'EXTERNAL_URL', 'INFO_ONLY'
    action_url           TEXT,
    action_label         VARCHAR(50) NOT NULL DEFAULT 'Tingkatkan Sekarang',
    target_tier          VARCHAR(20) NOT NULL DEFAULT 'FREE_ONLY', -- 'FREE_ONLY', 'ALL'
    priority             INT NOT NULL DEFAULT 0,
    skip_delay_seconds   INT NOT NULL DEFAULT 5,
    starts_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at              TIMESTAMP WITH TIME ZONE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    impression_count     BIGINT DEFAULT 0,
    click_count          BIGINT DEFAULT 0,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Master Tagihan / Faktur Langganan (Invoices & Payment Records)
CREATE TABLE subscription_invoices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id        VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id    UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    invoice_number     VARCHAR(50) NOT NULL UNIQUE, -- 'INV-202610-00045'
    plan_id            VARCHAR(32) NOT NULL REFERENCES plans(id),
    billing_cycle      VARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY', 'YEARLY'
    amount_minor       BIGINT NOT NULL,                        -- Harga dasar
    tax_minor          BIGINT NOT NULL DEFAULT 0,              -- PPN 11%
    total_minor        BIGINT NOT NULL,                        -- Total tagihan
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED'
    payment_gateway    VARCHAR(30) NOT NULL,                   -- 'MIDTRANS', 'XENDIT', 'MANUAL_TRANSFER'
    gateway_reference  VARCHAR(100),                           -- ID order / transaksi dari PG
    payment_method     VARCHAR(50),                            -- 'QRIS', 'BCA_VA', 'MANDIRI_VA', 'CREDIT_CARD', 'MANUAL'
    payment_url        TEXT,                                   -- URL Snap / Invoice PG
    va_number          VARCHAR(50),
    qr_payload         TEXT,
    paid_at            TIMESTAMP WITH TIME ZONE,
    expired_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Master Kanal Pembayaran Terkelola Platform (Managed Payment Channels)
CREATE TABLE managed_payment_channels (
    code          VARCHAR(30) PRIMARY KEY, -- 'QRIS', 'BCA_VA', 'MANDIRI_VA', 'BRI_VA', 'BNI_VA'
    name          VARCHAR(100) NOT NULL,
    category      VARCHAR(20) NOT NULL,    -- 'QRIS', 'VIRTUAL_ACCOUNT', 'E_WALLET', 'CREDIT_CARD'
    provider      VARCHAR(50) NOT NULL,    -- 'INTERNAL_RAILS', 'MIDTRANS', 'XENDIT', 'DIRECT_BANK'
    fee_type      VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE', -- 'PERCENTAGE', 'FIXED'
    fee_value     NUMERIC(10,4) NOT NULL DEFAULT 0.0070,     -- misal 0.7% untuk QRIS
    min_amount    BIGINT NOT NULL DEFAULT 1000,
    max_amount    BIGINT NOT NULL DEFAULT 10000000,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Dompet Merchant untuk Penampungan Hasil Transaksi Kasir Nontunai
CREATE TABLE merchant_wallets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    balance_minor       BIGINT NOT NULL DEFAULT 0,      -- Saldo tersedia untuk dicairkan
    held_balance_minor  BIGINT NOT NULL DEFAULT 0,     -- Saldo tertahan / proses settlement
    payout_bank_code    VARCHAR(20),                   -- 'BCA', 'MANDIRI', 'BRI', 'BNI'
    payout_account_no   VARCHAR(50),
    payout_account_name VARCHAR(100),
    is_frozen           BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_business_wallet UNIQUE (business_id)
);

-- 13. Buku Besar Mutasi Saldo Dompet Merchant (Wallet Ledger)
CREATE TABLE merchant_wallet_ledger (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id        UUID NOT NULL REFERENCES merchant_wallets(id) ON DELETE CASCADE,
    business_id      VARCHAR(8) NOT NULL,
    entry_type       VARCHAR(20) NOT NULL, -- 'CREDIT_SALE', 'DEBIT_PAYOUT', 'DEBIT_FEE', 'DEBIT_SUBSCRIPTION'
    amount_minor     BIGINT NOT NULL,
    fee_minor        BIGINT NOT NULL DEFAULT 0,
    balance_before   BIGINT NOT NULL,
    balance_after    BIGINT NOT NULL,
    reference_type   VARCHAR(30) NOT NULL, -- 'POS_ORDER', 'PAYOUT_REQUEST', 'SAAS_INVOICE'
    reference_id     VARCHAR(100) NOT NULL,
    description      TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Permintaan Pencairan Dana / Penarikan Merchant (Payout / Disbursement)
CREATE TABLE merchant_payout_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    payout_number    VARCHAR(50) NOT NULL UNIQUE, -- 'PO-202610-0012'
    amount_minor     BIGINT NOT NULL,
    disbursement_fee BIGINT NOT NULL DEFAULT 0,  -- Biaya transfer antar-bank
    net_amount_minor BIGINT NOT NULL,
    bank_code        VARCHAR(20) NOT NULL,
    account_number   VARCHAR(50) NOT NULL,
    account_name     VARCHAR(100) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'
    disbursement_ref VARCHAR(100),                            -- ID transfer dari payment rail / bank
    rejected_reason  TEXT,
    requested_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at     TIMESTAMP WITH TIME ZONE,
    processed_by     UUID REFERENCES landlord_users(id)
);

-- 15. Broadcast Pengumuman Sistem Global
CREATE TABLE system_announcements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(200) NOT NULL,
    message      TEXT NOT NULL,
    severity     VARCHAR(20) NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'CRITICAL'
    target_tier  VARCHAR(20) DEFAULT 'ALL',          -- 'ALL', 'FREE', 'PRO'
    is_active    BOOLEAN DEFAULT TRUE,
    starts_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Pengaturan Landing Page CMS
CREATE TABLE landing_page_settings (
    key          VARCHAR(100) PRIMARY KEY, -- 'company_contacts', 'social_links', 'trust_metrics', 'top_announcement'
    value        JSONB NOT NULL,
    description  TEXT,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by   UUID REFERENCES landlord_users(id)
);

-- 17. Banner Besar Hero & Promosi Landing Page
CREATE TABLE landing_hero_banners (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title              VARCHAR(150) NOT NULL,
    subtitle           TEXT,
    tagline            VARCHAR(50), -- "PROMO LAUNCHING V2"
    image_desktop_url  TEXT NOT NULL,
    image_mobile_url   TEXT,
    primary_cta_text   VARCHAR(50) DEFAULT 'Coba Gratis 14 Hari',
    primary_cta_url    TEXT DEFAULT '/register',
    secondary_cta_text VARCHAR(50) DEFAULT 'Lihat Demo Interaktif',
    secondary_cta_url  TEXT DEFAULT '#offline',
    starts_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at            TIMESTAMP WITH TIME ZONE,
    sort_order         INT NOT NULL DEFAULT 0,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Daftar FAQ Dinamis Landing Page
CREATE TABLE landing_faqs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    category   VARCHAR(50) DEFAULT 'UMUM', -- 'UMUM', 'KEAMANAN', 'TEKNIS', 'LANGGANAN'
    sort_order INT NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX idx_tenant_overrides_business ON tenant_feature_overrides(business_id);
CREATE INDEX idx_plan_features_lookup ON plan_features(plan_id, feature_key);
CREATE INDEX idx_saas_campaigns_active ON saas_campaigns(is_active, target_tier, placement);
CREATE INDEX idx_subscription_invoices_business ON subscription_invoices(business_id);
CREATE INDEX idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX idx_merchant_wallets_business ON merchant_wallets(business_id);
CREATE INDEX idx_merchant_wallet_ledger_wallet ON merchant_wallet_ledger(wallet_id);
CREATE INDEX idx_merchant_payout_requests_business ON merchant_payout_requests(business_id);
CREATE INDEX idx_merchant_payout_requests_status ON merchant_payout_requests(status);

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- 1. Default Superadmin (password: password123)
INSERT INTO landlord_users (id, name, email, password_hash, role, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'Godinov Superadmin', 'admin@godinov.id', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'SUPERADMIN', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 2. Master Fitur Platform
INSERT INTO saas_features (key, name, description, category, value_type, unit, sort_order) VALUES
('max_outlets', 'Maksimal Outlet', 'Jumlah maksimal cabang toko yang dapat didaftarkan', 'CORE', 'NUMERIC_LIMIT', 'Outlet', 1),
('max_products', 'Maksimal Produk', 'Batas maksimal katalog produk yang tersimpan', 'CORE', 'NUMERIC_LIMIT', 'Produk', 2),
('max_raw_materials', 'Maksimal Bahan Baku', 'Batas maksimal bahan baku inventori', 'INVENTORY', 'NUMERIC_LIMIT', 'Bahan', 3),
('max_staff_per_outlet', 'Maksimal Staf Kasir', 'Batas pengguna staf/kasir per outlet', 'STAFF', 'NUMERIC_LIMIT', 'Staf', 4),
('history_days_limit', 'Batas Riwayat Laporan', 'Rentang hari data transaksi dan log audit yang bisa diakses (-1 = unlimited)', 'REPORTS', 'NUMERIC_LIMIT', 'Hari', 5),
('cloud_storage_mb', 'Kapasitas Penyimpanan Gambar', 'Total kuota gambar WebP Cloudinary (-1 = unlimited)', 'CORE', 'NUMERIC_LIMIT', 'MB', 6),
('staff_transfer', 'Transfer Staf Antar Outlet', 'Izin mutasi staf kasir antar cabang', 'STAFF', 'BOOLEAN_FLAG', NULL, 7),
('export_reports', 'Ekspor Laporan Excel/CSV/PDF', 'Unduh berkas laporan keuangan dan audit', 'REPORTS', 'BOOLEAN_FLAG', NULL, 8),
('stock_opname_collaborative', 'Stock Opname Kolaboratif', 'Hitung stok fisik multi-staf serentak via mobile SO', 'INVENTORY', 'BOOLEAN_FLAG', NULL, 9),
('dual_stock_auto_unpack', 'Dual-Stock & Auto-Unpack', 'Pencatatan dus & eceran serta auto-unpack saat stok minus', 'INVENTORY', 'BOOLEAN_FLAG', NULL, 10),
('custom_branding', 'Kustomisasi Logo Struk & Nota', 'Kustomisasi logo outlet pada struk belanja', 'CORE', 'BOOLEAN_FLAG', NULL, 11),
('api_webhook_access', 'Akses REST API & Webhooks', 'Integrasi API langsung dengan sistem pihak ketiga', 'INTEGRATION', 'BOOLEAN_FLAG', NULL, 12),
('no_ads', 'Bebas Iklan (Ad-Free Experience)', 'Bebas dari iklan pop-up interstitial dan slide carousel promo', 'CORE', 'BOOLEAN_FLAG', NULL, 13)
ON CONFLICT (key) DO NOTHING;

-- 3. Paket Default
INSERT INTO plans (id, code, name, description, price_minor, billing_cycle, is_public, sort_order) VALUES
('plan_free', 'FREE', 'Free Tier (Starter)', 'Paket gratis permanen untuk UMKM rintisan 1 outlet', 0, 'LIFETIME', TRUE, 1),
('plan_pro_monthly', 'PRO', 'Pro Growth Monthly', 'Solusi lengkap bisnis berkembang multi-outlet & multi-staf', 14900000, 'MONTHLY', TRUE, 2),
('plan_enterprise', 'ENTERPRISE', 'Enterprise Unlimited', 'Solusi kustom untuk jaringan franchise dan chain store', 0, 'MONTHLY', FALSE, 3)
ON CONFLICT (id) DO NOTHING;

-- 4. Fitur Paket FREE
INSERT INTO plan_features (plan_id, feature_key, is_enabled, limit_value) VALUES
('plan_free', 'max_outlets', FALSE, 1),
('plan_free', 'max_products', FALSE, 50),
('plan_free', 'max_raw_materials', FALSE, 50),
('plan_free', 'max_staff_per_outlet', FALSE, 2),
('plan_free', 'history_days_limit', FALSE, 30),
('plan_free', 'cloud_storage_mb', FALSE, 100),
('plan_free', 'staff_transfer', FALSE, 0),
('plan_free', 'export_reports', FALSE, 0),
('plan_free', 'stock_opname_collaborative', FALSE, 0),
('plan_free', 'dual_stock_auto_unpack', TRUE, 0),
('plan_free', 'custom_branding', FALSE, 0),
('plan_free', 'api_webhook_access', FALSE, 0),
('plan_free', 'no_ads', FALSE, 0)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- 5. Fitur Paket PRO
INSERT INTO plan_features (plan_id, feature_key, is_enabled, limit_value) VALUES
('plan_pro_monthly', 'max_outlets', FALSE, 5),
('plan_pro_monthly', 'max_products', FALSE, -1),
('plan_pro_monthly', 'max_raw_materials', FALSE, -1),
('plan_pro_monthly', 'max_staff_per_outlet', FALSE, 10),
('plan_pro_monthly', 'history_days_limit', FALSE, -1),
('plan_pro_monthly', 'cloud_storage_mb', FALSE, 5000),
('plan_pro_monthly', 'staff_transfer', TRUE, 0),
('plan_pro_monthly', 'export_reports', TRUE, 0),
('plan_pro_monthly', 'stock_opname_collaborative', TRUE, 0),
('plan_pro_monthly', 'dual_stock_auto_unpack', TRUE, 0),
('plan_pro_monthly', 'custom_branding', TRUE, 0),
('plan_pro_monthly', 'api_webhook_access', FALSE, 0),
('plan_pro_monthly', 'no_ads', TRUE, 0)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- 6. Master Kanal Pembayaran
INSERT INTO managed_payment_channels (code, name, category, provider, fee_type, fee_value, min_amount, max_amount, is_active) VALUES
('QRIS', 'QRIS Dinamis (Semua E-Wallet & Bank)', 'QRIS', 'INTERNAL_RAILS', 'PERCENTAGE', 0.0070, 1000, 10000000, TRUE),
('BCA_VA', 'BCA Virtual Account', 'VIRTUAL_ACCOUNT', 'INTERNAL_RAILS', 'FIXED', 4000, 10000, 50000000, TRUE),
('MANDIRI_VA', 'Mandiri Virtual Account', 'VIRTUAL_ACCOUNT', 'INTERNAL_RAILS', 'FIXED', 4000, 10000, 50000000, TRUE),
('BRI_VA', 'BRI Virtual Account', 'VIRTUAL_ACCOUNT', 'INTERNAL_RAILS', 'FIXED', 4000, 10000, 50000000, TRUE),
('BNI_VA', 'BNI Virtual Account', 'VIRTUAL_ACCOUNT', 'INTERNAL_RAILS', 'FIXED', 4000, 10000, 50000000, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 7. Data Awal Landing Page Settings
INSERT INTO landing_page_settings (key, value, description) VALUES
('company_contacts', '{
    "whatsapp_sales": "6281234567890",
    "whatsapp_support": "6281234567891",
    "email_sales": "sales@godinov.id",
    "email_support": "support@godinov.id",
    "office_address": "Jakarta Selatan, DKI Jakarta, Indonesia",
    "office_hours": "Senin - Jumat: 09:00 - 18:00 WIB"
}'::jsonb, 'Kontak resmi operasional dan customer service'),
('social_links', '{
    "instagram": "https://instagram.com/godinov.pos",
    "tiktok": "https://tiktok.com/@godinov.pos",
    "linkedin": "https://linkedin.com/company/godinov",
    "youtube": "https://youtube.com/@godinov"
}'::jsonb, 'Tautan akun media sosial resmi'),
('trust_metrics', '{
    "total_transactions": "1.5jt+",
    "sync_success_rate": "99.9%",
    "data_loss_rate": "0 Kasus",
    "active_outlets": "500+ Cabang"
}'::jsonb, 'Angka statistik pencapaian di Trust Bar'),
('top_announcement', '{
    "is_active": true,
    "text": "🎉 Promo Launching V2: Dapatkan diskon 50% untuk 3 bulan pertama!",
    "link_url": "#harga"
}'::jsonb, 'Banner pengumuman bar atas landing page')
ON CONFLICT (key) DO NOTHING;
