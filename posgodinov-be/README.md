# Posgodinov Backend

Backend REST API untuk sistem Posgodinov, dibangun menggunakan Go (Golang) versi 1.26+ dan PostgreSQL, disusun dengan pendekatan **Domain-Driven Design (DDD) / Clean Architecture**.

## Fitur Utama & Tech Stack
- **Go 1.26+** (menggunakan *standard library* `net/http` router terbaru).
- **PostgreSQL 17** & **GORM** (ORM).
- **Multi-Tenant Architecture**: Pemisahan Master/Landlord DB (`posgodinov`) dan Business DB terisolasi per tenant (`business_<id>`).
- **Dual-Stock Inventory & Auto-Unpack**: Pelacakan stok kemasan utuh (`package_stock`) dan eceran terbuka (`loose_stock`) dengan *PostgreSQL generated stored column* (`unit_stock`) serta mekanisme otomatis pembongkaran kemasan (*auto-unpack*) saat konsumsi resep BOM.
- **Golang-Migrate**: Auto-migration berjalan saat aplikasi *startup* (1 migrasi landlord, 27 migrasi business).
- **Structured Logging** menggunakan standard `log/slog`.
- **Docker & Docker Compose** *ready*.
- **Middleware Terintegrasi**: CORS, Security Headers, & HTTP Request Logger.

---

## 🚀 Cara Menjalankan Aplikasi (Step-by-Step)

### 1. Clone Repository
Langkah pertama, clone repository ini ke mesin lokal Anda:
```bash
git clone godinov/posgodinov-backend.git
cd posgodinov-backend
```

### 2. Konfigurasi Environment Variables
Gandakan file `.env.example` menjadi `.env`. 
*(Nilai default sudah diatur agar bisa langsung berjalan tanpa perlu banyak perubahan)*:
```bash
cp .env.example .env
```

### 3. Menjalankan Aplikasi (Opsi A: Full Docker - Sangat Disarankan)
Cara termudah adalah menjalankan seluruh *stack* (Database dan Aplikasi Backend) di dalam Docker.
```bash
docker-compose up -d --build
```
- Server backend akan berjalan di `http://localhost:8080`.
- Proses *Database Migration* akan **berjalan secara otomatis** saat server berhasil menyala.

### 4. Menjalankan Aplikasi (Opsi B: Local Development)
Jika Anda ingin mengembangkan kode (ngoding) dan hanya butuh database dari Docker:

a. Jalankan container Database PostgreSQL-nya saja:
```bash
docker-compose up -d db
```

b. Jalankan aplikasi Go di lokal mesin Anda:
```bash
go run cmd/api/main.go
```
*Note: Pastikan Anda sudah menginstal Go 1.26 di mesin lokal Anda.*

---

## 🗄️ Database Migrations

Sistem migrasi sudah terintegrasi penuh menggunakan library `golang-migrate` dan berjalan secara otomatis setiap kali aplikasi (main.go) dihidupkan.
- Folder migrasi terbagi dua:
  - `db/migrations/landlord/`: Skema database master/tenant registry.
  - `db/migrations/business/`: Skema database operasional per tenant bisnis (27 migrasi hingga `000027_dual_stock_raw_materials`).
- Jika ingin menambah tabel atau struktur baru, cukup tambahkan file berakhiran `.up.sql` dan `.down.sql` di folder terkait. Aplikasi akan menerapkannya saat *restart* berikutnya.

> **⚠️ PERHATIAN PENTING: PostgreSQL Row-Level Security (RLS)**
> 
> Sistem ini menggunakan RLS untuk mengisolasi data antar outlet/cabang secara ketat di dalam *Business DB*.
> Migrasi `000025_enable_rls.up.sql` akan otomatis memindai dan mengamankan seluruh tabel yang memiliki kolom `outlet_id`.
> 
> **Aturan untuk pengembangan ke depan:**
> Jika Anda membuat tabel baru yang memiliki kolom `outlet_id` di atas urutan `000025` (misal `000026_create_table_x.up.sql`), **Anda WAJIB** mengaktifkan RLS secara manual di dalam file migrasi tersebut dengan sintaks berikut:
> ```sql
> ALTER TABLE nama_tabel_baru ENABLE ROW LEVEL SECURITY;
> ALTER TABLE nama_tabel_baru FORCE ROW LEVEL SECURITY;
> CREATE POLICY rls_outlet_isolation ON nama_tabel_baru FOR ALL USING (
>     current_setting('app.current_outlet_id', true) IS NULL 
>     OR current_setting('app.current_outlet_id', true) = '' 
>     OR outlet_id = current_setting('app.current_outlet_id', true)
> );
> ```

