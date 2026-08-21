-- ============================================================================
-- M11.1 · butir 5, 6, 13, 15 — Log pembatalan ([11 §3.2])
--
-- Satu tabel untuk SELURUH peristiwa pembatalan, termasuk yang terjadi
-- SEBELUM sebuah transaksi lahir.
--
-- Justru di sanalah kecurangan hidup: kasir memasukkan 10 item, pelanggan
-- membayar 10, kasir menurunkan menjadi 4 sebelum menekan Bayar, selisih 6
-- masuk kantong. Tanpa tabel ini peristiwa tersebut tidak meninggalkan jejak
-- APA PUN di sistem — tidak ada transaksi, tidak ada stok bergerak, tidak ada
-- baris untuk diaudit.
-- ============================================================================

CREATE TABLE IF NOT EXISTS void_logs (
    id                 UUID PRIMARY KEY,           -- UUID KLIEN (aturan R2)
    outlet_id          VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id        VARCHAR(8) NOT NULL REFERENCES businesses(id),
    device_id          VARCHAR(64) NOT NULL DEFAULT 'legacy',
    shift_id           UUID NOT NULL REFERENCES shifts(id),

    staff_id           UUID NOT NULL REFERENCES users(id),
    authorized_by      UUID REFERENCES users(id),

    scope              VARCHAR(20) NOT NULL,   -- CART_LINE | HELD_ORDER | TRANSACTION

    transaction_id     UUID REFERENCES transactions(id),  -- hanya scope TRANSACTION
    held_cart_id       UUID,                              -- lokal-only, TANPA FK
    product_id         UUID REFERENCES products(id),      -- hanya scope CART_LINE

    quantity_before    INT NOT NULL DEFAULT 0,
    quantity_after     INT NOT NULL DEFAULT 0,
    value_amount       DECIMAL(15,2) NOT NULL,

    reason_code        VARCHAR(50) NOT NULL,
    reason_notes       TEXT NOT NULL DEFAULT '',

    -- BUTIR 6: bukti bahwa struk pembatalan benar-benar terbit.
    receipt_printed    BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_printed_at TIMESTAMP WITH TIME ZONE,

    -- Snapshot item untuk scope HELD_ORDER / TRANSACTION — held cart tidak
    -- pernah ada di server, jadi isinya harus dibawa serta atau hilang selamanya.
    items_snapshot     JSONB,

    client_created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_void_scope CHECK (scope IN ('CART_LINE', 'HELD_ORDER', 'TRANSACTION')),

    -- Setiap scope wajib membawa referensinya sendiri; tidak ada baris yatim.
    CONSTRAINT ck_void_scope_ref CHECK (
        (scope = 'TRANSACTION' AND transaction_id IS NOT NULL)
     OR (scope = 'HELD_ORDER'  AND held_cart_id   IS NOT NULL)
     OR (scope = 'CART_LINE'   AND product_id     IS NOT NULL)
    ),
    CONSTRAINT ck_void_qty CHECK (quantity_after <= quantity_before)
);

CREATE INDEX IF NOT EXISTS idx_void_logs_shift ON void_logs (shift_id, client_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_void_logs_staff ON void_logs (staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_void_logs_scope ON void_logs (outlet_id, scope, created_at DESC);
