UPDATE subscriptions SET plan_id = 'plan_pro_monthly' WHERE plan_id = 'plan_pro_yearly';
UPDATE subscriptions SET plan_id = 'plan_enterprise' WHERE plan_id = 'plan_enterprise_yearly';

DELETE FROM plans WHERE id IN ('plan_pro_yearly', 'plan_enterprise_yearly');

ALTER TABLE plans DROP CONSTRAINT IF EXISTS uq_plans_code_cycle;
ALTER TABLE plans ADD CONSTRAINT plans_code_key UNIQUE (code);
