-- ============================================================================
-- M27 — Dual Stock: package_stock + loose_stock + generated unit_stock
--
-- package_stock : kemasan utuh (INTEGER)
-- loose_stock   : stok terbuka dalam base unit (DECIMAL)
-- unit_stock    : GENERATED ALWAYS AS (package_stock * COALESCE(quantity_per_package, 0) + loose_stock) STORED
-- ============================================================================

-- 1. Tambah kolom baru di raw_materials
ALTER TABLE raw_materials
    ADD COLUMN IF NOT EXISTS package_stock INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loose_stock   DECIMAL(12,4) NOT NULL DEFAULT 0;

-- 2. Backfill dari stock lama
UPDATE raw_materials SET
    package_stock = CASE
        WHEN quantity_per_package IS NOT NULL AND quantity_per_package > 0
        THEN FLOOR(stock / quantity_per_package)::INT
        ELSE 0
    END,
    loose_stock = CASE
        WHEN quantity_per_package IS NOT NULL AND quantity_per_package > 0
        THEN stock - (FLOOR(stock / quantity_per_package) * quantity_per_package)
        ELSE stock
    END;

-- 3. Ganti kolom stock dengan generated column unit_stock
ALTER TABLE raw_materials DROP COLUMN IF EXISTS stock;

ALTER TABLE raw_materials
    ADD COLUMN unit_stock DECIMAL(12,4) GENERATED ALWAYS AS (
        package_stock * COALESCE(quantity_per_package, 0) + loose_stock
    ) STORED;

-- 4. Modifikasi opname_count_entries: hapus input_type, ganti package field
ALTER TABLE opname_count_entries DROP COLUMN IF EXISTS input_type;
ALTER TABLE opname_count_entries DROP COLUMN IF EXISTS actual_package_quantity;
ALTER TABLE opname_count_entries
    ADD COLUMN IF NOT EXISTS actual_packages INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_loose    DECIMAL(12,4) NOT NULL DEFAULT 0;

-- 5. Modifikasi opname_session_items: hapus input_type, tambah dual fields
ALTER TABLE opname_session_items DROP COLUMN IF EXISTS input_type;
ALTER TABLE opname_session_items DROP COLUMN IF EXISTS actual_package_quantity;
ALTER TABLE opname_session_items DROP COLUMN IF EXISTS system_package_quantity;
ALTER TABLE opname_session_items
    ADD COLUMN IF NOT EXISTS actual_packages      INT,
    ADD COLUMN IF NOT EXISTS actual_loose         DECIMAL(12,4),
    ADD COLUMN IF NOT EXISTS system_package_stock INT,
    ADD COLUMN IF NOT EXISTS system_loose_stock   DECIMAL(12,4);
