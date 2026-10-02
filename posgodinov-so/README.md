# posgodinov-so: Aplikasi Mobile Stock Opname Fisik (Handheld)

Aplikasi mobile berbasis **Flutter** yang dirancang khusus untuk operasional **Stock Opname (SO) fisik bahan baku** secara kolaboratif (*multi-staff*), cepat, dan ergonomis menggunakan smartphone genggam (*handheld*) di area gudang, rak penyimpanan, bar, maupun dapur (*chiller/freezer*).

---

## 📱 Mengapa Terpisah dari `posgodinov-mobile`?

| Parameter | **`posgodinov-mobile` (Aplikasi POS Kasir)** | **`posgodinov-so` (Aplikasi Stock Opname)** |
| :--- | :--- | :--- |
| **Form Factor** | Tablet Android 10" (*Landscape*) | Smartphone 5.5"–6.7" (*Portrait / Handheld*) |
| **Lokasi Operasi** | Meja Kasir / Counter Transaksi | Lorong Gudang, Rak Bahan Baku, Kitchen, Chiller |
| **Perangkat Pendukung** | Cash Drawer, EDC, Printer Thermal ESC/POS | Kamera Smartphone (Barcode 1D & QR), Haptic Engine |
| **Karakter Pengguna** | Kasir fokus pada kecepatan transaksi penjualan | Staf gudang, barista, dan cook menghitung persediaan fisik |
| **Kondisi Jaringan** | Wi-Fi counter relatif stabil | Sering berada di area *blank spot* / sinyal lemah |
| **Scope Token Perangkat** | `godinov-device-pos` | `godinov-device-so` (Scope: `OPNAME`) |

---

## ⚡ Fitur Utama & Prinsip Kerja

### 1. Blind Counting (Keamanan Audit & Anti-Fraud)
- Staf lapangan **tidak dapat melihat stok sistem komputer (`system_stock`)**. Data dari server murni hanya mengirim daftar bahan baku dan spesifikasi kemasan, tanpa saldo sistem.
- Hal ini mencegah kelalaian staf (mengetik sesuai komputer tanpa menghitung fisik) dan mencegah manipulasi angka untuk menutupi selisih/kehilangan barang.
- Kalkulasi selisih (`difference`), nilai rupiah selisih (`difference_value`), dan status kecurangan (`fraud_flag`) dihitung secara otomatis dan aman di backend saat form ditutup oleh Admin.

### 2. Multi-Staff Collaborative Counting (SUM Aggregation)
- Beberapa staf dapat menghitung bersamaan pada satu form opname yang aktif di outlet yang sama:
  - **Staf Bar** menghitung stok sirup dan biji kopi di bar area.
  - **Staf Dapur** menghitung daging dan saus di freezer.
  - **Staf Gudang** menghitung persediaan cadangan di gudang belakang.
- Backend mencatat hitungan setiap staf secara atomik di `opname_count_entries` berdasarkan `(session_id, raw_material_id, counted_by)`.
- Saat sesi ditutup oleh Admin, server melakukan **SUM agregasi** seluruh lembar hitungan staf menjadi satu total fisik yang utuh.

### 3. Dual-Stock Stepper Counter (Kemasan Utuh & Eceran)
- Mendukung bahan baku dengan dua satuan (contoh: Dus isi 24 Botol):
  - **Kemasan Utuh / Dus** (`actual_packages`): bilangan bulat.
  - **Eceran Terbuka / Satuan Dasar** (`actual_loose`): bilangan desimal.
- Modal hitung menyediakan tombol stepper `+` / `-`, input langsung via angka/keyboard, serta live preview kalkulasi rumus total konversi.
- Otomatis sinkronisasi ke server di latar belakang saat tombol simpan ditekan.

### 4. Pemindai Barcode 1D (Garis Lurus) & 2D QR Code
- Terintegrasi kamera berkecepatan tinggi dengan `BarcodeFormat.all` (Code 128, Code 39, EAN-13, EAN-8, UPC, ITF, Codabar, dan QR Code).
- Jendela bidik ergonomis berbentuk persegi panjang mendatar (300×170 px) dilengkapi garis panduan laser merah untuk memudahkan pemindaian barcode garis lurus pada rak maupun kemasan kardus.
- Begitu barcode/SKU terdeteksi, modal hitung langsung terbuka otomatis (*auto-popup*).

### 5. Keamanan Perangkat & Otentikasi Staf
- **Device Binding**: Penautan perangkat ke outlet via serial bisnis, serial outlet, dan password akun bisnis. Mendapatkan token perangkat berjangka panjang.
- **Offline PIN Verification**: Staf login menggunakan `staff_identifier` dan 6-digit PIN yang diverifikasi secara lokal menggunakan **bcrypt isolate** (`compute()`) terhadap cache data staf outlet yang telah disinkronkan.
- Header `X-Staff-Id` otomatis disematkan pada setiap request mutasi hitungan.

### 6. Clean Error Handling (Zero Technical Leaks)
- Komponen `ErrorFormatter` menerjemahkan seluruh potensi kesalahan jaringan (timeout, koneksi terputus, 401, 403, 404, 500) ke dalam pesan ramah berbahasa Indonesia tanpa membocorkan trace `DioException`, `SocketException`, atau skema database ke layar pengguna.

---

## 🏗️ Struktur Proyek

