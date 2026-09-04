-- ============================================================================
-- M11.1 · butir 3, 4, 10 — Blind Opname & versi master data ([11 §3.2])
--
-- `stock_opnames` v1 menyimpan system_stock, actual_stock, dan difference dalam
-- SATU baris yang ditulis sekali — bentuk itu secara struktural mustahil
-- menyembunyikan ekspektasi, karena baris hanya lahir setelah semuanya
-- diketahui. v2 memecahnya menjadi sesi dua-fase.
--
-- `stock_opnames` TIDAK dihapus: saat sesi disetujui, service menulis satu baris
-- ke sana per item sebagai projection agar laporan pemilik tetap hidup.
-- ============================================================================

CREATE TABLE IF NOT EXISTS opname_sessions (
    id                UUID PRIMARY KEY,          -- UUID KLIEN (aturan R2)
    outlet_id         VARCHAR(6) NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    business_id       VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    device_id         VARCHAR(64) NOT NULL DEFAULT 'legacy',

    scope             VARCHAR(20) NOT NULL DEFAULT 'FULL',  -- FULL | CATEGORY | PARTIAL
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT | LOCKED | APPROVED | REJECTED

    counted_by        UUID NOT NULL REFERENCES users(id),
    approved_by       UUID REFERENCES users(id),

    -- MOMEN PENGUNCIAN: snapshot system_stock diambil PERSIS di sini, tidak
    -- lebih awal. Mengambilnya saat sesi dibuat akan membuat selisih salah
    -- untuk barang yang terjual selama penghitungan berlangsung.
    locked_at         TIMESTAMP WITH TIME ZONE,
    approved_at       TIMESTAMP WITH TIME ZONE,

    notes             TEXT NOT NULL DEFAULT '',
    client_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_opname_scope  CHECK (scope IN ('FULL', 'CATEGORY', 'PARTIAL')),
    CONSTRAINT ck_opname_status CHECK (status IN ('DRAFT', 'LOCKED', 'APPROVED', 'REJECTED')),
    CONSTRAINT ck_opname_locked_ts CHECK (
        (status = 'DRAFT' AND locked_at IS NULL) OR
        (status <> 'DRAFT' AND locked_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS opname_session_items (
    id                      UUID PRIMARY KEY,
    session_id              UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
    raw_material_id         UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,

    -- SATU-SATUNYA kolom yang diisi petugas.
    actual_stock            DECIMAL(12,4) NOT NULL,
    actual_package_quantity FLOAT,
    input_type              VARCHAR(50) NOT NULL DEFAULT 'base_unit',

    -- ── NULL SELAMA STATUS = DRAFT. Inilah butir 3 dalam bentuk kolom. ───────
    system_stock            DECIMAL(12,4),
    system_package_quantity FLOAT,
    difference              DECIMAL(12,4),
    difference_value        DECIMAL(15,2),
    fraud_flag              BOOLEAN NOT NULL DEFAULT FALSE,

    recount_of              UUID REFERENCES opname_session_items(id),
    notes                   TEXT NOT NULL DEFAULT '',

    CONSTRAINT uq_opname_item UNIQUE (session_id, raw_material_id),
    CONSTRAINT ck_opname_actual_nonneg CHECK (actual_stock >= 0)
);

CREATE INDEX IF NOT EXISTS idx_opname_items_session ON opname_session_items (session_id);
CREATE INDEX IF NOT EXISTS idx_opname_sessions_outlet
    ON opname_sessions (outlet_id, status, created_at DESC);

-- ── BUTIR 10 — versi master data per outlet ────────────────────────────────
--
-- Dinaikkan dalam transaksi yang SAMA dengan setiap mutasi produk, kategori,
-- resep, atau staff. Penghitung eksplisit dipilih ketimbang MAX(updated_at)
-- karena `product_categories` tidak memiliki `updated_at`, dan karena
-- penghapusan baris tidak menaikkan timestamp mana pun.
CREATE TABLE IF NOT EXISTS outlet_master_versions (
    outlet_id  VARCHAR(6) PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
    version    BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO outlet_master_versions (outlet_id, version)
SELECT id, 1 FROM outlets
ON CONFLICT (outlet_id) DO NOTHING;
