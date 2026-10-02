-- ============================================================================
-- 000029 · Revert Foreign Key & Performance Indexing
-- ============================================================================

DROP INDEX IF EXISTS idx_transactions_outlet_created;
DROP INDEX IF EXISTS idx_transactions_business_created;
DROP INDEX IF EXISTS idx_transactions_status;
DROP INDEX IF EXISTS idx_transactions_outlet_status_created;
DROP INDEX IF EXISTS idx_transaction_items_transaction;
DROP INDEX IF EXISTS idx_transaction_items_product;

DROP INDEX IF EXISTS idx_shifts_outlet_created;
DROP INDEX IF EXISTS idx_shifts_business_created;
DROP INDEX IF EXISTS idx_shifts_business_status;
DROP INDEX IF EXISTS idx_shifts_outlet_status;
DROP INDEX IF EXISTS idx_shifts_staff;

DROP INDEX IF EXISTS idx_opname_sessions_business;
DROP INDEX IF EXISTS idx_opname_sessions_recount;
DROP INDEX IF EXISTS idx_opname_session_items_material;
DROP INDEX IF EXISTS idx_opname_count_entries_material;
DROP INDEX IF EXISTS idx_opname_count_entries_counted_by;
DROP INDEX IF EXISTS idx_stock_opnames_outlet_created;
DROP INDEX IF EXISTS idx_stock_opnames_material;

DROP INDEX IF EXISTS idx_products_outlet;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_product_categories_outlet;
DROP INDEX IF EXISTS idx_raw_materials_outlet;
DROP INDEX IF EXISTS idx_users_outlet;
DROP INDEX IF EXISTS idx_outlets_business;

DROP INDEX IF EXISTS idx_product_recipes_product;
DROP INDEX IF EXISTS idx_product_recipes_material;
DROP INDEX IF EXISTS idx_waste_logs_outlet_created;
DROP INDEX IF EXISTS idx_waste_logs_material;
DROP INDEX IF EXISTS idx_restock_logs_outlet_created;
DROP INDEX IF EXISTS idx_restock_logs_material;
DROP INDEX IF EXISTS idx_product_wastes_outlet_created;
DROP INDEX IF EXISTS idx_product_wastes_product;

DROP INDEX IF EXISTS idx_audit_logs_actor_created;
DROP INDEX IF EXISTS idx_returns_outlet_created;
