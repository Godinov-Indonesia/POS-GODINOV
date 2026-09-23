# POS-GODINOV: Offline-First Multi-Tenant SaaS POS & ERP System

Sistem Point of Sale (POS) dan Enterprise Resource Planning (ERP) multi-tenant yang tangguh, dirancang dengan pendekatan **Offline-First** untuk menjamin operasional kasir tetap berjalan lancar tanpa jaringan internet.

---

## 🏗️ Struktur Repositori

Proyek ini terbagi menjadi beberapa komponen utama:

1. **`posgodinov-be/` (Backend Go)**:
   - REST API Server menggunakan **Go 1.26.1** dan **PostgreSQL 17**.
   - Menerapkan *Clean Architecture* (Layered Architecture dengan Dependency Inversion) tanpa framework HTTP eksternal (menggunakan `net/http.ServeMux` bawaan Go 1.22+).
   - Keamanan tingkat tinggi menggunakan **PASETO v4 local** (bukan JWT biasa) untuk token terenkripsi.
   - Multi-tenancy dengan strategi *Shared Database & Shared Schema* menggunakan kolom diskriminator `business_id` dan `outlet_id`.

2. **`posgodinov-fe/` (Frontend & Web POS PWA)**:
   - Dibangun menggunakan **Next.js (React)** dan TailwindCSS.
   - Menyediakan dua area kerja utama: **Admin Dashboard** (untuk kelola bisnis & outlet online) dan **Web POS PWA** (aplikasi kasir offline-first).
   - Database lokal menggunakan **Dexie IndexedDB** untuk penyimpanan master data (produk, kategori, kasir) dan data transaksi lokal secara offline.
   - Logika sinkronisasi dua arah yang tangguh (*sync engine*) dengan penanganan *partial success reconciliation* dan retensi UUID v4 client untuk menjamin idempotensi.

3. **`posgodinov-mobile/` (Aplikasi Kasir Flutter)**:
   - Aplikasi kasir **offline-first** untuk Tablet Android 10" (*landscape*) dan Handheld POS (Sunmi / iMin), termasuk mode Kiosk pesan mandiri.
   - Basis data lokal **Drift/SQLite**, sinkronisasi latar lewat **WorkManager**, cetak struk **ESC/POS** (Bluetooth SPP, BLE, USB, TCP).

4. **`posgodinov-landingpage/` (Landing Page)**:
   - Halaman pemasaran dan perkenalan produk POS Godinov.

5. **`docs/` (Dokumentasi Teknis)**:
   - [01 — Architecture Overview](docs/01-architecture-overview.md)
   - [02 — Database Schema](docs/02-database-schema.md)
   - [03 — API Specifications](docs/03-api-specifications.md)
   - [04 — Frontend Mobile Web Requirements](docs/04-frontend-mobile-web-requirements.md)
   - [05 — Frontend Architecture Design](docs/05-frontend-architecture-design.md)
   - [06 — UI/UX Design System](docs/06-ui-ux-design-system.md)
   - [07 — Implementation Plan](docs/07-implementation-plan.md)
   - [08 — UAT Test Scenarios](docs/08-uat-test-scenarios.md) (Dokumen skenario pengujian komprehensif)
   - [09 — Flutter Mobile Architecture](docs/09-flutter-mobile-architecture.md)
   - [10 — Flutter Implementation Plan](docs/10-flutter-implementation-plan.md)

---

## ⚡ Fitur Utama POS

