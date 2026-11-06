DROP INDEX IF EXISTS idx_landlord_audit_logs_created_at;
DROP INDEX IF EXISTS idx_subscriptions_plan_status;
DROP INDEX IF EXISTS idx_subscriptions_status_expires;
DROP INDEX IF EXISTS idx_subscription_invoices_gateway_ref;

ALTER TABLE businesses DROP COLUMN IF EXISTS storage_used_bytes;
