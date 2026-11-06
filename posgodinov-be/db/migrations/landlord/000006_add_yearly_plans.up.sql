-- Migrasi #000006: Paket Tahunan (YEARLY) & Matriks Fitur Enterprise
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_code_key;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS uq_plans_code_cycle;
ALTER TABLE plans ADD CONSTRAINT uq_plans_code_cycle UNIQUE (code, billing_cycle);

-- Pastikan plan_enterprise tampil di katalog publik & urutan rapi
UPDATE plans
SET is_public = TRUE, sort_order = 4, name = 'Enterprise Unlimited Monthly'
WHERE id = 'plan_enterprise';

-- Tambah varian paket tahunan (YEARLY)
INSERT INTO plans (id, code, name, description, price_minor, billing_cycle, is_public, is_active, sort_order) VALUES
('plan_pro_yearly', 'PRO', 'Pro Growth Yearly', 'Solusi lengkap bisnis berkembang multi-outlet & multi-staf (Hemat 2 Bulan)', 149000000, 'YEARLY', TRUE, TRUE, 3),
('plan_enterprise_yearly', 'ENTERPRISE', 'Enterprise Unlimited Yearly', 'Solusi kustom tahunan untuk jaringan franchise dan chain store', 0, 'YEARLY', TRUE, TRUE, 5)
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_minor = EXCLUDED.price_minor,
    billing_cycle = EXCLUDED.billing_cycle,
    is_public = EXCLUDED.is_public,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- Fitur Paket PRO YEARLY (identik dengan PRO MONTHLY)
INSERT INTO plan_features (plan_id, feature_key, is_enabled, limit_value) VALUES
('plan_pro_yearly', 'max_outlets', FALSE, 5),
('plan_pro_yearly', 'max_products', FALSE, -1),
('plan_pro_yearly', 'max_raw_materials', FALSE, -1),
('plan_pro_yearly', 'max_staff_per_outlet', FALSE, 10),
('plan_pro_yearly', 'history_days_limit', FALSE, -1),
('plan_pro_yearly', 'cloud_storage_mb', FALSE, 5000),
('plan_pro_yearly', 'staff_transfer', TRUE, 0),
('plan_pro_yearly', 'export_reports', TRUE, 0),
('plan_pro_yearly', 'stock_opname_collaborative', TRUE, 0),
('plan_pro_yearly', 'dual_stock_auto_unpack', TRUE, 0),
('plan_pro_yearly', 'custom_branding', TRUE, 0),
('plan_pro_yearly', 'api_webhook_access', FALSE, 0),
('plan_pro_yearly', 'no_ads', TRUE, 0)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Fitur Paket ENTERPRISE MONTHLY (Unlimited & Semua Fitur Aktif)
INSERT INTO plan_features (plan_id, feature_key, is_enabled, limit_value) VALUES
('plan_enterprise', 'max_outlets', FALSE, -1),
('plan_enterprise', 'max_products', FALSE, -1),
('plan_enterprise', 'max_raw_materials', FALSE, -1),
('plan_enterprise', 'max_staff_per_outlet', FALSE, -1),
('plan_enterprise', 'history_days_limit', FALSE, -1),
('plan_enterprise', 'cloud_storage_mb', FALSE, -1),
('plan_enterprise', 'staff_transfer', TRUE, 0),
('plan_enterprise', 'export_reports', TRUE, 0),
('plan_enterprise', 'stock_opname_collaborative', TRUE, 0),
('plan_enterprise', 'dual_stock_auto_unpack', TRUE, 0),
('plan_enterprise', 'custom_branding', TRUE, 0),
('plan_enterprise', 'api_webhook_access', TRUE, 0),
('plan_enterprise', 'no_ads', TRUE, 0)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Fitur Paket ENTERPRISE YEARLY (Unlimited & Semua Fitur Aktif)
INSERT INTO plan_features (plan_id, feature_key, is_enabled, limit_value) VALUES
('plan_enterprise_yearly', 'max_outlets', FALSE, -1),
('plan_enterprise_yearly', 'max_products', FALSE, -1),
('plan_enterprise_yearly', 'max_raw_materials', FALSE, -1),
('plan_enterprise_yearly', 'max_staff_per_outlet', FALSE, -1),
('plan_enterprise_yearly', 'history_days_limit', FALSE, -1),
('plan_enterprise_yearly', 'cloud_storage_mb', FALSE, -1),
('plan_enterprise_yearly', 'staff_transfer', TRUE, 0),
('plan_enterprise_yearly', 'export_reports', TRUE, 0),
('plan_enterprise_yearly', 'stock_opname_collaborative', TRUE, 0),
('plan_enterprise_yearly', 'dual_stock_auto_unpack', TRUE, 0),
('plan_enterprise_yearly', 'custom_branding', TRUE, 0),
('plan_enterprise_yearly', 'api_webhook_access', TRUE, 0),
('plan_enterprise_yearly', 'no_ads', TRUE, 0)
ON CONFLICT (plan_id, feature_key) DO NOTHING;
