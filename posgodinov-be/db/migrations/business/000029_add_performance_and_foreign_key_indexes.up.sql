-- ============================================================================
-- 000029 · Foreign Key & Performance Indexing
--
-- Menambahkan indeks B-Tree eksplisit pada kolom foreign key, filter waktu,
-- dan filter status untuk mencegah sequential scan saat data transaksi
-- dan operasional bertumbuh besar.
-- ============================================================================

-- ── 1. Tabel Transaksi & Item Penjualan (Jalur Paling Kritis) ───────────────
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_created
    ON transactions (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_business_created
    ON transactions (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);

CREATE INDEX IF NOT EXISTS idx_transactions_outlet_status_created
    ON transactions (outlet_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction
    ON transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product
    ON transaction_items (product_id);

-- ── 2. Tabel Shift Kasir ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shifts_outlet_created
    ON shifts (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shifts_business_created
    ON shifts (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shifts_business_status
    ON shifts (business_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_outlet_status
    ON shifts (outlet_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_staff
    ON shifts (staff_id, created_at DESC);

-- ── 3. Tabel Stock Opname (Sesi & Lembar Hitungan Fisik) ─────────────────────
CREATE INDEX IF NOT EXISTS idx_opname_sessions_business
    ON opname_sessions (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opname_sessions_recount
    ON opname_sessions (recount_of)
    WHERE recount_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opname_session_items_material
    ON opname_session_items (raw_material_id);

CREATE INDEX IF NOT EXISTS idx_opname_count_entries_material
    ON opname_count_entries (raw_material_id);

CREATE INDEX IF NOT EXISTS idx_opname_count_entries_counted_by
    ON opname_count_entries (counted_by);

CREATE INDEX IF NOT EXISTS idx_stock_opnames_outlet_created
    ON stock_opnames (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_opnames_material
    ON stock_opnames (raw_material_id);

-- ── 4. Tabel Master Data & Katalog (Partial Index Data Aktif) ───────────────
CREATE INDEX IF NOT EXISTS idx_products_outlet
    ON products (outlet_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (category_id)
    WHERE category_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_product_categories_outlet
    ON product_categories (outlet_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_raw_materials_outlet
    ON raw_materials (outlet_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_users_outlet
    ON users (outlet_id)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_outlets_business
    ON outlets (business_id)
    WHERE is_deleted = false;

-- ── 5. Tabel Resep BOM & Mutasi Log Bahan Baku ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_recipes_product
    ON product_recipes (product_id);

CREATE INDEX IF NOT EXISTS idx_product_recipes_material
    ON product_recipes (raw_material_id);

CREATE INDEX IF NOT EXISTS idx_waste_logs_outlet_created
    ON waste_logs (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waste_logs_material
    ON waste_logs (raw_material_id);

CREATE INDEX IF NOT EXISTS idx_restock_logs_outlet_created
    ON restock_logs (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restock_logs_material
    ON restock_logs (raw_material_id);

CREATE INDEX IF NOT EXISTS idx_product_wastes_outlet_created
    ON product_wastes (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_wastes_product
    ON product_wastes (product_id);

-- ── 6. Tabel Audit & Retur ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
    ON audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_returns_outlet_created
    ON returns (outlet_id, created_at DESC);
