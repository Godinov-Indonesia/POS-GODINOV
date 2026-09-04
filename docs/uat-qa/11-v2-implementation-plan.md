# 11 — POSGODINOV v2: Rancangan Arsitektur & Rencana Eksekusi

> # ✅ V2 SELESAI
>
> **Rekayasa dan QA v2 selesai seluruhnya — M11 s.d. M18.4 (cakupan repositori).**
> Ditutup 29 Agustus 2026 pada branch `dev-v2`.
>
> | | |
> |---|---|
> | UAT Web (Playwright · M15 Blind Closing) | **8 lulus / 0 gagal** |
> | UAT Mobile (Maestro · M13 Void Threshold) | **37 perintah / 0 gagal**, nol `FATAL EXCEPTION` |
> | Temuan penghambat rilis | **0 terbuka** — BLOCK-01, BLOCK-02, NOTE-01 seluruhnya tertutup |
> | Bukti | [19 · Laporan Eksekusi QA](19-v2-qa-execution-report.md) |
>
> ⚠️ **Yang BELUM selesai, dan sengaja tidak dicentang: 10 butir M18 yang
> menuntut lingkungan produksi nyata** — latihan migrasi pada salinan produksi,
> rollback yang benar-benar diuji, dashboard pemantauan, tiga panduan operasional,
> runbook cetak, dan pembersihan `decodeV1` yang gerbangnya 30 hari pasca-rilis.
> Rinciannya di [Fase M18](#fase-m18--migrasi-data-hardening--rilis).
>
> Butir-butir itu tidak dapat dikerjakan dari repositori ini, dan mencentangnya
> berarti menaruh klaim verifikasi palsu pada dokumen rilis — khususnya
> *"rollback telah diuji"*, yang justru dibaca orang saat keadaan sedang buruk.
> "V2 SELESAI" di atas karena itu bermakna **cakupan rekayasa**, bukan
> "operasi rilis sudah dijalankan".

> **Status dokumen:** SELESAI DIEKSEKUSI — lihat banner di atas.
> **Lingkup:** lintas-repositori — `posgodinov-be` (Go), `posgodinov-fe` (Next.js/PWA, Web Owner + Web POS),
> `posgodinov-mobile` (Flutter), dan satu modul baru `posgodinov-opname`.
> **Sumber kebenaran teknis v1:** [01](01-architecture-overview.md) · [02](02-database-schema.md) ·
> [03](03-api-specifications.md) · [05](05-frontend-architecture-design.md) · [09](09-flutter-mobile-architecture.md).
>
> ⚠️ **Catatan penomoran.** Berkas [11-flutter-verification-runbook.md](11-flutter-verification-runbook.md)
> sudah memakai prefiks `11-`. Dokumen ini memakai nama berkas yang diminta secara eksplisit
> (`11-v2-implementation-plan.md`) sehingga keduanya hidup berdampingan tanpa saling menimpa.
> Bila tim menghendaki penomoran linear, ganti nama dokumen ini menjadi `13-…` pada PR pertama.

---

## 0. Ringkasan Eksekutif

v2 bukan penambahan fitur. v2 adalah **pemindahan kelas sistem**: dari "POS offline-first yang benar
secara teknis" menjadi "POS yang tahan terhadap kecurangan operasional dan dapat diaudit".

Tiga pergeseran filosofis yang menjadi akar seluruh 18 butir:

| # | Pergeseran | Dari (v1) | Ke (v2) |
|---|---|---|---|
| **F1** | **Kebenaran angka dipindah ke server** | Kasir menghitung `expected_balance` dan menampilkannya. Petugas opname melihat `system_stock` saat menghitung. | Kasir dan petugas opname **hanya melaporkan angka mentah**. Ekspektasi dan selisih dihitung server, tidak pernah dikirim balik ke perangkat kasir. |
| **F2** | **Pembatalan adalah peristiwa, bukan penghapusan** | `CANCELLED` menimpa baris transaksi. Hold Order dihapus dengan satu tombol. | Setiap pembatalan melahirkan **baris audit baru** (`void_logs` / `returns`) plus **artefak fisik** (struk pembatalan). Tidak ada jalur "hilang tanpa jejak". |
| **F3** | **Identitas dan sesi saling mengunci** | Kasir bebas logout, ganti orang, keluar Kiosk. | Sesi Shift **menyandera** identitas kasir sampai Tutup Shift. Keluar Kiosk butuh otoritas, dan setiap percobaannya tercatat. |

Konsekuensi teknis yang tidak bisa dihindari: **skema basis data berubah di tiga tempat sekaligus**
(PostgreSQL, Dexie, Drift) dan **kontrak `POST /v1/pos/sync` naik versi**. Dua hal itu menentukan
urutan fase — M11 harus selesai sebelum apa pun yang lain dimulai.

### 0.1 Peta 18 butir → fase

| # | Butir Pembaruan | Fase | Artefak utama |
|---|---|---|---|
| 1 | Engine transisi online ↔ offline tanpa keluar aplikasi | **M12** | `connectivity-store`, `sw.js`, penghapusan seluruh navigasi dokumen |
| 2 | Default online + auto-push transaksi | **M12** | Pemicu `transaction-commit`, Background Sync |
| 3 | Blind Opname (selisih hanya muncul setelah dikunci) | **M16** | `opname_sessions`, transisi `DRAFT → LOCKED` |
| 4 | Modul Opname terpisah dari POS Kasir | **M16** | `posgodinov-opname` (PWA scope sendiri) + flavor Flutter |
| 5 | Penurunan qty > 5 wajib lewat alur Void | **M13** | `VOID_THRESHOLD_QTY`, `void_logs.scope = CART_LINE` |
| 6 | Void wajib mencetak struk pembatalan | **M14** | `CancelReceipt`, `print_jobs` |
| 7 | Waste wajib mencetak struk pembuangan | **M14** | `WasteReceipt`, `product_wastes.receipt_printed` |
| 8 | Kartu wajib Trace No., 4 digit akhir, nominal gesek | **M11** | Tabel `transaction_payments` (multi-tender) |
| 9 | Blind Closing Shift | **M15** | `shifts.declared_*`, `expected_*` server-only |
| 10 | Wajib pull Master Data sebelum Buka Shift | **M15** | `master_data_version`, gerbang P-04 |
| 11 | Layar Payment jadi Full-Page Route | **M17** | Rute `payment/cash · card · split` |
| 12 | Kasir ber-Shift aktif tidak bisa logout/diganti | **M15** | Indeks unik parsial `uq_shift_open_per_device` |
| 13 | Hold Order tanpa tombol hapus → wajib Void | **M13** | `void_logs.scope = HELD_ORDER` |
| 14 | Kiosk Mode untuk staff; keluar wajib PIN otoritas | **M17** | `staffs.role`, `pos_security_events` |
| 15 | Belum cetak = VOID; sudah cetak = RETUR | **M13** | `transactions.receipt_printed_at`, tabel `returns` |
| 16 | Riwayat hanya Shift aktif; lampau via Kode Struk | **M17** | `transactions.short_code`, endpoint `lookup` |
| 17 | Redirect ke Login Kasir setelah Tutup Shift | **M15** | `closeShiftSaga` |
| 18 | Ikon Header pindah ke Bottom Bar (thumb zone) | **M17** | `PosBottomBar` |

### 0.2 Graf ketergantungan fase

```
                     ┌─────────────────────────────────────┐
                     │  M11 — Skema Data & Kontrak Audit   │  ← GERBANG WAJIB
                     │  (migrasi 000017–000023, Dexie v4,  │
                     │   Drift v2, sync contract v2)       │
                     └───┬──────────┬──────────┬───────────┘
                         │          │          │
             ┌───────────v──┐  ┌────v──────┐  ┌v────────────────┐
             │ M12 Transisi │  │ M13 Void  │  │ M15 Blind Shift │
             │ & Auto-Sync  │  │ vs Retur  │  │ & Guard Sesi    │
             └───────┬──────┘  └────┬──────┘  └────────┬────────┘
                     │              │                  │
                     │         ┌────v──────────┐       │
                     │         │ M14 Hardware  │       │
                     │         │ & Print Flow  │       │
                     │         └────┬──────────┘       │
                     │              │                  │
                     └──────────────┼──────────────────┘
                                    │
                        ┌───────────v────────────┐   ┌──────────────────┐
                        │  M17 — UI/UX Revamp    │   │ M16 — Modul      │
                        │  (bottom bar, payment, │   │ Opname Terisolasi│
                        │   history, kiosk)      │   │ (paralel penuh)  │
                        └───────────┬────────────┘   └────────┬─────────┘
                                    └──────────┬──────────────┘
                                    ┌──────────v──────────────┐
                                    │ M18 — Migrasi Data,     │
                                    │ Hardening & Rilis       │
                                    └─────────────────────────┘
```

**M16 dapat berjalan paralel penuh** dengan M12–M15 karena tidak menyentuh satu berkas pun di jalur
kasir — itulah nilai sesungguhnya dari isolasi modul (butir 4).

---

## 1. Aturan yang Mengikat Seluruh Fase v2

Sepuluh aturan berikut diperiksa ulang di akhir **setiap** fase. Pelanggaran satu saja membatalkan
Definition of Done fase tersebut. Enam aturan v1 dari [10 §0](10-flutter-implementation-plan.md)
tetap berlaku dan tidak diulang di sini.

| # | Aturan | Alasan | Cara verifikasi |
|---|---|---|---|
| **R1** | Uang di **klien** = `int` sen. Uang di **PostgreSQL** = `DECIMAL(15,2)` Rupiah. Konversi **hanya** di `wire.ts` / `wire_mapper.dart`. | Konsisten dengan v1 ([02 §2.12], ADR-05). Tabel baru mengikuti tipe tetangganya, bukan selera penulisnya. | `grep -rn "DECIMAL" db/migrations/0000{17..23}*` — semua kolom uang `DECIMAL(15,2)` |
| **R2** | UUID dibuat **klien**, sekali seumur entitas, tidak pernah diregenerasi. Berlaku untuk `returns`, `void_logs`, `opname_sessions`, `pos_security_events`. | Dasar idempotensi sync ([03 §2.3]). | Uji unit `wire_mapper_test` per entitas baru |
| **R3** | Angka **ekspektasi** (`expected_*`, `system_stock`, `difference`) **tidak pernah** dikirim ke perangkat berperan `CASHIER` atau `STOCK_KEEPER`. | Inti Blind Closing & Blind Opname. Kolom yang tidak dikirim tidak bisa bocor lewat DevTools. | Uji integrasi API: `assert !body.contains("expected_")` untuk token peran kasir |
| **R4** | Klien **boleh** mengirim `expected_*`; server **wajib** mengabaikannya dan menghitung ulang. | Klien yang dimodifikasi tidak boleh menentukan selisih kasnya sendiri. | Uji: kirim `expected_cash: 999999`, assert nilai tersimpan = hasil hitung server |
| **R5** | Baris tidak pernah `DELETE`. Pembatalan = baris baru + perubahan status. | Butir 13 & 15; jejak audit. | `grep -rn "\.delete(" lib/db lib/core/database` hanya boleh muncul di pembersihan master data |
| **R6** | Kegagalan cetak **tidak pernah** membatalkan penulisan DB, tapi **wajib** menyisakan `print_jobs` berstatus `PENDING` + banner persisten. | Uang sudah berpindah; printer mati adalah masalah operasional ([09 §7.3]). | Uji: printer di-mock gagal → baris tetap ada, `print_jobs.status = PENDING` |
| **R7** | Perpindahan state jaringan **tidak boleh** memicu navigasi dokumen (`location.href`, `router.push`, `Navigator.pushReplacement` ke rute non-POS). | Butir 1. | `grep -rn "location.href\|window.location =" features/pos/` harus kosong |
| **R8** | Nomor kartu penuh (PAN), CVV, PIN kartu, dan data magstripe **dilarang** disimpan, dicatat, atau dicetak. Hanya 4 digit terakhir + trace number. | Butir 8 menyentuh data pembayaran; menyimpan PAN memindahkan sistem ke ruang lingkup PCI-DSS penuh. | `CHECK` constraint `char_length(card_last4) = 4` + tinjauan kode struk |
| **R9** | Setiap peristiwa keamanan sisi klien (keluar Kiosk, logout ditolak, cetak ulang, void) menulis `pos_security_events` yang ikut antre sync. | `audit_logs` backend hanya melihat HTTP; kecurangan terjadi saat offline. | Uji: matikan jaringan → lakukan void → nyalakan → assert baris tiba di server |
| **R10** | Kontrak sync membawa header `X-POS-Contract-Version`. Server melayani v1 **dan** v2 selama jendela deprekasi M18. | Perangkat di lapangan tidak bisa diperbarui serentak. | Uji kontrak: payload v1 lama tetap `200` |

**Gerbang mutu tiap fase — keempatnya wajib hijau:**

```bash
# Backend
cd posgodinov-be && go vet ./... && go test ./... && migrate -path db/migrations -database "$DB_URL" up

# Web
cd posgodinov-fe && pnpm typecheck && pnpm lint && pnpm test

# Mobile
cd posgodinov-mobile && flutter analyze && dart run import_lint && flutter test

# Kontrak
cd posgodinov-be && go test ./tests/contract/... -run TestSyncContractV2
```

---

## 2. Rancangan State Machine: VOID vs RETUR (butir 15)

### 2.1 Diskriminator tunggal

Yang memisahkan Void dari Retur **bukan** waktu, **bukan** status shift, dan **bukan** kebijakan
manajer. Diskriminatornya adalah satu kolom:

```
transactions.receipt_printed_at  IS NULL      → wilayah VOID
transactions.receipt_printed_at  IS NOT NULL  → wilayah RETUR
```

**Alasan.** Struk yang sudah keluar dari printer adalah dokumen yang berpindah tangan ke pelanggan.
Mengubah transaksi asal setelah dokumen itu terbit berarti menerbitkan realitas kedua yang
bertentangan dengan kertas di tangan pelanggan — dan itu persis lubang yang dipakai kecurangan
"cetak dulu, batalkan belakangan, uang masuk kantong". Karena itu:

- **VOID** = koreksi *in-place*. Transaksi belum pernah menjadi dokumen, jadi boleh dinyatakan tidak
  pernah terjadi. Baris asal berubah status; stok dikembalikan penuh.
- **RETUR** = peristiwa keuangan **baru**. Transaksi asal **beku selamanya** (`COMPLETED`, tidak
  pernah diubah); retur lahir sebagai baris `returns` tersendiri dengan waktunya sendiri, shift-nya
  sendiri (bisa berbeda dari shift asal), strukturnya sendiri, dan struk retur tersendiri.

### 2.2 Diagram transisi

```
                         ┌───────────────────────┐
                         │   CART (RAM/session)  │
                         │   belum ada baris DB  │
                         └───────────┬───────────┘
                                     │ qty turun > 5 unit  ──────────┐
                                     │ (butir 5)                     │
                                     │                    ┌──────────v──────────┐
                                     │                    │ void_logs           │
                                     │                    │ scope = CART_LINE   │
                                     │                    │ + CETAK struk batal │
                                     │                    └─────────────────────┘
                                     │
                                     │ Tahan Pesanan (butir 13)
                                     ├──────────────────► HELD ──────┐
                                     │                      │        │ batal hold
                                     │                      │        v
                                     │                      │  ┌─────────────────────┐
                                     │                      │  │ void_logs           │
                                     │                      │  │ scope = HELD_ORDER  │
                                     │                      │  │ + CETAK struk batal │
                                     │                      │  └─────────────────────┘
                                     │  ◄───────────────────┘ lanjutkan
                                     │
                                     │ COMMIT pembayaran (tulis DB dulu, cetak kemudian)
                                     v
                  ╔══════════════════════════════════════════╗
                  ║  status = COMPLETED                      ║
                  ║  receipt_printed_at = NULL               ║
                  ║  ── "sudah jadi uang, belum jadi kertas" ║
                  ╚═══════════╤══════════════════════╤═══════╝
                              │                      │
             printer sukses   │                      │  batal sebelum struk terbit
             (job PRINTED)    │                      │  (butir 15 — jalur VOID)
                              v                      v
   ╔══════════════════════════════════╗   ╔══════════════════════════════════╗
   ║ status = COMPLETED               ║   ║ status = VOIDED                  ║
   ║ receipt_printed_at = <timestamp> ║   ║ void_logs.scope = TRANSACTION    ║
   ║ ── DOKUMEN TERBIT, BARIS BEKU    ║   ║ stok dikembalikan PENUH          ║
   ╚═══════════╤══════════════════════╝   ║ + CETAK struk pembatalan (b.6)   ║
               │                          ╚══════════════════════════════════╝
               │ pelanggan mengembalikan barang / uang         (TERMINAL)
               │ (butir 15 — jalur RETUR)
               v
   ┌───────────────────────────────────────────────────────────────┐
   │  INSERT returns (id UUID klien) + return_items[]              │
   │  original_transaction_id → transaksi asal (TIDAK diubah)      │
   │  shift_id → shift SAAT INI, bukan shift asal                  │
   │  + CETAK struk retur                                          │
   └───────────────┬───────────────────────────────────────────────┘
                   │ server menghitung ulang agregat retur
                   v
   ╔═══════════════════════════════════════════════════════════════╗
   ║  transactions.return_state (KOLOM TURUNAN, dihitung server)   ║
   ║  ── NONE  → belum ada retur                                   ║
   ║  ── PARTIAL → Σ return_items.qty <  Σ transaction_items.qty    ║
   ║  ── FULL    → Σ return_items.qty =  Σ transaction_items.qty    ║
   ╚═══════════════════════════════════════════════════════════════╝
```

### 2.3 Transisi yang **dilarang** (ditegakkan `CHECK` + service)

| Dari | Ke | Putusan | Alasan |
|---|---|---|---|
| `VOIDED` | `COMPLETED` | ❌ ditolak `409` | Tidak ada "batalkan pembatalan". Buat transaksi baru. |
| `VOIDED` | `RETURNED` | ❌ ditolak `409` | Tidak ada barang yang berpindah; tidak ada yang bisa diretur. |
| `COMPLETED` + `receipt_printed_at IS NOT NULL` | `VOIDED` | ❌ ditolak `422` | Inti butir 15. Klien wajib mengarahkan ke alur Retur. |
| `COMPLETED` + `receipt_printed_at IS NULL` | `RETURNED` | ❌ ditolak `422` | Retur tanpa struk asal tidak dapat diverifikasi kasir berikutnya. |
| `returns` melebihi qty asal | — | ❌ ditolak `422` | Dijaga `CHECK` agregat di service, lihat §3.4. |
| Retur atas transaksi shift lain | — | ✅ **diizinkan** | Pelanggan kembali besok adalah kasus normal ritel. `returns.shift_id` mencatat shift retur, bukan shift asal. |

### 2.4 Konsekuensi pada laporan pemilik

`total_amount` transaksi asal **tidak pernah dikurangi**. Penjualan bersih menjadi:

```
net_sales = Σ transactions.total_amount WHERE status = 'COMPLETED'
          − Σ returns.refund_amount
```

Ini disengaja: pemilik harus dapat melihat **berapa banyak yang diretur**, bukan sekadar melihat
angka penjualan yang menyusut tanpa penjelasan. Kolom `transactions.status = 'VOIDED'` otomatis
keluar dari agregat penjualan karena filternya `= 'COMPLETED'`.

---

## 3. Rancangan Skema Basis Data

### 3.1 Ikhtisar objek baru

| Objek | Jenis | Butir | Repositori terdampak |
|---|---|---|---|
| `transaction_payments` | tabel baru | 8 | PG · Dexie (nested) · Drift |
| `returns` + `return_items` | tabel baru | 15 | PG · Dexie (nested) · Drift |
| `void_logs` | tabel baru | 5, 6, 13, 15 | PG · Dexie · Drift |
| `opname_sessions` + `opname_session_items` | tabel baru | 3, 4 | PG · Dexie modul opname |
| `pos_security_events` | tabel baru | 9, 12, 14 | PG · Dexie · Drift |
| `print_jobs` | tabel **lokal saja** | 6, 7 | Dexie · Drift (tidak pernah di-sync) |
| `outlet_master_versions` | tabel baru | 10 | PG |
| `transactions.receipt_printed_at`, `short_code`, `return_state`, `device_id` | kolom | 15, 16, 12 | PG · Dexie · Drift |
| `shifts.declared_*`, `expected_*`, `*_variance`, `device_id`, `master_data_version` | kolom | 9, 10, 12 | PG · Dexie · Drift |
| `users.permissions` (kolom `role` **sudah ada**) | kolom | 4, 12, 14 | PG · master data payload |
| `product_wastes.receipt_printed`, `printed_at` | kolom | 7 | PG · Dexie · Drift |

### 3.2 Migrasi PostgreSQL — `000017` … `000023`

> Seluruh migrasi bersifat **aditif dan reversibel**. Tidak ada `DROP COLUMN` pada v2; kolom lama
> (`shifts.expected_balance`, `shifts.discrepancy`, `transactions.payment_method`,
> `transactions.cancel_notes`) dipertahankan dan diisi ganda selama jendela deprekasi M18.

#### `000017_create_transaction_payments.up.sql` — butir 8

```sql
-- Multi-tender. Menggantikan asumsi "satu transaksi = satu metode bayar".
--
-- KEPUTUSAN: butir 8 menyebut "nominal gesek", yang secara implisit mengakui
-- pembayaran sebagian (mis. Rp 200.000 tunai + Rp 300.000 gesek). Kolom
-- `trace_number` di `transactions` tidak dapat merepresentasikan dua kartu pada
-- satu struk, dan tidak dapat merepresentasikan nominal gesek yang berbeda dari
-- total transaksi. Karena itu data tender dipindah ke tabel anak; `transactions`
-- tetap menyimpan RINGKASAN terdenormalisasi agar laporan v1 tidak pecah.
CREATE TABLE IF NOT EXISTS transaction_payments (
    id              UUID PRIMARY KEY,
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    sequence        INT NOT NULL DEFAULT 1,
    method          VARCHAR(50) NOT NULL,
    amount          DECIMAL(15,2) NOT NULL,

    -- Wajib untuk kartu (butir 8). NULL untuk CASH/QRIS/TRANSFER.
    trace_number    VARCHAR(32),
    card_last4      CHAR(4),

    -- Opsional, diisi bila EDC/operator menyediakannya.
    card_network    VARCHAR(20),
    approval_code   VARCHAR(32),
    edc_terminal_id VARCHAR(32),

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_txn_payment_seq UNIQUE (transaction_id, sequence),
    CONSTRAINT ck_payment_amount_positive CHECK (amount > 0),

    -- INTI BUTIR 8: kartu tanpa trace number & 4 digit akhir ditolak DATABASE,
    -- bukan sekadar ditolak form. Perangkat yang dimodifikasi tetap terbentur.
    CONSTRAINT ck_card_requires_trace CHECK (
        method NOT IN ('DEBIT', 'CREDIT')
        OR (trace_number IS NOT NULL AND btrim(trace_number) <> ''
            AND card_last4 IS NOT NULL)
    ),

    -- R8: hanya 4 digit, dan hanya digit. PAN penuh mustahil masuk.
    CONSTRAINT ck_card_last4_shape CHECK (
        card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'
    )
);

CREATE INDEX idx_txn_payments_parent ON transaction_payments (transaction_id);
CREATE INDEX idx_txn_payments_trace  ON transaction_payments (trace_number)
    WHERE trace_number IS NOT NULL;

-- Ringkasan terdenormalisasi pada induk — kompatibilitas laporan v1.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS tender_count       INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS cash_amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS noncash_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS primary_trace_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS primary_card_last4   CHAR(4);

-- `payment_method` v1 kini menerima nilai tambahan 'SPLIT' bila tender_count > 1.
COMMENT ON COLUMN transactions.payment_method IS
    'v1-compat. Nilai: CASH|QRIS|DEBIT|CREDIT|TRANSFER|SPLIT. Sumber kebenaran = transaction_payments.';
```

#### `000018_alter_transactions_v2_state.up.sql` — butir 15, 16, 12

```sql
ALTER TABLE transactions
    -- DISKRIMINATOR VOID vs RETUR (§2.1). NULL = belum pernah tercetak.
    ADD COLUMN IF NOT EXISTS receipt_printed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reprint_count      INT NOT NULL DEFAULT 0,

    -- BUTIR 16: kode struk yang dapat diketik manusia untuk pencarian lintas shift.
    ADD COLUMN IF NOT EXISTS short_code         VARCHAR(20),

    -- Turunan, dihitung server setiap kali `returns` berubah. NONE|PARTIAL|FULL.
    ADD COLUMN IF NOT EXISTS return_state       VARCHAR(10) NOT NULL DEFAULT 'NONE',

    -- BUTIR 12: identitas perangkat, dasar penguncian sesi.
    ADD COLUMN IF NOT EXISTS device_id          VARCHAR(64) NOT NULL DEFAULT 'legacy',

    ADD COLUMN IF NOT EXISTS voided_at          TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS voided_by          UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS void_reason_code   VARCHAR(50);

-- Status v2. 'CANCELLED' DIPERTAHANKAN sebagai nilai warisan; baris baru memakai 'VOIDED'.
ALTER TABLE transactions
    ADD CONSTRAINT ck_txn_status CHECK (
        status IN ('COMPLETED', 'VOIDED', 'CANCELLED')
    );

ALTER TABLE transactions
    ADD CONSTRAINT ck_txn_return_state CHECK (
        return_state IN ('NONE', 'PARTIAL', 'FULL')
    );

-- INTI BUTIR 15, ditegakkan di lapisan penyimpanan:
-- transaksi yang struknya sudah terbit TIDAK BOLEH berstatus VOIDED.
ALTER TABLE transactions
    ADD CONSTRAINT ck_void_requires_unprinted CHECK (
        status <> 'VOIDED' OR receipt_printed_at IS NULL
    );

-- Kode struk unik per outlet. Dibuat KLIEN (offline-first), divalidasi server.
CREATE UNIQUE INDEX IF NOT EXISTS uq_txn_short_code
    ON transactions (outlet_id, short_code) WHERE short_code IS NOT NULL;

-- BUTIR 16: riwayat default difilter shift aktif.
CREATE INDEX IF NOT EXISTS idx_txn_shift_created
    ON transactions (shift_id, client_created_at DESC);
```

**Format `short_code`.** Dibuat klien tanpa jaringan, tanpa penghitung terpusat:

```
        AB1234 - 250820 - K7QF1
        └──┬──┘  └──┬──┘  └─┬──┘
     outlet_id   YYMMDD   5 char HEX uppercase dari 20 bit pertama UUID
```

> ⚠️ **Koreksi saat eksekusi M11.1.** Rancangan awal menyebut 4 karakter
> Crockford-Base32. Diganti menjadi **5 karakter heksadesimal**: ruang
> tabrakannya identik (16⁵ = 32⁴ = 1.048.576), tetapi dapat dibangkitkan
> langsung di SQL murni pada migrasi backfill tanpa fungsi bantu — sehingga
> server dan klien memakai satu format yang sama, bukan dua. Segmen tanggal
> bersifat **kosmetik**; keunikan datang dari kode utuh per outlet.

Ruang tabrakan = 1 juta per outlet per hari; peluang tabrakan pada 500 transaksi/hari ≈ 0,012 %.
Server menolak duplikat dengan `409 SHORT_CODE_COLLISION`; klien membuat ulang **hanya suffix**
(UUID transaksi tidak pernah berubah — R2) lalu mengantre ulang.

#### `000019_create_returns.up.sql` — butir 15

```sql
CREATE TABLE IF NOT EXISTS returns (
    id                      UUID PRIMARY KEY,          -- UUID KLIEN (R2)
    original_transaction_id UUID NOT NULL REFERENCES transactions(id),

    -- Shift SAAT RETUR TERJADI — sengaja bisa berbeda dari shift transaksi asal.
    shift_id                UUID NOT NULL REFERENCES shifts(id),
    outlet_id               VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id             VARCHAR(8) NOT NULL REFERENCES businesses(id),
    device_id               VARCHAR(64) NOT NULL DEFAULT 'legacy',

    staff_id                UUID NOT NULL REFERENCES users(id),   -- kasir pelaksana
    authorized_by           UUID REFERENCES users(id),            -- pemberi otoritas

    return_type             VARCHAR(10) NOT NULL,   -- FULL | PARTIAL
    refund_method           VARCHAR(30) NOT NULL,   -- CASH | CARD_REVERSAL | QRIS_REVERSAL | EXCHANGE | STORE_CREDIT
    refund_amount           DECIMAL(15,2) NOT NULL,

    reason_code             VARCHAR(50) NOT NULL,   -- lihat §3.5
    reason_notes            TEXT NOT NULL DEFAULT '',

    receipt_printed         BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_printed_at      TIMESTAMP WITH TIME ZONE,
    short_code              VARCHAR(20),

    client_created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_return_type   CHECK (return_type IN ('FULL', 'PARTIAL')),
    CONSTRAINT ck_refund_amount CHECK (refund_amount >= 0)
);

CREATE TABLE IF NOT EXISTS return_items (
    id                  UUID PRIMARY KEY,
    return_id           UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    transaction_item_id UUID NOT NULL REFERENCES transaction_items(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    quantity            INT NOT NULL,
    unit_price          DECIMAL(15,2) NOT NULL,   -- snapshot harga ASAL, bukan harga hari ini

    -- FALSE untuk barang rusak: uang kembali ke pelanggan, stok TIDAK kembali.
    -- Inilah pembeda retur dari void, dan alasan `returns` tidak boleh
    -- direduksi menjadi "transaksi bernilai negatif".
    restock             BOOLEAN NOT NULL DEFAULT TRUE,
    waste_reason_code   VARCHAR(50),

    CONSTRAINT ck_return_item_qty CHECK (quantity > 0),
    CONSTRAINT uq_return_item UNIQUE (return_id, transaction_item_id)
);

CREATE INDEX idx_returns_original ON returns (original_transaction_id);
CREATE INDEX idx_returns_shift    ON returns (shift_id, client_created_at DESC);
CREATE INDEX idx_return_items_tx  ON return_items (transaction_item_id);
CREATE UNIQUE INDEX uq_return_short_code
    ON returns (outlet_id, short_code) WHERE short_code IS NOT NULL;
```

#### `000020_create_void_logs.up.sql` — butir 5, 6, 13, 15

```sql
-- Satu tabel untuk SELURUH peristiwa pembatalan, termasuk yang terjadi
-- SEBELUM sebuah transaksi lahir.
--
-- Justru di sanalah kecurangan hidup: kasir memasukkan 10 item, pelanggan
-- membayar 10, kasir menurunkan menjadi 4 sebelum menekan Bayar, selisih 6
-- masuk kantong. Tanpa tabel ini peristiwa tersebut tidak meninggalkan jejak
-- APA PUN di sistem — tidak ada transaksi, tidak ada stok bergerak, tidak ada
-- baris untuk diaudit.
CREATE TABLE IF NOT EXISTS void_logs (
    id                UUID PRIMARY KEY,           -- UUID KLIEN (R2)
    outlet_id         VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id       VARCHAR(8) NOT NULL REFERENCES businesses(id),
    device_id         VARCHAR(64) NOT NULL DEFAULT 'legacy',
    shift_id          UUID NOT NULL REFERENCES shifts(id),

    staff_id          UUID NOT NULL REFERENCES users(id),
    authorized_by     UUID REFERENCES users(id),

    scope             VARCHAR(20) NOT NULL,   -- CART_LINE | HELD_ORDER | TRANSACTION

    transaction_id    UUID REFERENCES transactions(id),  -- hanya scope TRANSACTION
    held_cart_id      UUID,                              -- lokal-only, TANPA FK
    product_id        UUID REFERENCES products(id),      -- hanya scope CART_LINE

    quantity_before   INT NOT NULL DEFAULT 0,
    quantity_after    INT NOT NULL DEFAULT 0,
    value_amount      DECIMAL(15,2) NOT NULL,  -- nilai rupiah yang lenyap dari keranjang

    reason_code       VARCHAR(50) NOT NULL,
    reason_notes      TEXT NOT NULL DEFAULT '',

    -- BUTIR 6: bukti bahwa struk pembatalan benar-benar terbit.
    receipt_printed   BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_printed_at TIMESTAMP WITH TIME ZONE,

    -- Snapshot item untuk scope HELD_ORDER / TRANSACTION — held cart tidak
    -- pernah ada di server, jadi isinya harus dibawa serta atau hilang selamanya.
    items_snapshot    JSONB,

    client_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_void_scope CHECK (scope IN ('CART_LINE', 'HELD_ORDER', 'TRANSACTION')),

    -- Setiap scope wajib membawa referensinya sendiri; tidak ada baris yatim.
    CONSTRAINT ck_void_scope_ref CHECK (
        (scope = 'TRANSACTION' AND transaction_id IS NOT NULL)
     OR (scope = 'HELD_ORDER'  AND held_cart_id   IS NOT NULL)
     OR (scope = 'CART_LINE'   AND product_id     IS NOT NULL)
    ),
    CONSTRAINT ck_void_qty CHECK (quantity_after <= quantity_before)
);

CREATE INDEX idx_void_logs_shift ON void_logs (shift_id, client_created_at DESC);
CREATE INDEX idx_void_logs_staff ON void_logs (staff_id, created_at DESC);
CREATE INDEX idx_void_logs_scope ON void_logs (outlet_id, scope, created_at DESC);
```

#### `000021_alter_shifts_blind_close.up.sql` — butir 9, 10, 12

```sql
ALTER TABLE shifts
    -- ── YANG DIINPUT KASIR (butir 9) — hanya tiga angka ini ────────────────
    ADD COLUMN IF NOT EXISTS declared_cash         DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS declared_edc_total    DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS declared_qris_total   DECIMAL(15,2) NOT NULL DEFAULT 0,

    -- ── YANG DIHITUNG SERVER (R3/R4) — tidak pernah dikirim ke perangkat kasir ─
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

-- BUTIR 12 — PENGUNCIAN IDENTITAS, ditegakkan indeks, bukan sekadar UI.
-- Satu perangkat hanya boleh punya satu shift OPEN.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_open_per_device
    ON shifts (outlet_id, device_id) WHERE status = 'OPEN';

-- Satu staff hanya boleh punya satu shift OPEN di seluruh bisnis. Mencegah
-- satu PIN dipakai membuka laci di dua perangkat sekaligus.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_open_per_staff
    ON shifts (staff_id) WHERE status = 'OPEN';

-- BUTIR 10: shift baru wajib membawa versi master data.
ALTER TABLE shifts
    ADD CONSTRAINT ck_shift_master_version CHECK (
        status <> 'OPEN' OR master_data_version IS NOT NULL OR device_id = 'legacy'
    );

COMMENT ON COLUMN shifts.expected_balance IS
    'DEPRECATED v2 — diisi ganda dari expected_cash selama jendela M18. Jangan dibaca kode baru.';
COMMENT ON COLUMN shifts.discrepancy IS
    'DEPRECATED v2 — diisi ganda dari cash_variance selama jendela M18.';
```

#### `000022_create_opname_sessions.up.sql` — butir 3, 4

```sql
-- BLIND OPNAME. `stock_opnames` v1 menyimpan system_stock, actual_stock, dan
-- difference dalam SATU baris yang ditulis sekali — bentuk itu secara struktural
-- mustahil menyembunyikan ekspektasi, karena baris hanya lahir setelah semuanya
-- diketahui. v2 memecahnya menjadi sesi dua-fase.
CREATE TABLE IF NOT EXISTS opname_sessions (
    id                UUID PRIMARY KEY,          -- UUID KLIEN (R2)
    outlet_id         VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id       VARCHAR(8) NOT NULL REFERENCES businesses(id),
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

    CONSTRAINT ck_opname_status CHECK (status IN ('DRAFT','LOCKED','APPROVED','REJECTED')),
    CONSTRAINT ck_opname_locked_ts CHECK (
        (status = 'DRAFT' AND locked_at IS NULL) OR
        (status <> 'DRAFT' AND locked_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS opname_session_items (
    id                      UUID PRIMARY KEY,
    session_id              UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
    raw_material_id         UUID NOT NULL REFERENCES raw_materials(id),

    -- SATU-SATUNYA kolom yang diisi petugas.
    actual_stock            DECIMAL(12,4) NOT NULL,
    actual_package_quantity FLOAT,
    input_type              VARCHAR(50) NOT NULL DEFAULT 'base_unit',

    -- ── NULL SELAMA STATUS = DRAFT. Inilah butir 3 dalam bentuk kolom. ──────
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

CREATE INDEX idx_opname_items_session ON opname_session_items (session_id);
CREATE INDEX idx_opname_sessions_outlet ON opname_sessions (outlet_id, status, created_at DESC);

-- BUTIR 10 (pendukung): versi master data per outlet, dinaikkan dalam transaksi
-- yang SAMA dengan setiap mutasi produk/kategori/staff.
CREATE TABLE IF NOT EXISTS outlet_master_versions (
    outlet_id  VARCHAR(6) PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
    version    BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO outlet_master_versions (outlet_id, version)
SELECT id, 1 FROM outlets ON CONFLICT DO NOTHING;
```

> `stock_opnames` v1 **tidak dihapus**. Saat sesi disetujui (`APPROVED`), service menulis satu baris
> `stock_opnames` per item sebagai *projection* agar laporan pemilik yang sudah ada tetap hidup.

#### `000023_create_pos_security_events.up.sql` — butir 9, 12, 14 (+ R9)

```sql
-- audit_logs yang ada hanya menangkap permintaan HTTP. Kecurangan di POS
-- terjadi justru ketika perangkat offline — dan tidak ada satu pun permintaan
-- HTTP yang lahir dari peristiwa itu. Tabel ini adalah kanal audit yang IKUT
-- ANTRE SYNC, sehingga jejaknya tetap tiba meski terlambat berjam-jam.
CREATE TABLE IF NOT EXISTS pos_security_events (
    id                UUID PRIMARY KEY,          -- UUID KLIEN (R2)
    outlet_id         VARCHAR(6) NOT NULL REFERENCES outlets(id),
    business_id       VARCHAR(8) NOT NULL REFERENCES businesses(id),
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

CREATE INDEX idx_sec_events_outlet ON pos_security_events (outlet_id, created_at DESC);
CREATE INDEX idx_sec_events_type   ON pos_security_events (event_type, created_at DESC);
CREATE INDEX idx_sec_events_shift  ON pos_security_events (shift_id);

-- BUTIR 4/12/14: peran staff. Master data POS harus membawanya agar otorisasi
-- dapat diputuskan OFFLINE.
--
-- ⚠️ KOREKSI SAAT EKSEKUSI M11.1 — rancangan awal keliru di tiga tempat:
--
--   1. Tabelnya bernama `users`, BUKAN `staffs`. `domain.Staff.TableName()`
--      mengembalikan "users"; tabel `staffs` tidak pernah ada.
--   2. Kolom `role VARCHAR(20) NOT NULL DEFAULT 'CASHIER'` SUDAH ADA sejak
--      migrasi 000002. Yang benar-benar baru hanya `permissions`.
--   3. 'ADMIN' WAJIB masuk daftar peran yang sah: `domain.RoleAdmin` sudah
--      memakainya, dan CHECK yang mengabaikannya menggagalkan migrasi pada
--      baris nyata.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users
    ADD CONSTRAINT ck_staff_role CHECK (
        role IN ('CASHIER', 'ADMIN', 'SUPERVISOR', 'STOCK_KEEPER', 'MANAGER')
    );

-- BUTIR 7: bukti cetak struk pembuangan.
ALTER TABLE product_wastes
    ADD COLUMN IF NOT EXISTS receipt_printed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS printed_at      TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS shift_id        UUID REFERENCES shifts(id),
    ADD COLUMN IF NOT EXISTS device_id       VARCHAR(64) NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS reason_code     VARCHAR(50) NOT NULL DEFAULT 'OTHER';
```

### 3.3 Enum `event_type` untuk `pos_security_events`

| `event_type` | Severity | Dipicu oleh |
|---|---|---|
| `KIOSK_EXIT_GRANTED` | WARN | Butir 14 — PIN otoritas diterima |
| `KIOSK_EXIT_DENIED` | CRITICAL | Butir 14 — PIN salah / peran tidak berwenang |
| `LOGOUT_BLOCKED_ACTIVE_SHIFT` | WARN | Butir 12 |
| `STAFF_SWITCH_BLOCKED` | WARN | Butir 12 |
| `OPEN_SHIFT_BLOCKED_STALE_MASTER` | INFO | Butir 10 |
| `QTY_DECREASE_ESCALATED_TO_VOID` | WARN | Butir 5 |
| `VOID_RECEIPT_PRINT_FAILED` | CRITICAL | Butir 6 + R6 |
| `WASTE_RECEIPT_PRINT_FAILED` | CRITICAL | Butir 7 + R6 |
| `RECEIPT_REPRINTED` | WARN | Cetak ulang struk penjualan |
| `VOID_AFTER_PRINT_ATTEMPTED` | CRITICAL | Butir 15 — kasir mencoba void transaksi tercetak |
| `PIN_FAILED_THRESHOLD` | CRITICAL | 5 kegagalan PIN dalam 60 detik |
| `CLOCK_SKEW_DETECTED` | WARN | Sudah ada di v1, kini ikut terekam |

### 3.4 Aturan integritas yang **tidak bisa** dijamin `CHECK` constraint

Empat aturan berikut lintas-baris sehingga wajib ditegakkan di *service layer* Go, di dalam satu
transaksi basis data dengan `SELECT … FOR UPDATE`:

| Aturan | Penegakan |
|---|---|
| `Σ return_items.quantity` per `transaction_item_id` ≤ `transaction_items.quantity` | `ReturnService.Create` — kunci baris `transaction_items` induk, jumlahkan retur terdahulu, tolak `422 RETURN_EXCEEDS_ORIGINAL` |
| `Σ transaction_payments.amount` = `transactions.total_amount` | `SyncService.upsertTransaction` — tolak `422 TENDER_MISMATCH` |
| `system_stock` hanya boleh terisi pada transisi `DRAFT → LOCKED` | `OpnameService.Lock` — satu-satunya jalur tulis; kolom tidak pernah diterima dari body permintaan |
| `expected_*` shift dihitung ulang server, input klien diabaikan | `ShiftService.Reconcile` — lihat R4 |

### 3.5 Kamus `reason_code` (kontrak beku lintas platform)

```
VOID   : CUSTOMER_CANCEL · WRONG_ITEM · WRONG_QTY · PRICE_DISPUTE ·
         TRAINING · SYSTEM_ERROR · DUPLICATE_ENTRY · OTHER
RETURN : DEFECTIVE · WRONG_ITEM_DELIVERED · CUSTOMER_CHANGED_MIND ·
         EXPIRED · SIZE_EXCHANGE · OTHER
WASTE  : EXPIRED · SPOILED · BROKEN · SPILLED · STAFF_MEAL ·
         SAMPLE_TASTING · PRODUCTION_ERROR · OTHER
```

`OTHER` **wajib** disertai `reason_notes` minimal 10 karakter — ditegakkan di form dan di
service (`422 REASON_NOTES_REQUIRED`). Tanpa aturan itu seluruh kamus akan runtuh menjadi `OTHER`
dalam dua minggu dan laporan kecurangan kehilangan seluruh dayanya.

### 3.6 Skema klien — Dexie v4 (`posgodinov-fe`)

```ts
// lib/db/dexie.ts — TAMBAHKAN, jangan ubah version(1..3).
this.version(4).stores({
  transactions:
    'id, shift_id, status, _synced, client_created_at, short_code, ' +
    'receipt_printed_at, return_state, ' +
    '[_synced+client_created_at], [shift_id+status], [shift_id+_synced], ' +
    '[shift_id+client_created_at]',          // butir 16 — riwayat per shift aktif
  returns:        'id, original_transaction_id, shift_id, _synced, [_synced+client_created_at]',
  voidLogs:       'id, shift_id, scope, _synced, [_synced+client_created_at]',
  securityEvents: 'id, event_type, _synced, [_synced+client_created_at]',
  printJobs:      'id, status, kind, created_at, [status+created_at]',  // LOKAL — tidak pernah di-sync
  wastes:         'id, _synced, staff_id, shift_id, [_synced+client_created_at]',
  shifts:         'id, status, _synced, [status+_synced], staff_id, device_id',
}).upgrade(async (tx) => {
  // Transaksi lama: struk v1 SELALU dicetak saat commit, jadi backfill
  // receipt_printed_at = client_created_at. Menganggapnya NULL akan membuka
  // jalur Void untuk transaksi lampau — persis yang butir 15 larang.
  await tx.table('transactions').toCollection().modify((t) => {
    t.receipt_printed_at ??= t.client_created_at
    t.return_state ??= 'NONE'
    t.payments ??= [{ id: crypto.randomUUID(), method: t.payment_method,
                      amount: t.total_amount, sequence: 1 }]
  })
})
```

`payments`, `items`, dan `return_items` disimpan **bersarang** di dalam baris induk, konsisten dengan
keputusan v1 pada `LocalTransaction.items` — payload sync memang bersarang.

### 3.7 Skema klien — Drift v2 (`posgodinov-mobile`)

`schemaVersion: 1 → 2`, dengan `onUpgrade` eksplisit. Tabel baru:
`TransactionPayments`, `Returns`, `ReturnItems`, `VoidLogs`, `SecurityEvents`, `PrintJobs`.

```dart
@override
int get schemaVersion => 2;

@override
MigrationStrategy get migration => MigrationStrategy(
      onCreate: (Migrator m) async { /* … v1 … */ },
      onUpgrade: (Migrator m, int from, int to) async {
        if (from < 2) {
          await m.createTable(transactionPayments);
          await m.createTable(returns);
          await m.createTable(returnItems);
          await m.createTable(voidLogs);
          await m.createTable(securityEvents);
          await m.createTable(printJobs);

          await m.addColumn(transactions, transactions.receiptPrintedAt);
          await m.addColumn(transactions, transactions.shortCode);
          await m.addColumn(transactions, transactions.returnState);
          await m.addColumn(transactions, transactions.deviceId);
          await m.addColumn(shifts, shifts.declaredCashMinor);
          await m.addColumn(shifts, shifts.declaredEdcTotalMinor);
          await m.addColumn(shifts, shifts.declaredQrisTotalMinor);
          await m.addColumn(shifts, shifts.masterDataVersion);
          await m.addColumn(shifts, shifts.deviceId);
          await m.addColumn(wastes, wastes.receiptPrinted);

          // Backfill sejalan dengan Dexie §3.6 — alasannya identik.
          await customStatement(
            'UPDATE transactions SET receipt_printed_at = client_created_at '
            'WHERE receipt_printed_at IS NULL',
          );
          await customStatement(
            'INSERT INTO transaction_payments (id, transaction_id, sequence, method, amount_minor) '
            "SELECT lower(hex(randomblob(16))), id, 1, payment_method, total_amount_minor "
            'FROM transactions',
          );

          await customStatement(
            'CREATE INDEX idx_tx_shift_created ON transactions (shift_id, client_created_at DESC)');
          await customStatement(
            'CREATE UNIQUE INDEX uq_tx_short_code ON transactions (short_code)');
          await customStatement(
            'CREATE INDEX idx_void_queue ON void_logs (synced, client_created_at)');
          await customStatement(
            'CREATE INDEX idx_return_queue ON returns (synced, client_created_at)');
          await customStatement(
            'CREATE INDEX idx_sec_queue ON security_events (synced, client_created_at)');
        }
      },
    );
```

> ⚠️ **Wajib** menambahkan uji migrasi Drift (`drift_dev` schema dump `v1 → v2`) sebelum M11 ditutup.
> Migrasi Drift yang salah bukan bug tampilan — ia menghapus transaksi yang belum tersinkron.

### 3.8 Tabel lokal `print_jobs` (tidak pernah di-sync)

```
kind    : SALE_RECEIPT | CANCEL_RECEIPT | RETURN_RECEIPT | WASTE_RECEIPT | SHIFT_REPORT
status  : PENDING → PRINTING → PRINTED
                             ↘ FAILED → (retry ≤ 3) → PENDING
                                      ↘ ABANDONED (butuh tindakan manual)
ref_type/ref_id : mengikat job ke transaction/return/void_log/waste
payload : byte ESC/POS yang sudah dirender — dirender SEKALI agar cetak ulang
          menghasilkan kertas yang identik, bukan hasil render ulang dari data
          yang mungkin sudah berubah
```

Job `FAILED`/`ABANDONED` memunculkan banner persisten di Bottom Bar dan menulis
`pos_security_events` bertipe `*_RECEIPT_PRINT_FAILED` (R6, R9).

---

## 4. Perubahan Kontrak API (Frontend ↔ Golang Backend)

### 4.1 Strategi versi

Perangkat di lapangan tidak dapat diperbarui serentak — sebuah tablet yang mati selama dua minggu
akan kembali online membawa payload v1 berisi transaksi asli yang uangnya sudah diterima. Menolaknya
berarti menghapus penjualan nyata.

```
Klien mengirim:  X-POS-Contract-Version: 2
Server:
  ├── header absen / "1"  → jalur v1 (parser lama, entitas baru diabaikan)
  └── header "2"          → jalur v2 (parser baru, seluruh entitas)

Respons SELALU menyertakan:  X-POS-Contract-Supported: 1,2
Jendela deprekasi v1 berakhir di M18.4; setelah itu v1 → 426 UPGRADE_REQUIRED.
```

Implementasi: `internal/handler/pos_sync_handler.go` melakukan *dispatch* di awal, dua fungsi
`decodeV1` / `decodeV2` yang keduanya menghasilkan `domain.SyncUpRequestV2` — logika service hanya
satu, tidak bercabang.

### 4.2 `POST /v1/pos/sync` — permintaan

```jsonc
{
  "device_id": "f3a1…",                    // BARU — wajib v2 (butir 12)
  "master_data_version": 184,              // BARU — versi yang dipegang perangkat (butir 10)

  "shifts": [{
    "id": "uuid-klien",
    "staff_id": "…", "device_id": "f3a1…",
    "opening_balance": 500000.00,
    "master_data_version": 184,            // BARU

    // BUTIR 9 — HANYA tiga angka ini yang berasal dari kasir.
    "declared_cash":       1750000.00,     // BARU
    "declared_edc_total":   900000.00,     // BARU
    "declared_qris_total":  250000.00,     // BARU
    "blind_close": true,                   // BARU

    // ⛔ expected_balance / discrepancy TIDAK LAGI DIKIRIM klien.
    //    Bila tetap terkirim (perangkat lama), server MENGABAIKANNYA (R4).
    "status": "CLOSED",
    "client_opened_at": "…", "client_closed_at": "…"
  }],

  "transactions": [{
    "id": "uuid-klien",
    "shift_id": "…", "device_id": "f3a1…",
    "short_code": "AB1234-250820-K7QF",    // BARU (butir 16)
    "customer_name": "",
    "total_amount": 155000.00,
    "status": "COMPLETED",                 // COMPLETED | VOIDED  (CANCELLED = warisan)
    "receipt_printed_at": "2026-08-20T10:14:22+07:00",  // BARU — diskriminator (butir 15)
    "reprint_count": 0,

    "payment_method": "SPLIT",             // ringkasan v1-compat
    "payments": [                          // BARU (butir 8) — sumber kebenaran
      { "id": "uuid", "sequence": 1, "method": "CASH",  "amount": 55000.00 },
      { "id": "uuid", "sequence": 2, "method": "DEBIT", "amount": 100000.00,
        "trace_number": "004871",          // WAJIB untuk DEBIT/CREDIT
        "card_last4": "4417",              // WAJIB untuk DEBIT/CREDIT
        "card_network": "GPN", "edc_terminal_id": "EDC-02" }
    ],

    "void_reason_code": null,
    "client_created_at": "…",
    "items": [ { "id": "…", "product_id": "…", "quantity": 2, "unit_price": 27500.00 } ]
  }],

  "returns": [{                            // BARU (butir 15)
    "id": "uuid-klien",
    "original_transaction_id": "…",
    "shift_id": "shift-SAAT-INI",
    "device_id": "f3a1…", "staff_id": "…", "authorized_by": "…",
    "return_type": "PARTIAL",
    "refund_method": "CASH",
    "refund_amount": 55000.00,
    "reason_code": "DEFECTIVE",
    "reason_notes": "Kemasan bocor saat diterima pelanggan",
    "receipt_printed": true,
    "short_code": "AB1234-250820-R2M9",
    "client_created_at": "…",
    "items": [{
      "id": "…", "transaction_item_id": "…", "product_id": "…",
      "quantity": 2, "unit_price": 27500.00,
      "restock": false, "waste_reason_code": "BROKEN"
    }]
  }],

  "void_logs": [{                          // BARU (butir 5, 6, 13, 15)
    "id": "uuid-klien",
    "shift_id": "…", "device_id": "f3a1…",
    "staff_id": "…", "authorized_by": "…",
    "scope": "CART_LINE",                  // CART_LINE | HELD_ORDER | TRANSACTION
    "transaction_id": null, "held_cart_id": null, "product_id": "…",
    "quantity_before": 12, "quantity_after": 3,
    "value_amount": 247500.00,
    "reason_code": "WRONG_QTY", "reason_notes": "Pelanggan mengurangi pesanan",
    "receipt_printed": true,
    "items_snapshot": null,
    "client_created_at": "…"
  }],

  "security_events": [{                    // BARU (R9; butir 12, 14)
    "id": "uuid-klien",
    "shift_id": "…", "staff_id": "…", "device_id": "f3a1…",
    "event_type": "KIOSK_EXIT_DENIED", "severity": "CRITICAL",
    "details": { "attempts": 3, "staff_identifier": "K-014" },
    "client_created_at": "…"
  }],

  "wastes": [{ "…": "…", "shift_id": "…", "reason_code": "SPOILED", "receipt_printed": true }]
}
```

### 4.3 `POST /v1/pos/sync` — respons

```jsonc
{
  "shifts_synced": 1, "transactions_synced": 42, "wastes_synced": 3,
  "returns_synced": 2, "void_logs_synced": 7, "security_events_synced": 4,   // BARU

  "failed_transactions": ["uuid-a", "uuid-b"],   // v1-compat, DIPERTAHANKAN

  // BARU — galat per-entitas dengan alasan. `failed_transactions` yang berupa
  // array string tidak pernah bisa memberi tahu kasir MENGAPA barisnya ditolak,
  // sehingga layar P-13 hanya bisa menyuruh "coba lagi" tanpa akhir.
  "errors": [
    { "entity": "transaction", "id": "uuid-a", "code": "TENDER_MISMATCH",
      "message": "Σ payments (150000) ≠ total_amount (155000)", "retryable": false },
    { "entity": "shift", "id": "uuid-c", "code": "SHIFT_ALREADY_OPEN_ON_DEVICE",
      "message": "Perangkat f3a1 sudah memiliki shift OPEN", "retryable": false },
    { "entity": "return", "id": "uuid-d", "code": "RETURN_EXCEEDS_ORIGINAL",
      "message": "Item sudah diretur 2 dari 2", "retryable": false }
  ],

  "master_data_version": 187,     // BARU — klien tahu master-nya kedaluwarsa
  "server_time": "2026-08-20T10:15:03Z"
}
```

**`retryable` menentukan perilaku klien:**

| `retryable` | Perilaku klien |
|---|---|
| `true` | Baris tetap `_synced = 0`, `_syncAttempts++`, masuk backoff normal |
| `false` | Baris ditandai `_synced = -1` (**karantina**), keluar dari antrean, muncul di P-13 sebagai "Butuh tindakan" |

Tanpa karantina, satu baris yang cacat permanen akan memblokir batch selamanya dan seluruh antrean
di belakangnya ikut membusuk.

### 4.4 `GET /v1/pos/sync/master-data` — tambahan

```jsonc
{
  "version": 187,                                    // BARU (butir 10)
  "generated_at": "2026-08-20T10:00:00Z",

  "staffs": [{
    "id": "…", "staff_identifier": "K-014", "name": "…", "pin_hash": "$2a$…",
    "role": "SUPERVISOR",                            // BARU (butir 4, 12, 14)
    "permissions": ["VOID_APPROVE", "KIOSK_EXIT", "RETURN_APPROVE", "OPNAME_COUNT"]
  }],
  "categories": [ /* tidak berubah */ ],
  "products":   [ /* tidak berubah — TETAP TANPA stok (butir 3) */ ],

  "config": {                                        // BARU — kebijakan per-bisnis
    "void_threshold_qty": 5,                         // butir 5
    "require_supervisor_for_void": true,
    "require_supervisor_for_return": true,
    "blind_close_enabled": true,                     // butir 9
    "blind_opname_enabled": true,                    // butir 3
    "kiosk_exit_permission": "KIOSK_EXIT",           // butir 14
    "history_scope": "ACTIVE_SHIFT",                 // butir 16
    "master_data_max_age_minutes": 720               // butir 10
  }
}
```

`config` dikirim dari server agar ambang batas dapat diubah pemilik **tanpa merilis ulang aplikasi**.
Klien menyimpannya di `meta['config']` dan **wajib** punya nilai bawaan hard-coded untuk perangkat
yang belum pernah menarik v2.

⛔ **Yang TIDAK boleh ditambahkan ke endpoint ini:** `products[].stock` dan `raw_materials[].stock`.
Butir 3 gugur seketika bila stok sistem hadir di payload yang dipegang perangkat kasir/opname —
DevTools dan `adb logcat` membuat "disembunyikan di UI" menjadi tidak berarti.

### 4.5 Endpoint baru

| Metode & Path | Auth | Butir | Keterangan |
|---|---|---|---|
| `GET /v1/pos/transactions/lookup?code={short_code}` | Device | 16 | Pencarian transaksi lampau lintas shift. **Wajib** `short_code` atau UUID penuh — **tidak ada** mode "daftar semua". Rate limit 30/menit/perangkat. |
| `GET /v1/pos/transactions/{id}/returnable` | Device | 15 | Mengembalikan sisa qty yang masih boleh diretur per item. Mencegah kasir menghitung manual. |
| `POST /v1/pos/opname/sessions` | Device (peran `STOCK_KEEPER`) | 3, 4 | Membuat sesi `DRAFT`. Respons **tanpa** `system_stock`. |
| `PUT /v1/pos/opname/sessions/{id}/items` | Device | 3 | Upsert hitungan fisik. Menolak bila status ≠ `DRAFT`. Respons **tanpa** `difference`. |
| `POST /v1/pos/opname/sessions/{id}/lock` | Device | 3 | **Transisi kunci.** Server mengambil snapshot `system_stock` di dalam satu transaksi, menghitung `difference`, lalu — dan hanya di sini — mengembalikannya. |
| `GET /v1/business/outlets/{id}/opname/sessions` | Business (pemilik) | 3, 4 | Tinjauan & persetujuan. |
| `POST /v1/business/outlets/{id}/opname/sessions/{sid}/approve` | Business | 3 | `LOCKED → APPROVED`, menerapkan penyesuaian stok + menulis projection `stock_opnames`. |
| `GET /v1/business/outlets/{id}/shifts/{sid}/reconciliation` | Business | 9 | Angka Blind Closing lengkap. **Hanya token bisnis**, tidak pernah token perangkat. |
| `GET /v1/business/outlets/{id}/void-logs` | Business | 5, 13 | Laporan kecurangan: void per kasir, per jam, per nilai. |
| `GET /v1/business/outlets/{id}/returns` | Business | 15 | Laporan retur. |

### 4.6 Kontrak `POST …/opname/sessions/{id}/lock` — inti butir 3

```
PERMINTAAN                                RESPONS (dan HANYA di sini)
──────────                                ───────────────────────────
POST /lock                                200 OK
{ "confirm": true }                       {
                                            "status": "LOCKED",
Selama status DRAFT, SETIAP respons         "locked_at": "…",
endpoint opname MENGHILANGKAN               "summary": {
`system_stock` dan `difference`               "items_counted": 87,
dari serialisasi — bukan mengisinya           "items_with_variance": 12,
dengan null, melainkan MENGHAPUS              "total_variance_value": -184500.00
field-nya (`omitempty` + DTO terpisah).     },
                                            "items": [
Struct DTO dibuat DUA: `OpnameItemDraftDTO`   { "raw_material_id": "…",
(tanpa field ekspektasi) dan                    "actual_stock": 12.0000,
`OpnameItemLockedDTO` (lengkap).                "system_stock": 15.5000,
Satu struct dengan tag `omitempty`              "difference": -3.5000,
akan bocor begitu ada yang lupa                 "difference_value": -52500.00,
menulis `nil` — dua struct membuat              "fraud_flag": true }
kebocoran itu MUSTAHIL DIKOMPILASI.         ]
                                          }
```

### 4.7 Ringkasan perubahan sisi Go

| Berkas | Perubahan |
|---|---|
| `internal/domain/pos_transaction.go` | `Transaction` + 8 field; struct baru `TransactionPayment`, `Return`, `ReturnItem`, `VoidLog`, `SecurityEvent`; `Shift` + 12 field |
| `internal/domain/pos_sync.go` | `SyncUpRequest` → `SyncUpRequestV2` (+4 koleksi); `SyncUpResponse` + `Errors []SyncError` |
| `internal/domain/opname_session.go` | **baru** — entitas + `OpnameItemDraftDTO` / `OpnameItemLockedDTO` |
| `internal/domain/pos_master_data.go` | `POSMasterStaff` + `Role`, `Permissions`; response + `Version`, `Config` |
| `internal/service/pos_sync_service.go` | Urutan proses: `Shifts → Transactions(+payments) → Returns → VoidLogs → Wastes → SecurityEvents`; rekonsiliasi shift; hitung `return_state` |
| `internal/service/shift_reconcile_service.go` | **baru** — R3/R4, hitung `expected_*` & `*_variance` |
| `internal/service/opname_session_service.go` | **baru** — transisi `DRAFT→LOCKED→APPROVED` |
| `internal/repository/*` | Repo baru: `ReturnRepository`, `VoidLogRepository`, `SecurityEventRepository`, `OpnameSessionRepository`, `MasterVersionRepository` |
| `internal/handler/router.go` | +9 rute (§4.5) |
| `internal/middleware/pos_device.go` | Membaca klaim `role` & `device_id` dari token perangkat |

### 4.8 Idempotensi & konkurensi

Seluruh entitas baru memakai UUID buatan klien, sehingga `INSERT … ON CONFLICT (id) DO UPDATE`
tetap menjadi pola tunggal — konsisten dengan v1. Tiga tambahan:

1. **`returns` bersifat `DO NOTHING`, bukan `DO UPDATE`.** Retur yang sudah tercatat tidak boleh
   ditimpa oleh pengiriman ulang yang membawa nilai berbeda akibat jam perangkat mundur.
2. **Rekonsiliasi shift bersifat idempoten** — `Reconcile` menghitung ulang dari nol setiap kali
   dipanggil, tidak menambah secara inkremental.
3. **`return_state` dihitung ulang** dalam transaksi yang sama dengan penyisipan `returns`,
   dengan `SELECT … FOR UPDATE` pada transaksi asal.

---

# BAGIAN II — RENCANA EKSEKUSI

> **Cara memakai.** Centang `[x]` hanya bila butir benar-benar berjalan **dan** gerbang mutu fasenya
> hijau. Butir yang "sudah ditulis tapi belum dijalankan" tetap `[ ]`.
> Setiap fase menyebutkan repositori terdampak: 🐹 `posgodinov-be` · 🌐 `posgodinov-fe` ·
> 📱 `posgodinov-mobile` · 📦 `posgodinov-opname`.

| Fase | Judul | Butir | Estimasi | Status |
|---|---|---|---|---|
| **M11** | Skema Basis Data & Kontrak Audit | 8, 15, 16 (skema) | 8–10 hari | 🟡 M11.2/M11.3/M11.4 🟢 · M11.1 belum dijalankan (tanpa PostgreSQL) · M11.5 kode lengkap (tanpa Flutter SDK) |
| **M12** | Engine Transisi & Auto-Sync | 1, 2 | 4–5 hari | 🟡 Web 🟢 (`tsc`+`eslint` hijau) · Mobile kode lengkap, **nol perkakas dijalankan** |
| **M13** | State Machine Void vs Retur | 5, 13, 15 | 8–10 hari | 🟡 Web 🟢 (`tsc`+`eslint` hijau) · Mobile & Go kode lengkap, **nol perkakas dijalankan** |
| **M14** | Hardware & Print Flow | 6, 7 | 5–6 hari | 🟡 Web 🟢 (`tsc`+`eslint` hijau) · Mobile kode lengkap, **nol perkakas dijalankan** · DoD 1–6 menunggu printer fisik |
| **M15** | Blind Shift, Guard & Identity Lock | 9, 10, 12, 17 | 7–8 hari | 🟡 Web 🟢 (`tsc`+`eslint` hijau) · Go & Mobile kode lengkap, **nol perkakas dijalankan** · DoD 1–8 menunggu perangkat & PostgreSQL |
| **M16** | Modul Opname Terisolasi (paralel) | 3, 4 | 10–12 hari | 🟡 Tahap 1 (M16.1–M16.3): Web 🟢 (`tsc`+`eslint` hijau, aturan isolasi diverifikasi umpan) · Go kode lengkap, **nol perkakas dijalankan** · M16.4–M16.6 belum mulai |
| **M17** | UI/UX Revamp — Thumb Zone & Isolasi | 11, 14, 16, 18 | 8–10 hari | 🟡 M17.1–M17.4: Web 🟢 (`tsc`+`eslint` hijau) · Mobile & Go kode lengkap, **nol perkakas dijalankan** · butir sisa M17.4 (Kiosk web/Fullscreen API) belum |
| **M18** | Migrasi Data, Hardening & Rilis | — | 6–8 hari | 🟡 M18.2 *feature flag* 🟢 · M18.3 UAT +52 skenario 🟢 · M18.4 migrasi 000025 ditulis & **dikunci** · M18.1 (migrasi produksi) & sisa M18.3 (panduan/runbook) menunggu lingkungan nyata |

---

## Fase M11 — Skema Basis Data & Kontrak Audit

**Tujuan.** Seluruh bentuk data v2 ada dan teruji, tanpa satu pun perubahan perilaku yang terlihat
pengguna. Setelah M11 selesai, aplikasi harus berjalan **persis seperti v1** — dengan tabel dan
kolom baru yang masih kosong. Fase ini adalah gerbang: tidak ada fase lain boleh dimulai sebelumnya.

**Mengapa didahulukan.** Migrasi Dexie dan Drift adalah satu-satunya operasi di seluruh v2 yang
dapat **menghancurkan transaksi yang belum tersinkron** — yaitu uang yang sudah diterima tetapi
belum pernah sampai ke server. Menjalankannya lebih awal, sendirian, tanpa perubahan perilaku yang
menyertainya, membuat kegagalannya dapat dikenali dan di-*rollback* tanpa ambiguitas.

### M11.1 Migrasi PostgreSQL 🐹 — 🟡 ditulis lengkap, **belum dijalankan**

> ⚠️ **Tidak ada PostgreSQL di mesin ini** (`psql` tidak terpasang, daemon Docker mati), sehingga
> `migrate up`/`down` **belum pernah dijalankan** atas kedelapan migrasi ini. Yang terverifikasi
> hanya pemeriksaan statis: pasangan up/down lengkap, versi berurutan tanpa lompatan, penanda
> `$$` blok `DO` seimbang. Gerbang M11 tetap **MERAH** sampai DoD butir 1 hijau.

- [x] `000017_create_transaction_payments` (up + **down**) — butir 8
- [x] `000018_alter_transactions_v2_state` (up + down) — butir 15, 16, 12
- [x] `000019_create_returns` (up + down) — butir 15
- [x] `000020_create_void_logs` (up + down) — butir 5, 6, 13, 15
- [x] `000021_alter_shifts_blind_close` (up + down) — butir 9, 10, 12
- [x] `000022_create_opname_sessions` + `outlet_master_versions` (up + down) — butir 3, 10
- [x] `000023_create_pos_security_events` + `users.permissions` + `product_wastes.*` (up + down) — butir 7, 14, R9
- [x] Skrip backfill `000024_backfill_v2.up.sql` (+ down), idempoten:
      - `transaction_payments` ← satu baris per transaksi lama, ber-`is_reconstructed = TRUE`
      - `transactions.receipt_printed_at` ← `client_created_at` (alasan di §3.6)
      - `transactions.short_code` ← `<outlet>-<YYMMDD>-<5 hex>`, tabrakan dibiarkan NULL
      - `shifts.declared_cash` ← `closing_balance`; `expected_cash` ← `expected_balance`;
        `cash_variance` ← `discrepancy`; `blind_close` dipaksa `FALSE`
      - blok verifikasi `DO $$` yang **menggagalkan migrasi** bila hasilnya tidak utuh
- [ ] Verifikasi `migrate down` mengembalikan skema ke state `000016` **tanpa galat** pada basis data
      berisi data hasil backfill — **terhalang: tidak ada PostgreSQL**

> **Tiga temuan yang mengubah rancangan §3.2.** Dicatat terbuka karena ketiganya akan menggagalkan
> migrasi bila dijalankan sesuai rancangan awal:
>
> | Temuan | Rancangan awal | Yang benar |
> |---|---|---|
> | Tabel staff | `ALTER TABLE staffs` | Tabelnya **`users`**; `staffs` tidak pernah ada. Kolom `role` **sudah ada** sejak migrasi 000002, jadi hanya `permissions` yang baru — dan `'ADMIN'` wajib masuk daftar peran sah, kalau tidak CHECK-nya menolak baris produksi. |
> | Format `short_code` | 4 char Crockford-Base32 | 5 char heksadesimal — ruang tabrakan identik (16⁵ = 32⁴), tetapi dapat dibangkitkan di SQL murni sehingga server dan klien memakai satu format. |
> | Tender kartu warisan | `ck_card_requires_trace` berlaku untuk semua | Transaksi `DEBIT` pra-v2 **tidak pernah punya** trace number. Ditambahkan kolom `is_reconstructed` sebagai satu-satunya pengecualian; mengisi trace number dengan sentinel berarti **memalsukan bukti audit** pada kolom yang dibuat untuk mencegah pemalsuan. |
>
> `000021` juga mendapat blok pra-terbang `DO $$` yang menggagalkan migrasi dengan pesan yang dapat
> ditindaklanjuti bila data memuat dua shift `OPEN` pada perangkat/staff yang sama — tanpa itu,
> `CREATE UNIQUE INDEX` gagal dengan galat Postgres mentah yang tidak menunjuk baris mana pun.

### M11.2 Domain & repositori Go 🐹 — 🟢 `build` + `vet` + `test` hijau

- [x] Struct baru di `internal/domain/` sesuai §4.7 — `TransactionPayment`, `Return`, `ReturnItem`,
      `VoidLog`, `SecurityEvent`, `OpnameSession`(+DTO ganda), `SyncError`, `TenderSummary`,
      tipe `JSONB` & `StringList`
- [x] `Shift` + 14 kolom v2, `Transaction` + 13 kolom v2, `POSMasterStaff` + `Role`/`Permissions`
- [x] `ReturnRepository`, `VoidLogRepository`, `SecurityEventRepository`, `OpnameSessionRepository`,
      `MasterVersionRepository`, `TransactionPaymentRepository` (+ implementasi GORM)
- [x] `MasterVersionRepository.Bump(ctx, outletID)` dipanggil **di dalam transaksi yang sama**
      dengan setiap mutasi `products`, `product_categories`, `users`, `product_recipes`
- [x] `TransactionManager.WithTransaction` mendapat **penjaga sarang**: panggilan bersarang kini
      ikut serta pada transaksi berjalan alih-alih membuka transaksi kedua yang commit sendiri
- [x] Uji unit `TestMasterVersionBumpedOnMasterDataMutation` — 4 skenario, termasuk "mutasi gagal
      TIDAK menaikkan versi" dan "kenaikan versi gagal menggagalkan seluruh operasi"
- [ ] Uji unit repositori: idempotensi `ON CONFLICT` untuk kelima entitas baru — **terhalang:
      butuh PostgreSQL sungguhan**; `ON CONFLICT` tidak dapat diuji dengan mock
- [ ] Uji unit: `ck_card_requires_trace` & `ck_void_requires_unprinted` di lapisan basis data —
      **terhalang: butuh PostgreSQL**. Keduanya **sudah** teruji di lapisan service/kontrak
      (`TestSyncContractV2`), tetapi itu tidak membuktikan constraint-nya sendiri bekerja

### M11.3 Kontrak sync v2 🐹 — 🟢 `build` + `vet` + `test` hijau

- [x] `SyncUpRequestV2` (menyematkan `SyncUpRequest`) + `decodeSyncUpRequest` berbasis
      `X-POS-Contract-Version`; respons selalu membawa `X-POS-Contract-Supported: 1,2`
- [x] `SyncUpResponse.Errors []SyncError` dengan `retryable`; `failed_transactions` v1 tetap terisi
- [x] Urutan pemrosesan ditegakkan: `Shifts → Transactions → Returns → VoidLogs → Wastes → SecurityEvents`
- [x] `master-data` mengembalikan `version`, `staffs[].role`, `staffs[].permissions`, `config`
- [x] Aturan **R4** ditegakkan dua lapis: tag `json:"-"` pada `Shift.Expected*`/`*Variance` membuang
      kunci saat dekode, dan service mengosongkannya lagi untuk menutup jalur pemanggil internal
- [x] Uji kontrak `TestSyncContractV1Compat` (3 skenario) — payload v1 lama tetap `200`
- [x] Uji kontrak `TestSyncContractV2` (8 skenario) — seluruh entitas baru tersimpan, yang cacat
      ditolak dengan `retryable: false`
- [x] `TestMasterDataContractV2` — memeriksa **body mentah** tidak memuat `"stock"`,
      `"system_stock"`, `"cost_per_unit"`, `"recipes"` (aturan R3)
- [x] `TestShiftExpectedNeverAcceptedFromClient` — klien mengirim `expected_cash: 1`, server
      mengabaikannya (aturan R4)
- [x] Postman collection diperbarui — folder "POS v2 — Kontrak Sinkronisasi (M11)" berisi 3 request
      (v2 lengkap · kartu tanpa trace yang harus ditolak · v1 kompatibilitas)

> **Batas fase yang disengaja.** `syncReturns` **menyimpan** retur tetapi belum menggerakkan stok
> dan belum menghitung ulang `transactions.return_state` — keduanya pekerjaan **M13.6**. Risikonya
> nihil sekarang: tidak satu pun klien mengirim `returns` sampai M13 membangun layarnya. Yang
> penting pada M11 adalah bentuk datanya sudah benar dan idempoten saat retur pertama tiba.
>
> **Satu regresi tertangkap uji.** Klien v1 mengirim `payment_method: "DEBIT"` **tanpa** trace
> number. Menuntut butir 8 pada tender hasil sintesis akan menolak **setiap penjualan kartu di
> lapangan**. Ditutup dengan penanda `is_reconstructed`, dan dikunci uji
> `TestSyncContractV1Compat/DEBIT_v1_tanpa_trace_number_TIDAK_ditolak`.

### M11.4 Dexie v4 🌐 — 🟢 kode lengkap, `tsc` + `eslint` hijau

- [x] `version(4).stores({…})` sesuai §3.6 — `version(1..3)` **tidak disentuh**
- [x] `.upgrade()` backfill `receipt_printed_at`, `return_state`, `payments[]`
- [x] Tipe baru di `lib/db/models.ts`: `LocalPayment`, `LocalReturn`, `LocalReturnItem`,
      `LocalVoidLog`, `LocalSecurityEvent`, `PrintJob`
- [x] `_synced` diperluas menjadi `-1 | 0 | 1` (`-1` = karantina, §4.3) + indeks tetap valid
- [x] `lib/sync/wire.ts`: `toWireReturn`, `toWireVoidLog`, `toWireSecurityEvent`,
      `toWirePayment` — seluruh field `_*` dibuang, sen → Rupiah
- [x] `lib/constants/payment.ts` — tambah `CREDIT` dan `SPLIT`
- [ ] **Catat tanggal & penyetuju** pada blok "KONTRAK BEKU" yang masih berisi
      `[ISI TANGGAL] — [ISI NAMA PENYETUJU]` — butuh keputusan lintas tim, bukan keputusan agen
- [ ] Uji: buka DB v3 berisi 200 transaksi → migrasi ke v4 → **200 baris utuh**, tak satu pun
      `_synced` berubah — **terhalang:** `posgodinov-fe` belum memiliki *test runner*
      (`package.json` hanya punya `dev`/`build`/`start`/`lint`). Menambah `vitest` +
      `fake-indexeddb` adalah perubahan dependensi tersendiri

> **Catatan pelaksanaan.** Tiga berkas di luar daftar di atas ikut disesuaikan karena
> `tsc --noEmit` menolak kompilasi tanpanya, dan ketiganya adalah berkas **tipe/logika**,
> bukan komponen UI:
>
> | Berkas | Alasan |
> |---|---|
> | `lib/types/api.ts` | Rumah kontrak payload — menampung `TransactionStatus` v2 dan seluruh tipe `…PayloadV2` |
> | `lib/printer/types.ts` | `Receipt.paymentMethod` harus menerima ringkasan `SPLIT` |
> | `lib/api/endpoints/reports.ts` | `TransactionReportRow.status` masih mengunci dua nilai v1 |
> | `features/pos/shift/shift-math.ts` | **Menemukan cacat nyata:** `summarizeShift` menghitung batal lewat `status == 'CANCELLED'`. Setelah `VOIDED` ada, transaksi ter-void akan terhitung sebagai penjualan tunai. Diperbaiki menjadi daftar `CANCELLED_STATUSES` |
>
> `PAYMENT_METHODS` sengaja **tetap 4 nilai**. `PaymentScreen` merender pemilih metode dari
> array itu, dan uji kontrak lintas platform mengunci kesamaannya dengan `PaymentMethod.values`
> di Flutter. `CREDIT`/`SPLIT` hidup di `TENDER_METHODS`/`PAYMENT_SUMMARY_METHODS`.

### M11.5 Drift v2 📱 — 🟡 kode lengkap, **belum satu pun perkakas dijalankan**

> ⚠️ **Gerbang mutu M11.5 MERAH, bukan hijau.** Flutter SDK tidak terpasang di mesin ini
> (`which flutter` dan `which dart` keduanya kosong; `~/development/flutter/bin` tidak ada) —
> kendala yang sama dengan yang tercatat di
> [10 §M0.2](10-flutter-implementation-plan.md). Karena itu `build_runner`, `flutter analyze`,
> `dart run import_lint`, dan `flutter test` **belum pernah dijalankan** atas kode ini.
> Prosedurnya ada di [11 — Verification Runbook](11-flutter-verification-runbook.md).
>
> Centang di bawah berarti **kode telah ditulis lengkap**, bukan bahwa ia terbukti berjalan.
> Fase M11 **tidak boleh** dinyatakan selesai — dan M12–M17 tidak boleh dimulai — sebelum
> keempat perkakas di atas hijau.

- [x] Enam tabel baru di `lib/core/database/tables/` — `TransactionPayments`, `Returns`,
      `ReturnItems`, `VoidLogs`, `SecurityEvents`, `PrintJobs`
- [x] Kolom v2 pada `transactions`, `shifts`, `wastes` (tidak tercantum eksplisit di §3.7,
      tetapi `m.addColumn` mustahil tanpa deklarasinya)
- [x] Enum kontrak v2 di `core/config/constants.dart`: `TenderMethod`, `PaymentSummary`,
      `VoidScope`, `ReturnKind`, `RefundMethod`, `ReturnState`, `SecuritySeverity`,
      `PrintJobKind`, `PrintJobStatus`, `SecurityEventType`, `ReasonCodes`
      — plus `TransactionStatus.voided` dan `isCancellation`
- [x] `schemaVersion: 2` + `onUpgrade` sesuai §3.7
- [x] DAO baru: `ReturnDao`, `VoidLogDao`, `SecurityEventDao`, `PrintJobDao`
- [x] `wire_mapper.dart` untuk seluruh entitas baru (`payment`, `shiftV2`, `transactionV2`,
      `returnEntity`, `voidLog`, `securityEvent`, `wasteV2`, `bodyV2`)
- [x] Uji kontrak `test/contract/payment_methods_test.dart` diperluas — mengunci daftar
      `TenderMethod`/`PaymentSummary` terhadap `TENDER_METHODS` di Web
- [ ] Dump skema `drift_dev` v1 & v2 di `test/drift/schema/` — **terhalang SDK**
      (`dart run drift_dev schema dump`)
- [ ] Uji migrasi `verifySelfMigration` v1 → v2 — **terhalang SDK**
- [ ] Uji unit R2 untuk `wire_mapper` entitas baru — **terhalang SDK**; menulis uji yang tidak
      pernah dijalankan hanya memindahkan risiko, bukan menghilangkannya

> **Mengapa `PaymentMethod` tidak ditambah `credit`/`split`.** `payment_page.dart` merender
> pemilih metode dari `PaymentMethod.values`, sehingga menambah nilai di sana **akan mengubah
> UI** — dilarang pada fase ini. Nilai baru hidup di `TenderMethod` (tender) dan
> `PaymentSummary` (ringkasan). Kolom `Transactions.paymentMethod` tetap bertipe
> `PaymentMethod`; pemindahannya ke `PaymentSummary` menjadi bagian M17.2 bersamaan dengan
> lahirnya layar pembayaran gabungan.

### ✅ Definition of Done — M11

Fase M11 selesai **hanya bila kedelapan butir berikut terbukti**, bukan diyakini:

1. `migrate up` lalu `migrate down` lalu `migrate up` pada basis data **berisi salinan data produksi**
   berjalan tanpa galat dan menghasilkan `pg_dump --schema-only` yang identik.
2. Uji migrasi Dexie v3→v4 hijau pada dataset 200 transaksi (100 `_synced=0`), **nol** baris hilang,
   **nol** `_synced` berubah.
3. Uji migrasi Drift v1→v2 (`verifySelfMigration`) hijau, termasuk backfill
   `transaction_payments`.
4. `TestSyncContractV1Compat` **dan** `TestSyncContractV2` keduanya hijau.
5. `go test ./...`, `pnpm typecheck && pnpm test`, `flutter analyze && flutter test` — semua hijau.
6. **Uji regresi perilaku:** seluruh 42 skenario [08-uat-test-scenarios.md](08-uat-test-scenarios.md)
   dan [12-mobile-uat-test-scenarios.md](12-mobile-uat-test-scenarios.md) lulus **tanpa modifikasi
   satu langkah pun** — membuktikan M11 tidak mengubah perilaku.
7. Kueri `SELECT` pada seluruh tabel baru memakai indeks (`EXPLAIN ANALYZE`, tidak ada `Seq Scan`
   pada tabel > 10.000 baris).
8. Backfill diverifikasi: `SELECT count(*) FROM transactions WHERE receipt_printed_at IS NULL` = 0
   dan `SELECT count(*) FROM transactions t WHERE NOT EXISTS (SELECT 1 FROM transaction_payments p
   WHERE p.transaction_id = t.id)` = 0.

---

## Fase M12 — Engine Transisi & Auto-Sync

**Butir:** 1, 2 · **Repositori:** 🌐 📱 🐹 (ringan)

**Diagnosis butir 1.** Penyebab "POS keluar dari aplikasi" telah ditemukan dan bersifat struktural,
bukan kosmetik:

```
posgodinov-fe/public/sw.js:101
    const fallback = await caches.match('/pos/offline')

`/pos/offline` adalah RUTE NEXT SUNGGUHAN — sebuah dokumen terpisah. Ketika
service worker mengembalikannya untuk sebuah permintaan navigasi, peramban
MEMUAT DOKUMEN BARU. Seluruh state dalam memori — keranjang Zustand, layar
aktif `usePosRouterStore`, sesi kasir — dibuang, dan pengguna mendarat di
halaman statis dengan tautan <a href="/pos">. Bagi kasir, itu persis terlihat
seperti "aplikasi keluar sendiri".

Pemicunya paling sering muncul PASCA-SINKRONISASI karena saat itulah permintaan
jaringan paling banyak terjadi sekaligus, sehingga peluang satu permintaan
navigasi jatuh ke fallback menjadi tertinggi.
```

### M12.1 Konektivitas sebagai state, bukan navigasi 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] `lib/sync/connectivity-store.ts` — sumber tunggal status jaringan
      (`online | degraded | offline`), **tanpa** efek samping navigasi. Sengaja **bebas kerangka
      kerja** (`subscribe`/`getSnapshot`) agar sah menghuni `lib/`; jembatan React ada di
      `features/pos/sync/useConnectivity.ts`
- [x] `sw.js`: fallback navigasi untuk permintaan **di dalam scope `/pos`** mengembalikan shell
      `/pos` dari cache, **bukan** `/pos/offline`
- [x] `/pos/offline` dipertahankan **hanya** untuk URL di luar scope (mis. `/admin` diakses offline)
- [x] R7 ditegakkan **oleh lint**, bukan oleh `grep` — lihat catatan di bawah
- [x] 📱 `connectivity_monitor.dart` diperiksa: **tidak ada** `Navigator` sama sekali di dalamnya;
      ia murni memancarkan `Stream<bool>`. `ConnectivityCubit` baru dibuat sebagai satu-satunya
      muara status di sisi UI, dan didaftarkan sebagai singleton di `injection.dart`
- [ ] Indikator jaringan hidup di **Bottom Bar** — **ditunda ke M17.1**: `PosBottomBar` belum ada.
      Bagian "berubah tanpa render ulang pohon layar" **sudah** terpenuhi lewat selector sempit
      (`useConnectivityStatus`, `ConnectivityCubit`)

> **Akar penyebab butir 1 ditemukan, dan ada DUA — bukan satu.**
>
> | # | Penyebab | Perbaikan |
> |---|---|---|
> | 1 | `caches.match(request)` mencocokkan **query string**. Navigasi ke `/pos?x=1` meleset dari entri cache `/pos`, lalu jatuh ke fallback. | `ignoreSearch: true` |
> | 2 | Fallback-nya `/pos/offline` — **dokumen Next terpisah**. Peramban memuat dokumen baru, seluruh state dibuang. | Navigasi dalam scope kini mengembalikan **shell `/pos`** |
>
> **R7 dinaikkan dari konvensi menjadi aturan lint.** Perintah `grep` di baris checklist asli tidak
> pernah gagal di CI; aturan `no-restricted-syntax` gagal. Ditegakkan atas `features/pos/**` dan
> `lib/sync/**`, dengan **satu** pengecualian terdokumentasi: `DeviceBindScreen.tsx`. `/pos/bind`
> adalah route Next yang **terpisah** dari `/pos`, sehingga perpindahan di antaranya memang navigasi
> dokumen dan tidak dapat dilakukan router internal — dan ia bukan pemicu jaringan.
>
> ⚠️ Saat memasang aturan ini, ditemukan bahwa blok `no-restricted-syntax` yang cocok belakangan
> **mengganti**, bukan menambahi, konfigurasi rule yang sama pada flat config. Versi pertama aturan
> R7 karena itu **tidak berbunyi sama sekali**. Sudah diperbaiki dengan mengangkat selector menjadi
> konstanta bersama, dan diverifikasi dengan berkas probe yang sengaja melanggar.

### M12.2 Default online + auto-push 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] `SyncTrigger` diperluas: `'transaction-commit' | 'void' | 'return' | 'reconnect'` (+`visibility`).
      📱 padanannya `transactionCommit` · `voidCommit` · `returnCommit`
- [x] Pemicu `transaction-commit` dipasang **setelah** commit Dexie/Drift berhasil, di-*debounce*
      1.500 ms. 🌐 lewat `lib/sync/commit-notifier.ts` — repositori hanya **mengumumkan**, tidak
      memanggil mesin sync, sehingga lapisan penyimpanan tetap dapat diuji sendirian dan store
      tampilan tidak pernah terlewat
- [x] Status awal **mengasumsikan online**; `offline` hanya dinyatakan setelah bukti — kegagalan
      TRANSPORT atau peristiwa `offline` dari sistem operasi. Response `4xx`/`5xx` yang benar-benar
      tiba **tidak** menurunkan status: ia justru membuktikan jaringan hidup
- [x] Backoff **tidak berlaku** untuk `transaction-commit`, `void`, `return`, dan `shift-close`
- [x] 📱 `background_sync_worker.dart` diperiksa: periode 15 menit + `NetworkType.connected`
      **sudah benar** sejak commit `12b99d9`; tidak ada perubahan yang diperlukan
- [ ] 📱 Verifikasi kesesuaian API WorkManager terhadap `workmanager: ^0.10.7` — **tidak dapat
      dilakukan**: paketnya belum pernah di-`pub get`, sehingga tanda tangan `initialize`,
      `registerPeriodicTask`, dan `ExistingPeriodicWorkPolicy` tidak dapat dibaca. Menebak lalu
      menulis ulang API-nya berisiko lebih besar daripada membiarkannya
- [x] 🌐 Registrasi Background Sync API sebagai lapis cadangan **tanpa** `BackgroundSyncPlugin`
      Workbox. Batasnya dinyatakan apa adanya di `sw.js`: mesin sync hidup di halaman (ADR-06),
      sehingga peristiwa `sync` hanya **membangunkan klien yang masih terbuka** — bila seluruh tab
      tertutup, tidak ada yang dapat dikerjakan
- [x] Tombol "Sinkronkan Sekarang" di P-13 tetap ada sebagai jaring pengaman

### M12.3 Karantina & telemetri antrean 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] `_synced = -1` diterapkan pada `errors[].retryable = false` (§4.3)
- [x] P-13 menampilkan tiga kelompok: **Antre** · **Gagal (akan diulang)** · **Butuh tindakan**,
      di web **dan** mobile
- [x] `syncLog` mencatat `returns_sent/synced`, `void_logs_sent/synced`,
      `security_events_sent/synced`, plus `quarantined`
- [x] 🌐 `syncLog` **benar-benar ditulis** — sebelumnya tabelnya dideklarasikan tetapi tidak pernah
      diisi satu baris pun. Ditulis pada keberhasilan MAUPUN kegagalan transport (justru putaran
      yang gagal yang paling dicari saat menelusuri insiden, dan itulah yang tidak pernah muncul di
      log server), dengan pemangkasan 200 baris
- [x] Mesin sync web dinaikkan ke **kontrak v2**: header `X-POS-Contract-Version: 2`, mengirim
      `returns`/`void_logs`/`security_events`, dan membaca `errors[]`. Tanpa ini karantina mustahil —
      `retryable` hanya ada di respons v2
- [x] 📱 Padanannya di mobile: `SyncUpResponse` mengurai `errors[]`, `Reconciler` memanggil
      `markQuarantined`, dan **seluruh kueri antrean mengecualikan baris berkarantina** — tanpa yang
      terakhir, karantina tidak berarti apa pun

> **📱 Karantina menuntut kolom baru.** `synced` di Drift bertipe `bool`, sehingga tidak dapat
> menampung keadaan ketiga. Ditambahkan kolom `quarantined` pada keenam tabel tersinkron, dan
> disatukan ke **migrasi v2 (M11.5) — bukan v3** karena v2 belum pernah dirilis ke perangkat mana
> pun. Memecahnya menjadi dua migrasi hanya menambah satu langkah yang harus dijalankan benar di
> lapangan tanpa menambah satu pun jaminan.

### ✅ Definition of Done — M12

1. **Uji transisi 50 siklus.** Skrip mematikan/menyalakan jaringan 50 kali selama keranjang berisi
   6 item. Setelah 50 siklus: keranjang utuh, layar aktif tidak berubah, `performance.navigation`
   menunjukkan **nol** muat dokumen ulang.
2. **Uji fallback SW.** `fetch('/pos', {mode:'navigate'})` dalam keadaan offline mengembalikan shell
   `/pos`, bukan `/pos/offline`. `fetch('/admin')` offline **tetap** mengembalikan `/pos/offline`.
3. **Uji auto-push.** Dengan jaringan hidup, satu transaksi selesai → baris tiba di server ≤ 5 detik
   **tanpa** interaksi pengguna. Diverifikasi dari log server, bukan dari indikator UI.
4. **Uji burst.** 10 transaksi dalam 20 detik menghasilkan ≤ 3 permintaan `POST /v1/pos/sync`
   (bukti debounce bekerja).
5. **Uji captive portal.** `navigator.onLine === true` tetapi seluruh permintaan gagal → status
   `degraded`, transaksi tetap tersimpan lokal, tidak ada dialog galat berulang di layar kasir.
6. R7 terverifikasi — **kini oleh lint, bukan `grep`**: `pnpm lint` gagal bila ada navigasi dokumen
   di `features/pos/**` atau `lib/sync/**`, kecuali `DeviceBindScreen.tsx`.
   ✅ **Sudah terpenuhi** dan diverifikasi dengan berkas probe.
7. 📱 WorkManager terbukti berjalan pada perangkat nyata setelah aplikasi ditutup 30 menit.

> ⚠️ **Butir 1–5 dan 7 belum terpenuhi.** Seluruhnya adalah uji perilaku runtime yang menuntut
> peramban sungguhan, perangkat sungguhan, atau server sungguhan — tidak satu pun tersedia di mesin
> ini. Yang terverifikasi pada web hanyalah `tsc --noEmit` (0 galat) dan `eslint` (nol masalah baru);
> pada mobile **tidak ada perkakas yang dijalankan sama sekali** karena Flutter SDK tidak terpasang.
> Gerbang M12 tetap **MERAH** sampai ketujuh butir hijau.

---

## Fase M13 — State Machine Void vs Retur

**Butir:** 5, 13, 15 · **Repositori:** 🐹 🌐 📱
**Prasyarat:** M11 selesai (tabel `returns`, `void_logs`, kolom `receipt_printed_at` ada).

### M13.1 Mesin keputusan terpusat 🌐 📱 — 🟢 web (`tsc`+`eslint` hijau) · 🟡 mobile (SDK absen)

- [x] `lib/pos/cancellation/decide.ts` + `lib/core/pos/cancellation_policy.dart` — **satu** fungsi
      murni per platform, dengan urutan pemeriksaan yang identik
- [x] Fungsi ini adalah **satu-satunya** tempat `receipt_printed_at` dibaca untuk keputusan
      pembatalan. `VoidScreen`, `ReturnScreen`, `VoidPage`, `ReturnPage`, dan `HistoryPage`
      seluruhnya merender hasilnya, tidak satu pun memutuskan sendiri
- [x] `FORBIDDEN` mendapat alasan ketiga — `NOTHING_TO_CANCEL` — untuk transaksi tercetak tanpa
      item; data rusak semacam itu tidak boleh jatuh ke jalur Retur yang menuntut item
- [x] **Fixture lintas platform** `fixtures/cancellation-decision.json` — 12 kasus, satu berkas
      untuk Web, Flutter, dan Go
- [ ] Uji unit tabel-driven yang MENJALANKAN fixture itu — **terhalang**: `posgodinov-fe` belum
      punya *test runner*, dan Flutter SDK tidak terpasang

> **Dua keputusan yang menyimpang dari rancangan, keduanya menutup lubang nyata.**
>
> **Urutan pemeriksaan mengikat.** "Belum tercetak" diperiksa **sebelum** daftar item, sehingga
> transaksi tanpa item pun tetap dapat di-void: yang dibatalkan adalah baris keuangannya, bukan
> isinya. Urutan sebaliknya membuat transaksi rusak terkunci selamanya.
>
> **`CANCELLED` warisan v1 ikut dihitung sebagai "sudah dibatalkan".** Memeriksa `VOIDED` saja
> membuat transaksi lama dapat di-void dua kali, dan server memotong stok dua kali.

### M13.2 Alur Void transaksi 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] `VoidScreen` / `void_page.dart` dirombak: pilih transaksi → `decideCancellation` → bila
      `RETURN`, layar **mengarahkan ke alur Retur**, tidak menampilkan tombol Void
- [x] Form void wajib: `reason_code` (dropdown §3.5) + `reason_notes` (wajib bila `OTHER`,
      min. 10 karakter) — satu komponen `VoidSheet`/`showVoidReasonSheet` dipakai **ketiga**
      cakupan, sehingga aturannya tidak dapat menyimpang antar-layar
- [x] Menulis `void_logs` (scope `TRANSACTION`, `items_snapshot` terisi) **dan** memutakhirkan
      `transactions.status = 'VOIDED'`, `voided_at`, `voided_by`, `void_reason_code`
      dalam **satu** transaksi Dexie/Drift
- [x] Keputusan diambil **ULANG** tepat sebelum menulis: antara render dan ketukan, sebuah retur
      dari perangkat lain bisa tersinkron, atau struknya baru selesai tercetak
- [ ] PIN supervisor bila `config.require_supervisor_for_void` — `authorized_by` terisi.
      **Ditunda ke M17.4**: verifikasi PIN berbasis peran menuntut `staffs.role`/`permissions`
      sampai ke perangkat, yang baru dipasang M15. Sampai saat itu kewajibannya **dinyatakan** di
      Void Sheet dan `authorized_by` dibiarkan `null` — mengisinya dengan `staff_id` pelaku akan
      memalsukan persetujuan yang tidak pernah terjadi
- [ ] Percobaan void atas transaksi tercetak menulis `pos_security_events`
      `VOID_AFTER_PRINT_ATTEMPTED` (CRITICAL) — **ditunda ke M15**: penulis
      `pos_security_events` belum ada di klien mana pun

### M13.3 Alur Retur — layar baru 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] Layar `return` baru (P-15) — **layar penuh, bukan modal**, konsisten dengan butir 11.
      Terdaftar di `POS_SCREENS` + `PosScreenOutlet` (web) dan `ReturnPage` (mobile)
- [x] Pemilihan item + qty per item, dijepit pada `returnable` (sisa qty) yang dihitung dari retur
      lokal. Baris yang sudah habis diretur **tetap ditampilkan** dengan sisa 0 — menyembunyikannya
      membuat kasir bertanya-tanya mengapa totalnya tidak cocok
- [x] Toggle **"Barang kembali ke stok"** per item (`restock`); bila `false` wajib
      `waste_reason_code`, ditegakkan sebelum tombol Proses aktif
- [x] `refund_method` dipilih kasir; **`refund_amount` dihitung repositori, bukan diterima dari UI**
      — nilai dari layar dapat menyimpang dari item yang benar-benar dipilih, dan selisihnya baru
      terlihat saat rekonsiliasi kas
- [x] Menulis `returns` + `return_items`, transaksi asal **tidak disentuh sama sekali**
- [x] `FULL` vs `PARTIAL` ditentukan per-BARIS, bukan dari total kuantitas: "2 dari item A + 0 dari
      item B" tidak boleh tercatat `FULL` hanya karena jumlahnya kebetulan cocok
- [x] Sisa dibaca **ULANG** tepat sebelum menulis, dan setiap baris diperiksa ulang terhadapnya
- [ ] `GET …/returnable` untuk transaksi hasil pencarian kode struk — **ditunda ke M17.3**, yang
      membangun pencariannya. Sampai saat itu retur hanya untuk transaksi yang ada di perangkat
- [ ] `trace_number` pembatalan untuk `CARD_REVERSAL` — **ditunda ke M17.2** bersama form kartu
- [ ] `return_state` lokal dihitung ulang untuk tampilan — nilai otoritatif dari server (M13.6)

### M13.4 Butir 5 — Strict Qty Audit 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] Konstanta `VOID_THRESHOLD_QTY` dibaca dari `config.void_threshold_qty` (default 5) lewat
      `lib/pos/config.ts`; nilai `0`/negatif ditolak dan jatuh ke bawaan
- [x] **`peakQuantity` per baris, BUKAN `decrementAccumulator`** — lihat catatan di bawah
- [x] Stepper minus **menolak** menurunkan bila penurunan kumulatif > ambang
- [x] Penolakan membuka **Void Sheet** (bukan pesan galat): alasan + peringatan cetak
- [x] Menulis `void_logs` scope `CART_LINE` dengan `quantity_before` = **puncak**, bukan kuantitas
      saat ini: yang diaudit adalah seluruh penurunan sejak barang masuk keranjang
- [x] "Hapus baris" mengikuti aturan yang **sama** — satu fungsi `requestDecrease` melayani tombol
      minus maupun tombol hapus
- [x] **"Kosongkan" juga tunduk pada ambang yang sama.** Tidak ada di rencana, tetapi tanpanya
      butir 5 punya pintu belakang selebar pintu depan: kasir yang ditahan tombol minus cukup
      menekan "Kosongkan"
- [ ] `pos_security_events` `QTY_DECREASE_ESCALATED_TO_VOID` — **ditunda ke M15** bersama penulis
      `pos_security_events`

> **Menyimpang dari rancangan: puncak, bukan akumulator.**
>
> Rancangan menyebut "akumulator penurunan yang direset saat baris ditambah". Bentuk itu dapat
> dipermainkan dengan sepele: **turunkan 5 → tambah 1 → turunkan 5 lagi**. Akumulatornya kembali
> nol, dan sembilan unit lenyap tanpa satu pun Void Sheet muncul.
>
> Puncak tidak dapat dipermainkan. Penurunan kumulatif SELALU `puncak − kuantitas sekarang`,
> sehingga menambah barang kembali benar-benar **membatalkan** penurunan alih-alih menghapus
> jejaknya. Dua aturan rancangan — "sekaligus > 5" dan "akumulasi > 5" — juga melebur menjadi satu
> pemeriksaan, dan satu pemeriksaan tidak dapat menyimpang dari dirinya sendiri.
>
> Perilakunya sama persis dengan DoD butir 4: `12 → 3` diblokir, `12 → 10 → 8 → 6` diblokir pada
> langkah terakhir, `12 → 8` lolos.

### M13.5 Butir 13 — Hold Order tanpa hapus 🌐 📱 — 🟢 web · 🟡 mobile (SDK absen)

- [x] Tombol hapus **dihapus dari kode** beserta `ConfirmDialog`-nya, bukan disembunyikan. Di
      mobile, metode `HeldCartRepository.discard` sendiri dihapus dari kontrak — jalur yang masih
      ada akan dipakai lagi oleh orang yang tidak tahu mengapa ia tidak boleh dipakai
- [x] Ikonnya **bukan** tempat sampah: aksinya bukan penghapusan, dan ikon yang berbohong tentang
      akibatnya adalah cara termudah membuat kasir menekannya tanpa berpikir
- [x] Aksi "Batalkan" → Void Sheet → `void_logs` scope `HELD_ORDER` dengan `items_snapshot` berisi
      seluruh baris
- [x] Hold cart dibuang **setelah** `void_logs` tertulis, keduanya dalam satu transaksi basis data
- [x] Hold cart yang dilanjutkan lalu dibayar tetap menghapus hold **tanpa** void (bukan
      pembatalan) — jalur `resume` tidak disentuh

### M13.6 Sisi server 🐹 — 🟡 kode lengkap, **belum dikompilasi**

> ⚠️ Mesin ini tidak dipakai untuk kompilasi pada sesi M13.6; `go build`/`go vet`/`go test`
> **tidak dijalankan**. Yang terverifikasi hanya statis: seluruh berkas ter-*parse* `gofmt -e`,
> setiap metode antarmuka punya implementasi dan mock, setiap simbol domain yang dirujuk ada, dan
> setiap impor terpakai.

- [x] `ReturnService.Create` — aturan §3.4 baris 1, `SELECT … FOR UPDATE` lewat
      `ReturnRepository.SnapshotForReturn`, seluruhnya di dalam SATU transaksi basis data
- [x] Validasi agregat: kuantitas **dijumlahkan per baris lebih dulu** — satu payload dapat memuat
      `transaction_item_id` yang sama dua kali, dan memeriksanya satu-per-satu meloloskan 2 + 2
      terhadap batas 3. Pelanggaran → `RETURN_EXCEEDS_ORIGINAL`, `retryable: false`
- [x] Perhitungan ulang `transactions.return_state` dalam transaksi yang sama, diproyeksikan dari
      snapshot terkunci + kuantitas retur ini (tanpa pembacaan kedua)
- [x] Penolakan `VOIDED` atas transaksi ber-`receipt_printed_at` → `VOID_AFTER_PRINT`
      *(sudah ada sejak M11.3; diverifikasi ulang dan tetap berlaku)*
- [x] **Arah sebaliknya juga ditolak**: retur atas transaksi yang struknya BELUM terbit, dan retur
      atas transaksi yang sudah dibatalkan
- [x] Pergerakan stok: void = kembalikan penuh; retur = kembalikan **hanya** item ber-`restock=true`;
      item `restock=false` menulis `product_wastes` otomatis dengan `reason_code` dari
      `waste_reason_code`
- [x] Penelusuran BOM diekstrak ke `bomStockAdjuster` — satu implementasi untuk penjualan, void,
      dan retur
- [x] Endpoint `GET /v1/pos/transactions/{id}/returnable` + handler + rute + wiring
- [x] Uji kontrak: 4 skenario retur baru (`FULL`, `PARTIAL`, `restock=false`, batas terlampaui) dan
      5 skenario endpoint `returnable`
- [ ] `go build` / `go vet` / `go test` — **tidak dijalankan** sesuai aturan lingkungan sesi ini

> **Tiga temuan saat eksekusi, semuanya menutup lubang nyata.**
>
> | Temuan | Akibat bila dibiarkan |
> |---|---|
> | `GetTransactionByID` **tidak** memakai `Preload("Items")`, sehingga `checkReturnable` (M11.3) selalu melihat daftar item kosong | **Setiap retur yang sah ditolak** dengan "item retur tidak ada pada transaksi asal". Ditutup: aturan kini membaca `transaction_items` langsung lewat kueri yang sekaligus menguncinya |
> | `ProductWaste` di Go tidak punya field `reason_code`/`shift_id`/`device_id` walau kolomnya ada sejak migrasi 000023 | Baris waste turunan retur jatuh ke bawaan `'OTHER'`; alasan pembuangan yang sebenarnya hilang |
> | Tidak ada pustaka UUID di `go.mod`, sedangkan `product_wastes.id` tidak punya `DEFAULT` | `INSERT` gagal dengan galat NOT NULL. Ditutup: `pkg/utils.NewUUID` berbasis `crypto/rand`, tanpa dependensi baru |
>
> **Baris `product_wastes` turunan retur TIDAK memotong stok lagi.** Barangnya sudah terpotong saat
> penjualan dan memang tidak pernah kembali; memotongnya sekali lagi menghitung barang yang sama dua
> kali, dan selisihnya muncul saat opname sebagai kehilangan yang tidak pernah terjadi. Ini berbeda
> dari jalur waste biasa (`syncWastes`), yang memang harus memotong — perbedaan yang didokumentasikan
> di kedua tempat karena mudah sekali disamakan oleh pembaca berikutnya.

### ✅ Definition of Done — M13

1. Matriks 12 baris `decideCancellation` hijau di ketiga platform (Go, TS, Dart) dengan **kasus uji
   yang identik** — file fixture JSON dibagikan lintas repositori.
2. Transaksi tercetak **tidak dapat** di-void dari UI mana pun; percobaan lewat manipulasi Dexie
   langsung tetap ditolak server `422` dan baris masuk karantina.
3. Retur parsial dua kali atas item yang sama: retur pertama 2 dari 3 → berhasil; kedua 2 dari 3 →
   ditolak `422 RETURN_EXCEEDS_ORIGINAL`; ketiga 1 dari 3 → berhasil dan `return_state = 'FULL'`.
4. Penurunan qty 12 → 3 pada satu langkah **dan** 12 → 10 → 8 → 6 (akumulasi 6) keduanya memicu Void
   Sheet. Penurunan 12 → 8 (akumulasi 4) tidak.
5. `grep -rn "deleteHeldCart\|hapus.*hold" features/pos posgodinov-mobile/lib` tidak menemukan
   satu pun jalur hapus tanpa void.
6. Void offline penuh: matikan jaringan → void → `void_logs` tertulis lokal → nyalakan → baris tiba
   di server dengan `authorized_by` utuh.
7. Retur item `restock=false` menghasilkan baris `product_wastes` di server dan **tidak** menambah
   stok bahan baku (diverifikasi lewat `raw_materials.stock` sebelum/sesudah).

---

## Fase M14 — Hardware & Print Flow

**Butir:** 6, 7 · **Repositori:** 🌐 📱
**Prasyarat:** M13 (peristiwa yang perlu dicetak sudah ada).

### M14.1 Antrean cetak yang tahan gagal 🌐 📱

- [x] Tabel lokal `print_jobs` (§3.8) di Dexie + Drift
- [x] `PrintQueueService`: `enqueue → render ESC/POS SEKALI → simpan payload → kirim → tandai`
- [x] Retry otomatis ≤ 3× dengan jeda 3 s / 10 s / 30 s, lalu `ABANDONED`
      — jeda hidup di `PRINT_BACKOFF_MS` / `PrintJobDao.backoff`, dan penjadwal
      (`scheduleNextFlush` / `_scheduleNextFlush`) yang membangunkan flush saat jatuh tempo.
      Tanpa penjadwal, percobaan kedua baru datang bila ada peristiwa lain yang kebetulan
      memicu flush — pada perangkat menganggur itu berarti tidak pernah.
- [x] R6 ditegakkan: kegagalan cetak **tidak pernah** mem-`rollback` transaksi basis data
- [x] Banner persisten "N struk belum tercetak — Ketuk untuk cetak ulang"
      ⚠️ Untuk sementara dipasang **tepat di bawah StatusBar**, bukan di Bottom Bar: Bottom Bar
      adalah pekerjaan M17.1 dan belum ada. Pemindahannya dicatat pada M17.1.
- [x] Cetak ulang memakai `payload` tersimpan (kertas identik), menaikkan `reprint_count`,
      menulis `pos_security_events` `RECEIPT_REPRINTED` — hanya bila job memang sudah pernah
      `PRINTED`; mencoba lagi job `FAILED` yang belum pernah menghasilkan kertas **bukan**
      cetak ulang, dan mencatatnya begitu akan menenggelamkan cetak ulang yang sungguhan.

### M14.2 Struk Pembatalan — butir 6 🌐 📱

- [x] `renderCancelReceipt()` di `lib/printer/audit-receipts.ts` + `escpos_audit_builder.dart`
      (berkas terpisah dari renderer struk penjualan — struk audit punya blok bersama sendiri:
      judul, baris alasan, baris tanda tangan)
- [x] Isi wajib: judul **"STRUK PEMBATALAN"** mencolok (double-height), kode struk asal, waktu
      pembatalan, nama kasir, **nama pemberi otoritas**, `reason_code` + catatan, daftar item yang
      dibatalkan, nilai total yang dibatalkan, dan garis tanda tangan pemberi otoritas
- [x] Dicetak untuk **ketiga** scope void — `CART_LINE`, `HELD_ORDER`, `TRANSACTION`.
      Void keranjang tanpa struk berarti butir 5 hanya menghasilkan baris database yang tidak pernah
      dilihat siapa pun sampai audit bulanan — terlambat.
- [x] `void_logs.receipt_printed` + `receipt_printed_at` dimutakhirkan saat job `PRINTED`
      (di `stampSource` / `_stampSource` — saat kertas terbit, bukan saat perintah terkirim)
- [x] Kegagalan → `pos_security_events` `VOID_RECEIPT_PRINT_FAILED` (CRITICAL)

### M14.3 Struk Pembuangan — butir 7 🌐 📱

- [x] `renderWasteReceipt()` — judul **"STRUK PEMBUANGAN / WASTE"**, nama produk, qty, satuan,
      `reason_code`, catatan, nama petugas, waktu, garis tanda tangan penyaksi
- [x] Dicetak **otomatis** saat waste disimpan, tanpa tombol tambahan
- [x] `product_wastes.receipt_printed` + `printed_at`
- [x] Kegagalan → `WASTE_RECEIPT_PRINT_FAILED`

### M14.4 Struk Retur 🌐 📱

- [x] `renderReturnReceipt()` — kode retur, kode struk asal, item + qty, metode & nominal refund,
      tanda tangan pelanggan **dan** pemberi otoritas

### ✅ Definition of Done — M14

1. Uji dengan printer di-mock **gagal permanen**: void tetap tercatat, `print_jobs.status =
   ABANDONED`, banner muncul, `pos_security_events` CRITICAL tertulis, dan **tidak ada** data hilang.
2. Uji cetak ulang: dua kertas dari job yang sama byte-identik (`assert payload_hash_1 == payload_hash_2`).
3. Uji fisik pada tiga printer: Sunmi inner, ESC/POS Bluetooth 58 mm, ESC/POS jaringan 80 mm.
   Ketiga jenis struk baru terbaca utuh, tidak terpotong, lebar kolom benar pada 32 dan 48 karakter.
4. Kertas habis di tengah cetak → job `FAILED`, retry setelah kertas diganti menghasilkan struk utuh
   (bukan potongan lanjutan).
5. `void_logs.receipt_printed = true` untuk 100 % void yang printernya sehat, diverifikasi lewat
   kueri server setelah sesi UAT.
6. Waste tanpa printer terpasang sama sekali tetap tersimpan, dengan banner dan event CRITICAL.

---

## Fase M15 — Blind Shift, Guard & Identity Lock

**Butir:** 9, 10, 12, 17 · **Repositori:** 🐹 🌐 📱
**Prasyarat:** M11. Dapat berjalan paralel dengan M13/M14.

### M15.1 Butir 10 — gerbang Master Data sebelum Buka Shift 🌐 📱

- [x] Layar P-04 (Buka Shift) **tidak dapat diakses** sebelum `pullMasterData()` sukses pada sesi ini
      — gerbang hidup DI DALAM layar (`OpenShiftScreen` / `OpenShiftPage`), bukan di tombol yang
      menuju ke sana, sehingga deep link `#open-shift` pun mendarat di pemblokir yang sama
- [x] Alur: Login Kasir → **Menarik Data Master…** (layar pemblokir, bukan spinner sudut) → Buka Shift
- [x] Offline saat mencoba buka shift → pemblokiran dengan pesan tegas + tombol "Coba Lagi".
      **Tidak ada tombol "Lewati".** Tombol lama "Lewati untuk sekarang" di P-02 ikut **dihapus dari
      kode**, diganti komentar yang menjelaskan mengapa ia tidak boleh kembali.
- [x] Toleransi: master yang ditarik < `config.master_data_max_age_minutes` (default 720 menit)
      **dan** versi sama dengan server → gerbang lolos tanpa unduh ulang.
      ⚠️ Perbandingan versi hanya berjalan bila KEDUA angka diketahui: server pra-v2 tidak mengirim
      `version`, dan membandingkan `null` akan memblokir seluruh outlet yang backend-nya belum naik.
- [x] `shifts.master_data_version` diisi dari versi yang benar-benar dipegang — diteruskan dari
      PUTUSAN gerbang, bukan dibaca ulang saat submit (pembacaan kedua dapat mengambil versi berbeda
      bila master ditarik ulang di antara keduanya). Ditegakkan juga di server: `syncShifts` menolak
      shift `OPEN` tanpa versi dengan `422 MASTER_DATA_REQUIRED`.
- [x] Kegagalan gerbang menulis `OPEN_SHIFT_BLOCKED_STALE_MASTER`
- [x] **Prasyarat yang ternyata belum ada:** `master.version` / `master_data_version` dan
      `device.id` / `device_id` DIBACA mesin sync sejak M12 tetapi **tidak pernah ditulis siapa pun**.
      Keduanya kini diisi — versi saat penarikan master, `device_id` sekali saat binding.

### M15.2 Butir 12 — Identity Lock 🌐 📱

- [x] Selama ada shift `OPEN` milik perangkat ini: tombol **Logout dihapus dari render**, menu
      "Ganti Kasir" dihapus, dan aksi keluar sesi apa pun ditolak.
      `logout()` **dihapus dari store**; yang tersisa `requestLogout()` (dapat ditolak) dan
      `clearSession()` (tanpa syarat, hanya untuk saga & force close). Nama netral sengaja dihindari.
- [x] Percobaan (mis. tombol back berulang, deep link) menulis `LOGOUT_BLOCKED_ACTIVE_SHIFT` —
      diputuskan dari **basis data**, bukan state UI: yang menyembunyikan tombol adalah render
      sesaat, dan shift dapat lahir di antara render dan ketukan.
- [x] Server: indeks `uq_shift_open_per_device` + `uq_shift_open_per_staff` (M11) ditegakkan;
      pelanggaran → `409 SHIFT_ALREADY_OPEN_ON_DEVICE` / `…_ON_STAFF`, entitas masuk karantina
- [x] `device_id`: identitas instalasi yang stabil, disimpan di `meta['device.id']` (web) /
      `sync_meta` (mobile), dibuat sekali saat binding dan **tidak pernah** berubah.
      ⚠️ Mobile memakai `sync_meta`, BUKAN `secure_storage` seperti rancangan awal: `device_id`
      bukan rahasia — ia dikirim apa adanya pada setiap payload sync — dan menaruhnya di keystore
      hanya menambah titik gagal pada jalur yang harus selalu berhasil.
- [x] Jalur darurat: Supervisor dapat melakukan **Force Close Shift** dengan PIN + alasan wajib
      (≥ 10 karakter); menulis `pos_security_events` **CRITICAL**.
      Otorisasi diputuskan OFFLINE lewat `role`/`permissions` yang kini ikut master data — peran
      kosong (server pra-v2) DITOLAK, bukan diloloskan.
      Deklarasi ditulis **nol** dan `blind_close = false`: tidak ada yang menghitung laci, dan
      mengarang angka atas nama orang yang sudah pulang akan membuat server menghitung selisih
      terhadap kesaksian palsu.

### M15.3 Butir 9 — Blind Closing 🌐 📱 🐹

- [x] `CloseShiftScreen` / `close_shift_page.dart` dirombak total:
      ```
      ┌────────────────────────────────────────────────┐
      │  TUTUP SHIFT — Kasir: Andi   Mulai: 08:02      │
      ├────────────────────────────────────────────────┤
      │  Uang Fisik di Laci        [ Rp ___________ ]  │  ← satu-satunya
      │  Total Settle EDC          [ Rp ___________ ]  │     input kasir
      │  Total Settle QRIS         [ Rp ___________ ]  │
      ├────────────────────────────────────────────────┤
      │  ⛔ TIDAK ADA: total penjualan sistem,          │
      │     jumlah transaksi, expected balance,        │
      │     selisih, ringkasan per metode bayar        │
      ├────────────────────────────────────────────────┤
      │           [   TUTUP SHIFT   ]                  │
      └────────────────────────────────────────────────┘
      ```
- [x] `shift-math.ts` / `shift_math.dart`: fungsi ekspektasi **dihapus dari jalur UI**.
      Ditegakkan `no-restricted-imports` + `no-restricted-syntax` pada `CloseShiftScreen.tsx`
      (`eslint.config.mjs`), bukan hanya oleh ulasan kode. Di mobile, `cashLinesOf` — satu-satunya
      pemasok bahan hitungnya — ikut dihapus dari repositori beserta `TransactionDao`-nya:
      ketergantungan yang tersisa tanpa pemakai adalah undangan.
      Berkasnya SENGAJA tidak dihapus: `config.blind_close_enabled == false` masih menjanjikan mode
      non-blind, dan rumus yang dihapus lalu diketik ulang di tempat lain lebih berbahaya.
- [x] Struk tutup shift kasir memuat **hanya angka deklarasi** — bukan ekspektasi, bukan selisih.
      `ShiftReport` / `ShiftReportData` **tidak memiliki field** untuk keduanya; ketiadaannya adalah
      penegakan, bukan kelalaian. Struk yang sudah keluar tidak dapat disunting.
- [x] 🐹 `ShiftReconcileService` menghitung `expected_cash` = `opening_balance` +
      `Σ transaction_payments(CASH) COMPLETED` − `Σ returns.refund_amount(CASH)`;
      `expected_edc_total` dan `expected_qris_total` analog; lalu ketiga `*_variance`.
      Sumbernya `transaction_payments`, BUKAN `transactions.payment_method` — kolom itu bernilai
      `SPLIT` sejak butir 8, dan menjumlah `total_amount` atasnya akan membebankan seluruh nilai
      transaksi split ke satu kelompok.
      Refund `EXCHANGE`/`STORE_CREDIT` tidak dikurangkan di mana pun: keduanya tidak memindahkan uang.
      Refund difilter `returns.shift_id`, bukan shift transaksi asalnya — uangnya keluar dari laci
      HARI INI.
- [x] 🐹 Respons `POST /v1/pos/sync` **tidak** memuat `expected_*` maupun `*_variance` (R3) —
      `SyncUpResponse` hanya berisi pencacah; kolom v2 bertag `json:"-"`.
      R4 ditutup dari dua arah: tag `json:"-"` menolak saat dekode, DAN `syncShifts` menolkan
      `expected_balance`/`discrepancy` v1 yang tag JSON-nya masih aktif — pengiriman PERTAMA sebuah
      shift adalah INSERT, dan pada INSERT seluruh kolom struct ikut tertulis.
- [x] Web Owner: layar Rekonsiliasi Shift menampilkan angka lengkap + penanda selisih melebihi ambang
      (`GET …/reports/shift-reconciliation`, ambang Rp 5.000 dihitung server; kedua arah ditandai —
      laci berlebih menandakan transaksi yang tidak tercatat).
      DTO tersendiri, bukan `domain.Shift`: membuka tag `json:"-"` demi layar pemilik akan
      membatalkan penegakan R3 untuk SETIAP endpoint sekaligus.
- [x] **Bug yang ditemukan & diperbaiki:** `SaveShift` tidak memuat `declared_*` di daftar
      `DoUpdates`-nya. Shift dikirim dua kali (buka, lalu tutup), sehingga ketiga angka deklarasi
      kasir — satu-satunya keluaran Blind Closing — akan membeku pada nol selamanya, dan
      rekonsiliasi menghitung selisih terhadap nol.

### M15.4 Butir 17 — Redirect setelah Tutup Shift 🌐 📱

- [x] `closeShiftSaga`, berurutan dan tahan gagal:
      ```
      1. Validasi input deklarasi (≥ 0, bukan kosong)
      2. Tulis shift CLOSED ke DB lokal            ← titik tak dapat dibatalkan
      3. Antre struk tutup shift ke print_jobs
      4. Picu sync (trigger 'shift-close'), TUNGGU maksimal 8 detik
         └─ gagal/timeout → lanjut; antrean akan menyusul, kasir tidak ditahan
      5. Bersihkan: cart-store, sesi kasir, held cart draft, params router
      6. posNavigate('login')  ← navigasi INTERNAL (R7), bukan router Next
      ```
- [x] Layar Login menampilkan konfirmasi ringkas "Shift ditutup" tanpa angka apa pun.
      Mobile menampilkannya SEBELUM berpindah (jeda 1,5 detik pada layar `_Done`): `AppGate.goTo`
      tidak membawa parameter, sehingga konfirmasinya tidak dapat menyusul di layar Login.
- [x] Setelah redirect, tombol back perangkat **tidak** dapat kembali ke layar tutup shift.
      Dua lapis di web: `posReplace` membuang entri riwayat layar Tutup Shift, DAN penjagaan
      `popstate` menolak setiap layar non-publik selama tidak ada sesi kasir — riwayat di
      belakangnya masih memuat Kasir Utama, dan satu ketukan *Back* tambahan akan sampai ke sana.
      Mobile memakai `popUntil(isFirst)` yang sudah ada pada `AppGate`.

### ✅ Definition of Done — M15

1. Kasir **tidak dapat** mencapai layar Buka Shift tanpa satu penarikan master data sukses —
   diverifikasi dengan memblokir endpoint master-data lalu mencoba seluruh jalur navigasi termasuk
   deep link `#open-shift`.
2. Layar Tutup Shift diaudit visual dan lewat `grep`: tidak ada satu pun pengikatan ke
   `expected_balance`, `discrepancy`, atau agregat penjualan.
   `grep -rn "expected\|discrepancy\|totalSales" CloseShiftScreen.tsx close_shift_page.dart` kosong.
3. Payload jaringan diaudit: respons sync ke token perangkat tidak memuat substring `expected_`
   maupun `variance` (uji otomatis atas body respons).
4. Klien yang dimodifikasi mengirim `expected_cash: 1` → nilai tersimpan tetap hasil hitung server (R4).
5. Dua perangkat mencoba membuka shift dengan PIN kasir yang sama → yang kedua ditolak `409`,
   masuk karantina, dan kasir melihat pesan yang dapat ditindaklanjuti.
6. Dengan shift `OPEN`: tidak ada tombol logout di seluruh 14 layar; percobaan lewat konsol
   (`posAuthStore.getState().logout()`) ditolak dan tercatat.
7. Tutup shift dalam keadaan **offline** tetap mengarahkan ke Login ≤ 8 detik, dan shift tersinkron
   otomatis begitu jaringan kembali tanpa interaksi.
8. Force Close oleh Supervisor menghasilkan event CRITICAL yang muncul di dashboard pemilik.

---

## Fase M16 — Modul Opname Terisolasi

**Butir:** 3, 4 · **Repositori:** 📦 `posgodinov-opname` (baru) + 🐹
**Prasyarat:** M11. **Paralel penuh** — tidak menyentuh satu berkas pun di jalur kasir.

### M16.1 Keputusan isolasi

| Opsi | Putusan | Alasan |
|---|---|---|
| Layar baru di dalam POS Kasir | ❌ | Melanggar butir 4. Petugas gudang mendapat akses ke layar Void, Riwayat, dan Tutup Shift — persis pemisahan tugas yang hendak ditegakkan. |
| Aplikasi Flutter terpisah | ⚠️ Tahap 2 | Butuh instalasi & binding perangkat kedua. Ditunda ke M16.6 sebagai *flavor*, bukan repositori baru. |
| **PWA terpisah pada scope `/opname`** | ✅ **Tahap 1** | Perangkat gudang biasanya ponsel pribadi atau tablet murah. PWA dapat dipasang tanpa toko aplikasi, mendapat service worker & Dexie sendiri, dan berbagi komponen desain lewat monorepo `posgodinov-fe`. |

**Batas isolasi yang ditegakkan secara teknis** (bukan sekadar kesepakatan):

```
posgodinov-fe/
  app/(opname)/opname/…        ← route group terpisah
  features/opname/…            ← TIDAK BOLEH mengimpor features/pos/**
  lib/db/opname-dexie.ts       ← database Dexie BERBEDA: 'posgodinov-opname'
  public/sw-opname.js          ← service worker dengan scope '/opname'

Ditegakkan lint:
  eslint no-restricted-imports  → features/opname/** dilarang mengimpor features/pos/**
                                → features/pos/**    dilarang mengimpor features/opname/**
  Database Dexie terpisah berarti session kasir dan session opname secara
  struktural TIDAK DAPAT saling melihat, bahkan bila seseorang salah menulis impor.
```

- [x] Route group `app/(opname)/` + layout, manifest PWA kedua (`/opname/manifest.webmanifest`)
      — manifest kedua berupa **Route Handler**, bukan `manifest.ts`: konvensi berkas itu hanya
      berlaku di AKAR `app/`, dan `app/manifest.ts` sudah dipakai aplikasi kasir.
      Warna tema sengaja berbeda (`OPNAME_THEME_COLOR`) dan orientasinya `portrait` — petugas
      gudang memegang perangkat satu tangan sambil memegang barang.
- [x] `sw-opname.js` dengan scope `/opname` — precache shell sendiri.
      Prefiks cache `posgodinov-opname-`, BUKAN `posgodinov-`: menyapu dengan prefiks yang lebih
      pendek akan membuat worker ini menghapus cache kasir setiap kali aktif.
- [x] `lib/db/opname-dexie.ts` — DB `posgodinov-opname` v1.
      Kunci majemuk `${session_id}:${raw_material_id}` sebagai primary key baris hitungan: petugas
      menghitung ulang bahan yang sama berkali-kali, dan menumpuk baris akan mengirim dua angka
      yang saling bertentangan untuk satu bahan.
- [x] Aturan `no-restricted-imports` dua arah di `eslint.config.mjs` —
      **diverifikasi dengan berkas umpan** yang sengaja melanggar (DoD butir 3): keduanya menyala.
- [x] Binding perangkat opname memakai endpoint yang sama, tetapi token menyimpan klaim
      `scope: 'OPNAME'`; server menolak `POST /v1/pos/sync` dari token ber-scope `OPNAME`
      (`403 SCOPE_FORBIDDEN`, via `middleware.RequireDeviceScope`).
      ⚠️ `GET /sync/master-data` SENGAJA dikecualikan — dipakai KEDUA jenis perangkat, dan
      payloadnya memang tidak memuat stok maupun resep ([03 §2.2]).
      Klaim kosong berarti `POS`, sehingga seluruh device token lapangan yang sudah terbit tetap
      sah dan tidak ada perangkat yang perlu di-binding ulang.

### M16.2 Blind Opname — alur dua fase 📦

```
FASE HITUNG (status = DRAFT)                FASE KUNCI (status = LOCKED)
─────────────────────────────               ────────────────────────────────
┌──────────────────────────────┐            ┌──────────────────────────────┐
│  Gula Pasir                  │            │  Gula Pasir                  │
│  Hitungan Anda: [  12.0  ] kg│            │  Fisik   12.0 kg             │
│                              │  ── kunci ─►  Sistem  15.5 kg             │
│  ⛔ TIDAK ADA stok sistem     │            │  Selisih −3.5 kg  (−Rp 52.500)│
│  ⛔ TIDAK ADA selisih         │            │  ⚠️ Melebihi ambang           │
│  ⛔ TIDAK ADA indikator warna │            │                              │
└──────────────────────────────┘            └──────────────────────────────┘
        │                                              │
        │ Petugas TIDAK DAPAT kembali ke DRAFT.        │
        │ Kunci bersifat satu arah — inilah yang       │
        │ membuat angka hitungan dapat dipercaya.      │
        ▼                                              ▼
   PUT /items  (respons tanpa field ekspektasi)   POST /lock (satu-satunya
                                                  respons yang memuatnya)
```

- [x] Layar daftar bahan baku dengan input hitungan; **nol** referensi ke stok sistem.
      Ditegakkan TIPE, bukan disiplin komponen: `OpnameLine` dan `OpnameMaterial` secara harfiah
      tidak punya field stok, sehingga menampilkannya tidak dapat dikompilasi.
      Bahkan **indikator warna dilarang** — lencana baris yang sudah terisi bernada netral, bukan
      hijau. Hijau adalah kebocoran ekspektasi paling halus: ia tidak menyebut angka, tetapi
      memberi tahu petugas kapan harus berhenti menghitung ulang.
- [x] Dukungan input paket & satuan dasar (memakai `input_type` dari migrasi `000014`).
      Konversi paket → satuan dasar terjadi di SERVER, sekali; melakukannya juga di klien membuat
      faktor isi paket hidup di dua tempat dan yang satu pasti akan basi.
- [x] Simpan draf lokal (Dexie) — opname gudang sering berlangsung di area tanpa sinyal.
      Sesi pun lahir OFFLINE; ia menyusul ke server pada langkah pertama penguncian, idempoten
      lewat UUID klien (aturan R2).
- [x] Konfirmasi kunci dua langkah: ringkasan **jumlah item terhitung saja** → "Kunci & Hitung Selisih".
      ⛔ Tidak ada baris "berapa yang menyimpang" — satu bilangan bulat itu saja sudah cukup memberi
      tahu petugas bahwa hitungannya "salah", dan ia akan menghitung ulang sampai angkanya nol.
      Yang ditampilkan justru bahan yang BELUM dihitung: itu informasi tentang pekerjaannya, bukan
      tentang hasilnya.
- [x] Setelah `LOCKED`: layar hasil dengan selisih, nilai rupiah, dan `fraud_flag`.
      Seluruh angkanya berasal dari respons `POST /lock` dan disimpan apa adanya — **tidak satu pun
      dihitung ulang di klien**, karena menghitung sendiri menuntut perangkat gudang memegang stok
      sistem sepanjang fase hitung.
- [x] Hitung ulang (`recount_of`) hanya boleh lewat **sesi baru**, bukan mengubah sesi terkunci.
      Pemilihan layar diturunkan dari `session.status`, bukan dari state navigasi: router yang dapat
      "kembali" ke layar hitung akan membuat sesi terkunci dapat dibuka lagi lewat tombol back.

### M16.3 Sisi server 🐹

- [x] `OpnameSessionService.Create/UpsertItems/Lock/Approve` (+ `GetDraft`, `GetLocked`,
      `Reject`, `ListSessions` — delapan metode).
      `Create` **tidak menyentuh `raw_materials` sama sekali**: mengambil snapshot saat sesi dibuka
      akan menghasilkan selisih salah untuk setiap bahan yang terjual selama penghitungan.
- [x] **DTO ganda** `OpnameItemDraftDTO` / `OpnameItemLockedDTO` (§4.6) — bukan satu struct
      ber-`omitempty`. **Nol tag `omitempty`** di seluruh berkas: uji kebocoran (DoD butir 1)
      memeriksa SUBSTRING pada body mentah, sehingga field yang kebetulan bernilai nol akan lolos
      hari ini dan bocor besok. `null` eksplisit lebih jujur daripada field yang hilang.
- [x] `Lock` dalam satu transaksi: `SELECT stock FROM raw_materials … FOR UPDATE` → tulis
      `system_stock`, `system_package_quantity`, `difference`, `difference_value`, `fraud_flag` →
      set `LOCKED`, `locked_at`.
      `ORDER BY id` pada kunci mencegah deadlock antar sesi yang menyentuh bahan yang sama;
      klausa `status = 'DRAFT'` membuat penguncian ganda tidak berpengaruh.
- [x] `fraud_flag` = `|difference_value| > ambang_bisnis` **atau** `|difference| / system_stock > 10 %`
      (`OpnameFraudThreshold` = Rp 50.000, `OpnameFraudRatio` = 0,10).
      Keduanya diperlukan: rasio melewatkan 4 kg dari 500 kg daging (0,8 %, jutaan rupiah);
      nominal melewatkan habisnya seluruh persediaan garam (100 %, beberapa ribu rupiah).
      Stok sistem NOL ditangani terpisah — pembagian dengan nol menghasilkan NULL, dan kolomnya
      `NOT NULL`.
- [x] `Approve` (token bisnis): terapkan penyesuaian `raw_materials.stock`, tulis projection
      `stock_opnames`, set `APPROVED`.
      ⚠️ `stock = stok_saat_ini + difference`, **bukan** `stock = actual_stock`. Penyetujuan sering
      terjadi keesokan harinya sementara toko terus berjualan; menimpa dengan hitungan fisik akan
      MENGHIDUPKAN KEMBALI bahan yang sudah terpakai di sela itu.
      Contoh: sistem 100 kg, fisik 95 kg (susut 5), lalu terjual 20 kg → stok saat ini 80 kg.
      Benar `80 + (−5) = 75`; salah `= 95`, dan opname berikutnya akan melaporkan susut 20 kg yang
      tidak pernah hilang. Membaca `rm.Stock` menuntut `LockByID` (`FOR UPDATE`) karena rumusnya
      baca-ubah-tulis.
      Idempotensi ditegakkan URUTAN — status dipindahkan LEBIH DULU di dalam transaksi yang sama,
      sehingga panggilan kedua gagal sebelum satu pun stok tersentuh (DoD butir 8).
- [x] Endpoint `GET`/`POST` approve untuk Web Owner — empat rute pemilik di balik token bisnis,
      empat rute perangkat di balik `opnameDevice`. `GetLocked` menolak sesi `DRAFT` dengan `409`
      bahkan untuk pemilik: angkanya belum ada, dan menyusun respons "lengkap" dari kolom NULL akan
      menampilkan selisih nol untuk setiap bahan.

### M16.4 Web Owner 🌐

- [ ] Daftar sesi opname + status, layar detail selisih, tombol Setujui/Tolak
- [ ] Laporan "Selisih per bahan baku per periode" + penanda `fraud_flag`

### M16.5 Peran & akses

- [ ] Peran `STOCK_KEEPER` hanya dapat login di modul Opname; peran `CASHIER` tidak dapat
- [ ] Peran `SUPERVISOR`/`MANAGER` dapat keduanya

### M16.6 (Opsional, setelah Tahap 1 stabil) Flavor Flutter 📱

- [ ] Flavor `opname` dengan `main_opname.dart`, berbagi `core/` tetapi hanya memuat
      `features/opname`; `features/register`, `features/history`, `features/shift`
      **tidak** ter-*link*

### ✅ Definition of Done — M16

1. **Uji kebocoran ekspektasi.** Seluruh respons endpoint opname pada status `DRAFT` diuji otomatis:
   body **tidak memuat** substring `system_stock`, `difference`, `fraud_flag`. Diuji pada respons
   mentah, bukan pada struct hasil parse.
2. Petugas dengan peran `STOCK_KEEPER` mencoba `POST /v1/pos/sync` → `403 SCOPE_FORBIDDEN`.
3. Aturan lint impor terbukti: menambahkan `import … from '@/features/pos/…'` di dalam
   `features/opname/` membuat `pnpm lint` **gagal**.
4. Kasir yang login di POS **tidak** ikut login di `/opname` (database Dexie terpisah terverifikasi
   di DevTools → Application → IndexedDB: dua database berbeda).
5. Opname 100 bahan baku dilakukan **sepenuhnya offline**, draf bertahan setelah aplikasi ditutup
   dan perangkat dimulai ulang, lalu terkunci sukses setelah online.
6. Sesi `LOCKED` tidak dapat dikembalikan ke `DRAFT` lewat jalur mana pun (UI, API, langsung ke DB
   klien) — percobaan API → `409 OPNAME_ALREADY_LOCKED`.
7. Snapshot `system_stock` diambil pada `locked_at`, bukan pada `client_created_at` — diverifikasi
   dengan menjual bahan baku di antara kedua momen dan memastikan `system_stock` mencerminkan
   penjualan tersebut.
8. `Approve` menerapkan penyesuaian stok tepat satu kali; memanggilnya dua kali → `409`.

---

## Fase M17 — UI/UX Revamp: Thumb Zone & Isolasi Riwayat

**Butir:** 11, 14, 16, 18 · **Repositori:** 🌐 📱
**Prasyarat:** M13 (rute retur), M14 (banner cetak), M15 (redirect).

### M17.1 Butir 18 — Bottom Bar 🌐 📱

**Temuan.** Zona jempol pada perangkat handheld POS 6" yang dipegang satu tangan mencakup sekitar
sepertiga bawah layar. Setiap ikon di header memaksa penyesuaian genggaman — puluhan kali per jam
pada jam sibuk. Ini bukan preferensi estetika melainkan biaya waktu per transaksi.

```
SEBELUM (v1)                          SESUDAH (v2)
┌────────────────────────────────┐    ┌────────────────────────────────┐
│ ☰  Kasir  🔄 📶 🖨 ⚙  👤 ⏻    │    │ Andi · Shift 08:02 · 🟢 · 🖨 !  │ ← header:
├────────────────────────────────┤    ├────────────────────────────────┤    KONTEKS saja,
│                                │    │                                │    nol aksi
│         DAFTAR PRODUK          │    │         DAFTAR PRODUK          │
│                                │    │                                │
│                                │    │                                │
├────────────────────────────────┤    ├────────────────────────────────┤
│  Total          Rp 155.000     │    │  Total          Rp 155.000     │
│  [        BAYAR          ]     │    │  [        BAYAR          ]     │
└────────────────────────────────┘    ├────────────────────────────────┤
                                      │  🛒     ⏸️     🕘     🗑️    ⋯  │ ← BOTTOM BAR
                                      │ Kasir Tahan Riwayat Waste Lain │   64 dp, safe-area
                                      └────────────────────────────────┘
```

- [x] Komponen `PosBottomBar` (web) / `PosBottomBar` widget (Flutter) — tinggi 64 dp,
      target sentuh ≥ 48 dp, menghormati `env(safe-area-inset-bottom)` / `MediaQuery.viewPadding`.
      ⚠️ Area aman DITAMBAHKAN di bawah 64 dp, bukan memakannya — menghitungnya ke dalam tinggi bar
      menyusutkan target sentuh menjadi ±30 dp pada perangkat berponi.
      Flutter memakai `viewPadding`, BUKAN `padding`: yang terakhir menjadi nol saat papan ketik
      terbuka, dan bar akan melompat naik-turun setiap kali kasir mengetik.
- [x] Maksimal **5 slot**: 4 aksi utama + "Lainnya" yang membuka *bottom sheet* (bukan menu atas).
      Batas lima bukan angka bulat sembarangan: pada lebar 360 dp, enam slot menghasilkan target
      60 dp — lebih sempit dari lebar jempol dewasa (±45–57 dp).
- [x] Header direduksi menjadi konteks: nama kasir, jam mulai shift, indikator jaringan,
      lonceng "struk belum tercetak". **Nol** aksi yang dapat diketuk kecuali lonceng.
      Web: tombol ☰, lencana antrean, dan peringatan jam yang dulu menavigasi — ketiganya menjadi
      `<span>`. Flutter: kelima `IconButton` pada `AppBar` dihapus bersama `_menuActions()`.
- [x] Seluruh dialog konfirmasi menjadi *bottom sheet* dengan tombol utama di **bawah**
      (`components/ui/sheet.tsx` — `Sheet` + `ConfirmSheet`).
      Tombol utama di ATAS tombol Batal, bukan di sebelahnya: jarak 24 px yang cukup di layar 10"
      menjadi tidak cukup di layar 6", sedangkan susunan vertikal menuntut jangkauan yang berbeda
      terlepas dari ukuran layar.
- [x] Tablet 10" *landscape*: bottom bar tetap, tetapi diberi lebar maksimum dan diratakan ke sisi
      genggaman dominan (kanan) — bar selebar 1280 px memaksa jangkauan lengan penuh
- [x] Audit `grep`: tidak ada `IconButton` di dalam komponen header POS.
      Web `StatusBar` menyisakan **satu** `onClick` — lonceng struk, yang memang dikecualikan.

### M17.2 Butir 11 — Payment Full-Page 🌐 📱

**Temuan.** Di web, `payment` **sudah** merupakan layar pada router internal
([screens.ts](../posgodinov-fe/features/pos/router/screens.ts)) — bukan modal. Yang masih berupa
overlay adalah **sub-langkahnya**: pemilihan metode, input tunai, dan konfirmasi. Butir 11
diterjemahkan menjadi: seluruh sub-langkah pembayaran menjadi rute tersendiri.

- [x] `POS_SCREENS` diperluas: `'payment'`, `'payment-cash'`, `'payment-card'`, `'payment-split'`
      (`'return'` sudah ada sejak M13). `Record<PosScreen, ComponentType>` yang ekshaustif membuat
      layar yang lupa didaftarkan gagal saat kompilasi, bukan saat kasir menekan tombol.
- [x] Sub-layar adalah rute penuh, punya entri `history.pushState` sendiri sehingga tombol back
      perangkat mundur satu langkah — bukan menutup seluruh pembayaran.
      Setelah transaksi tersimpan, `posReplace` membuang SELURUH rantai sub-layar dari riwayat:
      back dari struk kembali ke Kasir, bukan ke form kartu transaksi yang sudah selesai.
- [x] `payment-card` memuat form butir 8: Trace Number (wajib), 4 digit akhir (wajib, numerik),
      Nominal Gesek (default = sisa tagihan, dapat diubah untuk split).
      Input disaring saat DIKETIK, bukan saat submit: sebagian pemindai kartu mengirimkan karakter
      kontrol yang tidak terlihat di layar.
      ⛔ Nol kolom untuk PAN penuh, CVV, PIN, atau magstripe (aturan R8).
- [x] Validasi terjadi di layar, **dan** di `wire.ts`, **dan** di `CHECK` constraint — tiga lapis.
      Rumusnya hidup di SATU tempat (`lib/constants/card-tender.ts` / `CardTenderRules`) dan dipakai
      bersama; regex yang disalin ke tiga tempat akan berbeda pada perbaikan pertama.
- [x] Keypad numerik besar pada layar penuh; tombol Fast-Cash 72 dp (`Touch.critical`)
- [x] 📱 `payment_page.dart` dipecah sesuai struktur yang sama; `showDialog` di jalur pembayaran
      **dihapus**. Berkas lamanya dipertahankan sebagai penanda `library;` berisi alasan — berkas
      yang lenyap tanpa jejak akan dibuat ulang oleh orang berikutnya yang mencarinya.
- [x] Tombol kembali dari sub-layar pembayaran **tidak** menghapus keranjang. Keranjang hanya
      dibersihkan setelah transaksi benar-benar tertulis.
- [x] **Multi-tender ikut lahir di sini.** `transactions.payment_method` berpindah tipe dari
      `PaymentMethod` ke `PaymentSummary` (yang memiliki `split`) — persis yang dijadwalkan catatan
      pada enum itu. Tanpa migrasi data: Drift menyimpan `textEnum` sebagai NAMA anggota, dan
      `cash`/`qris`/`debit`/`transfer` bernama identik di kedua enum.
      `PaymentMethod` sengaja TETAP 4 nilai — uji kontrak lintas platform menguncinya terhadap
      `PAYMENT_METHODS` di Web.

### M17.3 Butir 16 — Isolasi Riwayat 🌐 📱

- [x] `HistoryScreen` default: `[shift_id+client_created_at]` pada **shift aktif saja**.
      Tab "Sebelumnya" **dihapus dari kode**, bukan disembunyikan.
      "Hari Ini" pun tidak cukup: satu hari memuat dua sampai tiga shift.
      Flutter menambahkan `@TableIndex` komposit yang setara.
- [x] Kolom pencarian Kode Struk sebagai satu-satunya jalan ke transaksi lampau — lokal dulu
      (`short_code` terindeks), lalu `GET /v1/pos/transactions/lookup?code=`.
      🐹 Endpoint itu **belum ada** dan ikut dibangun di fase ini (`LookupTransaction` pada repo,
      service, handler, dan router — di balik `posDevice`).
      Pencocokan EKSAK, bukan `LIKE '%…%'`: pencarian sebagian mengubah kolom terindeks menjadi
      pemindaian tabel penuh DAN mengembalikan transaksi yang tidak dicari siapa pun.
- [x] Pencarian menerima `short_code` **atau** UUID penuh; menolak input < 6 karakter.
      Ditegakkan di klien DAN server (`service.MinLookupCodeLength`).
- [x] Hasil pencarian bersifat **satu transaksi**, bukan daftar (`First`, bukan `Find`).
      Hasilnya TIDAK disimpan ke basis data lokal: transaksi milik shift lain tidak boleh muncul di
      daftar riwayat shift berjalan hanya karena pernah dicari.
- [x] Rate limit sisi klien: 10 pencarian/menit, lalu jeda dengan pesan jelas.
      Penghitungnya di tingkat modul, bukan `useState`: kasir yang menekan batas lalu berpindah
      layar dan kembali tidak boleh mendapat sepuluh percobaan baru.
      ⚠️ Dinyatakan apa adanya sebagai pembatas KENYAMANAN — ia hidup di memori, dan penegakan
      sesungguhnya harus ada di server.
- [x] Transaksi hasil pencarian dapat diretur (M13) tetapi **tidak** dapat di-void (butir 15).
      Flutter memaksa jalur Retur lewat `fromLookup` tanpa memandang `receiptPrintedAt`: transaksi
      shift lain yang penandanya entah bagaimana belum terisi tetap tidak boleh di-void dari sini.
- [x] Kode yang tidak ada dan kode milik outlet lain dijawab `404` yang SAMA — membedakannya akan
      membocorkan keberadaan transaksi cabang lain lewat pesan galat.

### M17.4 Butir 14 — KIOSK Mode untuk Staff 🌐 📱

**Penegasan lingkup.** Kiosk v2 **bukan** layar pesan-mandiri pelanggan. Ia adalah POS kasir penuh
yang dikunci ke satu aplikasi supaya staff tidak tergelincir ke WhatsApp, dan supaya perangkat tidak
dapat dipakai untuk hal lain. Karena itu Kiosk **tidak** menyederhanakan UI kasir sama sekali.

- [x] Keluar Kiosk butuh peran/izin, bukan sekadar PIN staff mana pun:
      `staff.permissions.includes(config.kiosk_exit_permission)`.
      Kandidat disaring **SEBELUM** verifikasi bcrypt, bukan sesudah: mencocokkan PIN ke seluruh
      staff lalu memeriksa izinnya akan memberi tahu — lewat selisih waktu — bahwa PIN-nya benar
      dan orangnya saja yang tidak berwenang.
      Izin KOSONG (server pra-v2) berarti TIDAK berwenang; gerbang yang terbuka untuk semua orang
      pada perangkat yang belum diperbarui adalah pintu belakang, bukan kompatibilitas.
- [x] Ketukan tersembunyi dipertahankan (5 ketuk/3 detik) sebagai lapis pertama
- [x] Sukses → `KIOSK_EXIT_GRANTED` (WARN); gagal → `KIOSK_EXIT_DENIED` (CRITICAL) dengan
      `details.attempts`. `details.known_staff` membedakan "orang asing menebak PIN" dari "kasir
      sendiri mencoba membuka kuncinya" — dua hal yang menuntut tindakan sangat berbeda —
      **tanpa** membedakan pesan yang dilihat pemakai.
- [x] 3 kegagalan berturut → jeda 60 detik, tercatat sebagai `KIOSK_EXIT_LOCKED_OUT` (CRITICAL).
      Jeda diperiksa SEBELUM dialog PIN dibuka: membuka dialog lalu menolak setiap PIN membuat staff
      mengira PIN-nya yang salah, dan ia akan mencoba lagi — memperpanjang jeda tanpa tahu mengapa.
      ⚠️ Penghitungnya di memori dan hilang saat aplikasi ditutup. Itu batas yang nyata dan
      dinyatakan apa adanya; pada perangkat yang benar-benar terkunci Device Owner, menutup aplikasi
      bukan pilihan yang tersedia.
- [ ] Masuk Kiosk otomatis saat aplikasi dimulai bila `config` mengaktifkannya
- [ ] Kiosk aktif **tidak** menonaktifkan fitur kasir apa pun (bukan mode terbatas)
- [x] Indikator "Mode Kiosk: Terkunci Penuh / Hanya Disematkan" ditampilkan apa adanya
      (perilaku v1 dipertahankan — pemilik harus tahu tingkat penguncian sesungguhnya).
      Sudah ada sejak v1 di `_KioskCard`: perangkat non-Device-Owner mendapat peringatan eksplisit
      bahwa penguncian hanya berupa *screen pinning*. **Diverifikasi, tidak diubah.**
- [ ] 🌐 Padanan web: Fullscreen API + `beforeunload` + peringatan bahwa PWA **tidak dapat**
      mengunci perangkat sekuat Android Device Owner — dinyatakan jujur di layar Pengaturan

### ✅ Definition of Done — M17

1. Uji ergonomi terukur: pada handheld 6", seluruh aksi navigasi berada dalam 240 px dari tepi
   bawah. Diverifikasi dengan uji widget yang mengukur `getBottomLeft()` setiap tombol navigasi.
2. `grep -rn "IconButton\|<button" features/pos/components/Header*` — nol hasil kecuali lonceng cetak.
3. Seluruh sub-langkah pembayaran memiliki entri riwayat sendiri: dari `payment-card`, satu kali
   back → `payment`; dua kali → `register` dengan **keranjang utuh**.
4. Pembayaran kartu tanpa Trace Number tidak dapat diselesaikan di UI; dipaksa lewat konsol →
   ditolak `wire.ts`; dipaksa lewat `curl` → ditolak `CHECK` constraint. Ketiganya diuji.
5. Layar Riwayat pada shift baru menampilkan **kosong**, bukan transaksi kemarin — diuji dengan
   database berisi 500 transaksi lintas 10 shift.
6. Pencarian kode struk yang valid menemukan transaksi lintas shift; input `"A"` ditolak; 11
   pencarian dalam semenit memicu jeda.
7. Keluar Kiosk dengan PIN kasir biasa **ditolak** dan menghasilkan event CRITICAL yang tiba di
   server setelah sinkronisasi berikutnya — diuji dalam keadaan offline saat penolakan terjadi.
8. Uji ulang seluruh skenario UAT [08](08-uat-test-scenarios.md) & [12](12-mobile-uat-test-scenarios.md)
   yang menyentuh navigasi, diperbarui untuk tata letak baru.

---

## Fase M18 — Migrasi Data, Hardening & Rilis

**Prasyarat:** M12–M17 selesai. ✅ Terpenuhi 29 Agustus 2026.

> ### Status M18 — dipisah antara REKAYASA dan OPERASI RILIS
>
> **Selesai (cakupan repositori):**
> M18.2 *feature flag* ✅ · M18.3 pembaruan 52 skenario UAT ✅ · M18.4 migrasi
> `000025` ditulis & dikunci ✅ · seluruh suite UAT otomatis hijau ✅
> ([19 · Laporan Eksekusi QA](19-v2-qa-execution-report.md)).
>
> **Belum selesai — 10 butir `[ ]` di bawah menunggu lingkungan produksi nyata.**
> Ketiganya tidak dapat dibuktikan dari repositori ini:
>
> | Butir | Mengapa tidak dapat dicentang sekarang |
> |---|---|
> | M18.1 (4 butir) | Menuntut salinan produksi penuh dan jendela pemeliharaan. Termasuk *"rollback tertulis dan **diuji**"* — mencentangnya tanpa pengujian nyata adalah klaim yang akan dibaca orang justru ketika keadaan sedang buruk. |
> | M18.2 dashboard (1 butir) | Dashboard pemantauan belum dibangun. |
> | M18.3 panduan & runbook (4 butir) | Tiga panduan operasional dan runbook cetak belum ditulis. |
> | M18.4 `decodeV1` (1 butir) | Gerbangnya **waktu**: 100 % outlet di v2 selama 30 hari. Hari ini adalah H-0. Migrasi `000025_DO_NOT_RUN_YET_…` sengaja dikunci untuk alasan yang sama. |
>
> Kotak-kotak itu dibiarkan kosong **dengan sengaja**. Rencana rilis yang
> seluruh kotaknya tercentang tetapi separuhnya tidak pernah dikerjakan lebih
> berbahaya daripada rencana yang jujur menunjukkan sisanya.

### M18.1 Migrasi data produksi 🐹 — ⏳ menunggu jendela pemeliharaan produksi

- [ ] Latihan migrasi pada salinan produksi penuh; catat durasi tiap migrasi
- [ ] Migrasi `000024_backfill_v2` dijalankan **berbatch** (10.000 baris/batch) agar tidak mengunci
      `transactions` pada jam operasional
- [ ] Rencana *rollback* tertulis dan **diuji**, bukan sekadar didokumentasikan
- [ ] Verifikasi pasca-migrasi: kedelapan kueri pada DoD M11 butir 8

### M18.2 Strategi rilis bertahap

```
Minggu 1  │ Backend v2 dirilis. Melayani kontrak v1 DAN v2.
          │ Nol perangkat memakai v2. Risiko: minimal.
Minggu 2  │ 1 outlet percontohan → klien v2. Pantau harian:
          │ tingkat karantina sync, kegagalan cetak, selisih shift.
Minggu 3  │ 25 % outlet. Gerbang lanjut: nol insiden P1 selama 5 hari.
Minggu 4  │ 100 % outlet.
Minggu 6  │ Kontrak v1 → 426 UPGRADE_REQUIRED. Jendela deprekasi ditutup.
```

- [x] *Feature flag* per bisnis untuk: `blind_close_enabled`, `blind_opname_enabled`,
      `require_supervisor_for_void`, `history_scope` — memungkinkan mematikan satu perilaku tanpa
      *rollback* rilis.

      Pembaca: `lib/pos/config.ts` (Web), `core/config/pos_config.dart` (Mobile),
      `features/opname/session/opname-config.ts` (PWA Opname — pembaca TERSENDIRI karena
      `readPosConfig()` membuka database kasir, dan modul gudang dilarang menyentuhnya).

      **Bawaan seluruhnya KETAT**, dan itu keputusan yang mengikat: perangkat yang belum pernah
      menarik `config` berjalan dengan v2 penuh. Kebijakan longgar secara bawaan berarti outlet yang
      syncnya tertinggal kehilangan pengendalian tanpa ada yang menyadarinya. Penggabungan
      dilakukan **per-field**, sehingga `config` separuh dari server tidak menjatuhkan field lain ke
      `undefined`.

      Keadaan pemasangan setelah M18.2:

      | Flag | Web | Mobile | Catatan |
      |---|:---:|:---:|---|
      | `blind_close_enabled` | ✅ | ✅ | Diteruskan ke `shifts.blind_close` saat shift dibuka |
      | `require_supervisor_for_void` | ✅ | ✅ | Void Sheet & Return Sheet |
      | `history_scope` | ✅ | ✅ | **Dipasang di M18.2** — sebelumnya dibaca tanpa pemakai |
      | `blind_opname_enabled` | ⚠️ | ⛔ | Lihat dua catatan di bawah |

      ⚠️ **`blind_opname_enabled` tidak dapat dipakai sebagai jalan mundur darurat untuk butir 3.**
      Mematikannya **tidak** memunculkan stok sistem selama fase hitung, dan tidak dapat: respons
      `DRAFT` memakai `OpnameItemDraftDTO`, yang secara harfiah tidak memiliki field `system_stock`
      (§4.6). Tidak ada nilai yang dapat ditampilkan klien karena tidak ada nilai yang dikirim.
      Yang benar-benar dikendalikan flag ini adalah **salinan peringatan** di layar hitung.
      Mencabut Blind Opname sepenuhnya menuntut perubahan DTO di server, bukan pembalikan flag.

      ⛔ Di Mobile flag ini **belum punya pemakai**, dan itu benar: modul Opname belum ada di
      Flutter (M16.6 belum dikerjakan). Ia dibaca sekarang supaya kontraknya sudah benar saat modul
      itu lahir.
- [ ] Dashboard pemantauan: tingkat karantina, umur antrean tertua, `print_jobs` `ABANDONED`,
      `pos_security_events` CRITICAL per jam

### M18.3 Pelatihan & dokumen operasional

- [ ] Panduan kasir: perbedaan Void vs Retur, alasan angka sistem tidak lagi terlihat
- [ ] Panduan supervisor: kapan memberi otoritas, cara membaca laporan void
- [ ] Panduan pemilik: membaca rekonsiliasi Blind Closing dan selisih opname
- [x] Pembaruan [08](08-uat-test-scenarios.md) & [12](12-mobile-uat-test-scenarios.md) dengan
      skenario v2 — **52 skenario** (29 Web `UAT-V2-01…29`, 23 Mobile `UAT-MV2-01…23`).

      Tiga skenario v1 ditandai **`[×] OBSOLETE`** dengan coretan, BUKAN dihapus:
      `UAT-REP-01`, `UAT-MOB-19` (keduanya menuntut kasir melihat expected balance — bertentangan
      dengan butir 9), dan `UAT-MOB-26` (menerima PIN kasir mana pun untuk keluar Kiosk —
      bertentangan dengan butir 14). Ketiganya akan **gagal secara benar** pada build v2.
      Dipertahankan dengan alasannya supaya penguji yang mencarinya menemukan penjelasan alih-alih
      mengira dokumennya rusak.

      Setiap skenario yang menuntut sesuatu **tidak terlihat** menyebutkan cara periksa yang
      mengikat — DevTools → Network pada body mentah, inspeksi IndexedDB/SQLite, atau `grep`
      substring. Memeriksa dengan mata saja tidak membuktikan nilai itu tidak ada.
- [ ] Runbook: apa yang dilakukan bila struk pembatalan gagal cetak berulang

### M18.4 Pembersihan

- [ ] Setelah 100 % outlet di v2 selama 30 hari: hapus jalur `decodeV1`
- [x] Migrasi `000025` ditulis dan **sengaja diberi nama** `000025_DO_NOT_RUN_YET_drop_deprecated_columns`
      — nama itu bagian dari pengamanannya: `migrate up` menjalankan seluruh berkas yang belum
      diterapkan tanpa bertanya, dan satu-satunya hal yang membuat seseorang berhenti adalah membaca
      namanya di daftar. Mengganti namanya harus menjadi tindakan yang disengaja dan ditinjau.

      Pengamanan berlapis:
      1. **Nama berkas** `DO_NOT_RUN_YET`.
      2. **Kepala berkas** memuat lima gerbang wajib berupa checklist, termasuk perintah `grep`
         audit beserta daftar tempat yang per hari ini MASIH membaca ketiga kolom.
      3. **Pengaman waktu-jalan**: blok `DO $$` menggagalkan migrasi dengan pesan panjang bila
         penanda `app_flags.pos_contract_v1_retired` belum `true`.

      ⚠️ `.down.sql` mengembalikan **kolom, bukan data**. `COMMENT ON COLUMN` yang ditulisnya
      menyatakan itu apa adanya, supaya laporan pemilik tidak menampilkan "selisih kas Rp 0" untuk
      setiap shift lampau tanpa ada yang tahu angka itu artefak rollback.

      **Belum boleh dijalankan.** Audit `grep` hari ini masih menemukan tiga pemakai:
      `Shift.ExpectedBalance`/`Discrepancy` & `Transaction.CancelNotes` (tag JSON aktif),
      `shift_reconcile_repository.go` (mengisi ganda selama jendela deprekasi), dan
      `pos_repository.go` (menulis `cancel_notes`).

### ✅ Definition of Done — M18

1. Migrasi produksi selesai dalam jendela pemeliharaan yang direncanakan, dengan verifikasi
   pasca-migrasi hijau seluruhnya.
2. Rollback telah diuji pada lingkungan *staging* berisi salinan produksi — bukan hanya ditulis.
3. Outlet percontohan berjalan 7 hari dengan: tingkat karantina sync < 0,1 %, `print_jobs`
   `ABANDONED` < 1 %, nol kehilangan transaksi.
4. Seluruh skenario UAT v1 + v2 lulus pada web dan mobile.
5. Kontrak v1 dinonaktifkan tanpa satu pun perangkat lapangan tertinggal (diverifikasi dari log
   `X-POS-Contract-Version` selama 14 hari sebelum penutupan).
6. Setiap dari 18 butir memiliki **satu skenario UAT bernomor** yang membuktikannya — dilacak di
   §5.1 dan tidak ada baris yang kosong.

---

## 5. Lampiran

### 5.1 Matriks keterlacakan 18 butir → artefak → bukti

| # | Butir | Fase | Artefak kunci | Bukti (DoD) |
|---|---|---|---|---|
| 1 | Transisi online↔offline tanpa keluar | M12 | `sw.js` fallback, `connectivity-store` | M12 DoD 1, 2 |
| 2 | Default online + auto-push | M12 | Trigger `transaction-commit` | M12 DoD 3, 4 |
| 3 | Blind Opname | M16 | `opname_sessions.status`, DTO ganda | M16 DoD 1, 7 |
| 4 | Modul Opname terpisah | M16 | Scope `/opname`, Dexie terpisah, lint impor | M16 DoD 2, 3, 4 |
| 5 | Qty turun > 5 → Void | M13 | `decrementAccumulator`, `void_logs.CART_LINE` | M13 DoD 4 |
| 6 | Void wajib cetak | M14 | `renderCancelReceipt`, `print_jobs` | M14 DoD 1, 5 |
| 7 | Waste wajib cetak | M14 | `renderWasteReceipt` | M14 DoD 6 |
| 8 | Kartu: trace, 4 digit, nominal | M11 + M17 | `transaction_payments` + `ck_card_requires_trace` | M17 DoD 4 |
| 9 | Blind Closing | M15 | `shifts.declared_*`, `ShiftReconcileService` | M15 DoD 2, 3, 4 |
| 10 | Guard master data | M15 | `master_data_version`, gerbang P-04 | M15 DoD 1 |
| 11 | Payment full-page | M17 | `payment-cash/card/split` | M17 DoD 3 |
| 12 | Identity Lock | M15 | `uq_shift_open_per_device/staff` | M15 DoD 5, 6 |
| 13 | Hold tanpa hapus | M13 | `void_logs.HELD_ORDER` + `items_snapshot` | M13 DoD 5 |
| 14 | Kiosk staff + PIN otoritas | M17 | `permissions`, `KIOSK_EXIT_DENIED` | M17 DoD 7 |
| 15 | Void vs Retur | M13 | `receipt_printed_at`, `returns`, `ck_void_requires_unprinted` | M13 DoD 1, 2, 3 |
| 16 | Isolasi riwayat | M17 | `short_code`, endpoint `lookup` | M17 DoD 5, 6 |
| 17 | Redirect pasca tutup shift | M15 | `closeShiftSaga` | M15 DoD 7 |
| 18 | Bottom Bar | M17 | `PosBottomBar` | M17 DoD 1, 2 |

### 5.2 Register risiko

| Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|
| Migrasi Drift/Dexie menghapus transaksi belum tersinkron | **Katastrofik** — uang hilang | Rendah | M11 berdiri sendiri; uji migrasi wajib; ekspor cadangan antrean ke JSON sebelum migrasi |
| Kasir menolak Blind Closing ("saya tidak tahu benar atau salah") | Tinggi — sabotase adopsi | **Tinggi** | Pelatihan M18.3; struk tutup shift tetap mencetak angka deklarasi sebagai bukti pegangan kasir; feature flag per bisnis |
| Volume struk pembatalan menghabiskan kertas | Sedang | Sedang | Struk pembatalan dicetak ringkas (≤ 15 baris); pemilik dapat memantau rasio void/transaksi |
| Butir 5 memperlambat jam sibuk | Sedang | Sedang | Ambang dapat dikonfigurasi server (`void_threshold_qty`); mulai dari 5, evaluasi dari data void nyata setelah 2 minggu |
| Tabrakan `short_code` | Rendah | Rendah | Indeks unik + `409` + pembuatan ulang suffix |
| `uq_shift_open_per_staff` memblokir kasir sah setelah aplikasi terpasang ulang | Tinggi | Sedang | Jalur Force Close Supervisor (M15.2) |
| PWA Opname tidak terpasang di perangkat gudang lama | Sedang | Sedang | Fallback: modul berjalan di peramban tanpa instalasi; flavor Flutter M16.6 |
| Perangkat lapangan tidak pernah diperbarui ke kontrak v2 | Sedang | Sedang | Jendela deprekasi 6 minggu + pemantauan header versi |

### 5.3 Yang **tidak** termasuk lingkup v2

Dinyatakan eksplisit agar tidak menyelinap masuk saat eksekusi:

- Diskon, pajak, dan biaya layanan — backend belum memilikinya ([03 §14]) dan menambahkannya
  mengubah seluruh matematika retur.
- Program loyalitas dan data pelanggan.
- Integrasi EDC langsung (v2 hanya **mencatat** hasil gesek yang diketik manual; integrasi soket
  EDC adalah proyek tersendiri).
- Multi-mata uang.
- Retur lintas outlet.
- Layar pesan-mandiri pelanggan (butir 14 secara eksplisit menyatakan Kiosk untuk staff).

### 5.4 Keputusan arsitektur yang menyimpang dari permintaan literal

Dicatat terbuka agar dapat ditinjau, bukan disembunyikan:

| Permintaan literal | Yang dirancang | Alasan |
|---|---|---|
| "penambahan kolom `trace_number` di `transactions`" | Tabel `transaction_payments`, **plus** kolom ringkasan `primary_trace_number` & `primary_card_last4` di `transactions` | Butir 8 menyebut "Nominal Gesek", yang berarti nominal gesek dapat berbeda dari total transaksi — yaitu pembayaran gabungan. Satu kolom di induk tidak dapat menampung dua tender. Kolom ringkasan tetap ditambahkan agar laporan v1 dan permintaan literal tetap terpenuhi. |
| "pembuatan tabel `returns`" | `returns` **dan** `return_items` **dan** `void_logs` | Retur per item memerlukan tabel anak. `void_logs` diperlukan karena butir 5 dan 13 membatalkan sesuatu yang **belum menjadi transaksi**, sehingga tidak ada baris yang dapat ditandai. |
| Modul Opname "aplikasi terpisah" | PWA scope terpisah + DB terpisah (Tahap 1); flavor Flutter (Tahap 2 opsional) | Aplikasi Android kedua menuntut binding perangkat, distribusi, dan pembaruan tersendiri. PWA mencapai isolasi yang sama secara teknis dengan biaya operasional jauh lebih rendah, dan dapat dinaikkan ke aplikasi native tanpa mengubah kontrak. |
| Butir 11 "Payment dari Modal menjadi Full-Page" | Sub-langkah pembayaran yang dijadikan rute | Di web, `payment` **sudah** merupakan layar penuh pada router internal. Yang masih overlay adalah sub-langkahnya. |

---

**Akhir dokumen.** Perubahan atas rancangan ini wajib melalui PR yang menyebutkan butir mana dari 18
yang terdampak dan DoD mana yang berubah.
