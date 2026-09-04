-- ============================================================================
-- M11.1 · butir 9, 10, 12 — Blind Closing & penguncian sesi ([11 §3.2])
-- ============================================================================

ALTER TABLE shifts
    -- ── YANG DIINPUT KASIR (butir 9) — hanya tiga angka ini ──────────────────
    ADD COLUMN IF NOT EXISTS declared_cash         DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS declared_edc_total    DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS declared_qris_total   DECIMAL(15,2) NOT NULL DEFAULT 0,

    -- ── YANG DIHITUNG SERVER (aturan R3/R4) ─────────────────────────────────
    -- Tidak pernah dikirim balik ke perangkat berperan kasir.
    ADD COLUMN IF NOT EXISTS expected_cash         DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS expected_edc_total    DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS expected_qris_total   DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS cash_variance         DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS edc_variance          DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS qris_variance         DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS reconciled_at         TIMESTAMP WITH TIME ZONE,

    ADD COLUMN IF NOT EXISTS blind_close           BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS closed_by             UUID REFERENCES users(id),

    -- BUTIR 10: versi master data yang dipegang perangkat saat shift dibuka.
    ADD COLUMN IF NOT EXISTS master_data_version   BIGINT,

    -- BUTIR 12: identitas perangkat pemilik sesi.
    ADD COLUMN IF NOT EXISTS device_id             VARCHAR(64) NOT NULL DEFAULT 'legacy';

-- ── PRA-TERBANG (butir 12) ──────────────────────────────────────────────────
--
-- Indeks unik parsial di bawah GAGAL bila data yang ada sudah memuat dua shift
-- OPEN pada perangkat atau staff yang sama. Kegagalan mentah dari Postgres
-- ("could not create unique index") tidak memberi tahu operator baris mana yang
-- bermasalah, sehingga migrasi produksi berhenti tanpa petunjuk. Blok ini
-- menggagalkannya lebih dulu dengan pesan yang dapat ditindaklanjuti.
DO $$
DECLARE
    dup_device INT;
    dup_staff  INT;
BEGIN
    SELECT count(*) INTO dup_device FROM (
        SELECT outlet_id, device_id FROM shifts WHERE status = 'OPEN'
        GROUP BY outlet_id, device_id HAVING count(*) > 1
    ) d;

    SELECT count(*) INTO dup_staff FROM (
        SELECT staff_id FROM shifts WHERE status = 'OPEN'
        GROUP BY staff_id HAVING count(*) > 1
    ) s;

    IF dup_device > 0 OR dup_staff > 0 THEN
        RAISE EXCEPTION
            'Migrasi 000021 dihentikan: ada % grup (outlet, device) dan % staff dengan LEBIH DARI SATU shift OPEN. '
            'Tutup atau perbaiki shift menggantung tersebut lebih dulu. Kueri diagnosis: '
            'SELECT id, outlet_id, staff_id, device_id, client_opened_at FROM shifts WHERE status = ''OPEN'' '
            'ORDER BY outlet_id, staff_id, client_opened_at;',
            dup_device, dup_staff;
    END IF;
END $$;

-- BUTIR 12 — PENGUNCIAN IDENTITAS, ditegakkan indeks, bukan sekadar UI.
-- Satu perangkat hanya boleh punya satu shift OPEN.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_open_per_device
    ON shifts (outlet_id, device_id) WHERE status = 'OPEN';

-- Satu staff hanya boleh punya satu shift OPEN di seluruh bisnis. Mencegah
-- satu PIN dipakai membuka laci di dua perangkat sekaligus.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_open_per_staff
    ON shifts (staff_id) WHERE status = 'OPEN';

-- BUTIR 10: shift v2 wajib membawa versi master data.
--
-- Klausa `device_id = 'legacy'` membebaskan baris yang lahir sebelum gerbang
-- ini ada. Ia MEMANG dapat dilewati klien yang mengirim device_id palsu —
-- constraint ini menangkap bug jujur, bukan lawan yang berniat curang.
-- Penegakan sesungguhnya ada di `ShiftService` ([11 §M15.1]).
ALTER TABLE shifts
    DROP CONSTRAINT IF EXISTS ck_shift_master_version;
ALTER TABLE shifts
    ADD CONSTRAINT ck_shift_master_version CHECK (
        status <> 'OPEN' OR master_data_version IS NOT NULL OR device_id = 'legacy'
    );

COMMENT ON COLUMN shifts.expected_balance IS
    'DEPRECATED v2 — diisi ganda dari expected_cash selama jendela M18. Jangan dibaca kode baru.';
COMMENT ON COLUMN shifts.discrepancy IS
    'DEPRECATED v2 — diisi ganda dari cash_variance selama jendela M18.';
