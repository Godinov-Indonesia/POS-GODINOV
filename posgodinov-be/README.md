# Posgodinov Backend

Backend REST API untuk sistem Posgodinov, dibangun menggunakan Go (Golang) versi 1.26+ dan PostgreSQL, disusun dengan pendekatan **Domain-Driven Design (DDD) / Clean Architecture**.

## Fitur Utama & Tech Stack
- **Go 1.26+** (menggunakan *standard library* `net/http` router terbaru).
- **PostgreSQL** & **GORM** (ORM).
- **Golang-Migrate** (Auto-migration berjalan saat aplikasi *startup*).
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
- Folder migrasi ada di: `db/migrations/`
- Jika ingin menambah tabel atau struktur baru, cukup tambahkan file berakhiran `.up.sql` dan `.down.sql` di folder tersebut. Aplikasi akan menerapkannya saat *restart* berikutnya.

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

### Inventory Control & Bill of Materials (BOM)
| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| POST | `/v1/business/outlets/{id}/raw-materials` | Menambah master data bahan mentah (Supplier) |
| POST | `/v1/business/outlets/{id}/raw-materials/bulk` | Menambah banyak master data bahan mentah sekaligus |
| GET | `/v1/business/outlets/{id}/raw-materials` | Melihat stok seluruh bahan mentah di outlet |
| POST | `/v1/business/outlets/{id}/categories` | Membuat kategori produk |
| POST | `/v1/business/outlets/{id}/categories/bulk` | Membuat banyak kategori produk sekaligus |
| POST | `/v1/business/outlets/{id}/products` | Membuat menu baru dan mengikat resep bahan bakunya (BOM) beserta **image_url** |
| POST | `/v1/business/outlets/{id}/products/bulk` | Membuat banyak menu beserta resep sekaligus |
| GET | `/v1/business/outlets/{id}/products` | Melihat daftar menu dan komposisi resep per produk |
| POST | `/v1/business/outlets/{id}/raw-materials/{rm_id}/restock` | Mencatat pembelian/penambahan stok tunggal |
| POST | `/v1/business/outlets/{id}/restock/bulk` | Mencatat banyak pembelian barang (inbound) sekaligus |
| POST | `/v1/business/outlets/{id}/raw-materials/{rm_id}/waste` | Melaporkan barang rusak/basi/tumpah (Log Waste) tunggal |
| POST | `/v1/business/outlets/{id}/waste/bulk` | Melaporkan banyak barang rusak/basi sekaligus |
| POST | `/v1/business/outlets/{id}/raw-materials/{rm_id}/opnames` | Melakukan Stock Opname tunggal (**Support `package_unit` & deteksi fraud rupiah otomatis**) |
| POST | `/v1/business/outlets/{id}/opnames/bulk` | Melakukan banyak Stock Opname sekaligus |

### Laporan & Analitik (Reports)
| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| GET | `/v1/business/outlets/{id}/reports/dashboard` | Dasbor statistik (*Revenue, Total Transactions, Top Products*) |
| GET | `/v1/business/outlets/{id}/reports/transactions` | Riwayat transaksi secara mendetail |
| GET | `/v1/business/outlets/{id}/reports/restock` | Laporan riwayat pembelian barang (restock) |
| GET | `/v1/business/outlets/{id}/reports/waste` | Laporan riwayat barang terbuang (waste) |
| GET | `/v1/business/outlets/{id}/reports/opnames` | Laporan riwayat stock opname dan selisih fraud |

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
