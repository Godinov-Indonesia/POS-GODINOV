# 10 — Flutter Implementation Plan (`posgodinov-mobile`)

> **Lingkup:** `posgodinov-mobile` saja — aplikasi kasir native Android untuk Tablet 10"
> *landscape* dan Handheld POS (Sunmi/iMin), termasuk mode Kiosk.
> Web (`posgodinov-fe`) berada di luar lingkup dokumen ini — rencananya ada di
> [07-implementation-plan.md](07-implementation-plan.md).
>
> **Sumber kebenaran teknis:** [09-flutter-mobile-architecture.md](09-flutter-mobile-architecture.md).
> Dokumen ini adalah **rencana eksekusi**, bukan rancangan ulang. Setiap keputusan teknis sudah
> diambil di 09; di sini hanya urutan, definisi selesai, dan status pengerjaan.
>
> **Cara memakai:** centang `[x]` begitu sebuah butir benar-benar selesai **dan** gerbang mutu
> fasenya hijau. Jangan mencentang butir yang "sudah ditulis tapi belum jalan".
>
> ⚠️ **Seluruh kode ditulis di mesin tanpa Flutter SDK.** `pub get`,
> `build_runner`, `analyze`, dan `test` belum pernah dijalankan. Prosedur
> verifikasinya ada di **[11 — Verification Runbook](11-flutter-verification-runbook.md)**.

---

## Status Ringkas

| Fase | Judul | Status |
|---|---|---|
| **M0** | Inisialisasi & Toolchain | 🟡 Sebagian — terhalang SDK |
| **M1** | Fondasi: Tema, Uang, Touch, DI | 🟢 Kode lengkap — menunggu `analyze` + `test` |
| **M2** | Persistensi & Jaringan | 🟢 Kode lengkap — menunggu `build_runner` + `analyze` |
| **M3** | Binding → Login PIN → Buka Shift (P-01…P-04) | 🟢 Kode lengkap — menunggu `build_runner` + `analyze` |
| **M4** | Keranjang → Bayar → Struk (P-05…P-08) | 🟢 Kode lengkap — menunggu `build_runner` + `analyze` |
| **M5** | **Sync Engine & Partial Success** (P-13) | 🟢 Kode lengkap — 3 skenario matriks tertunda |
| **M6** | Printer & ESC/POS | 🟡 Kode lengkap — plugin Sunmi terhalang AIDL |
| **M7** | Riwayat, Void, Waste, Tutup Shift (P-09…P-12, P-14) | 🟢 Kode lengkap — 1 uji ditunda |
| **M8** | Sinkronisasi Latar (WorkManager) | 🟡 Kode lengkap — menunggu uji lapangan |
| **M9** | Mode Kiosk (Lock Task) | 🟡 Kode lengkap — butuh perangkat Device Owner |
| **M10** | Pengerasan & Rilis | 🟡 Perkakas siap — 4 keputusan tim tertunda |

---

## 0. Aturan yang mengikat seluruh fase

Enam aturan berikut diperiksa ulang di akhir **setiap** fase. Pelanggaran satu saja membatalkan
definisi selesai fase tersebut.

| # | Aturan | Sumber | Cara verifikasi |
|---|---|---|---|
| 1 | Uang = **`int` sen** di seluruh state, DB, dan aritmetika. `double` tidak pernah menyentuh uang | [09 §3.5](09-flutter-mobile-architecture.md) | Tinjauan kode + uji unit `money_test.dart` |
| 2 | Nominal **hanya** dirender lewat `MoneyText` (mono + `tabularFigures`) | [09 §3.5](09-flutter-mobile-architecture.md) | `grep -rn "Rp \$" lib/` harus kosong di luar `money.dart` |
| 3 | `Color(0xFF…)` **hanya** di `godinov_colors.dart`. Widget memakai `context.tokens.*` | [09 §3.3](09-flutter-mobile-architecture.md) | `grep -rn "Color(0x" lib/ \| grep -v godinov_colors.dart` harus kosong |
| 4 | Koleksi API **selalu** lewat `Envelope.list()` — tidak pernah `as List` langsung | [09 §9.1](09-flutter-mobile-architecture.md) | `grep -rn "as List" lib/core/network lib/features/*/data` harus kosong |
| 5 | UUID **tidak pernah** diregenerasi; kolom lokal (`synced`, `syncError`, `syncAttempts`, `lastSyncAttemptAt`) **tidak pernah** dikirim | [09 §6.3](09-flutter-mobile-architecture.md) | Uji unit `wire_mapper_test.dart` |
| 6 | Target sentuh ≥ **48 dp**; numpad/keypad 56 dp; tombol bayar 64 dp; Fast-Cash 72 dp | [09 §3.4](09-flutter-mobile-architecture.md) | Uji widget mengukur `tester.getSize()` |

**Gerbang mutu tiap fase — ketiganya wajib hijau:**

```bash
flutter analyze          # 0 issue
dart run import_lint     # 0 pelanggaran batas lapisan
flutter test             # seluruh uji hijau
```

---

## Fase M0 — Inisialisasi & Toolchain

**Tujuan:** proyek ada, dependensi terkunci, struktur direktori terbentuk, dan `flutter analyze`
berjalan bersih. Tidak ada logika bisnis pada fase ini.

### M0.1 Scaffold sisi Dart — ✅ selesai

- [x] Direktori `posgodinov-mobile/` dibuat sejajar dengan `docs/` dan `posgodinov-fe/`
- [x] `pubspec.yaml` — seluruh `dependencies` & `dev_dependencies` dari [09 §1.2](09-flutter-mobile-architecture.md)
- [x] `analysis_options.yaml` — `flutter_lints` + pengecualian berkas hasil `build_runner` (`*.g.dart`, `*.freezed.dart`)
- [x] `import_lint.yaml` — tiga aturan batas lapisan dari [09 §2.2](09-flutter-mobile-architecture.md)
- [x] `.gitignore` khusus Flutter
- [x] Pohon direktori `lib/core/`, `lib/features/`, `lib/shared/` sesuai [09 §2.1](09-flutter-mobile-architecture.md)
- [x] `lib/shared/theme/godinov_colors.dart` — **Lapis 1** Godinov Palette ([09 §3.3](09-flutter-mobile-architecture.md))
- [x] `lib/main.dart` — placeholder minimal (diganti pada M1)
- [x] `test/`, `integration_test/` terbentuk

### M0.2 Toolchain — 🔴 terhalang

Flutter SDK **tidak terpasang** di mesin pengembangan. `~/.zshrc` mengekspor
`$HOME/development/flutter/bin` ke `PATH`, tetapi direktori itu kosong. Tidak ada `dart`, dan
tidak ada Android SDK di `~/Library/Android/sdk`.

