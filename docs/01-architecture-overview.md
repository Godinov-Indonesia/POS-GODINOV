# 01 — Architecture Overview

> **Sumber kebenaran:** hasil audit langsung terhadap kode di [posgodinov-be/](../posgodinov-be/).
> Modul Go: `posgodinov-backend` · Go `1.26.1` · PostgreSQL 17.
> Setiap klaim di dokumen ini dapat ditelusuri ke file yang dirujuk.

---

## 1. Gaya Arsitektur

**Layered Architecture dengan Dependency Inversion (Clean Architecture "lite" / DDD-flavored).**

Struktur direktori mengikuti konvensi `cmd/` + `internal/` + `pkg/`:

```text
cmd/api/main.go            → Composition Root (manual dependency injection)
cmd/seeder/main.go         → Utilitas seeding data
internal/
├── domain/                → Entity + Kontrak (interface Repository & Service) — layer terdalam
├── handler/               → HTTP Handler (Controller) + Router
├── service/               → Business Logic / Use Case
├── repository/            → Implementasi persistensi (GORM)
├── middleware/            → Auth, Audit, CORS, Rate Limit, Logger, Recovery
├── config/                → Pembacaan environment variable
└── database/              → Koneksi GORM + Transaction Manager
pkg/
├── token/                 → PASETO Token Maker
├── response/              → Standarisasi amplop JSON
├── logger/                → Structured logging (log/slog)
└── utils/                 → Helper (random string generator)
db/migrations/             → 16 file migrasi SQL (golang-migrate)
tests/{unit,feature}/      → 13 unit test + 13 feature test
```

### Aliran dependensi

```text
HTTP Request
    │
    ▼
[middleware]  PanicRecovery → SecurityHeaders → CORS → RequestLogger   (global, main.go:135-139)
    │
    ▼
[router]      http.ServeMux (Go 1.22+ pattern matching)                 (handler/router.go)
    │
    ▼
[middleware]  AuthMiddleware → AuditMiddleware                          (per-route, `chain()`)
    │
    ▼
[handler]     Parsing JSON, ekstraksi PathValue, ekstraksi token payload
    │
    ▼
[service]     Validasi bisnis + otorisasi tenant + orkestrasi transaksi DB
    │
    ▼
[repository]  Query GORM
    │
    ▼
PostgreSQL
```

**Titik kunci Clean Architecture yang benar-benar diterapkan:**

