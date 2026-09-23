# 09 — Flutter Mobile Architecture (`posgodinov-mobile`)

> **Lingkup:** aplikasi kasir native **Android** — Tablet 10" *landscape* (POS penuh) dan
> Handheld POS Sunmi/iMin (kasir bergerak + Kiosk pesan mandiri).
> Ini adalah **F11** pada [05 §4](05-frontend-architecture-design.md) — dokumen 07 sengaja
> mengecualikannya.
>
> **Sumber kebenaran kontrak:**
> [01 Architecture Overview](01-architecture-overview.md) ·
> [02 Database Schema](02-database-schema.md) ·
> [03 API Specifications](03-api-specifications.md) ·
> [05 Frontend Architecture Design](05-frontend-architecture-design.md) ·
> [06 UI/UX Design System](06-ui-ux-design-system.md)
>
> Dokumen ini **memperluas** [05 §2](05-frontend-architecture-design.md) menjadi rancangan
> yang dapat langsung dieksekusi. Di mana pun terjadi perbedaan dengan 05 §2, perbedaan itu
> ditulis eksplisit beserta alasannya di [§1.4](#14-penyimpangan-sadar-dari-05-22) — tidak ada
> keputusan yang diganti diam-diam.

---

## Daftar Isi

- [0. Konteks yang membentuk seluruh rancangan](#0-konteks-yang-membentuk-seluruh-rancangan)
- [1. Technology Stack & Packages](#1-technology-stack--packages)
- [2. Project Directory Structure](#2-project-directory-structure)
- [3. Tablet & Kiosk UI Layout Rules](#3-tablet--kiosk-ui-layout-rules)
- [4. Hardware Integrations & Kiosk Mode](#4-hardware-integrations--kiosk-mode)
- [5. Offline Engine — Drift, Secure Storage, PIN](#5-offline-engine--drift-secure-storage-pin)
- [6. Sync Engine & Rekonsiliasi Partial Success](#6-sync-engine--rekonsiliasi-partial-success)
- [7. State Management — Peta Cubit](#7-state-management--peta-cubit)
- [8. Peta Layar & Navigasi](#8-peta-layar--navigasi)
- [9. Checklist Penyelarasan Backend ↔ Flutter](#9-checklist-penyelarasan-backend--flutter)
- [10. Urutan Implementasi & Matriks Uji](#10-urutan-implementasi--matriks-uji)
- [11. Butir Terbuka](#11-butir-terbuka)

---

## 0. Konteks yang membentuk seluruh rancangan

### 0.1 Delapan batasan backend yang tidak dapat dinegosiasikan

Seluruh keputusan di dokumen ini adalah konsekuensi dari daftar berikut. Membaca kode Flutter
tanpa mengetahui delapan hal ini akan membuat banyak keputusan terlihat aneh.

| # | Batasan | Sumber | Konsekuensi di Flutter |
|---|---|---|---|
| 1 | **Tidak ada endpoint login kasir.** PIN diverifikasi 100% di perangkat terhadap `pin_hash` bcrypt yang ikut terunduh | [01 §4.5](01-architecture-overview.md), [03 §2.2](03-api-specifications.md) | `PinVerifier` di isolate ([§5.3](#53-pin-verifier--bcrypt-di-background-isolate)); DB **wajib** terenkripsi |
| 2 | **`device_token` berumur ~10 tahun, tidak dapat dicabut, tidak ada endpoint *unbind*** | [03 §2.1](03-api-specifications.md) | Simpan **hanya** di Keystore; UI menyatakan risiko ini apa adanya di layar Pengaturan |
| 3 | **Master data tidak memuat stok maupun BOM** — komentar kode menyebutnya "SENGAJA DIHAPUS" | [03 §2.2](03-api-specifications.md) | **Dilarang** menampilkan indikator stok/"habis" di layar kasir maupun Kiosk |
| 4 | **Setiap array koleksi bisa `null`, bukan `[]`** | [03 §2.2](03-api-specifications.md) | Normalisasi terpusat di satu titik: `Envelope.list()` ([§9](#9-checklist-penyelarasan-backend--flutter)) |
| 5 | **`POST /v1/pos/sync` mengembalikan `200` walau sebagian gagal**; hanya transaksi yang dilacak per-ID | [03 §2.3](03-api-specifications.md) | Rekonsiliasi ([§6.3](#63-rekonsiliasi--satu-satunya-tempat-data-penjualan-bisa-hilang)) adalah kode paling kritis di aplikasi |
| 6 | **UUID dibuat klien** — dasar idempotensi | [03 §2.3](03-api-specifications.md) | `uuid` v4 dibuat sekali saat entitas lahir, **tidak pernah** diregenerasi |
| 7 | **`payment_method` adalah `VARCHAR(50)` bebas tanpa enum DB** | [02 §2.12](02-database-schema.md) | Enum Dart dikunci huruf demi huruf + uji kontrak lintas platform ([§9.3](#93-kontrak-beku-payment_methods)) |
| 8 | **Hampir semua kegagalan dikembalikan sebagai `400`** — `403`/`404` tidak pernah muncul | [03 §0](03-api-specifications.md) | Jangan bercabang pada kode status; tampilkan `message` apa adanya (sudah Bahasa Indonesia) |

### 0.2 Target perangkat

| Kelas | Contoh perangkat | Resolusi acuan | Orientasi | Peran |
|---|---|---|---|---|
| **Tablet 10"** | Lenovo Tab M10, Samsung Tab A9+ | 1280 × 800 (mdpi ~800 dp lebar) | **Landscape dikunci** | **P0** — kasir utama, target rancangan utama |
| **Handheld POS** | Sunmi V2 Pro / V3 Mix, iMin M2 Pro | 720 × 1280 (≈360 dp lebar) | **Portrait dikunci** | P1 — kasir bergerak, printer internal 58 mm |
| **Tablet 8"** | Galaxy Tab A7 Lite | 1024 × 768 | Landscape | P2 — tata letak sama, grid menyempit |
| **Kiosk** | Tablet 10" pada *stand* + Lock Task Mode | 1280 × 800 / portrait 800 × 1280 | Keduanya | P1 — pesan mandiri pelanggan |

`minSdkVersion 24` (Android 7.0) · `targetSdkVersion 35` · `compileSdk 35`.
Batas bawah 24 ditentukan oleh `flutter_secure_storage` (EncryptedSharedPreferences) dan
oleh mayoritas perangkat handheld POS yang beredar (Android 7–11).

---

## 1. Technology Stack & Packages

### 1.1 Fondasi

| Lapis | Pilihan | Versi minimum | Alasan |
|---|---|---|---|
| **Framework** | Flutter (stable, channel `stable`) | `3.24+` | Target utama Android; iOS tidak dalam lingkup rilis pertama tetapi tidak diblokir oleh keputusan mana pun di sini |
| **Bahasa** | Dart | `3.5+` | *Sealed class*, *pattern matching*, dan `switch` ekspresif dipakai untuk state machine transaksi ([§7.3](#73-transactioncubit--satu-satunya-state-machine-sejati)) |
| **Arsitektur** | Clean / Layered (`core/` + `features/`) | — | Cerminan sadar gaya backend Go ([01 §1](01-architecture-overview.md)): kontrak di lapisan dalam, implementasi di lapisan luar |

### 1.2 Paket — `pubspec.yaml`

```yaml
name: posgodinov_mobile
description: POS Godinov — kasir offline-first untuk Tablet Android & Handheld POS.
publish_to: none
version: 1.0.0+1

environment:
  sdk: ">=3.5.0 <4.0.0"
  flutter: ">=3.24.0"

dependencies:
  flutter:
    sdk: flutter

  # ── State Management ───────────────────────────────────────────────────────
  flutter_bloc: ^8.1.6          # Cubit — ADR-09 [05 §0.3]
  bloc: ^8.1.4
  equatable: ^2.0.5             # kesetaraan state tanpa boilerplate

  # ── Basis data lokal (offline engine) ──────────────────────────────────────
  drift: ^2.20.0                # SQL bertipe aman, migrasi ter-versi, stream reaktif
  sqlite3_flutter_libs: ^0.5.24 # binari SQLite terbaru untuk semua ABI Android
  path_provider: ^2.1.4
  path: ^1.9.0

  # ── Penyimpanan rahasia ────────────────────────────────────────────────────
  flutter_secure_storage: ^9.2.2   # Android KeyStore via EncryptedSharedPreferences

  # ── Jaringan ───────────────────────────────────────────────────────────────
  dio: ^5.7.0                   # + interceptor device token / error / logging
  connectivity_plus: ^6.0.5     # pemicu sync saat koneksi kembali

  # ── Printer ────────────────────────────────────────────────────────────────
  flutter_pos_printer_platform_image_3: ^1.0.8  # transport: BT Classic (SPP), BLE, USB, TCP
  esc_pos_utils_2: ^2.0.4                       # encoder ESC/POS + CP437/CP858, barcode, QR
  image: ^4.2.0                                 # raster logo → ESC/POS bitmap

  # ── Kriptografi & identitas ────────────────────────────────────────────────
  bcrypt: ^1.1.3                # dibandingkan di isolate lewat compute()
  uuid: ^4.5.1                  # v4, dibuat KLIEN — dasar idempotensi [03 §2.3]

  # ── Latar & sistem ─────────────────────────────────────────────────────────
  workmanager: ^0.5.2           # Android WorkManager — sync saat aplikasi tertutup
  wakelock_plus: ^1.2.8         # layar tetap menyala saat shift terbuka / mode Kiosk
  package_info_plus: ^8.0.2
  device_info_plus: ^10.1.2     # deteksi Sunmi/iMin untuk memilih adapter printer
  permission_handler: ^11.3.1   # izin runtime BLUETOOTH_CONNECT / BLUETOOTH_SCAN — §4.6

  # ── Utilitas ───────────────────────────────────────────────────────────────
  get_it: ^8.0.0                # composition root — setara DI manual di main.go
  injectable: ^2.5.0
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0
  intl: ^0.19.0                 # NumberFormat id_ID, DateFormat
  synchronized: ^3.2.0          # mutex sync engine (pengganti Web Locks)
  collection: ^1.18.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  integration_test:
    sdk: flutter
  build_runner: ^2.4.13
  drift_dev: ^2.20.0
  freezed: ^2.5.7
  json_serializable: ^6.8.0
  injectable_generator: ^2.6.2
  bloc_test: ^9.1.7
  mocktail: ^1.0.4
  flutter_lints: ^4.0.0
  import_lint: ^2.1.0           # penegakan batas lapisan — §2.2

flutter:
  uses-material-design: true
  assets:
    - assets/images/
  fonts:
    # Font DIBUNDEL, bukan diunduh. Perangkat kasir sering tidak pernah online.
    - family: Inter
      fonts:
        - asset: assets/fonts/Inter-Regular.ttf
          weight: 400
        - asset: assets/fonts/Inter-Medium.ttf
          weight: 500
        - asset: assets/fonts/Inter-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/Inter-Bold.ttf
          weight: 700
    - family: JetBrainsMono
      fonts:
        - asset: assets/fonts/JetBrainsMono-Medium.ttf
          weight: 500
        - asset: assets/fonts/JetBrainsMono-Bold.ttf
          weight: 700
```

> ⚠️ **Jangan memakai `google_fonts` dengan pengambilan runtime.** Paket itu mengunduh font
> saat pemakaian pertama. Perangkat kasir yang di-*binding* lalu langsung dibawa ke outlet
> tanpa Wi-Fi akan menampilkan font fallback — dan `tabular-nums` yang menjadi syarat
> [06 §2.4](06-ui-ux-design-system.md) hilang. Font **dibundel sebagai aset**.

### 1.3 Peran tiap paket kunci

| Kebutuhan | Paket | Peran presisnya |
|---|---|---|
| **State management** | `flutter_bloc` (Cubit) | Tiga wilayah state **terpisah tegas**: `CartCubit` (ephemeral, berubah tiap ketukan), `TransactionCubit` (state machine persistensi), `SyncCubit` (latar, hidup lintas layar). Memcampur ketiganya adalah cara termudah membuat keranjang ikut ter-*reset* saat sync gagal |
| **DB relasional lokal** | `drift` + `sqlite3_flutter_libs` | SQLite ACID sungguhan: `transaction_items` menjadi tabel tersendiri dengan FK, bukan array bersarang seperti Dexie ([05 §1.5.1](05-frontend-architecture-design.md)). Indeks `(synced, client_created_at)` ditegakkan mesin basis data, bukan disiplin kode |
| **Secure storage** | `flutter_secure_storage` | `device_token` PASETO **hanya** di Android KeyStore (`encryptedSharedPreferences: true`). Tidak pernah di `SharedPreferences` polos, tidak pernah di tabel Drift |
| **HTTP client** | `dio` + `DeviceTokenInterceptor` | Menyisipkan `Authorization: Bearer <device_token>` untuk seluruh `/v1/pos/*`; mengubah amplop `{status,message,data}` menjadi `Either<Failure, T>`; mendeteksi `401` sebagai **penolakan perangkat** yang eksplisit, bukan sekadar error jaringan |
| **Bluetooth/USB printer** | `flutter_pos_printer_platform_image_3` + `esc_pos_utils_2` | Satu paket menutup empat transport (BT Classic SPP, BLE, USB OTG, TCP :9100). `esc_pos_utils_2` hanya membangkitkan **byte** — pemisahan renderer/transport ADR-07 ([05 §1.7.1](05-frontend-architecture-design.md)) tetap dipertahankan |
| **PIN verifier** | `bcrypt` di `compute()` | `BCrypt.checkpw` bersifat CPU-bound (100–300 ms pada perangkat handheld kelas bawah). Di isolate utama, UI membeku persis saat kasir menekan "Masuk" |
| **Sync latar** | `workmanager` | Menghapus batasan terbesar Web POS ([05 §1.6.6](05-frontend-architecture-design.md)): sinkronisasi berjalan walau aplikasi tertutup |

### 1.4 Penyimpangan sadar dari [05 §2.2]

| # | 05 §2.2 memilih | Dokumen ini memilih | Alasan |
|---|---|---|---|
| 1 | `flutter_blue_plus` (BLE) + `MethodChannel` SPP buatan sendiri | **`flutter_pos_printer_platform_image_3`** | Mayoritas printer termal murah di pasar Indonesia adalah **Bluetooth Classic (SPP)**, bukan BLE. Rancangan 05 sudah menyadarinya dan menjawabnya dengan plugin Kotlin buatan sendiri. Paket ini menyediakan SPP + BLE + **USB OTG** + TCP dalam satu antarmuka yang sudah teruji lapangan — mengurangi kode native yang harus dirawat dari ±200 baris Kotlin menjadi nol. Kontrak `ReceiptPrinter` ([§4.1](#41-kontrak-printer--satu-antarmuka-empat-transport)) tetap ada, jadi paket ini dapat diganti tanpa menyentuh layar mana pun |
| 2 | `esc_pos_utils_plus` | **`esc_pos_utils_2`** | Perawatan lebih aktif dan dukungan *code page* CP858 yang dibutuhkan simbol `Rp`. Keduanya API-kompatibel di tingkat `Generator` |
| 3 | `sqlcipher_flutter_libs` (wajib) | **`sqlite3_flutter_libs`** sebagai baseline, SQLCipher sebagai pengerasan berikutnya | Lihat peringatan di bawah — ini **bukan** penghapusan keputusan 05, melainkan penundaan yang harus diputuskan tim |
| 4 | `freezed` untuk seluruh model | `freezed` untuk **state & failure**, `drift` companion untuk baris DB | Menghindari dua sumber kebenaran untuk entitas yang sama. `drift` sudah membangkitkan kelas data yang *immutable* dan ber-`copyWith` |

> 🔴 **Peringatan enkripsi basis data — wajib dibaca.**
> Paket `sqlite3_flutter_libs` **tidak** mengenkripsi apa pun. Berkas `posgodinov.db` berisi
> `pin_hash` bcrypt seluruh kasir outlet ([03 §2.2](03-api-specifications.md)) dalam bentuk yang
> dapat dibaca siapa pun yang memperoleh akses berkas — persis risiko yang [05 §2.0] sebut
> sebagai keunggulan Flutter atas Web POS. PIN hanya 4–6 digit; ruang tebakan maksimum 1,1 juta
> kombinasi.
>
> **Mitigasi yang harus dipilih sebelum rilis produksi:**
>
> | Opsi | Perubahan | Biaya |
> |---|---|---|
> | **A (rekomendasi)** | Ganti `sqlite3_flutter_libs` → `sqlcipher_flutter_libs`, kunci 32 byte dari `SecureStorageService.getOrCreateDatabaseKey()`, `PRAGMA key` di `setup:` | +3 MB ukuran APK; kedua paket **tidak boleh terpasang bersamaan** (bentrok simbol `sqlite3_open`) |
> | **B** | Tetap tanpa enkripsi, andalkan `android:allowBackup="false"` + perangkat non-root | Gratis; hash tetap terekspos bila perangkat di-root atau hilang |
>
> Sampai keputusan diambil, **A dianggap default** dan kode di [§5.2](#52-secure-storage--device-token--kunci-basis-data) sudah menyiapkan jalannya:
> mengganti paket cukup menukar satu baris `setup:`.

---

## 2. Project Directory Structure

### 2.1 Peta direktori

```text
posgodinov-mobile/
├── lib/
│   ├── main.dart                          # Entry — runApp(bootstrap())
│   ├── bootstrap.dart                     # Buka DB, muat sesi, error handler global, orientasi
│   ├── app.dart                           # MaterialApp.router, tema, BlocProvider global
│   │
│   ├── core/
│   │   ├── config/
│   │   │   ├── app_config.dart            # baseUrl, flavor (dev/staging/prod), timeout
│   │   │   ├── constants.dart             # PaymentMethod (KONTRAK BEKU §9.3), ambang batas
│   │   │   └── device_profile.dart        # tablet10 / tablet8 / handheld / kiosk
│   │   │
│   │   ├── network/
│   │   │   ├── api_client.dart            # Dio + baseUrl + timeout + retry
│   │   │   ├── envelope.dart              # Amplop A ⇒ T · list() ⇒ null→[] ([03 §0])
│   │   │   ├── interceptors/
│   │   │   │   ├── device_token_interceptor.dart
│   │   │   │   ├── error_interceptor.dart          # DioException → Failure
│   │   │   │   ├── clock_skew_interceptor.dart     # header Date → skew ([05 §1.8.2])
│   │   │   │   └── logging_interceptor.dart        # nonaktif di release
│   │   │   └── connectivity_monitor.dart
│   │   │
│   │   ├── database/
│   │   │   ├── app_database.dart          # @DriftDatabase + migrasi + PRAGMA
│   │   │   ├── tables/
│   │   │   │   ├── staffs_table.dart              categories_table.dart
│   │   │   │   ├── products_table.dart            shifts_table.dart
│   │   │   │   ├── transactions_table.dart        transaction_items_table.dart
│   │   │   │   ├── wastes_table.dart              held_carts_table.dart
│   │   │   │   └── sync_meta_table.dart           sync_logs_table.dart
│   │   │   ├── daos/
│   │   │   │   ├── master_dao.dart                shift_dao.dart
│   │   │   │   ├── transaction_dao.dart           waste_dao.dart
│   │   │   │   └── sync_dao.dart                  held_cart_dao.dart
│   │   │   └── converters/                # enum ↔ TEXT, DateTime ↔ INTEGER (UTC ms)
│   │   │
│   │   ├── storage/
│   │   │   └── secure_storage_service.dart        # device_token + kunci DB
│   │   │
│   │   ├── crypto/
│   │   │   └── pin_verifier.dart                  # bcrypt via compute() — §5.3
│   │   │
│   │   ├── printer/
│   │   │   ├── receipt_printer.dart               # abstract interface (ADR-07)
│   │   │   ├── printer_manager.dart               # auto-reconnect + antrean + status
│   │   │   ├── escpos_receipt_builder.dart        # LocalTransaction → Uint8List
│   │   │   ├── adapters/
│   │   │   │   ├── bt_classic_printer_adapter.dart   # SPP — mayoritas printer murah
│   │   │   │   ├── ble_printer_adapter.dart
│   │   │   │   ├── usb_printer_adapter.dart          # handheld OTG / desktop POS
│   │   │   │   ├── network_printer_adapter.dart      # Socket :9100
│   │   │   │   └── sunmi_inner_printer_adapter.dart  # MethodChannel → AIDL InnerPrinter
│   │   │   └── printer_registry.dart              # deteksi & pemilihan otomatis
│   │   │
│   │   ├── kiosk/
│   │   │   ├── kiosk_service.dart                 # MethodChannel Lock Task — §4.4
│   │   │   └── kiosk_guard.dart                   # gerbang keluar berbasis PIN
│   │   │
│   │   ├── sync/
│   │   │   ├── sync_engine.dart                   # cerminan [05 §1.6.2]
│   │   │   ├── reconciler.dart                    # cerminan [05 §1.6.3]
│   │   │   ├── wire_mapper.dart                   # buang metadata lokal, sen → Rupiah
│   │   │   ├── backoff.dart
│   │   │   ├── sync_triggers.dart                 # online / periodik / tutup shift / manual
│   │   │   └── background_sync_worker.dart        # WorkManager callbackDispatcher
│   │   │
│   │   ├── error/
│   │   │   ├── failures.dart                      # sealed class Failure
│   │   │   └── exceptions.dart
│   │   │
│   │   ├── di/
│   │   │   └── injection.dart                     # get_it + injectable
│   │   │
│   │   └── utils/
│   │       ├── money.dart                         # INTEGER SEN — ADR-05
│   │       ├── uuid_gen.dart
│   │       ├── clock.dart                         # nowUtc(), skew
│   │       └── result.dart                        # Result<T> / Either sederhana
│   │
│   ├── features/
│   │   ├── device/          # P-01 binding, P-02 sync master, P-14 pengaturan
│   │   │   ├── data/
│   │   │   │   ├── datasources/{device_remote_ds.dart, master_local_ds.dart}
│   │   │   │   ├── models/{device_bind_request.dart, master_data_dto.dart}
│   │   │   │   └── repositories/device_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/{device_session.dart, master_snapshot.dart}
│   │   │   │   ├── repositories/device_repository.dart     # KONTRAK
│   │   │   │   └── usecases/{bind_device.dart, sync_master_data.dart}
│   │   │   └── presentation/
│   │   │       ├── cubit/{device_binding_cubit.dart, master_sync_cubit.dart}
│   │   │       ├── pages/{binding_page.dart, master_sync_page.dart, settings_page.dart}
│   │   │       └── widgets/
│   │   │
│   │   ├── auth/            # P-03 login kasir (100% lokal)
│   │   ├── shift/           # P-04 buka shift · P-12 tutup shift
│   │   ├── register/        # P-05 kasir · P-06 bayar · P-07 struk · P-08 hold
│   │   ├── history/         # P-09 riwayat · P-10 void
│   │   ├── waste/           # P-11 waste produk
│   │   ├── sync/            # P-13 status sinkronisasi
│   │   └── kiosk/           # mode pesan mandiri pelanggan
│   │
│   └── shared/
│       ├── theme/
│       │   ├── godinov_colors.dart        # LAPIS 1 — primitif, satu-satunya berkas ber-hex
│       │   ├── godinov_tokens.dart        # LAPIS 2 — ThemeExtension semantik
│       │   ├── app_theme.dart             # ThemeData + TextTheme POS
│       │   ├── spacing.dart               # touch 48 / 56 / 64 / 72
│       │   └── breakpoints.dart
│       ├── widgets/
│       │   ├── money_text.dart            # SATU-SATUNYA cara merender nominal
│       │   ├── touch_button.dart          numpad.dart          pin_keypad.dart
│       │   ├── product_tile.dart          category_tabs.dart
│       │   ├── cart_panel.dart            cart_line_tile.dart
│       │   ├── status_bar.dart            sync_badge.dart
│       │   └── empty_state.dart           confirm_dialog.dart
│       └── extensions/
│           ├── context_ext.dart           # context.tokens, context.deviceProfile
│           └── num_ext.dart
│
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       └── kotlin/id/godinov/pos/
│           ├── MainActivity.kt
│           ├── kiosk/KioskPlugin.kt            # Lock Task Mode — §4.4
│           └── printer/SunmiPrinterPlugin.kt   # AIDL InnerPrinter — §4.3
│
├── test/
│   ├── unit/          # money, cart math, shift math, reconciler, escpos builder
│   ├── contract/      # payment_methods_test.dart — §9.3
│   └── bloc/          # bloc_test untuk seluruh Cubit
├── integration_test/  # alur offline penuh: binding → sync → jual → tutup shift → sync
└── pubspec.yaml
```

### 2.2 Aturan ketergantungan — ditegakkan, bukan disepakati

```text
   presentation ──────► domain ◄────── data
        │                                │
        └──────────────► core ◄──────────┘

domain  : Dart MURNI. Dilarang mengimpor drift, dio, flutter/material,
          maupun apa pun dari data/ dan presentation/.
data    : boleh drift + dio. Mengimplementasikan kontrak milik domain/.
present.: boleh flutter + bloc. Bicara HANYA lewat usecase/repository domain.
core    : boleh diimpor siapa saja. Tidak boleh mengimpor features/ mana pun.
```

```yaml
# import_lint.yaml — gerbang CI, bukan sekadar konvensi
rules:
  - name: domain_is_pure_dart
    target: { path: "lib/features/*/domain/**" }
    not_allow_imports:
      - { path: "package:flutter/**" }
      - { path: "package:drift/**" }
      - { path: "package:dio/**" }
      - { path: "lib/features/*/data/**" }
      - { path: "lib/features/*/presentation/**" }

  - name: core_never_depends_on_features
    target: { path: "lib/core/**" }
    not_allow_imports:
      - { path: "lib/features/**" }

  - name: no_raw_hex_outside_layer1
    target: { path: "lib/features/**" }
    not_allow_imports:
      - { path: "lib/shared/theme/godinov_colors.dart" }   # Lapis 1 haram di fitur — §3.3
```

**Gerbang mutu tiap fase:** `flutter analyze` bersih · `dart run import_lint` bersih ·
`flutter test` hijau · `flutter build apk --release` sukses.

---

## 3. Tablet & Kiosk UI Layout Rules

### 3.1 Profil perangkat & *breakpoint*

```dart
// core/config/device_profile.dart
enum DeviceProfile { handheld, tablet8, tablet10, tabletWide }

abstract final class Breakpoints {
  static const double handheldMax = 600;   // < 600 dp → handheld POS (Sunmi/iMin)
  static const double tablet8Max  = 900;   // 600–899 dp → tablet 8"
  static const double tablet10Max = 1100;  // 900–1099 dp → tablet 10" (acuan utama)
                                           // ≥ 1100 dp → layar lebar / desktop POS
}

extension DeviceProfileX on BuildContext {
  DeviceProfile get profile {
    final w = MediaQuery.sizeOf(this).width;
    if (w < Breakpoints.handheldMax) return DeviceProfile.handheld;
    if (w < Breakpoints.tablet8Max)  return DeviceProfile.tablet8;
    if (w < Breakpoints.tablet10Max) return DeviceProfile.tablet10;
    return DeviceProfile.tabletWide;
  }
}
```

> **Mengapa dp, bukan piksel.** Tablet 1280 × 800 px pada densitas mdpi setara **800 dp** lebar
> di *landscape*; handheld 720 × 1280 px pada xhdpi setara **360 dp**. Seluruh ambang di
> [06 §3.1](06-ui-ux-design-system.md) yang ditulis dalam piksel CSS diterjemahkan ke dp di sini.

### 3.2 Aturan tata letak per profil

| Properti | **Tablet 10" (P0)** | Tablet 8" | Layar lebar | **Handheld** |
|---|---|---|---|---|
| Orientasi | **Landscape dikunci** | Landscape | Landscape | **Portrait dikunci** |
| Struktur | Split-screen | Split-screen | Rail + split | Bertumpuk + *bottom sheet* |
| Panel produk | **62 %** (`flex: 62`) | 60 % | *fluid* | 100 % |
| Panel keranjang | **38 %** (`flex: 38`) | 40 % | dikunci 420 dp | *Bottom sheet* 85 % + bar ringkasan 72 dp |
| Kolom grid produk | **4** | 3 | 6 | 2 |
| Tinggi tile produk | 150 dp | 150 dp | 150 dp | 132 dp |
| *Gutter* grid | 12 dp | 10 dp | 12 dp | 8 dp |
| *Padding* panel | 16 dp | 12 dp | 20 dp | 12 dp |
| Tinggi StatusBar | 56 dp | 56 dp | 56 dp | 48 dp (ringkas) |

**Wireframe acuan Tablet 10" — P-05 Kasir Utama**
(identik dengan [06 §3.3](06-ui-ux-design-system.md); di Flutter menjadi `Row` dengan dua `Expanded`)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ StatusBar  [=] GODINOV  Outlet Sudirman │ ● Online  ⧗3 antre │ Siti A. │ Shift 08:02 │10:47│  56dp · surfaceInverse
├────────────────────────────────────────────────────────┬─────────────────────────────────┤
│  PANEL PRODUK                        flex: 62          │  PANEL KERANJANG     flex: 38   │
│  ┌──────────────────────────────────────────┐ ┌──────┐ │  ┌───────────────────────────┐  │
│  │ 🔍 Cari produk atau pindai barcode       │ │ ⌗ 56 │ │  │ KERANJANG   3 item  [Bsh] │  │  48dp
│  └──────────────────────────────────────────┘ └──────┘ │  └───────────────────────────┘  │
│   56dp · borderRadius 12 · surface                     │                                 │
│  ┌─────┐┌──────┐┌──────┐┌───────┐┌─────┐               │  ┌───────────────────────────┐  │
│  │SMUA ││ Kopi ││ Non- ││Makanan││Snack│  CategoryTabs │  │ Kopi Susu Gula Aren       │  │
│  │ 128 ││  42  ││Kopi31││  38   ││ 17  │  56dp · scroll│  │ Rp 22.000 × 2             │  │
│  └─────┘└──────┘└──────┘└───────┘└─────┘               │  │ [−]  2  [+]     Rp 44.000 │  │  baris 72dp
│  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐      │  └───────────────────────────┘  │
│  │          ││          ││          ││          │      │  ┌───────────────────────────┐  │
│  │ Kopi Susu││ Americano││ Latte    ││Cappuccino│      │  │ Croissant Butter          │  │
│  │ Gula Aren││          ││ Hazelnut ││          │      │  │ Rp 18.000 × 1  Rp 18.000  │  │
│  │ Rp 22.000││ Rp 18.000││ Rp 26.000││ Rp 24.000│      │  └───────────────────────────┘  │
│  └──────────┘└──────────┘└──────────┘└──────────┘      │                                 │
│   4 kolom · tinggi 150dp · gutter 12dp                 │   (area gulir · Expanded)       │
│                                                        │  ┌───────────────────────────┐  │
│                                                        │  │ SUBTOTAL      Rp 70.000   │  │  mono
│                                                        │  ├───────────────────────────┤  │
│                                                        │  │ TOTAL         Rp 70.000   │  │  mono 28dp
│                                                        │  ├──────────────┬────────────┤  │
│                                                        │  │ TAHAN        │   BAYAR    │  │  64dp
│                                                        │  └──────────────┴────────────┘  │  success solid
└────────────────────────────────────────────────────────┴─────────────────────────────────┘
```

```dart
// features/register/presentation/pages/register_page.dart
@override
Widget build(BuildContext context) {
  final profile = context.profile;

  if (profile == DeviceProfile.handheld) {
    return const _HandheldRegisterLayout();     // grid penuh + bottom sheet keranjang
  }

  final (productFlex, cartFlex) = switch (profile) {
    DeviceProfile.tablet8    => (60, 40),
    DeviceProfile.tablet10   => (62, 38),   // ← acuan utama [06 §3.2]
    DeviceProfile.tabletWide => (0, 0),     // keranjang dikunci lebar tetap
    DeviceProfile.handheld   => (0, 0),     // tidak terjangkau
  };

  return Scaffold(
    body: Column(children: [
      const PosStatusBar(),
      Expanded(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (profile == DeviceProfile.tabletWide) ...[
            const Expanded(child: ProductPanel()),
            const SizedBox(width: 420, child: CartPanel()),
          ] else ...[
            Expanded(flex: productFlex, child: const ProductPanel()),
            Expanded(flex: cartFlex,    child: const CartPanel()),
          ],
        ]),
      ),
    ]),
  );
}
```

**Penguncian orientasi** — dilakukan sekali di `bootstrap.dart`, bergantung profil perangkat:

```dart
// bootstrap.dart
final shortest = WidgetsBinding.instance.platformDispatcher.views.first;
final isHandheld = /* lebar dp < 600 */;

await SystemChrome.setPreferredOrientations(
  isHandheld
      ? const [DeviceOrientation.portraitUp]
      : const [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight],
);
```

> **Tablet tidak pernah dijalankan portrait.** Tata letak 62/38 tidak pernah diuji vertikal, dan
> memaksakannya menghasilkan panel keranjang setinggi 300 dp yang tidak dapat dipakai. Sesuai
> [06 §3.1], jalur yang benar adalah **mengunci orientasi**, bukan membuat tata letak cadangan.

### 3.3 Godinov Palette sebagai token Flutter

Arsitektur tiga lapis [06 §1.1](06-ui-ux-design-system.md) dipertahankan utuh.

**Lapis 1 — primitif. Satu-satunya berkas di seluruh proyek yang boleh memuat nilai heksadesimal.**

```dart
// shared/theme/godinov_colors.dart
abstract final class GodinovColors {
  // Primary / Brand
  static const navy950 = Color(0xFF0F172A);   // Deep Navy — teks utama, StatusBar
  static const navy900 = Color(0xFF1E293B);
  static const navy800 = Color(0xFF334155);

  // Accent / Action
  static const blue600 = Color(0xFF2563EB);   // Electric Blue — AKSI UTAMA
  static const blue700 = Color(0xFF1D4ED8);
  static const blue50  = Color(0xFFEFF6FF);
  static const cyan600 = Color(0xFF0284C7);

  // Success / Paid
  static const emerald600 = Color(0xFF059669); // Emerald Green — BAYAR TUNAI, LUNAS
  static const emerald700 = Color(0xFF047857); // teks hijau di atas latar terang
  static const emerald50  = Color(0xFFECFDF5);

  // Warning / Alert
  static const amber600 = Color(0xFFD97706);
  static const amber700 = Color(0xFFB45309);
  static const amber50  = Color(0xFFFFFBEB);

  // Danger / Void
  static const red600 = Color(0xFFDC2626);
  static const red700 = Color(0xFFB91C1C);
  static const red50  = Color(0xFFFEF2F2);

  // Neutral / Slate
  static const slate50  = Color(0xFFF8FAFC);   // Slate Background — kanvas aplikasi
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const white    = Color(0xFFFFFFFF);
}
```

**Lapis 2 — semantik, sebagai `ThemeExtension`.** Inilah satu-satunya yang boleh disentuh widget.

```dart
// shared/theme/godinov_tokens.dart
@immutable
class GodinovTokens extends ThemeExtension<GodinovTokens> {
  const GodinovTokens({
    required this.bg, required this.bgMuted,
    required this.surface, required this.surfaceInverse,
    required this.border, required this.borderStrong, required this.borderInverse,
    required this.fg, required this.fgMuted, required this.fgSubtle, required this.fgInverse,
    required this.brand,
    required this.accent, required this.accentHover, required this.accentSubtle,
    required this.info,
    required this.success, required this.successText, required this.successSubtle,
    required this.warning, required this.warningText, required this.warningSubtle,
    required this.danger, required this.dangerHover, required this.dangerSubtle,
    required this.focusRing,
  });

  final Color bg, bgMuted, surface, surfaceInverse;
  final Color border, borderStrong, borderInverse;
  final Color fg, fgMuted, fgSubtle, fgInverse;
  final Color brand, accent, accentHover, accentSubtle, info;
  final Color success, successText, successSubtle;
  final Color warning, warningText, warningSubtle;
  final Color danger, dangerHover, dangerSubtle, focusRing;

  static const light = GodinovTokens(
    bg:             GodinovColors.slate50,
    bgMuted:        GodinovColors.slate100,
    surface:        GodinovColors.white,
    surfaceInverse: GodinovColors.navy950,
    border:         GodinovColors.slate200,
    borderStrong:   GodinovColors.slate300,
    borderInverse:  GodinovColors.navy800,
    fg:             GodinovColors.navy950,
    fgMuted:        GodinovColors.slate600,
    fgSubtle:       GodinovColors.slate500,
    fgInverse:      GodinovColors.white,
    brand:          GodinovColors.navy950,
    accent:         GodinovColors.blue600,
    accentHover:    GodinovColors.blue700,
    accentSubtle:   GodinovColors.blue50,
    info:           GodinovColors.cyan600,
    success:        GodinovColors.emerald600,
    successText:    GodinovColors.emerald700,   // AA di latar terang — [06 §1.5]
    successSubtle:  GodinovColors.emerald50,
    warning:        GodinovColors.amber600,
    warningText:    GodinovColors.amber700,
    warningSubtle:  GodinovColors.amber50,
    danger:         GodinovColors.red600,
    dangerHover:    GodinovColors.red700,
    dangerSubtle:   GodinovColors.red50,
    focusRing:      GodinovColors.blue600,
  );

  @override GodinovTokens copyWith({/* … */}) => this;
  @override GodinovTokens lerp(ThemeExtension<GodinovTokens>? other, double t) => this;
}

extension TokensX on BuildContext {
  GodinovTokens get tokens => Theme.of(this).extension<GodinovTokens>()!;
}
```

**Tiga aturan warna yang diperiksa saat tinjauan kode:**

1. `Color(0xFF…)` **hanya** boleh muncul di `godinov_colors.dart`. Di berkas lain — termasuk
   seluruh `features/` — nilai literal dilarang; ditegakkan oleh aturan `import_lint`
   `no_raw_hex_outside_layer1` ([§2.2](#22-aturan-ketergantungan--ditegakkan-bukan-disepakati)).
2. Widget merujuk `context.tokens.accent`, **bukan** `GodinovColors.blue600` dan bukan
   `Theme.of(context).primaryColor`.
3. **Mode gelap dikunci mati** untuk POS ([06 §1.6](06-ui-ux-design-system.md)):
   `themeMode: ThemeMode.light` dan `darkTheme` tidak didefinisikan. Layar kasir dipakai di
   bawah lampu toko yang terang; mode gelap menurunkan keterbacaan nominal.

### 3.4 Touch target — standar *fat-finger proof*

Diturunkan dari **konsekuensi kesalahan** ([06 §2.1](06-ui-ux-design-system.md)), bukan dari
kepadatan visual.

```dart
// shared/theme/spacing.dart
abstract final class Touch {
  static const double standard = 48;  // BATAS BAWAH ABSOLUT — ikon toolbar, baris daftar
  static const double frequent = 56;  // Numpad, keypad PIN, stepper qty, tab kategori
  static const double primary  = 64;  // Tombol BAYAR di CartPanel, konfirmasi transaksi
  static const double critical = 72;  // Preset Fast-Cash, tombol BAYAR di modal
}

abstract final class Gap {
  static const double tight       = 8;   // jarak antar target biasa
  static const double destructive = 24;  // WAJIB bila salah satu target destruktif
}
```

| Kelas | Ukuran | Dipakai untuk | Konsekuensi salah tekan |
|---|---|---|---|
| **Kritis** | **72 × 72 dp** | Fast-Cash, `BAYAR` di modal | Uang fisik keluar salah |
| **Utama** | **64 dp tinggi** | `BAYAR` di CartPanel, konfirmasi | Transaksi terkirim prematur |
| **Sering** | **56 × 56 dp** | Numpad, keypad PIN, stepper `+`/`−`, tab kategori | Kuantitas salah — memperlambat |
| **Standar** | **48 × 48 dp** | Ikon toolbar, tombol tutup, baris daftar | Navigasi salah — mudah dibatalkan |

**Enam aturan yang menyertai ukuran:**

1. **Target ≠ visual.** Ikon boleh 20 dp selama area sentuh 48 dp. Gunakan `Padding` di dalam
   `InkWell`, atau `MaterialTapTargetSize.padded` — **jangan** membesarkan ikon.
2. **Jarak antar target ≥ 8 dp; ≥ 24 dp bila salah satunya destruktif.** `Void` tidak pernah
   bersebelahan dengan `Bayar`.
3. **Tidak ada aksi destruktif di tepi layar.** `Kosongkan Keranjang` diletakkan di *header*
   panel, bukan di sudut bawah tempat telapak tangan menyentuh saat memegang tablet.
4. **Tidak ada `hover` sebagai satu-satunya pengungkap.** Tidak ada tetikus di tablet.
5. **Zona jempol.** Aksi paling sering (Bayar, Numpad) berada di **kanan-bawah** — tempat panel
   keranjang berakhir.
6. **Umpan balik haptik** pada setiap ketukan numpad dan tombol bayar:
   `HapticFeedback.selectionClick()` — pengganti `navigator.vibrate(8)` di Web
   ([06 §6.3](06-ui-ux-design-system.md)).

```dart
// shared/widgets/touch_button.dart — semua tombol POS melewati sini
class TouchButton extends StatelessWidget {
  const TouchButton({
    super.key, required this.label, required this.onPressed,
    this.variant = TouchVariant.primary, this.height = Touch.primary, this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (bg, fg) = switch (variant) {
      TouchVariant.primary   => (t.accent,  t.fgInverse),
      TouchVariant.success   => (t.success, t.fgInverse),   // BAYAR TUNAI
      TouchVariant.danger    => (t.danger,  t.fgInverse),   // Void, Hapus
      TouchVariant.secondary => (t.surface, t.fg),
      TouchVariant.ghost     => (Colors.transparent, t.fgMuted),
    };

    return SizedBox(
      height: height,
      child: FilledButton(
        onPressed: onPressed == null ? null : () {
          HapticFeedback.selectionClick();
          onPressed!();
        },
        style: FilledButton.styleFrom(
          backgroundColor: bg, foregroundColor: fg,
          minimumSize: Size(Touch.standard, height),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
        ),
        child: /* ikon + label */,
      ),
    );
  }
}
```

### 3.5 Data keuangan — Integer Sen & Monospace

**Aturan induk (ADR-05, [05 §1.8.1](05-frontend-architecture-design.md)):** seluruh nominal di
dalam aplikasi — state, DB, aritmetika — adalah **`int` sen**. `double` tidak pernah menyentuh
uang. Konversi hanya terjadi di **tiga titik**: batas API masuk, batas API keluar, dan
pemformatan tampilan.

```dart
// core/utils/money.dart
abstract final class Money {
  /// Batas API MASUK: Rupiah dari backend (mis. price 22000) → sen (2_200_000).
  static int toMinor(num major) => (major * 100).round();

  /// Batas API KELUAR: sen → Rupiah desimal untuk DECIMAL(15,2) di server.
  static num toMajor(int minor) => minor / 100;

  static final _idr = NumberFormat.currency(
    locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0,
  );

  /// Titik ketiga: TAMPILAN. Tanpa desimal, pemisah ribuan titik, minus tipografis.
  static String format(int minor) =>
      _idr.format(minor / 100).replaceFirst('-', '−');   // U+2212, bukan hubung
}
```

| Nilai state (sen) | `toMajor()` | Tampil di UI | Catatan |
|---:|---:|---|---|
| `2_200_000` | `22000` | `Rp 22.000` | Harga produk standar |
| `0` | `0` | `Rp 0` | **Bukan** `-`, bukan string kosong |
| `4_700_000` | `47000` | `Rp 47.000` | Total keranjang |
| `-1_500_000` | `-15000` | `−Rp 15.000` | Selisih shift kurang → `tone: danger` |
| `1_500_000` | `15000` | `+Rp 15.000` | Selisih shift lebih → `signed`, `tone: success` |

**Monospace wajib.** Seluruh nominal, kuantitas, persentase, nomor transaksi, jam, dan selisih
shift memakai `JetBrainsMono` dengan `FontFeature.tabularFigures()`
([06 §2.4](06-ui-ux-design-system.md)). Alasannya bukan estetika:

1. **Pemindaian kolom** — digit berlebar sama membuat `Rp 22.000` dan `Rp 220.000` berbeda
   panjang secara proporsional; kasir mendeteksi salah orde besaran tanpa membaca.
2. **Tanpa goyangan** — total yang berubah `Rp 99.000` → `Rp 100.000` tidak menggeser tata letak.
3. **Kesejajaran kanan** — kolom nominal rata kanan hanya bekerja dengan lebar digit tetap.

```dart
// shared/widgets/money_text.dart — SATU-SATUNYA cara merender nominal di seluruh aplikasi
enum MoneySize { sm, md, lg, xl, xxl }   // 14 / 18 / 22 / 28 / 40 dp — skala POS [06 §2.3]
enum MoneyTone { normal, muted, success, danger }

class MoneyText extends StatelessWidget {
  const MoneyText(this.minor, {super.key, this.size = MoneySize.md,
                               this.tone = MoneyTone.normal, this.signed = false});

  /// Nominal dalam INTEGER SEN. Bukan Rupiah. Widget TIDAK PERNAH menerima double.
  final int minor;
  final MoneySize size;
  final MoneyTone tone;
  final bool signed;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (fontSize, weight) = switch (size) {
      MoneySize.sm  => (14.0, FontWeight.w500),
      MoneySize.md  => (18.0, FontWeight.w600),
      MoneySize.lg  => (22.0, FontWeight.w600),
      MoneySize.xl  => (28.0, FontWeight.w700),
      MoneySize.xxl => (40.0, FontWeight.w700),
    };
    final color = switch (tone) {
      MoneyTone.normal  => t.fg,
      MoneyTone.muted   => t.fgMuted,
      MoneyTone.success => t.successText,   // emerald-700 — lolos AA di latar terang
      MoneyTone.danger  => t.danger,
    };
    final sign = signed && minor > 0 ? '+' : '';

    return Semantics(
      label: '$sign${Money.format(minor)}',
      child: Text(
        '$sign${Money.format(minor)}',
        maxLines: 1, softWrap: false,
        style: TextStyle(
          fontFamily: 'JetBrainsMono',
          fontFeatures: const [FontFeature.tabularFigures()],   // ← inti aturan
          fontSize: fontSize, fontWeight: weight, color: color,
        ),
      ),
    );
  }
}
```

**Lima larangan tampilan nominal:**

| # | Larangan | Alasan |
|---|---|---|
| 1 | `Text('Rp ${x}')` di mana pun | Melewati `MoneyText` = melewati monospace, minus tipografis, dan `Semantics` |
| 2 | Desimal sen ditampilkan | Sen adalah detail representasi internal, bukan realitas Rupiah |
| 3 | Singkatan `Rp 1,2jt` di layar kasir | Ambigu saat menghitung uang fisik |
| 4 | Nominal < 16 dp atau berwarna `fgSubtle` | Batas bawah [06 §2.3] |
| 5 | Aritmetika uang di dalam widget | Widget menerima hasil dari `cart_math.dart` / `shift_math.dart` |

### 3.6 Aturan tata letak khusus Kiosk

Mode Kiosk memakai **tema dan token yang sama**, tetapi tata letak dan kosakata interaksi berbeda
— penggunanya pelanggan, bukan kasir terlatih.

| Aspek | Mode Kasir | **Mode Kiosk** |
|---|---|---|
| Ukuran tile produk | 176 × 150 dp, 4 kolom | **240 × 260 dp, 3 kolom** — gambar besar, harga 22 dp |
| Target sentuh minimum | 48 dp | **64 dp** — pelanggan tidak terlatih, hanya sekali pakai |
| Nama produk | 16 dp, `maxLines: 2` | **20 dp, `maxLines: 2`** |
| Keranjang | Panel permanen 38 % | **Bilah bawah 96 dp** + layar tinjauan terpisah |
| Aksi tersedia | Semua | **Hanya**: tambah, kurangi, hapus, kirim pesanan |
| Yang disembunyikan | — | Pengaturan, binding, riwayat, void, waste, tutup shift, status sync |
| Idle timeout | — | **90 detik** tanpa sentuhan → keranjang dikosongkan, kembali ke layar sambutan |
| Layar tetap menyala | Saat shift terbuka | **Selalu** (`WakelockPlus.enable()`) |
| Jalan keluar | Tombol menu | **Ketuk logo 5× → dialog PIN staff** ([§4.5](#45-gerbang-keluar-kiosk)) |

> **Kiosk tetap tidak menampilkan stok.** Batasan [03 §2.2](03-api-specifications.md) berlaku
> penuh: tidak ada penanda "habis", tidak ada sisa porsi. Pelanggan yang memesan produk yang
> bahan bakunya habis akan diberitahu kasir saat penyerahan — konsekuensi yang harus disepakati
> pemilik sebelum Kiosk dinyalakan. Lihat [§11](#11-butir-terbuka) butir 3.

---

## 4. Hardware Integrations & Kiosk Mode

### 4.1 Kontrak printer — satu antarmuka, empat transport

Pemisahan **renderer** (byte ESC/POS) dan **transport** (cara byte sampai ke printer) —
ADR-07, [05 §1.7.1](05-frontend-architecture-design.md). Layar tidak pernah tahu transport apa
yang dipakai.

```dart
// core/printer/receipt_printer.dart — domain murni, tanpa impor plugin apa pun
enum PrinterKind { btClassic, ble, usb, network, sunmiInner }

enum PrinterState { unavailable, disconnected, connecting, ready, printing, outOfPaper, error }

class PrinterStatus {
  const PrinterStatus(this.state, {this.message, this.target});
  final PrinterState state;
  final String? message;
  final PrinterTarget? target;
}

class PrinterTarget {
  const PrinterTarget({required this.id, required this.name, required this.kind});
  final String id;      // MAC address · vendorId:productId · host:port · 'INNER'
  final String name;
  final PrinterKind kind;
}

abstract interface class ReceiptPrinter {
  PrinterKind get kind;
  Future<bool> isSupported();
  Future<List<PrinterTarget>> discover({Duration timeout});
  Future<void> connect(PrinterTarget target);
  Future<void> printBytes(Uint8List bytes);
  Future<void> disconnect();
  Stream<PrinterStatus> get status;
}
```

| Adapter | Mekanisme | Menangani |
|---|---|---|
| `BtClassicPrinterAdapter` | `flutter_pos_printer_platform_image_3` → SPP `00001101-…` | **Mayoritas printer termal murah** — tidak terjangkau BLE maupun Web Bluetooth |
| `BlePrinterAdapter` | paket yang sama, mode BLE | Printer generasi baru, konsumsi daya rendah |
| `UsbPrinterAdapter` | paket yang sama, USB Host/OTG | Handheld dengan *dock*, desktop POS |
| `NetworkPrinterAdapter` | `dart:io` `Socket` ke `:9100` | Printer LAN — **mustahil dari browser**, menyelesaikan [05 §1.7.3] dalam beberapa baris |
| `SunmiInnerPrinterAdapter` | MethodChannel → AIDL `InnerPrinterService` | **Printer internal handheld Sunmi/iMin** — tidak muncul sebagai perangkat Bluetooth |

### 4.2 `PrinterManager` — auto-reconnect, antrean, status

Ini yang membedakan printer yang "bisa dipakai demo" dari printer yang bertahan satu shift penuh.

```dart
// core/printer/printer_manager.dart
class PrinterManager {
  PrinterManager(this._registry, this._prefs);

  ReceiptPrinter? _printer;
  PrinterTarget? _target;
  final _statusCtrl = StreamController<PrinterStatus>.broadcast();
  final _lock = Lock();                      // package:synchronized — cetak tidak boleh tumpang tindih
  final _queue = Queue<_PrintJob>();

  static const _maxReconnectAttempts = 5;
  static const _baseReconnectDelay = Duration(seconds: 2);
  static const _connectTimeout = Duration(seconds: 8);

  Stream<PrinterStatus> get status => _statusCtrl.stream;

  /// Dipanggil saat aplikasi start dan setiap kali aplikasi kembali resume.
  Future<void> restore() async {
    final saved = _prefs.readPrinterTarget();          // MAC/host tersimpan lokal
    if (saved == null) {
      _emit(const PrinterStatus(PrinterState.unavailable,
          message: 'Belum ada printer terpasang'));
      return;
    }
    _target = saved;
    _printer = _registry.adapterFor(saved.kind);
    unawaited(_ensureConnected());
  }

  /// Reconnect dengan backoff eksponensial. TIDAK PERNAH melempar ke pemanggil —
  /// kegagalan printer bukan kegagalan transaksi ([05 §1.6.5]).
  Future<bool> _ensureConnected() async {
    if (_printer == null || _target == null) return false;

    for (var attempt = 1; attempt <= _maxReconnectAttempts; attempt++) {
      try {
        _emit(const PrinterStatus(PrinterState.connecting));
        await _printer!.connect(_target!).timeout(_connectTimeout);
        _emit(PrinterStatus(PrinterState.ready, target: _target));
        return true;
      } catch (e) {
        final delay = _baseReconnectDelay * (1 << (attempt - 1));   // 2s,4s,8s,16s,32s
        _emit(PrinterStatus(PrinterState.error,
            message: 'Gagal terhubung ke printer (percobaan $attempt/$_maxReconnectAttempts)'));
        if (attempt < _maxReconnectAttempts) await Future.delayed(delay);
      }
    }
    _emit(const PrinterStatus(PrinterState.disconnected,
        message: 'Printer tidak terhubung. Struk dapat dicetak ulang dari Riwayat.'));
    return false;
  }

  /// Mencetak. Mengembalikan false bila gagal — pemanggil TIDAK boleh membatalkan transaksi.
  Future<bool> printReceipt(Uint8List bytes) async => _lock.synchronized(() async {
        if (!await _ensureConnected()) return false;
        try {
          _emit(const PrinterStatus(PrinterState.printing));
          await _printer!.printBytes(bytes);
          await _pollPaperStatus();          // DLE EOT 4 bila transport mendukung baca-balik
          _emit(PrinterStatus(PrinterState.ready, target: _target));
          return true;
        } catch (e) {
          _emit(PrinterStatus(PrinterState.error, message: 'Cetak gagal: $e'));
          unawaited(_ensureConnected());     // siapkan untuk "Cetak Ulang"
          return false;
        }
      });
}
```

**Status printer yang dilaporkan ke UI** (`PrinterCubit` → badge di StatusBar):

| `PrinterState` | Tampilan StatusBar | Aksi yang ditawarkan |
|---|---|---|
| `unavailable` | Ikon printer tercoret, `fgSubtle` | "Pasang printer" → Pengaturan |
| `disconnected` | Ikon printer, `warning` | "Hubungkan ulang" |
| `connecting` | Ikon berputar, `info` | — |
| `ready` | Ikon printer, `success` | — |
| `printing` | Ikon berputar, `info` | — |
| `outOfPaper` | Ikon segitiga, `danger` | **Banner penuh**: "Kertas habis — ganti roll, lalu Cetak Ulang" |
| `error` | Ikon segitiga, `danger` | "Coba lagi" · "Cetak Ulang" |

> **Deteksi kertas habis bersifat *best-effort*.** Perintah real-time ESC/POS `DLE EOT 4`
> mengembalikan status sensor kertas, tetapi hanya dapat dibaca pada transport yang mendukung
> baca-balik: **SPP, USB, dan TCP**. Pada BLE, mayoritas printer murah tidak mengekspos
> karakteristik *notify*. Untuk BLE, `outOfPaper` tidak akan pernah terdeteksi otomatis — UI
> mengandalkan tombol "Cetak Ulang" sebagai jalur pemulihan. **Jangan menjanjikan deteksi
> kertas habis universal di dokumentasi pengguna.**

**Encoder struk** — `esc_pos_utils_2` hanya membangkitkan byte; tidak tahu apa pun soal Drift
maupun widget:

```dart
// core/printer/escpos_receipt_builder.dart
Future<Uint8List> buildReceipt(ReceiptData r, {PaperSize paper = PaperSize.mm58}) async {
  final profile = await CapabilityProfile.load();
  final g = Generator(paper, profile);
  final bytes = <int>[];

  bytes.addAll(g.text(r.outletName,
      styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2)));
  bytes.addAll(g.text(r.outletAddress, styles: const PosStyles(align: PosAlign.center)));
  bytes.addAll(g.hr());

  bytes.addAll(g.row([
    PosColumn(text: 'No', width: 3),
    PosColumn(text: r.shortId, width: 9, styles: const PosStyles(align: PosAlign.right)),
  ]));
  bytes.addAll(g.row([
    PosColumn(text: 'Kasir', width: 3),
    PosColumn(text: r.cashierName, width: 9, styles: const PosStyles(align: PosAlign.right)),
  ]));
  bytes.addAll(g.hr());

  for (final line in r.lines) {
    bytes.addAll(g.text(line.productName));
    bytes.addAll(g.row([
      PosColumn(text: '${line.quantity} x ${Money.format(line.unitPriceMinor)}', width: 7),
      PosColumn(text: Money.format(line.lineTotalMinor), width: 5,
                styles: const PosStyles(align: PosAlign.right)),
    ]));
  }

  bytes.addAll(g.hr());
  bytes.addAll(g.row([
    PosColumn(text: 'TOTAL', width: 6, styles: const PosStyles(bold: true)),
    PosColumn(text: Money.format(r.totalMinor), width: 6,
              styles: const PosStyles(align: PosAlign.right, bold: true, height: PosTextSize.size2)),
  ]));

  if (r.method == PaymentMethod.cash) {
    bytes.addAll(g.row([
      PosColumn(text: 'TUNAI', width: 6),
      PosColumn(text: Money.format(r.cashReceivedMinor), width: 6,
                styles: const PosStyles(align: PosAlign.right)),
    ]));
    bytes.addAll(g.row([
      PosColumn(text: 'KEMBALI', width: 6),
      PosColumn(text: Money.format(r.changeMinor), width: 6,
                styles: const PosStyles(align: PosAlign.right)),
    ]));
  } else {
    bytes.addAll(g.text('Metode: ${r.method.label} (${r.method.wireValue})'));
  }

  bytes.addAll(g.feed(1));
  bytes.addAll(g.qrcode(r.id));                   // UUID penuh — untuk penelusuran sengketa
  bytes.addAll(g.text('Terima kasih', styles: const PosStyles(align: PosAlign.center)));
  bytes.addAll(g.feed(2));
  bytes.addAll(g.cut());

  // Buka laci kas bila terpasang di port RJ11 printer (hanya untuk transaksi tunai).
  if (r.method == PaymentMethod.cash) bytes.addAll(g.drawer(pin: PosDrawer.pin2));

  return Uint8List.fromList(bytes);
}
```

### 4.3 Printer internal handheld (Sunmi / iMin)

Perangkat handheld POS memiliki printer 58 mm terpasang di dalam badan perangkat. Printer ini
**tidak muncul sebagai perangkat Bluetooth** — ia diakses lewat *service* AIDL vendor.

```kotlin
// android/app/src/main/kotlin/id/godinov/pos/printer/SunmiPrinterPlugin.kt
class SunmiPrinterPlugin(private val context: Context) : MethodCallHandler {

    private var service: IWoyouService? = null

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IWoyouService.Stub.asInterface(binder)
        }
        override fun onServiceDisconnected(name: ComponentName?) { service = null }
    }

    fun bind() {
        val intent = Intent().apply {
            setPackage("woyou.aidlservice.jiuiv5")
            action = "woyou.aidlservice.jiuiv5.IWoyouService"
        }
        context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    override fun onMethodCall(call: MethodCall, result: Result) = when (call.method) {
        "isAvailable" -> result.success(service != null)

        // Byte ESC/POS dibangkitkan di Dart oleh esc_pos_utils_2 dan diteruskan APA ADANYA.
        // Renderer tetap satu — hanya transportnya yang berbeda (ADR-07).
        "printRaw" -> {
            val bytes = call.argument<ByteArray>("bytes")!!
            service?.sendRAWData(bytes, null)
            result.success(true)
        }

        // 0 = normal · 1 = persiapan · 2 = kertas habis · 3 = terlalu panas · 4 = tutup terbuka
        "paperStatus" -> result.success(service?.updatePrinterState() ?: -1)

        else -> result.notImplemented()
    }
}
```

```dart
// core/printer/printer_registry.dart — pemilihan otomatis, kasir tidak pernah memilih transport
class PrinterRegistry {
  Future<PrinterKind> detectPreferred() async {
    final info = await DeviceInfoPlugin().androidInfo;
    final vendor = info.manufacturer.toLowerCase();

    // 1. Handheld dengan printer internal → SELALU menang. Tidak ada yang perlu di-pairing.
    if (vendor.contains('sunmi') || vendor.contains('imin')) {
      if (await _sunmi.isSupported()) return PrinterKind.sunmiInner;
    }
    // 2. Printer tersimpan dari sesi sebelumnya.
    final saved = _prefs.readPrinterTarget();
    if (saved != null) return saved.kind;
    // 3. Tidak ada — layar Pengaturan memandu pemasangan.
    return PrinterKind.btClassic;
  }
}
```

### 4.4 Android Lock Task Mode (Kiosk Pinning)

**Dua tingkat penguncian yang harus dibedakan dengan jujur:**

| Tingkat | Syarat | Kekuatan | Cara keluar |
|---|---|---|---|
| **Lock Task Mode penuh** | Aplikasi adalah **Device Owner** — di-*provision* saat perangkat masih pabrik (QR / NFC / `adb`) | **Kuat.** Tombol Home & Recents mati total, status bar tidak dapat ditarik, notifikasi diblokir, tidak ada dialog "keluar" | Hanya lewat `stopLockTask()` dari dalam aplikasi |
| **Screen Pinning** | Tidak perlu apa pun | **Lemah.** Android menampilkan toast "Layar disematkan"; menahan Back + Recents akan keluar | Gestur sistem, atau `stopLockTask()` |

> Aplikasi memanggil API yang **sama** (`startLockTask()`) untuk keduanya. Yang menentukan
> tingkat kekuatan adalah status Device Owner perangkat, bukan kode aplikasi. Untuk Kiosk
> pelanggan, **Device Owner wajib** — tanpa itu pelanggan yang iseng dapat keluar ke Home dalam
> tiga detik.

**Provisioning Device Owner** (dilakukan teknisi, sekali, saat perangkat baru / setelah *factory reset*):

```bash
# Jalur adb — untuk perangkat uji dan pemasangan skala kecil.
# Syarat: perangkat baru direset, TIDAK ADA akun Google yang ditambahkan.
adb shell dpm set-device-owner id.godinov.pos/.kiosk.GodinovDeviceAdminReceiver

# Untuk armada besar: gunakan QR provisioning dari layar sambutan Android
# (ketuk 6× pada layar "Selamat datang") dengan payload
# PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME + PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM.
```

```kotlin
// android/app/src/main/kotlin/id/godinov/pos/kiosk/KioskPlugin.kt
class KioskPlugin(private val activity: Activity) : MethodCallHandler {

    private val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val admin = ComponentName(activity, GodinovDeviceAdminReceiver::class.java)

    override fun onMethodCall(call: MethodCall, result: Result) = when (call.method) {

        "isDeviceOwner" -> result.success(dpm.isDeviceOwnerApp(activity.packageName))

        "enterKiosk" -> {
            if (dpm.isDeviceOwnerApp(activity.packageName)) {
                // Hanya paket ini yang boleh berjalan di Lock Task.
                dpm.setLockTaskPackages(admin, arrayOf(activity.packageName))

                // setLockTaskFeatures adalah daftar-IZIN, bukan daftar-tolak: fitur yang
                // TIDAK disebutkan otomatis mati. Karena LOCK_TASK_FEATURE_HOME dan
                // _OVERVIEW tidak disebut, tombol Home & Recents ikut mati. API 28+.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    dpm.setLockTaskFeatures(
                        admin,
                        DevicePolicyManager.LOCK_TASK_FEATURE_KEYGUARD or
                            DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS
                    )
                }
                // Cegah dialog pembaruan sistem menutupi layar saat jam operasional.
                dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "3")
            }
            activity.startLockTask()          // Device Owner → penuh · selain itu → pinning
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            result.success(dpm.isDeviceOwnerApp(activity.packageName))
        }

        "exitKiosk" -> {
            activity.stopLockTask()
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            result.success(true)
        }

        "isLocked" -> {
            val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            result.success(am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE)
        }

        else -> result.notImplemented()
    }
}
```

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Jaringan & sinkronisasi latar -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
    <uses-permission android:name="android.permission.WAKE_LOCK"/>

    <!-- Bluetooth Android 12+ (API 31+) — WAJIB diminta saat runtime -->
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation"/>
    <!-- Android ≤ 11 -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"
        android:maxSdkVersion="30"/>

    <application
        android:label="POS Godinov"
        android:allowBackup="false"          
        android:fullBackupContent="false"    
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:name=".MainActivity"
            android:launchMode="singleTop"
            android:screenOrientation="unspecified"   <!-- orientasi dikunci dari Dart, §3.2 -->
            android:configChanges="orientation|screenSize|keyboardHidden|density|smallestScreenSize|uiMode"
            android:exported="true"
            android:lockTaskMode="if_whitelisted">      <!-- kunci Kiosk -->

            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>

            <!-- Kiosk: aplikasi menjadi Home launcher agar tombol Home tidak
                 memindahkan pelanggan ke luar. Hanya aktif bila Device Owner. -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.HOME"/>
                <category android:name="android.intent.category.DEFAULT"/>
            </intent-filter>
        </activity>

        <receiver
            android:name=".kiosk.GodinovDeviceAdminReceiver"
            android:permission="android.permission.BIND_DEVICE_ADMIN"
            android:exported="true">
            <meta-data android:name="android.app.device_admin"
                       android:resource="@xml/device_admin_receiver"/>
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED"/>
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

> **`allowBackup="false"` bukan opsi.** Basis data lokal memuat `pin_hash` seluruh kasir
> ([03 §2.2](03-api-specifications.md)). Membiarkan Android Auto Backup menyalinnya ke Google
> Drive milik akun perangkat memindahkan seluruh permukaan serangan ke luar kendali outlet.

```dart
// core/kiosk/kiosk_service.dart
class KioskService {
  static const _ch = MethodChannel('id.godinov.pos/kiosk');

  Future<bool> get isDeviceOwner async =>
      await _ch.invokeMethod<bool>('isDeviceOwner') ?? false;

  /// Mengembalikan true bila penguncian PENUH aktif; false bila hanya screen pinning.
  Future<bool> enter() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await WakelockPlus.enable();
    return await _ch.invokeMethod<bool>('enterKiosk') ?? false;
  }

  Future<void> exit() async {
    await _ch.invokeMethod('exitKiosk');
    await WakelockPlus.disable();
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }
}
```

**Layar Pengaturan wajib menyatakan tingkat penguncian apa adanya** — jangan biarkan pemilik
mengira perangkat terkunci penuh padahal hanya ter-*pin*:

```text
┌──────────────────────────────────────────────────────────────┐
│  MODE KIOSK                                                  │
│  ⚠ Perangkat ini BUKAN Device Owner.                         │
│  Mode Kiosk hanya akan menyematkan layar (screen pinning).   │
│  Pelanggan masih dapat keluar dengan menahan tombol          │
│  Kembali + Recents.                                          │
│                                                              │
│  Untuk penguncian penuh, perangkat harus di-reset pabrik     │
│  dan dipasang ulang oleh teknisi.       [ Panduan Teknisi ]  │
└──────────────────────────────────────────────────────────────┘
```

### 4.5 Gerbang keluar Kiosk

Keluar dari Kiosk memakai **`PinVerifier` yang sama** dengan login kasir
([§5.3](#53-pin-verifier--bcrypt-di-background-isolate)) — tidak ada PIN kedua, tidak ada kode
master yang di-*hard-code*.

```dart
// core/kiosk/kiosk_guard.dart
class KioskGuard {
  static const _tapsRequired = 5;
  static const _tapWindow = Duration(seconds: 3);

  /// Dipasang pada logo di pojok layar Kiosk. Tidak ada tombol yang terlihat —
  /// pelanggan tidak boleh menemukan jalan keluar secara tidak sengaja.
  void registerTap() { /* hitung ketukan dalam _tapWindow */ }

  Future<bool> attemptExit(BuildContext context) async {
    final pin = await showDialog<String>(context: context, builder: (_) => const PinDialog());
    if (pin == null) return false;

    final session = await _pinVerifier.verify(staffIdentifier: _lastStaffId, pin: pin);
    if (session == null) return false;               // pesan disamakan: "ID atau PIN salah"

    await _kiosk.exit();
    return true;
  }
}
```

### 4.6 Perangkat keras pendukung lainnya

| Perangkat | Integrasi | Catatan |
|---|---|---|
| **Pemindai barcode** | Mayoritas beroperasi sebagai **keyboard HID** — `RawKeyboardListener` global mendeteksi ketikan cepat (< 30 ms antar-karakter) diakhiri `Enter` | ⚠️ **Pemetaan barcode → produk belum mungkin**: tabel `products` tidak punya kolom `barcode`/`sku` ([03 §6](03-api-specifications.md)). Deteksi boleh dibangun; pemetaan menunggu keputusan ([§11](#11-butir-terbuka) butir 4) |
| **Laci kas (cash drawer)** | Perintah ESC/POS `DLE DC4` lewat port RJ11 printer — sudah termasuk di `buildReceipt()` | Hanya terbuka untuk transaksi `CASH` |
| **Pemindai internal handheld** | Sunmi/iMin mengirim hasil pindaian sebagai *broadcast* Intent | Ditangkap `BroadcastReceiver` → EventChannel |
| **NFC / kartu member** | ❌ **Di luar lingkup** | Tidak ada tabel pelanggan di skema ([02](02-database-schema.md)) |
| **Payment terminal / EDC** | ❌ **Di luar lingkup** | Tidak ada payment gateway di backend ([03 §14](03-api-specifications.md)). `QRIS`/`DEBIT` dicatat manual oleh kasir |

**Izin runtime Android 12+** — wajib diminta sebelum operasi printer pertama, bukan saat start:

```dart
// Tanpa ini, adapter gagal dengan SecurityException yang menyesatkan.
Future<bool> ensureBluetoothPermissions() async {
  if ((await DeviceInfoPlugin().androidInfo).version.sdkInt >= 31) {
    final r = await [Permission.bluetoothConnect, Permission.bluetoothScan].request();
    return r.values.every((s) => s.isGranted);
  }
  return (await Permission.location.request()).isGranted;   // Android ≤ 11
}
```

---

## 5. Offline Engine — Drift, Secure Storage, PIN

### 5.1 Skema Drift

Berbeda dari Dexie yang menyimpan `items` bersarang ([05 §1.5.1](05-frontend-architecture-design.md)),
Drift bersifat **relasional**: `transaction_items` adalah tabel tersendiri dengan foreign key.
Penyusunan ulang menjadi payload bersarang terjadi di `core/sync/wire_mapper.dart`.

```dart
// core/database/tables/transactions_table.dart
class Transactions extends Table {
  TextColumn get id => text()();                               // UUID v4 dibuat KLIEN
  TextColumn get shiftId => text().references(Shifts, #id)();
  TextColumn get customerName => text().withDefault(const Constant(''))();
  IntColumn  get totalAmount => integer()();                   // INTEGER SEN — ADR-05
  TextColumn get paymentMethod => textEnum<PaymentMethod>()();
  TextColumn get status => textEnum<TransactionStatus>()();    // COMPLETED | CANCELLED
  TextColumn get cancelNotes => text().withDefault(const Constant(''))();
  DateTimeColumn get clientCreatedAt => dateTime()();          // UTC

  // Kolom lokal — TIDAK PERNAH dikirim ke server ([05 §1.6.3] aturan 5)
  BoolColumn get synced => boolean().withDefault(const Constant(false))();
  TextColumn get syncError => text().nullable()();
  IntColumn  get syncAttempts => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastSyncAttemptAt => dateTime().nullable()();

  @override Set<Column> get primaryKey => {id};
}
```

```dart
// core/database/app_database.dart
@DriftDatabase(
  tables: [Staffs, Categories, Products, Shifts, Transactions,
           TransactionItems, Wastes, HeldCarts, SyncMeta, SyncLogs],
  daos: [MasterDao, ShiftDao, TransactionDao, WasteDao, SyncDao, HeldCartDao],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
          // Antrean sync selalu dibaca dengan filter+urutan ini. Tanpa indeks,
          // pembacaan antrean menjadi full scan setiap 5 menit.
          await customStatement(
            'CREATE INDEX idx_tx_queue ON transactions (synced, client_created_at)');
          await customStatement(
            'CREATE INDEX idx_tx_shift ON transactions (shift_id)');
          await customStatement(
            'CREATE INDEX idx_waste_queue ON wastes (synced, client_created_at)');
        },
        beforeOpen: (details) async {
          await customStatement('PRAGMA foreign_keys = ON');   // SQLite mematikannya secara bawaan
          await customStatement('PRAGMA journal_mode = WAL');  // baca & tulis bersamaan
        },
      );
}

Future<AppDatabase> openDatabase(SecureStorageService storage) async {
  final dir = await getApplicationDocumentsDirectory();
  final file = File(p.join(dir.path, 'posgodinov.db'));

  return AppDatabase(NativeDatabase.createInBackground(   // isolate terpisah — UI tidak terblokir
    file,
    // Aktifkan bersama sqlcipher_flutter_libs — lihat peringatan §1.4.
    // setup: (raw) => raw.execute("PRAGMA key = '${await storage.getOrCreateDatabaseKey()}'"),
  ));
}
```

> **Keunggulan Drift atas Dexie di sini:** `synced` adalah `BOOLEAN` sungguhan (IndexedDB memaksa
> `0 | 1`), indeks komposit dan foreign key ditegakkan mesin basis data, dan seluruh pembacaan
> antrean berjalan dalam satu transaksi ACID. `INSERT` transaksi + seluruh itemnya bersifat
> atomik — tidak ada lagi kemungkinan transaksi tersimpan tanpa item.

### 5.2 Secure storage — device token & kunci basis data

```dart
// core/storage/secure_storage_service.dart
class SecureStorageService {
  static const _kDeviceToken = 'device_token';
  static const _kDbKey       = 'db_encryption_key';
  static const _kOutletName  = 'outlet_name';

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,     // KeyStore-backed (AES-256-GCM)
      resetOnError: false,                  // JANGAN hapus diam-diam saat gagal baca —
                                            // itu akan membuang device_token yang tak dapat dipulihkan
    ),
  );

  /// device_token berumur ~10 tahun dan TIDAK DAPAT DICABUT ([03 §2.1]).
  /// Ini satu-satunya tempat yang layak menyimpannya — bukan tabel Drift,
  /// bukan SharedPreferences.
  Future<void> saveDeviceToken(String token) =>
      _storage.write(key: _kDeviceToken, value: token);

  Future<String?> readDeviceToken() => _storage.read(key: _kDeviceToken);

  /// Dipanggil HANYA saat server menolak token (401) atau saat teknisi
  /// memasang ulang perangkat. Menghapus token TIDAK menghapus data lokal —
  /// antrean penjualan harus selamat sampai binding ulang selesai.
  Future<void> clearDeviceToken() => _storage.delete(key: _kDeviceToken);

  Future<String> getOrCreateDatabaseKey() async {
    final existing = await _storage.read(key: _kDbKey);
    if (existing != null) return existing;
    final rnd = Random.secure();
    final key = base64UrlEncode(List<int>.generate(32, (_) => rnd.nextInt(256)));
    await _storage.write(key: _kDbKey, value: key);
    return key;
  }
}
```

**Penanganan `401` pada endpoint POS** — perangkat ditolak, bukan sekadar gangguan jaringan:

```dart
// core/network/interceptors/device_token_interceptor.dart
@override
void onError(DioException err, ErrorInterceptorHandler handler) {
  if (err.response?.statusCode == 401) {
    // Tidak ada refresh token untuk device token ([03 §2.1]) — tidak ada yang bisa dicoba ulang.
    // Perangkat harus di-binding ulang oleh teknisi.
    _deviceStatus.add(DeviceStatus.rejected);
    return handler.reject(DioException(
      requestOptions: err.requestOptions,
      error: const DeviceRejectedFailure(
        'Perangkat ditolak server. Hubungi teknisi untuk memasang ulang perangkat. '
        'Data penjualan Anda tetap tersimpan dan akan terkirim setelah pemasangan ulang.',
      ),
    ));
  }
  handler.next(err);
}
```

### 5.3 PIN Verifier — bcrypt di background isolate

Setara Web Worker pada Web POS (ADR-08). `BCrypt.checkpw` bersifat CPU-bound: 100–300 ms pada
tablet kelas menengah, hingga 600 ms pada handheld kelas bawah. Di isolate utama, UI membeku
persis pada momen kasir menekan "Masuk" — gejala yang akan dilaporkan sebagai "aplikasi hang".

```dart
// core/crypto/pin_verifier.dart

/// WAJIB top-level (atau static). `compute` mengirim referensi fungsi ke isolate baru;
/// closure dan method instance tidak dapat dikirim.
bool _comparePinIsolate(_PinPayload p) => BCrypt.checkpw(p.pin, p.hash);

class _PinPayload {
  const _PinPayload(this.pin, this.hash);
  final String pin;
  final String hash;
}

class PinVerifier {
  PinVerifier(this._staffDao);
  final MasterDao _staffDao;

  /// Hash umpan dengan cost yang sama seperti hash produksi. Dipakai agar durasi
  /// respons tidak membocorkan apakah `staff_identifier` ada atau tidak.
  static const _decoyHash = r'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  Future<CashierSession?> verify({
    required String staffIdentifier,
    required String pin,
  }) async {
    final staff = await _staffDao.findByIdentifier(staffIdentifier);
    final hash = staff?.pinHash ?? _decoyHash;

    final matched = await compute(
      _comparePinIsolate,
      _PinPayload(pin, hash),
      debugLabel: 'bcrypt-pin-compare',
    );

    // Pesan UI DISAMAKAN untuk kedua kegagalan: "ID atau PIN salah".
    if (!matched || staff == null) return null;

    return CashierSession(
      staffId: staff.id, name: staff.name, loginAt: DateTime.now().toUtc(),
    );
  }
}
```

**Tiga aturan UI login PIN** ([06 §3.6](06-ui-ux-design-system.md)):

1. Tombol `MASUK` **dinonaktifkan** selama verifikasi + spinner inline. Ketukan ganda tidak
   boleh memicu dua isolate.
2. Keypad 56 × 56 dp (`Touch.frequent`); `inputMode` tidak pernah memunculkan keyboard OS.
3. **Tidak ada tautan "Reset PIN"** — endpointnya tidak ada ([05 §3.5]). Teks yang ditampilkan:
   *"Lupa PIN? Hubungi pemilik untuk membuat ulang akun staff."*

> **Untuk mode Kiosk, `compute()` tetap pilihan yang benar.** Ia membuat & menghancurkan isolate
> tiap panggilan (~10–30 ms *overhead*), tetapi verifikasi PIN hanya terjadi beberapa kali per
> shift. Isolate pekerja permanen baru layak bila kelak ada operasi kriptografi per-transaksi.

---

## 6. Sync Engine & Rekonsiliasi Partial Success

Logika **identik** dengan [05 §1.6](05-frontend-architecture-design.md) — perbedaannya hanya pada
mekanisme mutex dan pemicu. Fase ini adalah tempat mayoritas bug akan muncul; [04 §C.6] menandainya
*"paling rawan salah — sediakan waktu ekstra"*.

### 6.1 Mesin sinkronisasi

```dart
// core/sync/sync_engine.dart
const _maxTransactionsPerBatch = 200;

class SyncEngine {
  final _lock = Lock();                     // pengganti Web Locks — satu proses, satu isolate UI

  Future<SyncOutcome> syncUp(SyncTrigger trigger) async {
    return _lock.synchronized(() async {
      if (DateTime.now().isBefore(await _syncDao.backoffUntil())) {
        return const SyncOutcome.skipped('backoff');
      }
      if (!await _connectivity.isOnline) return const SyncOutcome.skipped('offline');

      // ── 1. Ambil antrean, kronologis ────────────────────────────────────────
      final transactions =
          await _txDao.pendingTransactions(limit: _maxTransactionsPerBatch);
      final wastes = await _wasteDao.pending();

      // ── 2. ATURAN KRITIS: sertakan shift induk SETIAP transaksi dalam batch,
      //     walau shift itu sudah pernah ditandai tersinkron.
      //     transactions.shift_id memiliki FK ke shifts(id) ([02 §2.12]) dan
      //     backend memproses Shifts → Transactions → Wastes ([03 §2.3]).
      //     Kegagalan shift TIDAK dilaporkan per-ID, sehingga sebuah shift bisa
      //     saja tidak pernah tersimpan meski kita menandainya tersinkron.
      //     Mengirim ulang aman: upsert backend hanya menyentuh kolom penutupan.
      final unsynced = await _shiftDao.pending();
      final parentIds = transactions.map((t) => t.shiftId).toSet();
      final parents = await _shiftDao.byIds(parentIds);
      final shifts = {...unsynced, ...parents}.toList();   // dedup by id

      if (shifts.isEmpty && transactions.isEmpty && wastes.isEmpty) {
        return const SyncOutcome.skipped('empty');
      }

      // ── 3. Kirim ────────────────────────────────────────────────────────────
      final SyncUpResponse response;
      try {
        response = await _remote.syncUp(SyncUpRequest(
          shifts:       shifts.map(WireMapper.shift).toList(),
          transactions: transactions.map(WireMapper.transaction).toList(),
          wastes:       wastes.map(WireMapper.waste).toList(),   // ⚠️ kunci `wastes`
        ));
      } catch (e) {
        await _syncDao.recordFailure(e);      // menaikkan backoff
        rethrow;
      }

      // ── 4. Rekonsiliasi ─────────────────────────────────────────────────────
      final outcome = await _reconciler.reconcile(
        sent: (shifts: shifts, transactions: transactions, wastes: wastes),
        response: response,
      );
      await _syncDao.clearBackoff();
      await _syncDao.writeLog(trigger, response, outcome);
      return outcome;
    });
  }
}
```

### 6.2 `wire_mapper.dart` — tiga transformasi wajib

```dart
// core/sync/wire_mapper.dart
abstract final class WireMapper {
  static Map<String, dynamic> transaction(TransactionWithItems t) {
    // Jaring pengaman terakhir: nilai payment_method tak sah lebih baik menggagalkan
    // sync daripada mencemari laporan historis selamanya ([05 §3.3]).
    assert(PaymentMethod.values.contains(t.tx.paymentMethod));

    return {
      'id': t.tx.id,
      'shift_id': t.tx.shiftId,
      'customer_name': t.tx.customerName,
      'total_amount': Money.toMajor(t.tx.totalAmount),      // 1. sen → Rupiah desimal
      'payment_method': t.tx.paymentMethod.wireValue,
      'status': t.tx.status.wireValue,
      'cancel_notes': t.tx.cancelNotes,
      'client_created_at': t.tx.clientCreatedAt.toUtc().toIso8601String(),
      'items': t.items.map((i) => {
        'id': i.id,
        'transaction_id': i.transactionId,
        'product_id': i.productId,
        'quantity': i.quantity,
        'unit_price': Money.toMajor(i.unitPrice),
      }).toList(),
      // 2. Kolom lokal (synced, syncError, syncAttempts) TIDAK disalin.
      // 3. business_id / outlet_id TIDAK dikirim — backend menimpanya paksa
      //    dari device token ([03 §2.3]).
    };
  }
}
```

### 6.3 Rekonsiliasi — satu-satunya tempat data penjualan bisa hilang

**`200` tidak berarti semuanya berhasil** ([03 §2.3](03-api-specifications.md)).

```dart
// core/sync/reconciler.dart
Future<SyncOutcome> reconcile({required SentBatch sent, required SyncUpResponse response}) async {
  final failed = (response.failedTransactions ?? const <String>[]).toSet();
  final now = DateTime.now().toUtc();

  // Backend melaporkan kegagalan shift HANYA lewat selisih hitungan — `failed_shifts`
  // tidak ada. Bila jumlahnya tidak cocok, kita tidak tahu shift MANA yang gagal,
  // maka TIDAK SATU PUN boleh ditandai tersinkron.
  final allShiftsOk = response.shiftsSynced == sent.shifts.length;
  final allWastesOk = response.wastesSynced == sent.wastes.length;

  await _db.transaction(() async {
    for (final s in sent.shifts) {
      allShiftsOk
          ? await _shiftDao.markSynced(s.id)
          : await _shiftDao.markFailed(s.id, now,
              'Sebagian shift gagal tersimpan (${response.shiftsSynced}/${sent.shifts.length}). '
              'Transaksi pada shift ini akan ikut tertunda.');
    }

    for (final t in sent.transactions) {
      if (failed.contains(t.id)) {
        await _txDao.markFailed(t.id, now, 'Ditolak server saat sinkronisasi. Akan dicoba ulang.');
      } else if (allShiftsOk) {
        await _txDao.markSynced(t.id);
      } else {
        // Shift induk diragukan → JANGAN tandai tersinkron meski tidak muncul di
        // failed_transactions. Menandainya di sini adalah cara paling mudah
        // kehilangan data penjualan secara permanen.
        await _txDao.markFailed(t.id, now, 'Menunggu shift induk tersimpan di server.');
      }
    }

    for (final w in sent.wastes) {
      allWastesOk
          ? await _wasteDao.markSynced(w.id)
          : await _wasteDao.markFailed(w.id, now,
              'Sebagian waste gagal (${response.wastesSynced}/${sent.wastes.length}).');
    }
  });

  return SyncOutcome(
    ok: allShiftsOk && allWastesOk && failed.isEmpty,
    failedTransactionIds: failed.toList(),
    shiftsSynced: response.shiftsSynced,
    transactionsSynced: response.transactionsSynced,
    wastesSynced: response.wastesSynced,
  );
}
```

**Lima aturan yang tidak boleh dilanggar** ([05 §1.6.3](05-frontend-architecture-design.md)):

1. `200` **bukan** berarti sukses total — selalu periksa `failed_transactions`.
2. Kirim shift bersama transaksinya, **termasuk shift induk yang sudah tersinkron**.
3. **Jangan pernah meregenerasi UUID** saat mengirim ulang.
4. **Jangan menghapus data lokal** setelah sync — hanya tandai `synced = true`.
5. **Buang metadata lokal** sebelum mengirim.

### 6.4 Backoff & pemicu

```dart
// core/sync/backoff.dart
const _base = Duration(seconds: 5);
const _max  = Duration(minutes: 5);

Duration nextDelay(int consecutiveFailures) {
  final raw = _base * (1 << (consecutiveFailures - 1));
  final capped = raw > _max ? _max : raw;
  final jitter = (Random().nextDouble() * 2 - 1) * 0.2;      // ±20 %
  return capped * (1 + jitter);
}
```

> **Tidak ada batas percobaan.** Setelah sekian kegagalan, interval berhenti di 5 menit dan mesin
> **terus mencoba selamanya**. Baris yang berulang kali gagal dinaikkan ke P-13 sebagai peringatan
> yang terlihat, tetapi tidak pernah dibuang. Ini data keuangan; menyerah bukan pilihan.

| Pemicu | Implementasi Flutter | Catatan |
|---|---|---|
| Koneksi kembali | `connectivity_plus` `onConnectivityChanged` | Beri jeda 2 detik — koneksi sering "menyala" sebelum benar-benar dapat dipakai |
| Berkala (foreground) | `Timer.periodic(5 menit)` | Dihentikan saat `AppLifecycleState.paused` |
| **Latar (aplikasi tertutup)** | **`workmanager` — periodik 15 menit** | ✅ Keunggulan terbesar Flutter atas Web POS |
| Tutup shift | Dipanggil langsung dari P-12 | Momen paling penting — laci sudah dihitung |
| Manual | Tombol di P-13 | Selalu tersedia, **mengabaikan backoff** |
| Startup | Setelah DB terbuka | Menangkap antrean sesi sebelumnya |
| Kembali ke foreground | `AppLifecycleState.resumed` | Menangkap aplikasi yang lama di-*suspend* |

```dart
// core/sync/background_sync_worker.dart
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, _) async {
    // Isolate latar TIDAK mewarisi DI dari isolate UI — bangun ulang seluruhnya.
    WidgetsFlutterBinding.ensureInitialized();
    await configureDependencies();
    final outcome = await getIt<SyncEngine>().syncUp(SyncTrigger.background);
    return !outcome.shouldRetry;      // false → WorkManager menjadwalkan ulang
  });
}

// Didaftarkan SEKALI setelah binding berhasil:
await Workmanager().registerPeriodicTask(
  'pos-sync', 'pos-sync',
  frequency: const Duration(minutes: 15),               // minimum yang diizinkan Android
  constraints: Constraints(networkType: NetworkType.connected),
  existingWorkPolicy: ExistingWorkPolicy.keep,
  backoffPolicy: BackoffPolicy.exponential,
);
```

> **Inilah keunggulan Fase 2 yang paling berdampak operasional.** Batasan
> [05 §1.6.6](05-frontend-architecture-design.md) — *"sinkronisasi hanya berjalan saat aplikasi
> terbuka"* — hilang. Tablet yang tertinggal menyala di outlet akan menyinkronkan penjualan
> kemarin tanpa ada yang menyentuhnya.
>
> ⚠️ **Peringatan OEM.** Xiaomi, Oppo, Vivo, dan sebagian perangkat handheld POS membunuh
> WorkManager secara agresif lewat pengelola baterai bawaan. Layar Pengaturan **wajib** memuat
> tombol "Optimalkan Sinkronisasi Latar" yang membuka
> `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, disertai penjelasan singkat. Tanpa itu,
> sync latar akan bekerja di lab dan mati di outlet.

---

## 7. State Management — Peta Cubit

### 7.1 Peta lengkap

| Cubit | State | Lingkup | Cakupan hidup |
|---|---|---|---|
| `DeviceBindingCubit` | `idle / submitting / bound / failure` | P-01 | Sekali seumur pemasangan |
| `MasterSyncCubit` | `idle / downloading(progress) / done / failure` | P-02, P-14 | Per-panggilan |
| `CashierAuthCubit` | `loggedOut / verifying / loggedIn(session)` | P-03 | Global (aplikasi) |
| `ShiftCubit` | `noShift / open(shift) / closing / closed` | P-04, P-12 | Global |
| **`CartCubit`** | `CartState(lines, heldCartId, customerName)` | P-05, P-08 | Per-layar kasir |
| **`TransactionCubit`** | *state machine* — [§7.3](#73-transactioncubit--satu-satunya-state-machine-sejati) | P-06, P-07 | Per-transaksi |
| **`SyncCubit`** | `idle / syncing / partialFailure(ids) / failure` | P-13, StatusBar | Global |
| `PrinterCubit` | `unavailable / disconnected / ready / printing / outOfPaper / error` | Global | Global |
| `HistoryCubit` | `loading / local(list) / remote(list) / failure` | P-09, P-10 | Per-layar |
| `KioskCubit` | `disabled / welcome / browsing / cartReview / submitted` | Kiosk | Global |

**Pemisahan tiga wilayah yang tidak boleh dicampur** (permintaan eksplisit rancangan):

```text
CartCubit          → EPHEMERAL. Berubah tiap ketukan. Tidak pernah menyentuh DB.
TransactionCubit   → PERSISTENSI. Menulis ke Drift, memerintahkan cetak, memicu sync.
SyncCubit          → LATAR. Hidup lintas layar, tidak pernah dipengaruhi isi keranjang.
```

Menggabungkan `CartCubit` dan `SyncCubit` adalah cara termudah membuat keranjang kasir ter-*reset*
saat sinkronisasi gagal di latar — bug yang sangat mahal dan sangat sulit direproduksi.

### 7.2 `CartCubit` — turunan, bukan state tersimpan

```dart
@freezed
class CartState with _$CartState {
  const factory CartState({
    @Default([]) List<CartLine> lines,
    String? heldCartId,
    String? customerName,
  }) = _CartState;

  const CartState._();

  /// TURUNAN, bukan field. Tidak ada peluang menjadi tidak sinkron dengan `lines`.
  int get subtotalMinor => lines.fold(0, (s, l) => s + l.unitPriceMinor * l.quantity);
  int get totalMinor => subtotalMinor;    // tidak ada pajak/diskon di backend ([03 §14])
  int get itemCount => lines.fold(0, (s, l) => s + l.quantity);
  bool get isEmpty => lines.isEmpty;
}

class CartCubit extends Cubit<CartState> {
  CartCubit() : super(const CartState());

  void addProduct(Product p) {
    final idx = state.lines.indexWhere((l) => l.productId == p.id);
    if (idx >= 0) {
      final updated = [...state.lines];
      updated[idx] = updated[idx].copyWith(quantity: updated[idx].quantity + 1);
      emit(state.copyWith(lines: updated));
    } else {
      emit(state.copyWith(lines: [
        ...state.lines,
        CartLine(
          id: const Uuid().v4(),          // UUID item dibuat saat lahir, tidak pernah diganti
          productId: p.id,
          productName: p.name,            // hanya untuk tampilan & struk
          unitPriceMinor: p.priceMinor,   // SNAPSHOT harga saat ini
          quantity: 1,
        ),
      ]));
    }
  }
}
```

> **Harga di-*snapshot*.** Bila master data disinkronkan ulang di tengah transaksi dan harga
> produk berubah, keranjang yang sedang berjalan **tidak** ikut berubah. Pelanggan membayar harga
> yang ditunjukkan saat item ditambahkan.

### 7.3 `TransactionCubit` — satu-satunya state machine sejati

Transisi dibatasi *sealed class* agar keadaan mustahil tidak dapat direpresentasikan.

```dart
@freezed
sealed class TransactionState with _$TransactionState {
  const factory TransactionState.idle() = TxIdle;
  const factory TransactionState.selectingPayment({required int totalMinor}) = TxSelectingPayment;
  const factory TransactionState.confirming({
    required PaymentMethod method, required int totalMinor, required int cashReceivedMinor,
  }) = TxConfirming;
  const factory TransactionState.persisting() = TxPersisting;
  const factory TransactionState.printing({required LocalTransaction tx}) = TxPrinting;
  const factory TransactionState.completed({
    required LocalTransaction tx, required bool printOk,
  }) = TxCompleted;
  const factory TransactionState.failed({required String message}) = TxFailed;
}
```

```dart
Future<void> confirmPayment() async {
  final s = state;
  if (s is! TxConfirming) return;                  // transisi tidak sah — abaikan

  emit(const TransactionState.persisting());
  final tx = _buildTransaction(s);                 // UUID transaksi + tiap item, dibuat SEKALI

  // 1. PERSIST DULU. Uang sudah diterima; transaksi tidak boleh hilang karena
  //    printer bermasalah ([05 §1.6.5]).
  try {
    await _txDao.insertWithItems(tx);              // atomik: transaksi + items dalam satu tx DB
  } catch (e) {
    emit(TransactionState.failed(message: 'Gagal menyimpan transaksi: $e'));
    return;
  }

  // 2. Cetak — kegagalan TIDAK membatalkan transaksi.
  emit(TransactionState.printing(tx: tx));
  final printOk = await _printer.printReceipt(await buildReceipt(_toReceipt(tx)));

  // 3. Picu sync — fire-and-forget; antrean tetap aman bila gagal.
  unawaited(_syncEngine.syncUp(SyncTrigger.transaction));

  emit(TransactionState.completed(tx: tx, printOk: printOk));   // printOk=false → tawarkan "Cetak Ulang"
}
```

### 7.4 Aritmetika shift

Rumus [04 §A.3] — **server tidak menghitung ulang**, dan `discrepancy` inilah yang muncul di
dashboard pemilik ([02 §2.11](02-database-schema.md)):

```dart
// features/shift/domain/shift_math.dart — seluruhnya INTEGER SEN
int expectedBalance({required int openingBalanceMinor, required List<LocalTransaction> txs}) =>
    openingBalanceMinor +
    txs
        .where((t) => t.status == TransactionStatus.completed &&
                      CashMethods.contains(t.paymentMethod))   // HANYA CASH
        .fold(0, (s, t) => s + t.totalAmount);

int discrepancy({required int closingBalanceMinor, required int expectedBalanceMinor}) =>
    closingBalanceMinor - expectedBalanceMinor;
```

Layar P-12 menampilkan selisih dengan `MoneyText(..., signed: true)` dan
`tone: discrepancy < 0 ? danger : success`.

---

## 8. Peta Layar & Navigasi

| ID | Layar | Butuh internet | Endpoint | Catatan Flutter |
|---|---|---|---|---|
| **P-01** | Device Binding | ✅ Ya (1×) | `POST /v1/auth/device/bind` | Token → `flutter_secure_storage`. `200`, bukan `201` |
| **P-02** | Sync Master Data | ✅ Ya | `GET /v1/pos/sync/master-data` | `bulkPut`, **bukan** `clear()`. Normalisasi `null → []` |
| **P-03** | Login Kasir | ❌ Offline | *(lokal — bcrypt)* | `compute()` isolate; keypad 56 dp |
| **P-04** | Buka Shift | ❌ Offline | *(lokal)* | UUID shift dibuat di sini |
| **P-05** | Kasir Utama | ❌ Offline | *(lokal)* | Split 62/38 · **tanpa indikator stok apa pun** |
| **P-06** | Pembayaran | ❌ Offline | *(lokal)* | Numpad 56 dp, Fast-Cash 72 dp, tombol bayar 64 dp |
| **P-07** | Struk / Konfirmasi | ❌ Offline | *(lokal)* | Persist **sebelum** cetak; "Cetak Ulang" selalu ada |
| **P-08** | Pesanan Ditahan | ❌ Offline | *(lokal saja)* | Murni lokal — **tidak pernah** dikirim ke server |
| **P-09** | Riwayat Transaksi | ⚠️ Sebagian | `GET /v1/pos/transactions` | Tab "Sebelumnya": **maks. 50 baris selamanya** ([03 §2.4]) |
| **P-10** | Void Transaksi | ❌ Offline | *(lokal → sync)* | UUID **sama**, `status: CANCELLED`, `cancel_notes` wajib |
| **P-11** | Waste Produk | ❌ Offline | *(lokal → sync)* | Kunci payload `wastes`, **bukan** `product_wastes` |
| **P-12** | Tutup Shift | ❌ Offline | *(lokal)* | Memicu sync langsung setelah tersimpan |
| **P-13** | Status Sinkronisasi | ✅ Ya | `POST /v1/pos/sync` | Antrean, daftar gagal, sync manual (abaikan backoff) |
| **P-14** | Pengaturan | ⚠️ Sebagian | `GET /v1/pos/sync/master-data` | Printer, Kiosk, optimasi baterai, info perangkat |
| **K-01** | Kiosk — Sambutan | ❌ Offline | *(lokal)* | Idle 90 dtk → kembali ke sini |
| **K-02** | Kiosk — Katalog | ❌ Offline | *(lokal)* | Tile 240 × 260 dp, target 64 dp |
| **K-03** | Kiosk — Tinjau & Kirim | ❌ Offline | *(lokal)* | Menulis transaksi berstatus `COMPLETED` seperti kasir |

**Gerbang navigasi saat aplikasi start** (`bootstrap.dart`), berurutan:

```text
device_token ada?          ─ tidak ─▶ P-01 Binding
   │ ya
master data ada?           ─ tidak ─▶ P-02 Sync Master
   │ ya · umur > 12 jam ───────────▶ P-02 (otomatis, dapat dilewati bila offline)
sesi kasir aktif?          ─ tidak ─▶ P-03 Login Kasir
   │ ya
shift terbuka?             ─ tidak ─▶ P-04 Buka Shift
   │ ya
mode kiosk aktif?          ─ ya ───▶ K-01 Kiosk
   └ tidak ────────────────────────▶ P-05 Kasir Utama
```

> **Kebijakan sinkronisasi master data** ([04 §A.2]): saat binding, saat aplikasi dibuka bila
> berumur > 12 jam, dan lewat tombol manual di P-14. Tidak ada sinkronisasi inkremental
> (`updated_since` tidak ada di backend) — setiap panggilan menarik **seluruh** data. Jangan
> menjadwalkannya berkala.

---

## 9. Checklist Penyelarasan Backend ↔ Flutter

### 9.1 Amplop & koleksi `null`

Backend membangun slice dengan `append` ke variabel `nil`; outlet tanpa produk menghasilkan
`"products": null`, bukan `[]` ([03 §2.2](03-api-specifications.md)). Perbedaan ini **tidak
konsisten dan tidak dijamin** — tidak ada gunanya menghafal endpoint mana yang aman.

```dart
// core/network/envelope.dart — TITIK PENEGAKAN TUNGGAL
class Envelope<T> {
  static T data<T>(Response r, T Function(Map<String, dynamic>) fromJson) {
    final body = r.data as Map<String, dynamic>;
    if (body['status'] != 'success') throw ApiFailure(body['message'] as String? ?? 'Gagal');
    return fromJson(body['data'] as Map<String, dynamic>);
  }

  /// SATU-SATUNYA cara membaca koleksi. `null → []` dilakukan di sini, sekali.
  static List<T> list<T>(dynamic raw, T Function(Map<String, dynamic>) fromJson) =>
      (raw as List<dynamic>? ?? const [])
          .map((e) => fromJson(e as Map<String, dynamic>))
          .toList();
}
```

**Aturan:** tidak ada satu pun pemanggil yang boleh melakukan `as List` langsung. Terlewat satu
saja menghasilkan `type 'Null' is not a subtype of type 'List'` di outlet, bukan di lab.

### 9.2 Error `400` sebagai pesan utama

```dart
// core/network/interceptors/error_interceptor.dart
Failure mapError(DioException e) {
  final code = e.response?.statusCode;
  final message = (e.response?.data is Map)
      ? (e.response!.data['message'] as String? ?? 'Terjadi kesalahan')
      : 'Tidak dapat terhubung ke server';

  return switch (code) {
    // JANGAN bercabang pada 403/404 — backend tidak pernah mengembalikannya ([03 §0]).
    // Seluruh kegagalan bisnis datang sebagai 400 dengan message Bahasa Indonesia
    // yang sudah layak ditampilkan apa adanya.
    400 => ApiFailure(message),
    401 => const DeviceRejectedFailure(/* … §5.2 */),
    429 => ApiFailure(message),
    _   => (code != null && code >= 500)
        ? ServerFailure(message)            // layak dicoba ulang
        : NetworkFailure(message),          // offline / timeout — antrean tetap aman
  };
}
```

### 9.3 Kontrak beku `PAYMENT_METHODS`

`transactions.payment_method` adalah `VARCHAR(50)` bebas tanpa enum database
([02 §2.12](02-database-schema.md)). Backend menerima **string apa pun**. Salah ketik satu kali
memecah pengelompokan laporan **secara permanen** — tidak ada endpoint untuk memperbaiki data lama.

```dart
// core/config/constants.dart
//
// ⚠️ KONTRAK BEKU — WAJIB identik huruf demi huruf dengan
//    posgodinov-fe/lib/constants/payment.ts ([05 §3.3]).
//
// Mengubah, mengganti nama, atau menghapus salah satunya SETELAH produksi berjalan
// akan memecah seluruh laporan historis. Penambahan nilai baru harus disepakati
// lintas tim (Web, Flutter, Backend, Analitik) sebelum dirilis.
//
// Terakhir disepakati: [ISI TANGGAL] — [ISI NAMA PENYETUJU]
enum PaymentMethod {
  cash('CASH', 'Tunai'),
  qris('QRIS', 'QRIS'),
  debit('DEBIT', 'Kartu Debit'),
  transfer('TRANSFER', 'Transfer Bank');

  const PaymentMethod(this.wireValue, this.label);
  final String wireValue;      // nilai yang masuk ke kolom payment_method
  final String label;          // yang dibaca kasir
}

/// Hanya CASH yang memengaruhi expected_balance saat tutup shift ([04 §A.3]).
const cashMethods = {PaymentMethod.cash};
```

**Tiga penegakan yang harus ada bersamaan:**

1. **Tipe** — kolom Drift `textEnum<PaymentMethod>()`, bukan `text()`. Nilai lain ditolak saat kompilasi.
2. **Runtime** — `assert` di `WireMapper.transaction` ([§6.2](#62-wire_mapperdart--tiga-transformasi-wajib)).
3. **UI** — P-06 hanya merender `PaymentMethod.values.map(...)`. Tidak ada input teks bebas, tidak ada opsi "Lainnya".

Uji kontrak lintas platform ([05 §3.3](05-frontend-architecture-design.md)) berjalan **dari sisi
Web** dengan membaca berkas Dart ini. Cermin Dart-nya:

```dart
// test/contract/payment_methods_test.dart
test('daftar metode pembayaran Flutter dan Web identik', () {
  final ts = File('../posgodinov-fe/lib/constants/payment.ts').readAsStringSync();
  final web = RegExp(r"'([A-Z_]+)'").allMatches(
      RegExp(r'PAYMENT_METHODS = \[(.*?)\]', dotAll: true).firstMatch(ts)!.group(1)!,
  ).map((m) => m.group(1)).toSet();

  expect(PaymentMethod.values.map((e) => e.wireValue).toSet(), web);
});
```

### 9.4 Checklist lapisan API client

- [ ] Seluruh `/v1/pos/*` memakai **device token**; tidak ada access/refresh token di aplikasi ini
- [ ] `null → []` untuk **setiap** koleksi lewat `Envelope.list()` — tanpa pengecualian
- [ ] **Tidak** mengirim header `X-Tenant-ID` — backend tidak membacanya ([03 §0])
- [ ] **Tidak** mengirim `business_id` / `outlet_id` pada payload sync — backend menimpanya paksa
- [ ] Kunci payload `wastes`, **bukan** `product_wastes`
- [ ] Konversi uang di batas API: `toMinor` masuk, `toMajor` keluar
- [ ] Membuang seluruh kolom lokal (`synced`, `syncError`, `syncAttempts`, `lastSyncAttemptAt`) sebelum kirim
- [ ] `401` diperlakukan sebagai **penolakan perangkat**, bukan error jaringan yang dapat dicoba ulang
- [ ] Deteksi *clock skew* dari header `Date` setiap response; peringatan bila > 5 menit
- [ ] `client_created_at` dikirim UTC ISO-8601 dan **tidak pernah dikoreksi diam-diam** saat skew terdeteksi

### 9.5 Larangan UI yang wajib dipatuhi

Diturunkan dari endpoint yang **tidak ada** ([03 §14](03-api-specifications.md)):

| Larangan | Sebab |
|---|---|
| **Jangan** tampilkan stok / penanda "habis" di P-05 maupun Kiosk | Master data POS tidak memuat stok maupun BOM |
| **Jangan** sediakan fitur reset PIN kasir | Endpointnya tidak ada — kasir lupa PIN harus dihapus & dibuat ulang oleh pemilik |
| **Jangan** sediakan pengelolaan produk/kategori/staff dari aplikasi kasir | Seluruh `/v1/business/*` memerlukan access token yang tidak dimiliki perangkat POS |
| **Jangan** menjanjikan "unbind perangkat" | Tidak ada endpoint; perangkat hilang mempertahankan akses selamanya — nyatakan apa adanya di P-14 |
| P-09 tab "Sebelumnya" **wajib** memuat catatan batas 50 baris | Paginasi di-*hard-code* di backend |
| Sediakan **"Cetak Ulang"** di P-07 dan P-09 | Kegagalan cetak tidak pernah membatalkan transaksi |

---

## 10. Urutan Implementasi & Matriks Uji

| Fase | Cakupan | Berkas inti | Definisi selesai |
|---|---|---|---|
| **M1** | Fondasi: tema Godinov, `MoneyText`, `TouchButton`, breakpoint, DI, `import_lint` | `shared/theme/*`, `core/di/*` | `flutter analyze` + `import_lint` bersih; tidak ada hex di luar Lapis 1 |
| **M2** | Drift + secure storage + `Envelope` + Dio interceptor | `core/database/*`, `core/network/*` | DB terbuka, indeks terbentuk, `null → []` teruji unit |
| **M3** | P-01 binding · P-02 sync master · P-03 login PIN · P-04 buka shift | `features/device`, `auth`, `shift` | **Setelah binding, aplikasi terbuka penuh dalam mode pesawat** |
| **M4** | P-05 keranjang · P-06 bayar · P-07 struk · P-08 hold | `features/register` | Aritmetika integer sen eksak; UUID dibuat sekali |
| **M5** | **Sync engine + rekonsiliasi partial success** + P-13 | `core/sync/*` | Matriks uji di bawah **hijau seluruhnya** — sediakan waktu ekstra |
| **M6** | Printer: adapter, `PrinterManager`, ESC/POS, Sunmi inner | `core/printer/*` | Cetak berhasil di **printer SPP nyata**, bukan emulator |
| **M7** | P-09 riwayat · P-10 void · P-11 waste · P-12 tutup shift · P-14 pengaturan | `features/history`, `waste`, `shift` | Void terkirim `CANCELLED` dengan UUID sama |
| **M8** | WorkManager sync latar + optimasi baterai OEM | `core/sync/background_sync_worker.dart` | Sync berjalan dengan aplikasi tertutup di **perangkat target nyata** |
| **M9** | Mode Kiosk: Lock Task, K-01…K-03, gerbang keluar PIN | `core/kiosk/*`, `features/kiosk` | Device Owner terbukti; pelanggan tidak dapat keluar |
| **M10** | Pengerasan: SQLCipher (opsi A §1.4), audit token warna, aksesibilitas, uji kontrak | seluruh | Seluruh checklist [§9](#9-checklist-penyelarasan-backend--flutter) tercentang |

**Matriks uji wajib untuk M5** — fase tempat mayoritas bug akan muncul:

| Skenario | Hasil yang diharapkan |
|---|---|
| Perangkat offline 3 hari, lalu online | Seluruh antrean terkirim bertahap; tidak ada duplikasi |
| Transaksi dikirim ulang (UUID sama) | Backend idempotent; stok tidak terpotong dua kali |
| Shift gagal, transaksinya ikut dalam batch | **Tidak satu pun** transaksi ditandai tersinkron; P-13 memperingatkan |
| `failed_transactions` berisi sebagian ID | Hanya ID tersebut tetap di antrean; sisanya tertandai |
| Sync latar & sync foreground bersamaan | `Lock` mencegah pengiriman ganda |
| Void transaksi yang sudah tersinkron | Terkirim `CANCELLED`; server mengembalikan bahan baku |
| Void transaksi yang belum pernah tersinkron | Terkirim `CANCELLED`; stok tidak pernah terpotong |
| Batch > 200 transaksi | Terpecah menjadi beberapa pengiriman kronologis |
| Jaringan putus di tengah `POST /v1/pos/sync` | Backoff aktif; pengiriman ulang tidak menduplikasi |
| Jam perangkat digeser 1 jam | Peringatan skew muncul; `client_created_at` **tidak** dikoreksi diam-diam |
| Aplikasi dimatikan paksa saat menulis transaksi | Transaksi + items tersimpan utuh atau tidak sama sekali (ACID) |
| Printer mati saat konfirmasi bayar | Transaksi **tetap tersimpan**; UI menawarkan "Cetak Ulang" |
| `device_token` ditolak (`401`) | Pesan eksplisit "perangkat ditolak"; **antrean lokal tidak dihapus** |

---

## 11. Butir Terbuka

Butir-butir berikut **tidak diputuskan sepihak di dokumen ini**. Seluruh `[NEEDS DISCUSSION]` dari
01–06 tetap berlaku; berikut yang berdampak langsung pada `posgodinov-mobile`.

| # | Butir | Bagian | Mendesak? |
|---|---|---|---|
| 1 | **Enkripsi basis data lokal** — SQLCipher (opsi A) vs tanpa enkripsi (opsi B). `pin_hash` seluruh kasir ada di berkas DB | [§1.4](#14-penyimpangan-sadar-dari-05-22) | 🔴 Sebelum rilis produksi |
| 2 | **Provisioning Device Owner** untuk Kiosk. Tanpa itu, Kiosk hanya *screen pinning* yang mudah ditembus. Memerlukan prosedur teknisi + *factory reset* perangkat | [§4.4](#44-android-lock-task-mode-kiosk-pinning) | 🔴 Sebelum Kiosk dinyalakan di outlet |
| 3 | **Kiosk tanpa informasi stok.** Pelanggan dapat memesan produk yang bahan bakunya habis; penolakan terjadi saat penyerahan. Pemilik harus menyetujui konsekuensi operasional ini, atau backend harus memperluas payload master data | [§3.6](#36-aturan-tata-letak-khusus-kiosk), [03 §2.2](03-api-specifications.md) | 🔴 Sebelum Kiosk dinyalakan |
| 4 | **`PAYMENT_METHODS` belum disepakati formal.** Harus dikunci sebelum transaksi produksi pertama — mengganti nama nilai lama kelak tidak mungkin | [§9.3](#93-kontrak-beku-payment_methods) | 🔴 Sebelum transaksi produksi pertama |
| 5 | **Model printer nyata di outlet** — BLE vs SPP Classic vs internal handheld. Menentukan adapter mana yang harus diuji lapangan lebih dulu | [§4.1](#41-kontrak-printer--satu-antarmuka-empat-transport) | 🔴 Menentukan urutan M6 |
| 6 | **Pemetaan barcode → produk.** Tabel `products` tidak punya kolom `barcode`/`sku`. Solusi lokal per-perangkat tidak tersinkronisasi antar-perangkat dan hilang bila aplikasi dipasang ulang | [§4.6](#46-perangkat-keras-pendukung-lainnya) | 🟠 |
| 7 | **Pembunuhan WorkManager oleh OEM** (Xiaomi/Oppo/Vivo/handheld POS). Perlu daftar perangkat yang divalidasi + prosedur pengecualian baterai saat pemasangan | [§6.4](#64-backoff--pemicu) | 🟠 |
| 8 | **Tidak ada endpoint *unbind*.** Perangkat hilang mempertahankan akses sinkronisasi selamanya. Tidak ada mitigasi yang dapat dilakukan dari sisi Flutter | [03 §2.1](03-api-specifications.md) | 🟠 Tidak dapat diselesaikan klien |
| 9 | **`pin_hash` didistribusikan ke perangkat.** PIN 4–6 digit dapat di-*brute force* offline dalam hitungan menit bila DB terekspos. Perlu *pepper* sisi server | [01 §4.5](01-architecture-overview.md) | 🟠 Tidak dapat diselesaikan klien |
| 10 | **Batas 50 transaksi** pada `GET /v1/pos/transactions`. Perbaikan backend ±6 baris akan membuka `?limit=`/`?offset=` | [03 §2.4](03-api-specifications.md) | 🟡 |

### Ringkasan keputusan

| Aspek | Web POS (PWA) | **Flutter Mobile (dokumen ini)** |
|---|---|---|
| Basis data offline | Dexie / IndexedDB, tanpa enkripsi | **Drift / SQLite** (+ SQLCipher, opsi A §1.4) |
| Penyimpanan `device_token` | Dexie `meta` | **Android KeyStore** (`flutter_secure_storage`) |
| Verifikasi PIN | `bcryptjs` di Web Worker | **`bcrypt` di background isolate** (`compute()`) |
| Mutex sync | Web Locks API (lintas tab) | **`Lock` (`synchronized`)** — satu proses |
| Sinkronisasi latar | ❌ Hanya saat aplikasi terbuka | ✅ **WorkManager**, aplikasi boleh tertutup |
| Cetak Bluetooth | Web Bluetooth (BLE saja) | ✅ **BLE + SPP Classic + USB + internal handheld** |
| Cetak LAN | ⚠️ Terhalang *mixed content* / PNA | ✅ **Soket TCP `:9100`** |
| Mode Kiosk | ❌ Tidak mungkin | ✅ **Lock Task Mode** (Device Owner) |
| Uang | Integer sen (ADR-05) | **Integer sen — identik** |
| Sumber kebenaran POS | IndexedDB | **SQLite** |
| Rekonsiliasi sync | [05 §1.6.3] | **Identik, baris demi baris** ([§6.3](#63-rekonsiliasi--satu-satunya-tempat-data-penjualan-bisa-hilang)) |