---

## 📡 API Endpoints 

### Authentication & Management
| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| POST | `/v1/auth/business/register` | Mendaftarkan akun Business Owner |
| POST | `/v1/auth/business/login` | Login Business Owner (Mendapatkan Token) |
| POST | `/v1/auth/business/refresh` | Refresh Akses Token |
| POST | `/v1/business/outlets` | Menambahkan outlet/cabang baru |
| GET | `/v1/business/outlets` | Mendapatkan daftar outlet |
| POST | `/v1/business/staff` | Mendaftarkan akun kasir (Staff) pada outlet tertentu |
| GET | `/v1/business/staff` | Mendapatkan daftar seluruh akun kasir di semua outlet bisnis Anda |
| GET | `/v1/business/outlets/{id}/staff` | Mendapatkan daftar akun kasir per outlet spesifik |
| PUT | `/v1/business/staff/{staff_id}` | Mengubah data atau status akun kasir |
| DELETE | `/v1/business/staff/{staff_id}` | Menghapus akun kasir |

### POS (Point of Sales) Client & Sync Hub
| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| POST | `/v1/auth/device/bind` | Menghubungkan perangkat Tablet POS dengan Outlet menggunakan *Pairing Code* |
| GET | `/v1/pos/sync/master-data` | Menarik master data (Staf, Kategori, Produk, Resep) ke perangkat kasir (Offline-First) |
| POST | `/v1/pos/sync` | Sinkronisasi massal data transaksi, shift, dan waste dari kasir ke server secara *idempotent* |
| GET | `/v1/pos/transactions` | Mengambil riwayat transaksi masa lalu khusus untuk perangkat POS (dengan batas dan pagination) |

### Inventory Control, Dual-Stock & Bill of Materials (BOM)

Sistem menggunakan model **Dual-Stock** untuk akurasi inventori tingkat tinggi antara stok gudang (kemasan utuh) dan stok operasional harian (eceran terbuka):
- **`package_stock`** (`INTEGER`): Jumlah kemasan utuh yang belum dibuka (misal: 10 dus, 5 karung).
- **`loose_stock`** (`DECIMAL(12,4)`): Jumlah bahan eceran terbuka dalam satuan dasar (misal: 450.5 gram, 120 ml).
- **`unit_stock`** (`DECIMAL(12,4)`): Total ketersediaan bahan dalam satuan dasar, dihitung otomatis oleh PostgreSQL via `GENERATED ALWAYS AS (package_stock * COALESCE(quantity_per_package, 0) + loose_stock) STORED` (read-only di aplikasi backend).
- **Auto-Unpack**: Pada saat sinkronisasi transaksi kasir (`/v1/pos/sync`), jika kebutuhan resep BOM melebihi `loose_stock`, sistem otomatis membongkar kemasan utuh secara atomik (`ceil` dari kekurangan dibagi `quantity_per_package`) tanpa intervensi manual.
- **Restock**: Menerima penambahan kemasan (`package_quantity`) atau eceran (`quantity`), memperbarui HPP (*moving average*) berbasis unit dasar.
- **Waste**: Mendukung pencatatan bahan rusak per kemasan (`package_quantity`) atau eceran (`quantity`) dengan logika auto-unpack bila eceran tidak mencukupi.

| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| POST | `/v1/business/outlets/{id}/raw-materials` | Menambah master data bahan mentah (Supplier, kemasan & konversi unit) |
| POST | `/v1/business/outlets/{id}/raw-materials/bulk` | Menambah banyak master data bahan mentah sekaligus |
| GET | `/v1/business/outlets/{id}/raw-materials` | Melihat stok seluruh bahan mentah (`package_stock`, `loose_stock`, `unit_stock`) |
| POST | `/v1/business/outlets/{id}/categories` | Membuat kategori produk |
| POST | `/v1/business/outlets/{id}/categories/bulk` | Membuat banyak kategori produk sekaligus |
| POST | `/v1/business/outlets/{id}/products` | Membuat menu baru dan mengikat resep bahan bakunya (BOM) beserta **image_url** |
| POST | `/v1/business/outlets/{id}/products/bulk` | Membuat banyak menu beserta resep sekaligus |
| GET | `/v1/business/outlets/{id}/products` | Melihat daftar menu dan komposisi resep per produk |
| POST | `/v1/business/outlets/{id}/raw-materials/{rm_id}/restock` | Mencatat restock tunggal (bisa kemasan atau eceran) + update moving HPP |
| POST | `/v1/business/outlets/{id}/restock/bulk` | Mencatat banyak pembelian barang (inbound) sekaligus |
| POST | `/v1/business/outlets/{id}/raw-materials/{rm_id}/waste` | Melaporkan barang rusak/basi (kemasan atau eceran dengan auto-unpack) |
| POST | `/v1/business/outlets/{id}/waste/bulk` | Melaporkan banyak barang rusak/basi sekaligus |