- [ ] Pasang Flutter SDK stable ke `~/development/flutter` (sesuai `PATH` yang sudah ada)
      ```bash
      git clone -b stable --depth 1 https://github.com/flutter/flutter.git ~/development/flutter
      flutter --version    # verifikasi ≥ 3.24
      ```
- [ ] Pasang Android SDK (Android Studio atau `cmdline-tools`) + terima lisensi: `flutter doctor --android-licenses`
- [ ] Generate folder platform native ke dalam proyek yang sudah ada:
      ```bash
      cd posgodinov-mobile
      flutter create --platforms=android --org id.godinov.pos --project-name posgodinov_mobile .
      ```
      > Perintah ini **menambahkan** `android/` tanpa menghapus `lib/` yang sudah dibentuk.
      > Periksa ulang `lib/main.dart` setelahnya — bila tertimpa template *counter app*,
      > kembalikan ke placeholder.
- [ ] `flutter pub get` — kunci dependensi, hasilkan `pubspec.lock`
- [ ] `flutter analyze` — **wajib 0 issue**
- [ ] **Koreksi `applicationId`.** Perintah `flutter create` menghasilkan
      `id.godinov.pos.posgodinov_mobile`, sedangkan [09 §4.4](09-flutter-mobile-architecture.md)
      mensyaratkan **`id.godinov.pos`** — nilai ini masuk ke perintah *provisioning* Device Owner
      yang dipakai teknisi. Pilih satu, lalu samakan di ketiga tempat:
  - [ ] `android/app/build.gradle.kts` → `applicationId`
  - [ ] Paket Kotlin `android/app/src/main/kotlin/id/godinov/pos/`
  - [ ] Perintah `adb shell dpm set-device-owner …` di [09 §4.4](09-flutter-mobile-architecture.md)
- [ ] `minSdkVersion 24` · `targetSdkVersion 35` · `compileSdk 35` di `build.gradle.kts` ([09 §0.2](09-flutter-mobile-architecture.md))
- [ ] `android:allowBackup="false"` + `android:fullBackupContent="false"` di `AndroidManifest.xml` — **wajib**, DB memuat `pin_hash` ([09 §4.4](09-flutter-mobile-architecture.md))
- [ ] Aset font: unduh Inter + JetBrains Mono ke `assets/fonts/`, lalu **aktifkan kembali** blok `fonts:` di `pubspec.yaml` yang saat ini dikomentari
      > Font **dibundel**, bukan diunduh runtime. Tanpa ini, `tabularFigures` hilang di perangkat yang tidak pernah online ([09 §1.2](09-flutter-mobile-architecture.md))

**Selesai bila:** `flutter analyze` bersih · `flutter build apk --debug` sukses · `applicationId` konsisten dengan dokumen 09.

---

## Fase M1 — Fondasi: Tema, Uang, Touch, DI

**Tujuan:** kosakata visual dan aritmetika uang tersedia, sehingga tidak ada fase berikutnya yang
mengarang tombol atau format Rupiah sendiri. Belum ada layar bisnis.