- **Device Binding (P-01)**: Penautan perangkat POS ritel ke outlet secara aman menggunakan token perangkat dengan masa berlaku 10 tahun.
- **Login Kasir Offline (P-03)**: Autentikasi kasir dilakukan 100% secara lokal pada perangkat menggunakan pencocokan hash PIN (bcrypt) tanpa bergantung pada koneksi backend.
- **Manajemen Shift (P-04)**: Pembukaan dan penutupan shift kasir secara mandiri dengan pencatatan modal awal, modal akhir, expected balance, dan discrepancy (selisih uang laci).
- **Keranjang & Stepper Touch-Optimized (P-05)**: Pembagian grid produk dengan ukuran Touch Target stepper kuantitas minimal **48px × 48px** (`h-12 w-12`) untuk kenyamanan tablet dan layar sentuh.
- **Custom Hold Order Dialog**: Menyimpan keranjang berjalan secara lokal menggunakan modal kustom yang menyediakan *preset chips* pelabelan (mis. Meja 1, Takeaway) dan mendukung auto-focus.
- **Sinkronisasi Otomatis & Rekonsiliasi Transaksi**: Pengunggahan transaksi secara berkala dengan logika rekonsiliasi yang cerdas; status sinkronisasi diperbarui parsial berdasarkan respon sukses/gagal per ID transaksi dari server.

---

## 🚀 Menjalankan di Lokal

Panduan ini terverifikasi berjalan di Windows 10/11 + Docker Desktop (WSL 2).
Urutannya mengikat: backend harus hidup sebelum seeder, dan seeder sebelum
frontend maupun mobile — tanpa data seed, layar login tidak bisa dilewati.

### Prasyarat

| Perangkat | Versi teruji | Catatan |
| --------- | ------------ | ------- |
| Go | 1.27.0 | untuk seeder dan mode Opsi B |
| Node.js | 24.19.0 (npm 11.17) | minimal 18+ |
| Flutter | 3.47.1 stable (Dart 3.13.1) | untuk `posgodinov-mobile` |
| Docker Desktop | 29.7.2 (Compose v5.4.0) | backend + PostgreSQL 17 |
| Android SDK | platform-tools (`adb`) + emulator | AVD tablet 10" landscape |

> **Windows — dua jebakan pemasangan Docker.**
>
> 1. Docker Desktop membutuhkan **kernel WSL 2**. Bila `wsl --status` menjawab
>    *"The WSL 2 kernel file is not found"*, jalankan `wsl --update` **dari
>    PowerShell Administrator**. Tanpa elevasi, perintah itu gagal dengan
>    `Catastrophic failure`, dan Docker Desktop akan diam sekitar 10 menit lalu
>    menutup diri dengan `Failed to connect to Docker Desktop backend`.
> 2. Seusai pemasangan, `docker` hanya masuk PATH pada proses yang baru dibuat.
>    Tutup VSCode **sepenuhnya** — membuka tab terminal baru saja tidak cukup,
>    karena VSCode menyambung ulang ke pty lama yang PATH-nya masih basi.

---

### 1. Backend + PostgreSQL

```bash
cd posgodinov-be
cp .env.example .env          # nilai bawaan sudah siap pakai
docker compose up -d --build
```

PostgreSQL 17 naik sebagai container `posgodinov_db`, backend Go sebagai
`posgodinov_backend`, lalu **migrasi berjalan otomatis saat startup**
(`golang-migrate` — 24 migrasi, 24 tabel).

Verifikasi, harus menjawab `OK`:

```bash
curl http://localhost:8080/health
```

Bila status container `Restarting` terus-menerus, baca lognya lebih dulu:

```bash
docker logs posgodinov_backend --tail 30
```

<details>
<summary><b>Opsi B — mengembangkan backend di lokal, database saja dari Docker</b></summary>

```bash
docker compose up -d db
go run cmd/api/main.go
```

`.env` bawaan berisi `DB_PORT=5432`. Container memetakan PostgreSQL ke port host
**5433**, jadi untuk mode ini ubah menjadi `DB_PORT=5433` — kalau tidak, Go akan
mencoba menyambung ke PostgreSQL lokal yang tidak ada.
</details>

---

### 2. Mengisi data awal (seeder)

Database yang baru dibuat hanya berisi skema. Tanpa langkah ini, pemasangan
perangkat dan login kasir pasti gagal.

```bash
cd posgodinov-be
DB_HOST=localhost DB_PORT=5433 DB_USER=posgodinov DB_PASSWORD=secret \
DB_NAME=posgodinov DB_SSLMODE=disable APP_PORT=8080 \
PASETO_SYMMETRIC_KEY=12345678901234567890123456789012 \
go run ./cmd/seeder
```