- Seluruh kontrak (`XxxRepository`, `XxxService`) dideklarasikan di package `domain`, sementara implementasinya berada di `repository` dan `service`. Layer luar bergantung pada abstraksi milik layer dalam — bukan sebaliknya.
- `service` menerima `domain.XxxRepository` (interface), bukan `*gorm.DB`. Hal ini membuat unit test dapat berjalan penuh dengan mock — lihat [tests/unit/](../posgodinov-be/tests/unit/).
- Dependency injection dilakukan **manual dan eksplisit** di [main.go:73-132](../posgodinov-be/cmd/api/main.go#L73-L132). Tidak ada framework DI (wire/fx/dig).

**Deviasi dari Clean Architecture murni (catatan jujur):**

- Package `domain` mengandung tag GORM (`gorm:"column:..."`) dan tag JSON pada entity yang sama. Artinya entity domain terikat pada detail persistensi dan detail transport. Ini adalah *pragmatic shortcut*, bukan Clean Architecture ketat.
- DTO request/response ikut tinggal di `domain` (mis. `RegisterBusinessRequest`), bukan di layer handler.
- Tidak ada layer `usecase` terpisah dari `service`; keduanya digabung.

---

## 2. Dependency & Library Utama

Dari [go.mod](../posgodinov-be/go.mod):

| Peran | Library | Versi | Catatan |
|---|---|---|---|
| **HTTP Router** | `net/http` (standard library) | Go 1.26 | **Tidak memakai Gin/Echo/Chi/Fiber.** Menggunakan `http.ServeMux` gaya Go 1.22+ dengan pola `"POST /v1/auth/business/login"` dan wildcard `{outlet_id}` yang dibaca via `r.PathValue()`. |
| **ORM** | `gorm.io/gorm` | v1.31.2 | Driver: `gorm.io/driver/postgres` v1.6.0 (di atas `jackc/pgx/v5`). |
| **Database Driver** | `jackc/pgx/v5` + `lib/pq` | v5.10.0 / v1.12.3 | `lib/pq` dipakai oleh golang-migrate. |
| **Migration** | `golang-migrate/migrate/v4` | v4.19.1 | Dijalankan **otomatis saat startup** dari `file://db/migrations` — [main.go:47-63](../posgodinov-be/cmd/api/main.go#L47-L63). |
| **Auth Token** | `vk-rv/pvx` | — | **PASETO v4 `local`** (bukan JWT). Token terenkripsi simetris, bukan sekadar ditandatangani. |
| **Hashing** | `golang.org/x/crypto/bcrypt` | v0.54.0 | `bcrypt.DefaultCost` untuk password Business dan PIN Kasir. |
| **Logger** | `log/slog` (standard library) | Go 1.26 | Handler JSON ke stdout, level dari `LOG_LEVEL` — [pkg/logger/logger.go](../posgodinov-be/pkg/logger/logger.go). |
| **CORS** | `rs/cors` | v1.11.1 | — |
| **Rate Limiting** | `golang.org/x/time/rate` | v0.15.0 | Token bucket in-memory per IP. |
| **Env Loader** | `joho/godotenv` | v1.5.1 | `.env` bersifat opsional; error diabaikan. |
| **Faker (test)** | `brianvoe/gofakeit/v7` | v7.15.0 | Hanya untuk seeder/test. |

> ⚠️ **Catatan teknis:** seluruh dependensi di `go.mod` ditandai `// indirect` walaupun sebagian besar diimpor langsung. Ini menandakan `go mod tidy` belum pernah dijalankan setelah dependensi ditambahkan. Tidak memengaruhi runtime, tetapi sebaiknya dirapikan.

### Infrastruktur

- **Containerization:** [Dockerfile](../posgodinov-be/Dockerfile) + [docker-compose.yml](../posgodinov-be/docker-compose.yml) (app + `postgres:17-alpine`, host port `5433` → container `5432`).
- **CI/CD:** [.github/workflows/deploy.yml](../posgodinov-be/.github/workflows/deploy.yml) — build & push ke Docker Hub, lalu deploy via SSH. **Trigger `on:` sedang di-comment**, jadi pipeline tidak aktif otomatis.
- **Connection Pool:** `MaxOpenConns=25`, `MaxIdleConns=25` — [database/postgres.go](../posgodinov-be/internal/database/postgres.go).
- **Graceful Shutdown:** aktif dengan timeout 10 detik pada `SIGINT` — [main.go:146-171](../posgodinov-be/cmd/api/main.go#L146-L171).

---

## 3. Strategi Multi-Tenancy

### Model: **Shared Database, Shared Schema, Discriminator Column**

Seluruh tenant berbagi satu database dan satu schema (`public`). Tidak ada schema-per-tenant, tidak ada database-per-tenant, dan **tidak ada PostgreSQL Row-Level Security (RLS)**.

### Hierarki tenant dua tingkat

```text
Business  (Tenant Root — pemilik/owner pusat)
   │  businesses.id — VARCHAR(8), random alfanumerik
   │
   └── Outlet  (Sub-tenant — cabang/toko fisik)
          │  outlets.id — VARCHAR(6), random alfanumerik
          │
          ├── users (Staff/Kasir)
          ├── raw_materials, products, product_categories
          ├── waste_logs, stock_opnames, restock_logs
          └── shifts, transactions, product_wastes
```

### Kolom diskriminator

> **Penting:** tidak ada kolom bernama `tenant_id` di skema ini. Peran diskriminator dipegang oleh **`outlet_id`**, dan pada tabel POS ditambah **`business_id`**.

| Kelompok tabel | Kolom isolasi | Cara isolasi |
|---|---|---|
| `outlets` | `business_id` | Langsung |
| `users`, `raw_materials`, `products`, `product_categories`, `waste_logs`, `stock_opnames`, `restock_logs` | `outlet_id` | Satu tingkat — `business_id` diperoleh lewat join/lookup ke `outlets` |
| `shifts`, `transactions`, `product_wastes` | `business_id` **dan** `outlet_id` | Denormalisasi ganda agar query laporan lintas-outlet bisa langsung memfilter `business_id` tanpa join |
| `transaction_items` | *(tidak ada)* | Turunan — terisolasi lewat `transaction_id` |
| `product_recipes` | *(tidak ada)* | Turunan — terisolasi lewat `product_id` |
| `audit_logs` | *(tidak ada)* | **Tidak terisolasi tenant** — lihat catatan di bawah |

### Mekanisme penegakan (enforcement)

Isolasi **ditegakkan di service layer**, bukan di database dan bukan di middleware. Pola bakunya konsisten di seluruh service:

```go
// contoh: internal/service/product_service.go
outlet, err := s.outletRepo.GetByID(ctx, outletID)
if err != nil {
    return nil, errors.New("outlet tidak ditemukan")
}
if outlet.BusinessID != businessID {          // ← inilah gerbang tenant
    return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
}
```

`businessID` **selalu** berasal dari payload token yang sudah diverifikasi (`payload.ID`), tidak pernah dari body atau query — sehingga klien tidak bisa memalsukannya. `outletID` diambil dari path URL, lalu diverifikasi kepemilikannya terhadap `businessID`.

Cek ini telah diverifikasi ada di: `product_service`, `raw_material_service`, `category_service`, `staff_service`, `waste_log_service`, `stock_opname_service`, `restock_log_service`.

### Identitas tenant yang dapat dibaca manusia (Serial)

Digunakan untuk *device binding* POS agar kasir tidak perlu tahu email/password owner:

- **`businesses.serial_business`** — `UPPER(nama[0:3]) + UPPER(owner[0:2]) + ddMMyy`
  Contoh: bisnis *"Kopi Senja"* milik *"Budi"* terdaftar 01-08-2026 → `KOPBU010826`
  ([business_service.go:52-70](../posgodinov-be/internal/service/business_service.go#L52-L70))
- **`outlets.serial_tenant`** — `serial_business + %03d` berdasarkan jumlah outlet yang sudah ada
  Contoh: `KOPBU010826001`, `KOPBU010826002`
  Dihasilkan di dalam transaksi DB dengan **row lock pada `businesses`** (`LockByID`) untuk mencegah *race condition* penomoran ganda — [outlet_service.go:36-60](../posgodinov-be/internal/service/outlet_service.go#L36-L60).

### `[NEEDS DISCUSSION]` — Isu multi-tenancy yang terbuka

1. **Tidak ada header `X-Tenant-ID`.** Konteks tenant murni berasal dari token + path parameter. Jika ke depan diperlukan header eksplisit, saat ini backend belum membacanya sama sekali.
2. **`audit_logs` tidak punya kolom tenant.** Tabel ini hanya menyimpan `actor_id` (= Business ID). Menyajikan audit trail per-outlet, atau memisahkan log antar tenant, belum bisa dilakukan tanpa perubahan skema.
3. **Isolasi bergantung sepenuhnya pada disiplin developer.** Satu service baru yang lupa memanggil pemeriksaan `outlet.BusinessID != businessID` akan langsung membocorkan data lintas tenant. Pertimbangkan *guard* terpusat (middleware resolusi outlet, atau PostgreSQL RLS) sebagai lapisan pertahanan kedua.
4. **Endpoint laporan tidak memverifikasi kepemilikan outlet secara eksplisit.** [report_handler.go](../posgodinov-be/internal/handler/report_handler.go) langsung meneruskan `outlet_id` dari path ke query. Kebocoran data tetap tidak terjadi karena query selalu menyertakan `WHERE business_id = ?` ([report_repository.go:23](../posgodinov-be/internal/repository/report_repository.go#L23)) — outlet milik tenant lain hanya menghasilkan nol baris, bukan `403`. Frontend perlu memahami bahwa outlet tak sah menghasilkan **laporan kosong**, bukan error.

---

## 4. Autentikasi & Otorisasi

### 4.1 Teknologi token: PASETO v4 `local` — bukan JWT

[pkg/token/paseto.go](../posgodinov-be/pkg/token/paseto.go)

- Menggunakan **PASETO v4 local** = terenkripsi simetris (XChaCha20-Poly1305), bukan sekadar ditandatangani seperti JWT `HS256`. **Isi token tidak dapat dibaca oleh frontend.**
- Kunci: `PASETO_SYMMETRIC_KEY`, wajib 32 byte. Jika panjangnya berbeda, kunci akan otomatis dipotong atau di-*pad* dengan byte nol.
- Payload token sangat ramping:
  ```go
  type Payload struct {
      ID    string `json:"id"`
      Email string `json:"email"`
      Type  string `json:"type"`
  }
  ```
  Ditambah `RegisteredClaims` (`Expiration`, `IssuedAt`).

> ⚠️ **Implikasi bagi Frontend:** karena token terenkripsi, frontend **tidak bisa** melakukan `jwt-decode` untuk membaca masa berlaku atau identitas. Semua metadata yang dibutuhkan UI harus diambil dari **body response login**, bukan dari token.

### 4.2 Tiga jenis token

| `Type` | Diterbitkan oleh | Masa berlaku | `Payload.ID` | `Payload.Email` | Digunakan untuk |
|---|---|---|---|---|---|
| `access` | `POST /v1/auth/business/{register,login,refresh}` | **24 jam** | Business ID | Email business | Seluruh endpoint Dashboard Admin |
| `refresh` | `POST /v1/auth/business/{register,login}` | **7 hari** | Business ID | Email business | Hanya untuk `POST /v1/auth/business/refresh` |
| `device` | `POST /v1/auth/device/bind` | **87.600 jam ≈ 10 tahun** | **Outlet ID** | **Business ID** | Seluruh endpoint `/v1/pos/*` |

> ⚠️ **Perhatikan pembalikan semantik pada `device` token:** field `Email` dipakai untuk menyimpan **Business ID**, dan `ID` menyimpan **Outlet ID**. Ini keputusan sadar yang didokumentasikan di [pos_auth_service.go:52](../posgodinov-be/internal/service/pos_auth_service.go#L52) (*"We store BusinessID in Email field for convenience in middleware"*) dan dibaca kembali di [pos_sync_handler.go:29-30](../posgodinov-be/internal/handler/pos_sync_handler.go#L29-L30).

### 4.3 Middleware autentikasi

[internal/middleware/auth.go](../posgodinov-be/internal/middleware/auth.go)

| Middleware | Memvalidasi | Melindungi |
|---|---|---|
| `AuthMiddleware` | Header `Authorization: Bearer <token>` + `payload.Type == "access"` | Seluruh rute `/v1/business/*` |
| `POSDeviceMiddleware` | Header `Authorization: Bearer <token>` + `payload.Type == "device"` | Seluruh rute `/v1/pos/*` |

Keduanya menaruh `*token.Payload` ke `request.Context()` dengan kunci `middleware.AuthPayloadKey`. Pemeriksaan `Type` bersifat ketat — access token **ditolak** pada endpoint POS dan sebaliknya, sehingga tidak terjadi *token confusion*.

Rangkaian middleware per rute ([router.go:34-36](../posgodinov-be/internal/handler/router.go#L34-L36)):

```go
chain := func(handler http.HandlerFunc) http.HandlerFunc {
    return authMiddleware(auditMiddleware(handler))   // Auth dulu, agar Audit bisa membaca payload
}
```

### 4.4 Otorisasi

**Otorisasi tenant (aktif ✅)** — dijelaskan pada bagian 3: setiap operasi memverifikasi `outlet.BusinessID == payload.ID`.

**Role-Based Access Control (RBAC) — belum diimplementasikan ❌**

Perkakasnya sudah ada, tetapi tidak pernah digunakan untuk mengambil keputusan otorisasi:

- Kolom `users.role VARCHAR(20) NOT NULL DEFAULT 'CASHIER'` ada di skema.
- Tipe `domain.StaffRole` dengan konstanta `RoleCashier` dan `RoleAdmin` sudah didefinisikan ([staff.go:10-15](../posgodinov-be/internal/domain/staff.go#L10-L15)).
- **Namun:** tidak ada satu pun middleware atau percabangan yang memeriksa `role`. Seluruh staff dibuat *hard-coded* sebagai `RoleCashier` ([staff_service.go:56](../posgodinov-be/internal/service/staff_service.go#L56)); `RoleAdmin` tidak pernah diberikan kepada siapa pun.
- Kasir juga tidak pernah login ke backend sama sekali (lihat 4.5), sehingga tidak ada subjek yang bisa dikenai RBAC di sisi server.

`[NEEDS DISCUSSION]` — **RBAC harus dianggap belum ada di backend.** Saat ini hanya ada satu kelas identitas yang bisa memanggil API bisnis: pemilik Business. Bila Dashboard Admin membutuhkan peran "Manajer Cabang" atau "Supervisor" dengan hak akses terbatas, dibutuhkan pekerjaan backend baru: tabel akun per-outlet, jenis token baru, dan middleware pemeriksa peran.

### 4.5 Autentikasi kasir: 100% offline, tidak menyentuh backend

Ini adalah karakteristik paling khas dari sistem ini ([CLIENTS.md](../posgodinov-be/CLIENTS.md) Tahap 3):

1. Perangkat POS melakukan *binding* **satu kali** dengan `serial_business` + `serial_outlet` + password owner → memperoleh `device_token` berumur ~10 tahun.
2. Perangkat menarik master data, yang **menyertakan `pin_hash` bcrypt milik setiap staff** ([pos_master_data.go:8-13](../posgodinov-be/internal/domain/pos_master_data.go#L8-L13)).
3. Login harian kasir divalidasi **sepenuhnya di perangkat** dengan membandingkan PIN terhadap `pin_hash` lokal. **Tidak ada endpoint login kasir di backend.**

`[NEEDS DISCUSSION]` — Konsekuensi keamanan yang perlu diputuskan bersama:

- **Distribusi hash PIN.** Hash bcrypt seluruh kasir satu outlet dikirim ke perangkat. PIN hanya 4-6 digit numerik, sehingga ruang tebakan sangat kecil (maks. 1.1 juta kombinasi). Siapa pun yang berhasil mengekstrak database lokal perangkat dapat melakukan *brute force* offline. Mitigasi yang perlu dibahas: enkripsi penyimpanan di perangkat, atau *pepper* sisi server.
- **Device token tidak dapat dicabut.** Berumur ~10 tahun, tanpa daftar hitam (*blocklist*), tanpa tabel registrasi perangkat, dan tanpa endpoint *unbind*. Perangkat POS yang hilang atau dicuri akan tetap memiliki akses sinkronisasi permanen ke outlet tersebut. **Ini adalah temuan paling mendesak dalam audit ini.**
- **Tidak ada rotasi refresh token.** `POST /v1/auth/business/refresh` menerbitkan access token baru tetapi tidak pernah mengganti refresh token; refresh token yang bocor tetap sah selama 7 hari penuh.

### 4.6 Kontrol keamanan pendukung

| Kontrol | Implementasi | Cakupan |
|---|---|---|
| **Rate limiting** | `rate.NewLimiter(rate.Every(time.Minute/10), 10)` per IP, in-memory, pembersihan tiap 3 menit | **Hanya `POST /v1/auth/business/register`.** `login` dan `device/bind` **tidak** dibatasi — keduanya menerima password, sehingga terbuka terhadap *credential stuffing*. `[NEEDS DISCUSSION]` |
| **Security headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, HSTS `max-age=31536000`, CSP `default-src 'self'` | Global |
| **CORS** | `*` bila `APP_ENV != "production"`; daftar eksplisit dari `ALLOWED_ORIGINS` bila production. `AllowCredentials: true`. Header yang diizinkan: `Accept`, `Authorization`, `Content-Type`, `X-CSRF-Token` | Global |
| **Panic recovery** | Stack trace ditampilkan pada `local`/`development`, disembunyikan pada environment lain | Global |
| **Audit trail** | `AuditMiddleware` menulis `audit_logs` secara **asinkron** (goroutine + `context.Background()`) untuk setiap request terautentikasi | Seluruh rute ber-`chain()` |

`[NEEDS DISCUSSION]` — **Audit log menyimpan body request mentah** ([audit.go:74-80](../posgodinov-be/internal/middleware/audit.go#L74-L80)). Rute yang di-`chain()` saat ini memang tidak menerima password, sehingga belum ada kebocoran nyata. Namun tidak ada *sanitizer*, jadi endpoint baru berisi kredensial yang ditambahkan ke `chain()` akan langsung menuliskan kredensial tersebut dalam bentuk teks polos ke `audit_logs.details`. Perlu daftar-tolak (*denylist*) field sebelum modul berkembang.

Selain itu, `actor_type` selalu bernilai `"BUSINESS"`: kode memeriksa `payload.Type == "staff"`, padahal tipe token `"staff"` tidak pernah diterbitkan di mana pun.

---

## 5. Manajemen Transaksi Database

[internal/database/transaction.go](../posgodinov-be/internal/database/transaction.go)

Pola **Transaction Manager berbasis context** — transaksi GORM dititipkan di `context.Context`, lalu repository mengambilnya kembali melalui `database.GetDB(ctx, r.db)`:

```go
err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
    rm, _ := s.rmRepo.LockByID(txCtx, rawMaterialID)   // SELECT ... FOR UPDATE
    // ... mutasi stok + penulisan log, keduanya atomik
    return nil
})
```

Manfaatnya: repository tidak perlu tahu apakah dirinya sedang berjalan di dalam transaksi, dan `MockTransactionManager` memungkinkan unit test berjalan tanpa database sama sekali.

**Pencegahan race condition** memakai *pessimistic locking* (`SELECT ... FOR UPDATE`) melalui `LockByID` / `LockByIDs` pada `raw_materials` dan `LockByID` pada `businesses`. Diterapkan pada: pembuatan outlet (penomoran serial), waste, stock opname, restock, dan pemotongan stok saat sinkronisasi POS.

---

## 6. Peringatan Operasional

| Temuan | File | Dampak |
|---|---|---|
| **Migrasi berjalan otomatis saat startup** | [main.go:47-63](../posgodinov-be/cmd/api/main.go#L47-L63) | Beberapa replika yang menyala bersamaan akan berebut menjalankan `m.Up()`. Jika migrasi gagal, proses langsung `os.Exit(1)`. Belum aman untuk *rolling deployment*. |
| **`fix_migration.go` berada di root repositori** | [fix_migration.go](../posgodinov-be/fix_migration.go) | Ini adalah `package main` kedua yang **menghapus tabel POS** (`DROP TABLE ... transactions, shifts`) dan memaksa versi migrasi ke 15. Merupakan skrip perbaikan sekali pakai yang tertinggal di repo. **Sangat destruktif jika terlanjur dijalankan.** Sebaiknya dipindahkan ke `cmd/` atau dihapus. |
| **Kunci PASETO default ada di dalam kode** | [config.go:39](../posgodinov-be/internal/config/config.go#L39) | Nilai *fallback* `"12345678901234567890123456789012"` akan terpakai secara diam-diam bila `PASETO_SYMMETRIC_KEY` tidak diset — termasuk di production. Idealnya aplikasi menolak start bila kunci tidak diset saat `APP_ENV=production`. |
| **`utils.GenerateRandomString` memakai `math/rand`** | [pkg/utils/random.go](../posgodinov-be/pkg/utils/random.go) | Menghasilkan ID business (8 karakter) dan outlet (6 karakter) menggunakan RNG non-kriptografis yang di-*seed* dengan waktu. ID bersifat dapat ditebak, dan pada pembuatan yang berdekatan berpotensi bertabrakan. Tidak ada penanganan pelanggaran *unique constraint*. |
| **Tidak ada indeks selain PK/UNIQUE** | [db/migrations/](../posgodinov-be/db/migrations/) | Tidak satu pun `CREATE INDEX` di 16 file migrasi. Seluruh kolom foreign key (`outlet_id`, `business_id`, `raw_material_id`, `transaction_id`, …) tidak terindeks. Query laporan akan melakukan *sequential scan*. Detail dan usulan indeks ada di [02-database-schema.md](02-database-schema.md). |

---

## 7. Ringkasan

| Aspek | Kondisi saat ini |
|---|---|
| Arsitektur | Layered + Dependency Inversion, DI manual, terstruktur konsisten dan mudah diuji |
| Router | `net/http.ServeMux` standard library (Go 1.22+), tanpa framework |
| ORM | GORM di atas pgx |
| Token | PASETO v4 local (terenkripsi), 3 audiens: access / refresh / device |
| Multi-tenancy | Shared DB + shared schema; diskriminator `outlet_id` (+ `business_id` pada tabel POS); ditegakkan di service layer |
| Otorisasi | Isolasi tenant ✅ · RBAC ❌ (kolom `role` ada tetapi tidak dipakai) |
| Model POS | Offline-first; login kasir sepenuhnya lokal; sinkronisasi *idempotent* melalui UUID buatan klien |
| Cakupan test | 13 unit test + 13 feature test, memakai `MockTransactionManager` |
