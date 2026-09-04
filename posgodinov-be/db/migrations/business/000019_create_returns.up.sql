-- ============================================================================
-- M11.1 · butir 15 — Retur ([11 §2, §3.2])
--
-- Retur adalah PERISTIWA KEUANGAN BARU, bukan perubahan atas transaksi asal.
-- Transaksi asal tetap `COMPLETED` selamanya.
-- ============================================================================

CREATE TABLE IF NOT EXISTS returns (
    id                      UUID PRIMARY KEY,          -- UUID KLIEN (aturan R2)
    original_transaction_id UUID NOT NULL REFERENCES transactions(id),

    -- Shift SAAT RETUR TERJADI — sengaja bisa berbeda dari shift transaksi asal.
    -- Pelanggan yang kembali besok adalah kasus ritel normal.
    shift_id                UUID NOT NULL REFERENCES shifts(id),
    outlet_id               VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id             VARCHAR(8) NOT NULL,
    device_id               VARCHAR(64) NOT NULL DEFAULT 'legacy',

    staff_id                UUID NOT NULL REFERENCES users(id),   -- kasir pelaksana
    authorized_by           UUID REFERENCES users(id),            -- pemberi otoritas

    return_type             VARCHAR(10) NOT NULL,   -- FULL | PARTIAL
    refund_method           VARCHAR(30) NOT NULL,
    refund_amount           DECIMAL(15,2) NOT NULL,

    reason_code             VARCHAR(50) NOT NULL,
    reason_notes            TEXT NOT NULL DEFAULT '',

    receipt_printed         BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_printed_at      TIMESTAMP WITH TIME ZONE,
    short_code              VARCHAR(20),

    client_created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_return_type   CHECK (return_type IN ('FULL', 'PARTIAL')),
    CONSTRAINT ck_refund_method CHECK (
        refund_method IN ('CASH', 'CARD_REVERSAL', 'QRIS_REVERSAL', 'EXCHANGE', 'STORE_CREDIT')
    ),
    CONSTRAINT ck_refund_amount CHECK (refund_amount >= 0)
);

CREATE TABLE IF NOT EXISTS return_items (
    id                  UUID PRIMARY KEY,
    return_id           UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    transaction_item_id UUID NOT NULL REFERENCES transaction_items(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    quantity            INT NOT NULL,
    unit_price          DECIMAL(15,2) NOT NULL,   -- snapshot harga ASAL

    -- FALSE untuk barang rusak: uang kembali ke pelanggan, stok TIDAK kembali.
    -- Inilah pembeda retur dari void, dan alasan `returns` tidak boleh
    -- direduksi menjadi "transaksi bernilai negatif".
    restock             BOOLEAN NOT NULL DEFAULT TRUE,
    waste_reason_code   VARCHAR(50),

    CONSTRAINT ck_return_item_qty CHECK (quantity > 0),
    CONSTRAINT uq_return_item UNIQUE (return_id, transaction_item_id)
);

CREATE INDEX IF NOT EXISTS idx_returns_original ON returns (original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_returns_shift    ON returns (shift_id, client_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_items_tx  ON return_items (transaction_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_return_short_code
    ON returns (outlet_id, short_code) WHERE short_code IS NOT NULL;