Perhatikan `DB_PORT=5433` — seeder berjalan di host, jadi memakai port host,
bukan `5432` milik jaringan internal Docker.

Hasilnya 1 business, 1 outlet, dan 3 akun kasir. Kredensialnya ada di
[Kredensial Pengujian](#-kredensial-pengujian) di bawah.

Seeder **tidak idempoten** — menjalankannya dua kali membuat business kedua
dengan serial yang sama. Untuk mengulang dari nol:

```bash
docker compose down -v      # -v ikut menghapus volume beserta seluruh datanya
docker compose up -d --build
```

---

### 3. Frontend (Admin Dashboard + Web POS PWA)

```bash
cd posgodinov-fe
npm install
cp .env.example .env          # NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
npm run dev
```

Buka `http://localhost:3000` — otomatis diarahkan ke `/admin`.

Nilai `NEXT_PUBLIC_API_BASE_URL` harus cocok dengan `ALLOWED_ORIGINS` pada `.env`
backend (bawaannya `http://localhost:3000`); bila tidak, setiap permintaan
ditolak CORS.

---

### 4. Mobile (Flutter — Tablet Android)

```bash
cd posgodinov-mobile
flutter pub get
flutter devices               # pastikan emulator atau tablet terbaca
flutter run -d <device-id>
```

Aplikasi memakai `http://10.0.2.2:8080` sebagai bawaan — alias emulator Android
untuk `localhost` mesin host, sudah cocok dengan pemetaan port Docker. Untuk
perangkat fisik, arahkan ke IP LAN mesin kamu:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8080
```

`API_BASE_URL` dibaca lewat `String.fromEnvironment`, artinya **compile-time** —
hot reload tidak akan mengubahnya, harus `flutter run` ulang.

Alur pertama kali: layar **Pemasangan Perangkat** (serial bisnis + serial outlet
+ password pemilik) → aplikasi menarik master data → layar **MASUK SEBAGAI
KASIR**.

> **Jalankan `flutter run` dari terminal interaktif.** Bila dijalankan dari shell
> tanpa TTY (skrip, CI, *background job*), stdin langsung EOF dan `flutter run`
> membacanya sebagai perintah `q` — aplikasi ikut mati begitu selesai terpasang.
> Untuk sekadar membuka aplikasi yang sudah ter-install:
>
> ```bash
> adb shell monkey -p id.godinov.pos -c android.intent.category.LAUNCHER 1
> ```

---

### 🗄️ Akses Database (DBeaver / psql)

| Field | Nilai |
| ----- | ----- |
| Host | `localhost` |
| **Port** | **`5433`** |
| Database | `posgodinov` |
| Username | `posgodinov` |
| Password | `secret` |
| SSL | disable / non-SSL |

⚠️ **Port host-nya `5433`, bukan `5432`.** `docker-compose.yml` sengaja
memetakan `5433:5432` agar tidak bentrok dengan PostgreSQL yang mungkin sudah
terpasang di mesin. `5432` hanya berlaku *di dalam* jaringan Docker — itulah
nilai yang dipakai container backend (`DB_HOST=db`).

Lewat terminal, tanpa perlu client apa pun:

```bash
docker exec -it posgodinov_db psql -U posgodinov -d posgodinov
```

---

### 🔑 Kredensial Pengujian

Nilai berikut dihasilkan `cmd/seeder` dan **inilah yang berlaku** untuk
pemasangan lokal.

| Keperluan | Nilai |
| --------- | ----- |
| Serial Bisnis | `POSGO180726` |
| Serial Outlet | `POSGO180726001` |
| Owner (email) | `owner@posgodinov.com` |
| Owner (password) | `password123` |
| PIN seluruh kasir | `123456` |

Username kasir **diacak setiap kali seeder dijalankan** (`gofakeit`), jadi jangan
disalin dari dokumen mana pun. Ambil daftar aktualnya dari database:

```bash
docker exec posgodinov_db psql -U posgodinov -d posgodinov \
  -c "select staff_identifier, name, role from users;"
```

Tulisan `kasir01` pada kolom login mobile hanyalah *placeholder*, bukan akun yang
benar-benar ada.

---

### ⚠️ Yang perlu diketahui sebelum menguji

**Migrasi `000025` diparkir dengan sengaja.** Pasangan berkasnya berada di
`posgodinov-be/db/migrations_pending/`, di luar jangkauan `migrate up`. Berkas
itu menghapus kolom warisan v1 secara permanen dan belum boleh dijalankan —
alasan lengkap beserta gerbang persyaratannya ada pada
`db/migrations_pending/README.md`. **Jangan memindahkannya kembali** ke
`db/migrations/` sebelum seluruh gerbang terpenuhi.

**Bila sebuah migrasi gagal, database ditandai *dirty*** dan backend menolak
menyala dengan `Dirty database version N. Fix and force version.` Perbaiki
setelah penyebabnya beres:

```bash
docker exec posgodinov_db psql -U posgodinov -d posgodinov \
  -c "UPDATE schema_migrations SET version=24, dirty=false;"
docker restart posgodinov_backend
```

**Jangan menyalakan dua emulator Android sekaligus.** Emulator memakai netsim
WiFi yang dipakai bersama antar instance; menjalankan dua AVD membuat salah
satunya boot tanpa antarmuka jaringan sama sekali — hanya `lo`, tanpa `wlan0` —
sehingga aplikasi tidak dapat menjangkau backend dan gagal senyap sebagai
"Tidak dapat terhubung ke server". Cara memeriksanya:

```bash
adb -s emulator-5554 shell ip -4 addr show     # wajib ada wlan0
adb -s emulator-5554 shell ping -c 2 10.0.2.2  # wajib 0% packet loss
```

Bila jaringannya mati: matikan seluruh emulator, pastikan tidak ada proses
`emulator.exe` yang tersisa, lalu boot satu AVD saja dengan `-no-snapshot-load`.

**Bug diketahui — aplikasi mobile mati saat sinkronisasi latar berjalan.**
`registerPeriodicTask` dijadwalkan setiap 15 menit
(`lib/core/sync/background_sync_worker.dart`). Sinkronisasinya sendiri berhasil,
tetapi ketika WorkManager merobohkan *headless engine*-nya, plugin
`flutter_pos_printer_platform_image_3` melempar
`UninitializedPropertyAccessException: lateinit property bluetoothService has not
been initialized` pada `onDetachedFromEngine`. Exception itu tidak tertangkap dan
mematikan seluruh proses aplikasi.

Ini terjadi di perangkat asli, bukan hanya emulator. Selama belum diperbaiki,
aplikasi akan tertutup sendiri secara berkala saat pengujian — buka kembali
dengan perintah `adb shell monkey` di atas. Akar masalahnya:
`GeneratedPluginRegistrant` mendaftarkan **seluruh** plugin ke isolate latar,
termasuk plugin printer yang `bluetoothService`-nya hanya diinisialisasi melalui
Activity.

---

### 🛑 Mematikan

```bash
# backend + database (volume beserta datanya tetap aman)
cd posgodinov-be && docker compose down

# frontend: Ctrl+C pada terminal `npm run dev`

# emulator
adb -s emulator-5554 emu kill
```

Tambahkan `-v` pada `docker compose down` hanya bila memang ingin **menghapus
seluruh isi database** dan menyeed ulang dari awal.

---

## 📝 Skenario Pengujian (UAT)

Panduan pengujian terstruktur untuk fitur bisnis (Admin Dashboard) maupun
operasional kasir (Web POS PWA):

- [docs/08-uat-test-scenarios.md](docs/08-uat-test-scenarios.md) — Web & Admin
- [docs/10-flutter-implementation-plan.md](docs/10-flutter-implementation-plan.md) — Mobile

Gunakan nilai pada [Kredensial Pengujian](#-kredensial-pengujian), bukan contoh
yang mungkin tertulis di dalam dokumen-dokumen tersebut.
