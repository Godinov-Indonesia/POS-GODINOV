-- ============================================================================
-- M16 v3 — Redesign Stock Opname: Admin-Managed Form Flow
--
-- Alur baru:
--   Admin buat form (OPEN) → Admin publish (PUBLISHED) → Kasir submit (COUNTING)
--   → Admin tutup (CLOSED) → Admin approve/reject (APPROVED/REJECTED)
--
-- Perubahan utama:
--   1. Status baru: OPEN, PUBLISHED, COUNTING, CLOSED (menggantikan DRAFT, LOCKED)
--   2. Tabel `opname_form_items`: material yang dipilih admin
--   3. Tabel `opname_count_entries`: hitungan individual per kasir
--   4. Multi-kasir: satu form bisa diisi banyak kasir, final = SUM
--   5. Recount: form baru berdasarkan parent, chain historis
-- ============================================================================

-- ── 1. Tambah kolom baru ke opname_sessions ─────────────────────────────────

ALTER TABLE opname_sessions
    ADD COLUMN IF NOT EXISTS created_by      UUID,
    ADD COLUMN IF NOT EXISTS closed_by       UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS closed_at       TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS published_at    TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS recount_of      UUID REFERENCES opname_sessions(id),
    ADD COLUMN IF NOT EXISTS recount_number  INT NOT NULL DEFAULT 0;

-- ── 2. Ganti constraint status ──────────────────────────────────────────────

ALTER TABLE opname_sessions DROP CONSTRAINT IF EXISTS ck_opname_status;
ALTER TABLE opname_sessions ADD CONSTRAINT ck_opname_status
    CHECK (status IN ('OPEN', 'PUBLISHED', 'COUNTING', 'CLOSED', 'APPROVED', 'REJECTED'));

-- ── 3. Hapus constraint locked_ts lama ──────────────────────────────────────

ALTER TABLE opname_sessions DROP CONSTRAINT IF EXISTS ck_opname_locked_ts;

-- ── 4. Tabel form items — material yang dipilih admin ───────────────────────

CREATE TABLE IF NOT EXISTS opname_form_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    CONSTRAINT uq_form_item UNIQUE (session_id, raw_material_id)
);

CREATE INDEX IF NOT EXISTS idx_opname_form_items_session
    ON opname_form_items (session_id);

-- ── 5. Tabel count entries — hitungan individual per kasir ──────────────────
--
-- Unique per (session, material, kasir). Setiap kasir punya SATU entry per
-- material per form. Jika kasir submit ulang material yang sama, entry-nya
-- di-UPDATE (upsert via ON CONFLICT).
--
-- Final `actual_stock` per material = SUM(actual_stock) dari semua kasir.

CREATE TABLE IF NOT EXISTS opname_count_entries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
    raw_material_id         UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    counted_by              UUID NOT NULL REFERENCES users(id),
    actual_stock            DECIMAL(12,4) NOT NULL,
    actual_package_quantity FLOAT,
    input_type              VARCHAR(50) NOT NULL DEFAULT 'base_unit',
    notes                   TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_count_entry UNIQUE (session_id, raw_material_id, counted_by),
    CONSTRAINT ck_count_nonneg CHECK (actual_stock >= 0)
);

CREATE INDEX IF NOT EXISTS idx_count_entries_session
    ON opname_count_entries (session_id);
CREATE INDEX IF NOT EXISTS idx_count_entries_staff
    ON opname_count_entries (session_id, counted_by);

-- ── 6. Migrasi data existing ────────────────────────────────────────────────

UPDATE opname_sessions
SET status = 'OPEN', created_by = counted_by
WHERE status = 'DRAFT';

UPDATE opname_sessions
SET status = 'CLOSED', closed_at = locked_at, closed_by = approved_by, created_by = counted_by
WHERE status = 'LOCKED';

UPDATE opname_sessions
SET created_by = counted_by
WHERE created_by IS NULL AND status IN ('APPROVED', 'REJECTED');