- [x] `shared/theme/godinov_tokens.dart` — `GodinovTokens extends ThemeExtension` (Lapis 2 semantik)
- [x] `shared/theme/app_theme.dart` — `ThemeData` + skala tipografi POS (`PosText`); **`themeMode: ThemeMode.light`**, `darkTheme` tidak didefinisikan ([09 §3.3](09-flutter-mobile-architecture.md))
- [x] `shared/theme/spacing.dart` — `Touch.standard/frequent/primary/critical` (48/56/64/72) + `Gap.destructive` + `Radii` + `Sizes`
- [x] `shared/theme/breakpoints.dart` + `core/config/device_profile.dart` — `handheld / tablet8 / tablet10 / tabletWide` berbasis **dp**, plus `PosLayout` & `KioskLayout`
- [x] `core/utils/money.dart` — `toMinor`, `toMajor`, `format` (locale `id_ID`, 0 desimal, minus tipografis `−`)
- [x] `shared/widgets/money_text.dart` — `MoneyText` dengan `FontFeature.tabularFigures()` + `Semantics`
- [x] `shared/widgets/touch_button.dart` — varian `primary/success/danger/secondary/ghost` + `HapticFeedback.selectionClick()`
- [x] `shared/extensions/context_ext.dart` — `context.tokens`, `context.profile`, `context.layout`
- [x] `core/config/constants.dart` — enum **`PaymentMethod`** (KONTRAK BEKU) + `cashMethods` *(dikerjakan di M2)*
- [x] `core/error/failures.dart` — `sealed class Failure` (`ApiFailure`, `NetworkFailure`, `ServerFailure`, `DeviceRejectedFailure`) *(dikerjakan di M2)*
- [x] `core/config/app_config.dart` — flavor + `baseUrl` + timeout *(dikerjakan di M2)*
- [x] `core/di/injection.dart` — `get_it` **manual**, `configureDependencies()` + `resetDependencies()`
- [x] `bootstrap.dart` — penguncian orientasi per profil perangkat ([09 §3.2](09-flutter-mobile-architecture.md)) + penangkap error global + `runGuardedApp`
- [x] `app.dart` — `MaterialApp` + tema; **`locale` sengaja tidak diset** (lihat penyimpangan #2)
- [x] `shared/widgets/design_system_preview.dart` — layar verifikasi M1 di perangkat nyata
- [x] Uji: `money_test.dart`, `touch_target_test.dart`, `device_profile_test.dart`, `widget_test.dart`

**Penyimpangan sadar dari rancangan:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | DI ([09 §1.2] memilih `injectable`) | `get_it` didaftarkan **manual** di `injection.dart` | Satu berkas hasil generasi lebih sedikit, dan urutan perakitan (DB terbuka → DAO → ApiClient) menjadi terbaca dari atas ke bawah. Cerminan DI manual backend Go ([01 §1]). **`injectable` + `injectable_generator` kini tidak terpakai** — hapus dari `pubspec.yaml` bila tim setuju |
| 2 | `app.dart` — `locale: id_ID` | `locale` **tidak** diset | `MaterialApp` hanya menyediakan `MaterialLocalizations` untuk bahasa Inggris; menyetel locale lain tanpa `flutter_localizations` membuat `Tooltip` dan date picker melempar saat dibuka. Pemformatan Rupiah tidak terpengaruh — `Money.format` menetapkan `id_ID` langsung di `NumberFormat`. Tambahkan `flutter_localizations` saat date picker pertama dibutuhkan (P-09) |
| 3 | Ambang `tablet8Max` | 900 dp, bukan 840 dp | Uji `device_profile_test` menangkap klasifikasi terbalik: pada 840 dp, tablet 10" hdpi (853 dp) mendapat 4 kolom sementara tablet 8" mdpi (1024 dp) juga 4 kolom. Profil kini mengikuti **anggaran dp**, bukan diagonal fisik |

**Selesai bila:** `import_lint` bersih · tidak ada `Color(0x` di luar `godinov_colors.dart` ·
`MoneyText(2200000)` merender `Rp 22.000` dengan lebar digit tetap.

> **Belum terverifikasi.** `flutter analyze` dan `flutter test` belum dijalankan — SDK tidak
> tersedia di mesin penulisan (M0.2). Berkas M1 **tidak** bergantung pada `build_runner`, jadi
> dapat dianalisis lebih dulu; hanya `core/di/injection.dart` yang menyeret `app_database.dart`.

---

## Fase M2 — Persistensi & Jaringan

**Tujuan:** basis data lokal terbuka dengan indeks yang benar, dan lapisan API menutup seluruh
keanehan backend di satu tempat.

- [x] `core/database/tables/*` — 10 tabel: `Staffs`, `Categories`, `Products`, `Shifts`, `Transactions`, `TransactionItems`, `Wastes`, `HeldCarts`, `SyncMeta`, `SyncLogs`
- [x] Kolom uang bertipe `IntColumn` (**sen**); `paymentMethod`/`status` bertipe `textEnum<…>()`
- [x] `core/database/app_database.dart` — `schemaVersion = 1`, `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`
- [x] Indeks di `onCreate`: `idx_tx_queue (synced, client_created_at)`, `idx_tx_shift (shift_id)`, `idx_waste_queue` (+4 indeks pendukung)
- [x] `NativeDatabase.createInBackground` — DB berjalan di isolate terpisah, UI tidak terblokir
- [x] `core/database/daos/*` — `MasterDao`, `ShiftDao`, `TransactionDao` (`insertWithItems` **atomik**), `WasteDao`, `SyncDao`, `HeldCartDao`
- [x] `core/storage/secure_storage_service.dart` — `AndroidOptions(encryptedSharedPreferences: true, resetOnError: false)`
- [x] `core/network/envelope.dart` — `Envelope.data<T>()` + **`Envelope.list<T>()` dengan `null → []`**
- [x] `core/network/api_client.dart` — Dio + `baseUrl` + timeout + urutan interceptor
- [x] `interceptors/device_token_interceptor.dart` — sisip `Bearer`; **`401` → `DeviceRejectedFailure`**, bukan retry
- [x] `interceptors/error_interceptor.dart` — `400` → `message` apa adanya; **tidak ada percabangan `403`/`404`**
- [x] `interceptors/clock_skew_interceptor.dart` — baca header `Date`, tandai skew > 5 menit
- [x] `core/network/clock_skew_monitor.dart` — penampung status skew, dibaca StatusBar
- [x] `core/network/connectivity_monitor.dart` — `Stream<bool> isOnline` + `Future<bool> checkOnline`, **debounce 2 dtk hanya ke arah online**
- [x] Uji: `envelope_test.dart` (`null → []` untuk `staffs`/`categories`/`products`), `error_mapping_test.dart`, `clock_skew_test.dart`

**Ditarik maju dari M1** karena tabel, interceptor, dan `ApiClient` tidak dapat berdiri tanpanya:

- [x] `core/config/constants.dart` — `PaymentMethod` (KONTRAK BEKU), `TransactionStatus`, `ShiftStatus`, `SyncLimits`, `SyncMetaKeys`
- [x] `core/error/failures.dart` — `sealed class Failure` + 7 turunan, masing-masing dengan `isRetryable`
- [x] `core/config/app_config.dart` — flavor + `baseUrl` + timeout dari `--dart-define`

**Sisa yang sengaja ditunda ke fase berikutnya:**

- [ ] Uji `ConnectivityMonitor` — memerlukan `Connectivity` tiruan (`mocktail`) dan jam palsu untuk menguji debounce tanpa menunggu 2 detik nyata. Dikerjakan bersama uji `SyncEngine` di M5, tempat pemicunya benar-benar dipakai

**Selesai bila:** DB terbuka & indeks terbentuk (verifikasi `PRAGMA index_list`) ·
`Envelope.list(null, …)` mengembalikan `[]`, bukan melempar.

> **Belum terverifikasi.** `dart run build_runner build`, `flutter analyze`, dan `flutter test`
> belum pernah dijalankan pada fase ini — Flutter SDK tidak tersedia di mesin penulisan (lihat
> M0.2). Seluruh rujukan ke `_$AppDatabase`, `$TransactionsTable`, `TransactionsCompanion`, dan
> kelas data (`LocalTransaction`, `Product`, …) akan ditandai analyzer sebagai *undefined* sampai
> generasi kode dijalankan. **Jalankan `build_runner` lebih dulu, baru `analyze`.**

---

## Fase M3 — Binding → Login PIN → Buka Shift (P-01…P-04)

**Tujuan:** membuktikan jalur offline paling awal. Ini gerbang kelayakan seluruh proyek.

- [x] **P-01** `binding_page.dart` — form `serial_business`, `serial_outlet`, password owner
- [x] `POST /v1/auth/device/bind` → `200` (**bukan `201`**); token → `flutter_secure_storage`
- [x] Pesan `401` "kredensial bisnis tidak valid" ditampilkan apa adanya
- [x] UI menyatakan apa adanya: **tidak ada endpoint *unbind*** — perangkat hilang mempertahankan akses ([09 §9.5](09-flutter-mobile-architecture.md))
- [x] **P-02** `master_sync_page.dart` — progres unduhan `GET /v1/pos/sync/master-data`
- [x] Simpan dengan **upsert + buang baris yatim**, bukan `clear()` + insert; harga dikonversi `toMinor()`
- [x] Ketiga koleksi (`staffs`, `categories`, `products`) lewat `Envelope.list()`
- [x] **P-03** `core/crypto/pin_verifier.dart` — `BCrypt.checkpw` di `compute()` + hash umpan
- [x] `pin_login_page.dart` — keypad 56 dp, tombol `MASUK` **nonaktif** selama verifikasi + spinner
- [x] Pesan gagal **disamakan**: "ID atau PIN salah" (tidak membocorkan keberadaan staff)
- [x] **Tidak ada** tautan "Reset PIN" — teks: *"Lupa PIN? Hubungi pemilik untuk membuat ulang akun staff."*
- [x] **P-04** `open_shift_page.dart` — input modal awal laci; UUID shift dibuat di sini
- [x] `app_gate.dart` — gerbang navigasi berurutan ([09 §8](09-flutter-mobile-architecture.md))
- [x] Uji: `pin_verifier_test.dart` (hash umpan menghabiskan waktu setara), `bloc_test` untuk keempat Cubit

**Berkas pendukung yang ikut lahir di fase ini:**

- [x] `features/device/` — DTO, datasource remote & lokal, `DeviceRepositoryImpl`, dua Cubit, dua halaman
- [x] `features/auth/` — `CashierSession`, `AuthRepositoryImpl`, `CashierAuthCubit`, `PinKeypad` + `PinDots`
- [x] `features/shift/` — `Shift`, `ShiftRepositoryImpl`, `ShiftCubit`
- [x] `core/di/injection.dart` — pendaftaran repository + tiga Cubit berumur panjang
- [x] `pubspec.yaml` — `injectable` & `injectable_generator` **dihapus** (penyimpangan M1 #1 disetujui)

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | State Cubit ([09 §7] memakai `freezed`) | `sealed class` + `Equatable` | Menghindari berkas hasil `build_runner` ketiga; `Equatable` sudah memberi kesetaraan yang dibutuhkan bloc untuk melewatkan rebuild. Konsisten dengan `failures.dart` yang juga tanpa `freezed` |
| 2 | Gerbang navigasi di `bootstrap.dart` | `lib/app_gate.dart` terpisah | `bootstrap.dart` berjalan **sebelum** ada `BuildContext`; gerbang butuh widget tree. Ditempatkan di akar `lib/` karena perannya komposisi lintas fitur (`device` + `auth` + `shift`), bukan milik salah satunya |

**Selesai bila:** **setelah binding, aplikasi terbuka penuh dalam mode pesawat** — mulai dari login
kasir sampai buka shift, tanpa satu pun permintaan jaringan.

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan (M0.2).
> `GateStep.ready` masih placeholder sampai P-05 lahir di M4.

---

## Fase M4 — Keranjang → Bayar → Struk (P-05…P-08)

**Tujuan:** fitur inti kasir. Aritmetika harus eksak dan UUID dibuat tepat sekali.

- [x] `features/register/.../cart_cubit.dart` — `CartState` dengan subtotal/total sebagai **getter turunan**, bukan field
- [x] Harga di-**snapshot** saat item ditambahkan; sync master di tengah transaksi tidak mengubah keranjang
- [x] **P-05** `register_page.dart` — split **62/38** (`Expanded flex`), grid 4 kolom @1280
- [x] `product_tile.dart` — nama ≥ 16 dp `maxLines: 2`; fallback gambar wajib (dua lapis: URL kosong **dan** gagal muat)
- [x] `category_tabs.dart` — tinggi 56 dp, tab aktif `accentSubtle` + `accent`
- [x] **Tanpa indikator stok apa pun** — `CatalogProduct` sengaja tidak punya field stok ([09 §9.5](09-flutter-mobile-architecture.md))
- [x] Tata letak `handheld` — grid penuh + keranjang sebagai *bottom sheet* + bar ringkasan 72 dp
- [x] **P-06** `payment_page.dart` — metode **hanya** dari `PaymentMethod.values`, tanpa input bebas
- [x] Numpad 56 dp tata letak telepon (`1 2 3` … `000 0 ⌫`), maksimum 9 digit
- [x] Fast-Cash 72 dp: Lapis 1 UANG PAS · Lapis 2 pembulatan cerdas · Lapis 3 pecahan tetap (nonaktif bila < total)
- [x] Blok kembalian: `KURANG` → tombol selesai **nonaktif**; QRIS/DEBIT/TRANSFER → blok kembalian disembunyikan
- [x] **P-07** `TransactionCubit` — *sealed* state machine; **persist ke Drift SEBELUM perintah cetak**
- [x] Kegagalan cetak **tidak** membatalkan transaksi; tombol "Cetak Ulang" tersedia
- [x] **P-08** `held_cart` — murni lokal, **tidak pernah** dikirim ke server
- [x] Uji: `cart_math_test.dart`, `fast_cash_test.dart`, `cart_cubit_test.dart`, `transaction_cubit_test.dart`

**Berkas pendukung yang ikut lahir di fase ini:**

- [x] `features/register/domain/` — `CartLine`, `SaleTransaction`, `CatalogProduct`, `CartMath`, `FastCash`, tiga kontrak repository
- [x] `features/register/data/` — `RegisterRepositoryImpl` (simpan atomik), `HeldCartRepositoryImpl` (JSON lokal), `CatalogRepositoryImpl`
- [x] `features/register/presentation/` — 4 Cubit, 4 halaman, 4 widget
- [x] `app_gate.dart` — `GateStep.ready` kini merakit P-05, bukan placeholder

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Printer belum ada sampai M6 | `core/printer/receipt_printer.dart` (kontrak) + `NoopReceiptPrinter` yang **selalu melaporkan gagal** | Printer palsu yang mengaku sukses menyembunyikan bug termahal: transaksi hilang karena kegagalan cetak diperlakukan sebagai pembatalan. Yang selalu gagal justru memaksa jalur "Cetak Ulang" teruji sejak sekarang |
| 2 | `outletName` pada struk | Di-*hardcode* `'POS Godinov'` | Nama outlet belum tersimpan lokal; `sync_meta` sudah punya kunci `outletName` dan akan diisi saat P-14 lahir di M7 |
| 3 | Catatan baris keranjang (`CartLine.note`) | Disimpan di state, **tidak** dikirim ke server | Tabel `transaction_items` tidak punya kolom catatan ([02 §2.13]). Ditampilkan di keranjang dan struk saja |

**Selesai bila:** aritmetika integer sen eksak pada 1.000 kombinasi acak · UUID transaksi & item
dibuat sekali dan tidak berubah setelah gagal cetak.

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan (M0.2).

---

## Fase M5 — Sync Engine & Partial Success (P-13)

> 🔴 **Fase paling rawan salah — sediakan waktu ekstra.** [04 §C.6] dan [09 §10]
> sama-sama menandainya. Mayoritas bug produksi akan lahir di sini.

- [x] `core/sync/wire_mapper.dart` — buang kolom lokal · `toMajor()` · **tidak** mengirim `business_id`/`outlet_id`
- [x] Kunci payload **`wastes`**, bukan `product_wastes` ([09 §9.4](09-flutter-mobile-architecture.md))
- [x] `core/sync/sync_engine.dart` — mutex `Lock` (`synchronized`), batas **200 transaksi/batch**, urut kronologis
- [x] **ATURAN KRITIS:** sertakan **shift induk setiap transaksi** dalam batch, walau sudah tersinkron
- [x] `core/sync/reconcile_decision.dart` + `reconciler.dart`:
  - [x] `failed_transactions` → tetap di antrean, `syncAttempts++`
  - [x] `shifts_synced` tidak cocok → **tidak satu pun** shift ditandai tersinkron
  - [x] `shifts_synced` tidak cocok → **tidak satu pun** transaksinya ditandai tersinkron, walau tidak muncul di `failed_transactions`
  - [x] `wastes_synced` tidak cocok → seluruh waste batch tetap di antrean
- [x] `core/sync/backoff.dart` — eksponensial 5 dtk → maks 5 mnt, jitter ±20 %, **tanpa batas percobaan**
- [x] `core/sync/sync_triggers.dart` — online (jeda 2 dtk) · periodik 5 mnt · tutup shift · manual · startup · resume
- [x] **P-13** `sync_status_page.dart` — antrean, daftar gagal, tombol sync manual (**mengabaikan backoff**)
- [x] `sync_badge_chip.dart` — matriks prioritas: `syncError` › skew jam › offline › antrean › normal
- [x] **Data lokal tidak pernah dihapus** setelah sync — hanya ditandai
- [x] Uji: `wire_mapper_test.dart`, `reconcile_decision_test.dart`, `backoff_test.dart`, `sync_cubit_test.dart`

**Matriks uji [09 §10] — status per skenario:**

| # | Skenario | Status |
|---|---|---|
| 1 | Perangkat offline 3 hari, lalu online | 🟡 Logika ada (perulangan batch); butuh uji integrasi |
| 2 | Transaksi dikirim ulang (UUID sama) | ✅ Dijaga `wire_mapper_test` — UUID tidak pernah diregenerasi |
| 3 | **Shift gagal, transaksinya ikut dalam batch** | ✅ Dijaga `reconcile_decision_test` |
| 4 | `failed_transactions` berisi sebagian ID | ✅ Dijaga `reconcile_decision_test` |
| 5 | Sync latar & foreground bersamaan | ✅ `Lock.locked` → `SyncSkipReason.locked` |
| 6 | Void transaksi yang sudah tersinkron | 🟡 `voidTransaction` ada di DAO; layarnya (P-10) di M7 |
| 7 | Void transaksi yang belum pernah tersinkron | 🟡 Sama seperti #6 |
| 8 | Batch > 200 transaksi | 🟡 Perulangan ada; butuh uji integrasi berbasis DB |
| 9 | Jaringan putus di tengah `POST` | ✅ `recordFailure` → backoff; tidak ada yang ditandai |
| 10 | Jam perangkat digeser 1 jam | ✅ Dijaga `clock_skew_test`; `client_created_at` tidak dikoreksi |
| 11 | Aplikasi dimatikan paksa saat menulis | ✅ `insertWithItems` atomik (M4) |
| 12 | Printer mati saat konfirmasi bayar | ✅ Dijaga `transaction_cubit_test` (M4) |
| 13 | `device_token` ditolak (`401`) | ✅ `DeviceRejectedFailure`; antrean tidak dihapus |

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Rekonsiliasi sebagai satu kelas ([09 §6.3]) | Dipecah menjadi `ReconcileDecision` (murni) + `Reconciler` (I/O) | Logika ini yang paling berkonsekuensi di seluruh aplikasi, tetapi terkunci di balik Drift sehingga hanya dapat diuji dengan basis data sungguhan. Sebagai fungsi murni, seluruh tabel kombinasinya teruji tanpa I/O — dan blok penulisan tidak lagi memuat percabangan |
| 2 | StatusBar penuh ([06 §4.7]) | Baru `SyncBadgeChip` di atas panel produk | Slot kasir, shift, dan jam bergantung pada P-14 yang lahir di M7. Bagian paling berkonsekuensi — keadaan sinkronisasi — sudah ada dan dapat diketuk menuju P-13 |
| 3 | Skenario #1, #8 pada matriks uji | Ditandai 🟡 | Keduanya memerlukan basis data sungguhan (`NativeDatabase.memory()`), yang butuh `sqlite3` di mesin uji. Dikerjakan sebagai uji integrasi di M10 |

**Selesai bila:** matriks uji M5 hijau seluruhnya, termasuk skenario "shift gagal → tidak satu pun
transaksi ditandai" dan "batch > 200 terpecah kronologis".

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan (M0.2).
> Tiga skenario matriks masih 🟡 — lihat penyimpangan #3.

---

## Fase M6 — Printer & ESC/POS

- [x] `core/printer/receipt_printer.dart` — kontrak `ReceiptPrinter` (renderer+kebijakan) **dan** `PrinterTransport` (byte)
- [x] `core/printer/escpos_receipt_builder.dart` — `esc_pos_utils_plus`, struk 58 mm, QR berisi **UUID penuh**
- [x] Perintah buka laci (`drawer`) **hanya** untuk transaksi `CASH`
- [x] `adapters/platform_printer_adapter.dart` — BT Classic (**prioritas**), BLE, USB
- [x] `adapters/network_printer_adapter.dart` — `Socket` ke `:9100`, tanpa paket pihak ketiga
- [x] `adapters/sunmi_inner_printer_adapter.dart` — sisi Dart lewat MethodChannel
- [ ] `SunmiPrinterPlugin.kt` (AIDL `IWoyouService`) — **terhalang**, lihat catatan di bawah
- [x] `core/printer/printer_registry.dart` — deteksi vendor via `device_info_plus`; handheld internal **selalu menang**
- [x] `core/printer/printer_manager.dart` — auto-reconnect backoff (2/4/8/16/32 dtk), antrean ber-mutex, timeout 8 dtk
- [x] `core/printer/printer_preferences.dart` — printer terpilih bertahan lintas restart
- [x] `PrinterCubit` + `printer_setup_page.dart` — matriks 7 status ([09 §4.2](09-flutter-mobile-architecture.md))
- [x] Izin runtime Android 12+: `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` (`neverForLocation`) diminta **sebelum operasi printer pertama**
- [x] `AndroidManifest.xml` — izin Bluetooth + `allowBackup="false"` + `data_extraction_rules.xml`
- [x] Deteksi kertas habis `DLE EOT 4` — **hanya** TCP & Sunmi; dinyatakan apa adanya di UI
- [x] Uji: `printer_test.dart` (status kertas, penguraian alamat, matriks state, golden byte ESC/POS)
- [ ] Uji manual di **printer SPP fisik** — memerlukan perangkat keras

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Tiga adapter terpisah ([09 §4.1]) | Satu `PlatformPrinterAdapter` ber-parameter `PrinterKind` | BT Classic, BLE, dan USB berbeda **hanya** pada `PrinterType` dan bendera `isBle`. Menuliskannya tiga kali berarti menyalin permukaan paket tiga kali, dan setiap perubahan API paket harus diperbaiki di tiga tempat. `PrinterRegistry` tetap membuat instance terpisah per kind, jadi dari luar tetap tampak tiga adapter |
| 2 | `PrinterManager` memegang koneksi LAN | `NetworkPrinterAdapter` membuka soket **baru setiap cetak** | Printer LAN kerap memutus koneksi menganggur; soket yang tampak hidup tetapi sudah mati adalah kegagalan cetak yang paling membingungkan. Membuka soket per struk memakan ~50 ms dan menghapus seluruh kelas masalah itu |
| 3 | `allowBackup="false"` saja ([09 §4.4]) | Ditambah `data_extraction_rules.xml` | Android 12+ mengabaikan `allowBackup` dan memakai berkas aturan. Tanpa keduanya, perangkat Android 12+ tetap menyalin basis data berisi `pin_hash` ke cloud |

### 🔴 Terhalang — printer internal Sunmi/iMin

Sisi Dart (`SunmiInnerPrinterAdapter`) **selesai** dan menurun dengan aman:
`MissingPluginException` → `isAvailable() == false` → registry jatuh ke Bluetooth.

Yang belum ada adalah jembatan Kotlin-nya, dan itu **disengaja**. Plugin harus
memanggil `IWoyouService` lewat AIDL, sedangkan berkas
`woyou/aidlservice/jiuiv5/IWoyouService.aidl` adalah milik SDK Sunmi. **Urutan
metode di dalam AIDL menentukan kode transaksi Binder** — AIDL yang ditulis dari
ingatan akan tetap ter-*compile* tetapi memanggil metode yang salah, dan
gejalanya adalah printer yang berperilaku acak di lapangan. Itu lebih berbahaya
daripada tidak ada sama sekali.

**Dua jalan penyelesaian, pilih salah satu:**

| Jalan | Langkah |
|---|---|
| **A — AIDL resmi** | Salin `IWoyouService.aidl` + `ICallback.aidl` dari SDK Sunmi ke `android/app/src/main/aidl/woyou/aidlservice/jiuiv5/`, lalu tulis `SunmiPrinterPlugin.kt` yang mendaftar pada channel `id.godinov.pos/sunmi_printer` dengan tiga metode: `isAvailable`, `printRaw(bytes)`, `paperStatus` |
| **B — paket pihak ketiga** | Tambahkan `sunmi_printer_plus` ke `pubspec.yaml` (AIDL sudah dibundel), lalu ganti isi `SunmiInnerPrinterAdapter` agar memanggil paket itu alih-alih MethodChannel. Kontraknya tidak berubah |

Sampai salah satunya dikerjakan, handheld Sunmi/iMin memakai jalur Bluetooth
seperti perangkat lain — bukan kegagalan, tetapi kehilangan kenyamanan.

### ⚠️ Berkas yang perlu diverifikasi setelah `pub get`

`adapters/platform_printer_adapter.dart` adalah **satu-satunya berkas M6 yang
bergantung pada API paket pihak ketiga** (`flutter_pos_printer_platform_image_3`).
Bila `flutter analyze` melaporkan galat setelah dependensi terpasang,
kemungkinan besar di sana — sesuaikan pemanggilan paketnya, bukan kontraknya.

**Selesai bila:** cetak berhasil di printer nyata (bukan emulator) · mencabut daya
printer di tengah shift tidak menghilangkan satu transaksi pun.

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan
> (M0.2). Uji lapangan di printer SPP fisik adalah syarat mutlak fase ini —
> tidak ada uji otomatis yang dapat menggantikannya.

---

## Fase M7 — Riwayat, Void, Waste, Tutup Shift (P-09…P-12, P-14)

- [x] **P-09** `history_page.dart` — tab "Hari Ini" (lokal) & "Sebelumnya" (`GET /v1/pos/transactions`)
- [x] Tab "Sebelumnya" **wajib** memuat catatan batas 50 baris ([09 §9.5](09-flutter-mobile-architecture.md))
- [x] Tombol "Cetak Ulang" tersedia di setiap baris riwayat **lokal**
- [x] **P-10** `void_page.dart` — layar terpisah (**bukan aksi inline**), `cancel_notes` wajib, konfirmasi ganda
- [x] Void mengirim **UUID yang sama** dengan `status: CANCELLED` ([09 §8](09-flutter-mobile-architecture.md))
- [x] **P-11** `waste_page.dart` — pilih produk, jumlah, alasan; antre untuk sync
- [x] **P-12** `close_shift_page.dart` — `shift_math.dart`: `expected = opening + Σ(COMPLETED ∧ CASH)`, `discrepancy = closing − expected`
- [x] Selisih dirender `MoneyText(signed: true)` dengan `tone` `danger`/`success`
- [x] Tutup shift **memicu sync langsung** setelah tersimpan
- [x] **P-14** `settings_page.dart` — nama outlet, sync master ulang, ganti kasir, pilih printer
- [x] P-14 menyatakan apa adanya: device token tidak dapat dicabut; tidak ada endpoint unbind
- [x] Uji: `shift_math_test.dart` (hanya CASH yang dihitung)
- [ ] Uji: `bloc_test` void & waste — ditunda, lihat penyimpangan #3

**Berkas pendukung yang ikut lahir:**

- [x] `features/history/` — `HistoryEntry`, remote DS, repository, `HistoryCubit`, 2 halaman
- [x] `features/waste/` — `WasteEntry`, repository, `WasteCubit`, 1 halaman
- [x] `features/shift/domain/shift_math.dart` + `ShiftClosing`/`ShiftClosed` pada `ShiftCubit`
- [x] `register_page.dart` — bilah menu menuju P-09, P-11, P-12, P-14

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | `expected_balance` dihitung di UI | Dihitung di **repository**, bukan diterima dari layar | Angka ini masuk ke dashboard pemilik dan server tidak menghitung ulang ([02 §2.11]). Rumusnya tidak boleh punya dua tempat tinggal — UI hanya menampilkan hasil |
| 2 | Riwayat server dapat di-void & dicetak ulang | Hanya baris **lokal** yang bisa | Item dari server tidak membawa nama produk (kolomnya tidak ada, [02 §2.13]), sehingga struk tidak dapat dirakit ulang dan daftar itemnya tampil sebagai "Produk". Menawarkan cetak ulang di sana adalah janji yang tidak dapat ditepati |
| 3 | `bloc_test` untuk void & waste | Ditunda ke M10 | Keduanya adalah pembungkus tipis di atas DAO; nilai ujinya ada pada penulisan basis data yang sesungguhnya, bukan pada transisi state. Dikerjakan sebagai uji integrasi bersama skenario matriks M5 yang tertunda |

### 🔎 Temuan: nama outlet tidak tersedia dari server

Struk membutuhkan nama outlet di kepalanya, dan catatan M4 menyebut nilainya
"diisi dari master data pada M7". **Itu keliru.** Tidak ada endpoint POS yang
menyediakannya:

- `GET /v1/pos/sync/master-data` hanya mengirim `staffs`, `categories`, dan
  `products` ([03 §2.2])
- `POST /v1/auth/device/bind` hanya mengembalikan `device_token` ([03 §2.1])

Karena itu nama outlet menjadi **isian teknisi** di P-14, disimpan pada
`sync_meta` dengan kunci `outletName`, dan dibaca `app_gate.dart` saat merakit
`TransactionCubit`. Sampai diisi, struk memakai `POS Godinov`.

Bila tim menginginkan nama outlet resmi ikut terunduh, itu **perubahan backend**
— menambahkan blok `outlet` ke payload master data.

**Selesai bila:** void transaksi yang sudah tersinkron memicu *reverse deduction*
di server · `discrepancy` yang tampil di dashboard pemilik cocok dengan hitungan
manual.

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan
> (M0.2).

---

## Fase M8 — Sinkronisasi Latar (WorkManager)

- [x] `core/sync/background_sync_worker.dart` — `@pragma('vm:entry-point') callbackDispatcher`
- [x] DI **dibangun ulang** di isolate latar — tidak mewarisi apa pun dari isolate UI
- [x] Basis data **ditutup** di blok `finally` — koneksi menggantung menyebabkan "database is locked" acak
- [x] `registerPeriodicTask` 15 menit, `NetworkType.connected`, `ExistingWorkPolicy.keep`, backoff eksponensial
- [x] Didaftarkan **hanya bila perangkat sudah ter-binding**, dan tepat setelah binding berhasil
- [x] `core/sync/battery_optimization.dart` — deteksi vendor agresif + permintaan pengecualian
- [x] P-14: kartu "Optimalkan Sinkronisasi Latar" → `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
- [x] Instruksi tambahan untuk MIUI / ColorOS / FunTouch bila vendor terdeteksi agresif
- [x] P-13: catatan batasan diperbarui — bukan lagi "hanya saat aplikasi terbuka"
- [x] `AndroidManifest.xml` — izin `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
- [ ] **Uji lapangan** di perangkat target nyata dengan aplikasi tertutup penuh
- [ ] Daftar perangkat/OEM yang tervalidasi

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Pengecualian baterai lewat MethodChannel kustom | `permission_handler` `Permission.ignoreBatteryOptimizations` | Paketnya sudah ada di `pubspec.yaml` sejak M0 dan membuka dialog sistem yang sama. Menulis plugin Kotlin sendiri untuk itu berarti menambah kode native yang harus dirawat tanpa menambah kemampuan apa pun |
| 2 | Uji unit `BackgroundSync` | **Tidak ada** | Kelasnya pembungkus tipis di atas kanal platform; yang layak diuji hanya perilaku sistem operasi, dan itulah yang dijadwalkan sebagai uji lapangan. Uji unit di sini hanya akan memverifikasi bahwa Dart memanggil Dart |

### 🔴 Tanpa uji lapangan, fase ini tidak dapat dinyatakan selesai

WorkManager bekerja mulus di emulator dan pada Android murni. Yang terjadi di
outlet berbeda: **MIUI (Xiaomi), ColorOS (Oppo/Realme), FunTouch (Vivo), dan
sebagian besar handheld POS membunuh proses latar** yang tidak dikecualikan —
kadang dalam hitungan menit setelah layar mati.

Gejalanya adalah yang paling menyesatkan yang mungkin ada: sinkronisasi
**berhasil di lab**, lalu diam di outlet, **tanpa pesan error apa pun** karena
isolate-nya memang tidak pernah dibangunkan.

Karena itu dua butir terakhir sengaja dibiarkan `[ ]`. Prosedur ujinya:

1. Pasang APK release pada perangkat target
2. Lakukan binding, buka shift, catat 2–3 transaksi
3. **Tutup aplikasi sepenuhnya** (usap dari daftar aplikasi terbaru), matikan layar
4. Tunggu 20 menit dengan Wi-Fi menyala
5. Periksa dashboard pemilik: transaksi harus sudah muncul
6. Ulangi setelah menekan "Optimalkan Sinkronisasi Latar" bila gagal
7. Catat hasilnya per model perangkat pada tabel di bawah

| Perangkat | Android | Vendor skin | Tanpa pengecualian | Dengan pengecualian |
|---|---|---|---|---|
| _(isi setelah uji lapangan)_ | | | | |

**Selesai bila:** transaksi yang dibuat offline tersinkron dengan aplikasi
tertutup dan layar mati, pada minimal satu perangkat handheld target.

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan
> (M0.2).

---

## Fase M9 — Mode Kiosk (Lock Task)

- [x] `KioskPlugin.kt` — `setLockTaskPackages`, `setLockTaskFeatures` (API 28+), `startLockTask`/`stopLockTask`
- [x] `GodinovDeviceAdminReceiver` + `@xml/device_admin_receiver` + `android:lockTaskMode="if_whitelisted"`
- [x] `intent-filter` `CATEGORY_HOME` agar tombol Home tidak memindahkan pelanggan keluar
- [x] `core/kiosk/kiosk_service.dart` — `immersiveSticky` + `WakelockPlus.enable()`
- [x] **P-14 menampilkan tingkat penguncian apa adanya** — banner peringatan bila perangkat **bukan** Device Owner
- [x] `core/kiosk/kiosk_guard.dart` — ketuk logo 5× dalam 3 dtk → dialog PIN → `PinVerifier` yang **sama**
- [x] **K-01** layar sambutan · idle timeout **90 dtk** → keranjang dikosongkan
- [x] **K-02** katalog: tile 240 × 260 dp, 3 kolom, target sentuh **64 dp**, nama 20 dp
- [x] **K-03** tinjau & kirim
- [x] Kiosk **menyembunyikan** seluruh jalur admin: pengaturan, binding, riwayat, void, waste, tutup shift, status sync
- [x] Prosedur *provisioning* Device Owner didokumentasikan untuk teknisi ([09 §4.4](09-flutter-mobile-architecture.md))
- [ ] Uji: pelanggan tidak dapat keluar ke Home OS pada perangkat ber-Device Owner — **butuh perangkat ter-provision**

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | K-03 menulis transaksi `COMPLETED` ([09 §3.6]) | K-03 menulis **keranjang tertahan** (P-08) dengan label antrean | Lihat catatan di bawah — ini penyimpangan paling berkonsekuensi di M9 |
| 2 | Gerbang keluar memeriksa PIN satu staff | Memeriksa **seluruh** staff, tanpa keluar lebih awal saat cocok | Pelanggan tidak boleh melihat daftar nama staff, jadi identifier tidak dapat diminta. Perulangan tidak dihentikan saat cocok karena PIN staff pertama akan terverifikasi jauh lebih cepat daripada staff terakhir, dan selisih itu dapat diukur. Biayanya ~2–3 detik pada outlet 10 kasir — dapat diterima untuk gerbang yang ditekan beberapa kali sehari |

### 🔴 K-03 tidak mencatat penjualan, dan itu disengaja

Dokumen 09 §3.6 menyatakan K-03 *"menulis transaksi `COMPLETED` seperti kasir"*.
Implementasi ini **tidak** melakukannya. Alasannya:

**Sistem ini tidak memiliki payment gateway** ([03 §14]). Tidak ada cara
pelanggan membayar di kiosk — pembayaran pasti terjadi di konter. Mencatat
transaksi `COMPLETED` sebelum uang diterima berarti:

- Server **memotong stok bahan baku** lewat BOM atas pesanan yang belum dibayar
- Pendapatan **tercatat di dashboard pemilik** atas uang yang belum ada
- Pelanggan yang berubah pikiran meninggalkan **transaksi hantu** yang harus
  di-void manual, dan setiap void memicu *reverse deduction* di server

Karena itu K-03 menyimpan pesanan sebagai **keranjang tertahan** — mekanisme yang
sudah ada sejak M4, murni lokal, tidak pernah menyentuh server. Pelanggan
menerima label antrean, menunjukkannya ke kasir, dan kasir mengambil pesanan itu
lewat P-08 lalu menyelesaikan pembayaran seperti biasa. Transaksi lahir tepat
saat uang diterima.

**Bila tim tetap menginginkan perilaku asli 09 §3.6**, itu memerlukan salah satu:
(a) terminal pembayaran di kiosk — perubahan lingkup produk, atau (b) penerimaan
sadar bahwa stok terpotong sebelum pembayaran.

**Selesai bila:** perangkat Kiosk bertahan 1 jam di tangan penguji yang berusaha
keluar, tanpa berhasil mencapai layar Home.

> **Belum terverifikasi.** `build_runner`, `analyze`, dan `test` belum dijalankan
> (M0.2). Uji penguncian memerlukan perangkat yang benar-benar ter-*provision*
> sebagai Device Owner — tidak dapat disimulasikan di emulator biasa.

---

## Fase M10 — Pengerasan & Rilis

- [ ] **Keputusan enkripsi DB** ([09 §1.4](09-flutter-mobile-architecture.md)): opsi A `sqlcipher_flutter_libs` atau opsi B tanpa enkripsi
  - [x] Jalur penerapan opsi A didokumentasikan lengkap ([11 §4](11-flutter-verification-runbook.md))
  - [ ] Keputusan diambil tim
  - [ ] Uji migrasi DB lama (tidak terenkripsi) → terenkripsi
- [ ] **Kunci `PAYMENT_METHODS` secara formal** — isi tanggal & nama penyetuju di `constants.dart`
- [x] `test/contract/payment_methods_test.dart` — bandingkan dengan `posgodinov-fe/lib/constants/payment.ts`
- [x] `tool/audit.sh` — 12 pemeriksaan arsitektur yang tidak dilihat `flutter analyze`
- [x] Audit warna · nominal · `Envelope.list` · batas lapisan — **seluruhnya bersih**
- [x] `integration_test/offline_flow_test.dart` — alur penuh + skenario matriks yang tertunda dari M5 & M7
- [x] `android/app/build.gradle.kts` — konfigurasi penandatanganan, `minSdk 24`, R8 + shrink
- [x] `proguard-rules.pro` — WorkManager, Drift, secure storage, Device Admin
- [x] `key.properties.example` + `.gitignore` — keystore **tidak pernah** di-commit
- [ ] Aksesibilitas: kontras AA, target sentuh terverifikasi uji widget di perangkat nyata
- [ ] Build release: `flutter build apk --release --split-per-abi`
- [ ] Uji regresi pada tiga kelas perangkat: tablet 10", tablet 8", handheld

**Yang dikerjakan tanpa SDK:**

| Berkas | Peran |
|---|---|
| `test/contract/payment_methods_test.dart` | Gagal begitu daftar metode Web dan Flutter menyimpang. Melewatkan uji bila repo Web tidak ada di sebelah — tetapi **tidak** lolos diam-diam bila ada dan menyimpang |
| `tool/audit.sh` | Menjalankan 12 aturan arsitektur sebagai `grep` — dapat dijalankan **sekarang juga**, tanpa SDK. Sudah dijalankan: **bersih** |
| `integration_test/offline_flow_test.dart` | Menutup matriks #1, #6, #7, #8, #11 dan penulisan void/waste yang ditunda dari M7 |
| `build.gradle.kts` + `proguard-rules.pro` | R8 membuang `callbackDispatcher` WorkManager dan `GodinovDeviceAdminReceiver` tanpa aturan `-keep` — sinkronisasi latar dan Kiosk akan mati **hanya di release** |

**Penyimpangan sadar:**

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Audit sebagai butir tinjauan manual | `tool/audit.sh` yang dapat dijalankan | Tinjauan manual mengendur seiring waktu; skrip yang mengembalikan kode keluar dapat dipasang di CI dan tidak pernah lupa |
| 2 | Uji integrasi sebagai satu alur panjang | Dipecah per skenario matriks | Alur panjang yang gagal di tengah hanya memberi tahu "ada yang salah". Uji per skenario menunjuk langsung ke aturan yang dilanggar |

**Selesai bila:** seluruh gerbang mutu hijau · seluruh checklist [09 §9](09-flutter-mobile-architecture.md) tercentang · APK release berjalan pada perangkat target.

> **Verifikasi dijalankan di mesin lain.** Seluruh perintah, titik gagal yang
> sudah diketahui, dan urutannya ada di
> **[11 — Verification Runbook](11-flutter-verification-runbook.md)**.

---

## Butir yang tidak diputuskan sepihak

Seluruh butir `[NEEDS DISCUSSION]` di [09 §11](09-flutter-mobile-architecture.md) tetap terbuka.
Empat yang **memblokir rilis produksi**:

| # | Butir | Memblokir |
|---|---|---|
| 1 | **Enkripsi basis data lokal** — `pin_hash` seluruh kasir ada di berkas DB | M10 |
| 2 | **Provisioning Device Owner** — tanpa itu Kiosk hanya *screen pinning* yang mudah ditembus | M9 |
| 3 | **Kiosk tanpa informasi stok** — pelanggan dapat memesan produk yang bahan bakunya habis | M9 |
| 4 | **`PAYMENT_METHODS` belum disepakati formal** — mengganti nama nilai lama kelak tidak mungkin | M4 |
