-- ============================================================================
-- M11.1 · butir 7, 9, 12, 14 + aturan R9 — Audit keamanan ([11 §3.2, §3.3])
--
-- `audit_logs` yang ada hanya menangkap permintaan HTTP. Kecurangan di POS
-- terjadi justru ketika perangkat offline — dan tidak ada satu pun permintaan
-- HTTP yang lahir dari peristiwa itu. Tabel ini adalah kanal audit yang IKUT
-- ANTRE SYNC, sehingga jejaknya tetap tiba meski terlambat berjam-jam.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pos_security_events (
    id                UUID PRIMARY KEY,          -- UUID KLIEN (aturan R2)
    outlet_id         VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id       VARCHAR(8) NOT NULL,
    device_id         VARCHAR(64) NOT NULL DEFAULT 'legacy',
    shift_id          UUID REFERENCES shifts(id),
    staff_id          UUID REFERENCES users(id),

    event_type        VARCHAR(50) NOT NULL,
    severity          VARCHAR(10) NOT NULL DEFAULT 'INFO',   -- INFO | WARN | CRITICAL
    details           JSONB NOT NULL DEFAULT '{}'::jsonb,

    client_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_sec_severity CHECK (severity IN ('INFO','WARN','CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_sec_events_outlet ON pos_security_events (outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_type   ON pos_security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_shift  ON pos_security_events (shift_id);

-- ── BUTIR 4/12/14 — peran & izin staff ─────────────────────────────────────
--
-- ⚠️ KOREKSI TERHADAP [11 §3.2]: rancangan menyebut tabel `staffs`. Tabel itu
-- TIDAK ADA. Staff tersimpan di tabel `users` (`domain.Staff.TableName()`
-- mengembalikan "users"), dan kolom `role VARCHAR(20) NOT NULL DEFAULT
-- 'CASHIER'` SUDAH ADA sejak migrasi 000002. Jadi yang ditambahkan di sini
-- hanya `permissions`, plus perluasan daftar peran yang sah.
--
-- 'ADMIN' WAJIB masuk daftar: `domain.RoleAdmin` sudah memakainya di produksi,
-- dan CHECK yang mengabaikannya akan menggagalkan migrasi pada baris nyata.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS ck_staff_role;
ALTER TABLE users
    ADD CONSTRAINT ck_staff_role CHECK (
        role IN ('CASHIER', 'ADMIN', 'SUPERVISOR', 'STOCK_KEEPER', 'MANAGER')
    );

-- ── BUTIR 7 — bukti cetak struk pembuangan ─────────────────────────────────
ALTER TABLE product_wastes
    ADD COLUMN IF NOT EXISTS receipt_printed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS printed_at      TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS shift_id        UUID REFERENCES shifts(id),
    ADD COLUMN IF NOT EXISTS device_id       VARCHAR(64) NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS reason_code     VARCHAR(50) NOT NULL DEFAULT 'OTHER';