### Stock Opname (SO) — Admin (Token Bisnis)

Modul SO menggunakan alur form terkelola: Admin membuat form → pilih material → publish → staf menghitung dual-stock fisik via app mobile SO → admin tutup form → review selisih gabungan & fraud flag → approve/reject/recount.

| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| POST | `/v1/business/outlets/{id}/so/forms` | Membuat form SO baru (pilih material yang akan dihitung) |
| GET | `/v1/business/outlets/{id}/so/forms` | Melihat daftar form SO (filter `?status=OPEN\|PUBLISHED\|...`) |
| GET | `/v1/business/outlets/{id}/so/forms/{fid}` | Detail form: lembar per kasir + lembar final gabungan (setelah close) |
| PUT | `/v1/business/outlets/{id}/so/forms/{fid}/items` | Mengubah daftar material (hanya saat status `OPEN`) |
| POST | `/v1/business/outlets/{id}/so/forms/{fid}/publish` | Publish form → terlihat di app SO staf |
| POST | `/v1/business/outlets/{id}/so/forms/{fid}/close` | Menutup form: agregasi hitungan fisik, snapshot stok sistem, selisih & fraud flag |
| POST | `/v1/business/outlets/{id}/so/forms/{fid}/approve` | Menyetujui & menyesuaikan langsung `package_stock` dan `loose_stock` bahan baku |
| POST | `/v1/business/outlets/{id}/so/forms/{fid}/reject` | Menolak form tanpa mengubah stok |
| POST | `/v1/business/outlets/{id}/so/forms/{fid}/recount` | Membuat form recount baru (Recount ke-N), terhubung historis ke parent |

### Stock Opname (SO) — App Mobile SO (Device Token scope `OPNAME`)

Endpoint untuk aplikasi mobile **posgodinov-so**. Auth menggunakan device binding sama seperti POS, dengan scope `OPNAME`.
Staf menginput hitungan fisik dalam format **Dual-Stock**:
- `actual_packages` (`INTEGER`): Jumlah kemasan utuh fisik yang dihitung.
- `actual_loose` (`DECIMAL`): Jumlah eceran terbuka fisik yang dihitung.

| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| GET | `/v1/so/available` | Melihat daftar SO yang bisa dikerjakan (`PUBLISHED`/`COUNTING`) |
| GET | `/v1/so/{form_id}` | Detail form + daftar material (tanpa stok sistem — blind opname) |
| PUT | `/v1/so/{form_id}/counts` | Mengirim hitungan dual-stock fisik (`actual_packages`, `actual_loose`) per staf (header `X-Staff-Id` wajib) |
| GET | `/v1/so/{form_id}/my-counts` | Melihat lembar hitungan staf yang sedang login pada form tersebut |

### Laporan & Analitik (Reports)
| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| GET | `/v1/business/outlets/{id}/reports/dashboard` | Dasbor statistik (*Revenue, Total Transactions, Top Products*) |
| GET | `/v1/business/outlets/{id}/reports/transactions` | Riwayat transaksi secara mendetail |
| GET | `/v1/business/outlets/{id}/reports/restock` | Laporan riwayat pembelian barang (restock) |
| GET | `/v1/business/outlets/{id}/reports/waste` | Laporan riwayat barang terbuang (waste) |

---

## 📁 Struktur Direktori

```text
├── cmd
│   └── api
│       └── main.go                 # Entry point aplikasi
├── db
│   └── migrations/                 # File .sql untuk skema database
├── internal
│   ├── config/                     # Logic pembacaan file .env
│   ├── database/                   # Konfigurasi GORM dan Connection Pool
│   ├── domain/                     # Core Business: Struct Model & Interface
│   ├── handler/                    # HTTP Handlers (Controller) dan Router Mux
│   ├── middleware/                 # CORS, Security Headers, dan Request Logger
│   ├── repository/                 # Implementasi koneksi Data/Query (GORM)
│   └── service/                    # Business logic implementation
├── pkg
│   └── logger/                     # Shared structured JSON logger
├── tests                           # Folder test sesuai standarisasi
│   ├── feature/
│   └── unit/
```
