-- Migrasi #18 & #25: Indeks SaaS/Landlord & pelacakan pemakaian cloud storage
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_gateway_ref ON subscription_invoices(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires ON subscriptions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status ON subscriptions(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_landlord_audit_logs_created_at ON landlord_audit_logs(created_at DESC);