```text
posgodinov-so/
├── lib/
│   ├── main.dart                          # Entrypoint aplikasi Flutter
│   ├── core/
│   │   ├── config/
│   │   │   └── app_config.dart            # Hardcoded static Base URL (http://localhost:8080)
│   │   ├── crypto/
│   │   │   └── pin_verifier.dart          # Pure Dart BCrypt verification via compute isolate
│   │   ├── database/
│   │   │   └── database.dart              # SQLite local persistence
│   │   ├── di/
│   │   │   └── injection.dart             # Dependency Injection (GetIt)
│   │   ├── error/
│   │   │   └── error_formatter.dart       # User-friendly error message formatter
│   │   ├── network/
│   │   │   └── api_client.dart            # Dio HTTP Client dengan auto auth & X-Staff-Id interceptor
│   │   ├── storage/
│   │   │   └── token_storage.dart         # Flutter Secure Storage / SharedPreferences wrapper
│   │   └── theme/
│   │       └── app_theme.dart             # Palet warna, tipografi, dan gaya tombol
│   └── features/
│       ├── device_binding/
│       │   └── device_binding_screen.dart # Layar penautan perangkat pertama kali
│       ├── staff_auth/
│       │   └── staff_select_screen.dart   # Layar login staf via ID & 6-digit PIN
│       ├── opname_session/
│       │   └── session_list_screen.dart   # Layar daftar sesi SO aktif (PUBLISHED / COUNTING)
│       ├── counting/
│       │   ├── counting_master_screen.dart # Master list bahan baku, search, filter, status
│       │   └── widgets/
│       │       ├── barcode_scanner_modal.dart # Pemindai Barcode 1D & QR Code
│       │       └── stepper_count_modal.dart   # Popup stepper dual-stock (Dus + Ecer)
│       └── my_summary/
│           └── my_summary_screen.dart     # Ringkasan riwayat hitungan staf yang sedang login
└── test/
    ├── calculation_test.dart              # Unit test logika kalkulasi dual-stock & konversi
    └── widget_test.dart                   # Smoke test rendering UI
```

---

## 🔌 Integrasi Endpoint Backend

Aplikasi berkomunikasi dengan `posgodinov-be` melalui kontrak endpoint berikut:

| Method | Endpoint | Auth Header | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/device/bind` | — | Penautan perangkat outlet (menghasilkan token perangkat) |
| `GET` | `/v1/so/sync/staff-data` | `Bearer <device_token>` | Sinkronisasi daftar staf & pin hash outlet |
| `GET` | `/v1/so/available` | `Bearer <device_token>` | Mengambil daftar sesi SO yang berstatus `PUBLISHED` atau `COUNTING` |
| `GET` | `/v1/so/{form_id}` | `Bearer <device_token>` | Mengambil rincian form SO (daftar bahan baku, satuan, SKU) tanpa stok sistem |
| `PUT` | `/v1/so/{form_id}/counts` | `Bearer <device_token>`<br>`X-Staff-Id: <staff_id>` | Menyimpan/memperbarui lembar hitungan fisik staf (`actual_packages` & `actual_loose`) |
| `GET` | `/v1/so/{form_id}/my-counts` | `Bearer <device_token>`<br>`X-Staff-Id: <staff_id>` | Mengambil lembar hitungan staf yang sedang login |

---

## 🚀 Panduan Menjalankan & Pengembangan

### Prasyarat
- **Flutter SDK**: 3.47+ (Dart 3.13+)
- **Android SDK**: Platform 34+, Android Studio JBR
- Perangkat fisik Android (dengan USB Debugging aktif) atau Android Emulator

### 1. Persiapan Port Forwarding (Perangkat Fisik)
Jika menguji menggunakan perangkat fisik yang tersambung via kabel data USB, arahkan port host backend ke perangkat via `adb`:

```bash
adb reverse tcp:8080 tcp:8080
```

Dengan `adb reverse`, aplikasi di smartphone dapat langsung memanggil `http://localhost:8080` yang mengarah ke mesin laptop/PC Anda.

### 2. Menjalankan Aplikasi

```bash
cd posgodinov-so
flutter pub get
flutter devices               # Catat ID perangkat Anda
flutter run -d <device-id>
```

> **Hot Reload / Hot Restart:**
> - Tekan tombol **`r`** di terminal untuk *Hot Reload*.
> - Tekan tombol **`R`** di terminal untuk *Hot Restart*.

### 3. Analisis Kode & Pengujian

```bash
# Menjalankan linter & static analyzer
flutter analyze

# Menjalankan seluruh test suite
flutter test
```

### 4. Build APK Release

```bash
flutter build apk --release
```
Berkas APK akan tersedia di `build/app/outputs/flutter-apk/app-release.apk`.

---

## 🔒 Alur Pengujian Lapangan

1. **Buka Aplikasi**: Pada layar pertama, masukkan kredensial outlet:
   - Serial Bisnis (contoh: `POSGO180726`)
   - Serial Outlet (contoh: `POSGO180726001`)
   - Password Akun Bisnis (`password123`)
2. **Pilih / Login Staf**:
   - Masukkan ID Staf (contoh: ID kasir/staf hasil seeder).
   - Masukkan PIN 6 digit (default seeder: `123456`).
3. **Pilih Sesi Opname**:
   - Pastikan Admin telah membuat dan menekan tombol *Publish* pada form SO di Web Dashboard (`posgodinov-fe`).
   - Sesi akan muncul di daftar. Klik sesi untuk membuka layar hitung.
4. **Hitung Fisik**:
   - Cari bahan baku berdasarkan Nama / SKU, atau klik ikon Barcode untuk memindai barcode fisik pada kemasan.
   - Masukkan jumlah kemasan utuh (Dus) dan sisa eceran (Loose).
   - Tekan **Simpan Hitungan**. Hitungan tersimpan secara instan di server.
