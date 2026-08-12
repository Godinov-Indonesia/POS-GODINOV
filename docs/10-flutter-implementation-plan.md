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

---

## Status Ringkas

| Fase | Judul | Status |
|---|---|---|
| **M0** | Inisialisasi & Toolchain | 🟡 Sebagian — terhalang SDK |
| **M1** | Fondasi: Tema, Uang, Touch, DI | ⬜ Belum |
| **M2** | Persistensi & Jaringan | ⬜ Belum |
| **M3** | Binding → Login PIN → Buka Shift (P-01…P-04) | ⬜ Belum |
| **M4** | Keranjang → Bayar → Struk (P-05…P-08) | ⬜ Belum |
| **M5** | **Sync Engine & Partial Success** (P-13) | ⬜ Belum |
| **M6** | Printer & ESC/POS | ⬜ Belum |
| **M7** | Riwayat, Void, Waste, Tutup Shift (P-09…P-12, P-14) | ⬜ Belum |
| **M8** | Sinkronisasi Latar (WorkManager) | ⬜ Belum |
| **M9** | Mode Kiosk (Lock Task) | ⬜ Belum |
| **M10** | Pengerasan & Rilis | ⬜ Belum |

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

- [ ] `shared/theme/godinov_tokens.dart` — `GodinovTokens extends ThemeExtension` (Lapis 2 semantik)
- [ ] `shared/theme/app_theme.dart` — `ThemeData` + `TextTheme` skala POS; **`themeMode: ThemeMode.light`**, `darkTheme` tidak didefinisikan ([09 §3.3](09-flutter-mobile-architecture.md))
- [ ] `shared/theme/spacing.dart` — `Touch.standard/frequent/primary/critical` (48/56/64/72) + `Gap.tight/destructive`
- [ ] `shared/theme/breakpoints.dart` + `core/config/device_profile.dart` — `handheld / tablet8 / tablet10 / tabletWide` berbasis **dp**
- [ ] `core/utils/money.dart` — `toMinor`, `toMajor`, `format` (locale `id_ID`, 0 desimal, minus tipografis `−`)
- [ ] `shared/widgets/money_text.dart` — `MoneyText` dengan `FontFeature.tabularFigures()` + `Semantics`
- [ ] `shared/widgets/touch_button.dart` — varian `primary/success/danger/secondary/ghost` + `HapticFeedback.selectionClick()`
- [ ] `shared/extensions/context_ext.dart` — `context.tokens`, `context.profile`
- [ ] `core/config/constants.dart` — enum **`PaymentMethod`** (KONTRAK BEKU) + `cashMethods`
- [ ] `core/error/failures.dart` — `sealed class Failure` (`ApiFailure`, `NetworkFailure`, `ServerFailure`, `DeviceRejectedFailure`)
- [ ] `core/di/injection.dart` — `get_it` + `injectable`, `configureDependencies()`
- [ ] `bootstrap.dart` — penguncian orientasi per profil perangkat ([09 §3.2](09-flutter-mobile-architecture.md))
- [ ] `app.dart` — `MaterialApp`, `locale: id_ID`, `BlocProvider` global
- [ ] Uji: `money_test.dart` (tabel konversi [09 §3.5]), `touch_target_test.dart`

**Selesai bila:** `import_lint` bersih · tidak ada `Color(0x` di luar `godinov_colors.dart` ·
`MoneyText(2200000)` merender `Rp 22.000` dengan lebar digit tetap.

---

## Fase M2 — Persistensi & Jaringan

**Tujuan:** basis data lokal terbuka dengan indeks yang benar, dan lapisan API menutup seluruh
keanehan backend di satu tempat.

- [ ] `core/database/tables/*` — 10 tabel: `Staffs`, `Categories`, `Products`, `Shifts`, `Transactions`, `TransactionItems`, `Wastes`, `HeldCarts`, `SyncMeta`, `SyncLogs`
- [ ] Kolom uang bertipe `IntColumn` (**sen**); `paymentMethod`/`status` bertipe `textEnum<…>()`
- [ ] `core/database/app_database.dart` — `schemaVersion = 1`, `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`
- [ ] Indeks di `onCreate`: `idx_tx_queue (synced, client_created_at)`, `idx_tx_shift (shift_id)`, `idx_waste_queue`
- [ ] `NativeDatabase.createInBackground` — DB berjalan di isolate terpisah, UI tidak terblokir
- [ ] `core/database/daos/*` — `MasterDao`, `ShiftDao`, `TransactionDao` (`insertWithItems` **atomik**), `WasteDao`, `SyncDao`, `HeldCartDao`
- [ ] `core/storage/secure_storage_service.dart` — `AndroidOptions(encryptedSharedPreferences: true, resetOnError: false)`
- [ ] `core/network/envelope.dart` — `Envelope.data<T>()` + **`Envelope.list<T>()` dengan `null → []`**
- [ ] `core/network/api_client.dart` — Dio + `baseUrl` + timeout
- [ ] `interceptors/device_token_interceptor.dart` — sisip `Bearer`; **`401` → `DeviceRejectedFailure`**, bukan retry
- [ ] `interceptors/error_interceptor.dart` — `400` → `message` apa adanya; **tidak ada percabangan `403`/`404`**
- [ ] `interceptors/clock_skew_interceptor.dart` — baca header `Date`, tandai skew > 5 menit
- [ ] `core/network/connectivity_monitor.dart`
- [ ] Uji: `envelope_test.dart` (`null → []` untuk `staffs`/`categories`/`products`), `error_mapping_test.dart`

**Selesai bila:** DB terbuka & indeks terbentuk (verifikasi `PRAGMA index_list`) ·
`Envelope.list(null, …)` mengembalikan `[]`, bukan melempar.

---

## Fase M3 — Binding → Login PIN → Buka Shift (P-01…P-04)

**Tujuan:** membuktikan jalur offline paling awal. Ini gerbang kelayakan seluruh proyek.

- [ ] **P-01** `binding_page.dart` — form `serial_business`, `serial_outlet`, password owner
- [ ] `POST /v1/auth/device/bind` → `200` (**bukan `201`**); token → `flutter_secure_storage`
- [ ] Pesan `401` "kredensial bisnis tidak valid" ditampilkan apa adanya
- [ ] UI menyatakan apa adanya: **tidak ada endpoint *unbind*** — perangkat hilang mempertahankan akses ([09 §9.5](09-flutter-mobile-architecture.md))
- [ ] **P-02** `master_sync_page.dart` — progres unduhan `GET /v1/pos/sync/master-data`
- [ ] Simpan dengan **`bulkPut`**, bukan `clear()` + insert; harga dikonversi `toMinor()`
- [ ] Ketiga koleksi (`staffs`, `categories`, `products`) lewat `Envelope.list()`
- [ ] **P-03** `core/crypto/pin_verifier.dart` — `BCrypt.checkpw` di `compute()` + hash umpan
- [ ] `pin_login_page.dart` — keypad 56 dp, tombol `MASUK` **nonaktif** selama verifikasi + spinner
- [ ] Pesan gagal **disamakan**: "ID atau PIN salah" (tidak membocorkan keberadaan staff)
- [ ] **Tidak ada** tautan "Reset PIN" — teks: *"Lupa PIN? Hubungi pemilik untuk membuat ulang akun staff."*
- [ ] **P-04** `open_shift_page.dart` — input modal awal laci; UUID shift dibuat di sini
- [ ] `bootstrap.dart` — gerbang navigasi berurutan ([09 §8](09-flutter-mobile-architecture.md))
- [ ] Uji: `pin_verifier_test.dart` (hash umpan menghabiskan waktu setara), `bloc_test` untuk keempat Cubit

**Selesai bila:** **setelah binding, aplikasi terbuka penuh dalam mode pesawat** — mulai dari login
kasir sampai buka shift, tanpa satu pun permintaan jaringan.

---

## Fase M4 — Keranjang → Bayar → Struk (P-05…P-08)

**Tujuan:** fitur inti kasir. Aritmetika harus eksak dan UUID dibuat tepat sekali.

- [ ] `features/register/.../cart_cubit.dart` — `CartState` dengan subtotal/total sebagai **getter turunan**, bukan field
- [ ] Harga di-**snapshot** saat item ditambahkan; sync master di tengah transaksi tidak mengubah keranjang
- [ ] **P-05** `register_page.dart` — split **62/38** (`Expanded flex`), grid 4 kolom @1280
- [ ] `product_tile.dart` — nama ≥ 16 dp `maxLines: 2`; fallback gambar wajib
- [ ] `category_tabs.dart` — tinggi 56 dp, tab aktif `accentSubtle` + `accent`
- [ ] **Tanpa indikator stok apa pun** — master data tidak memuat stok/BOM ([09 §9.5](09-flutter-mobile-architecture.md))
- [ ] Tata letak `handheld` — grid penuh + keranjang sebagai *bottom sheet* + bar ringkasan 72 dp
- [ ] **P-06** `payment_page.dart` — metode **hanya** dari `PaymentMethod.values.map()`, tanpa input bebas
- [ ] Numpad 56 dp tata letak telepon (`1 2 3` … `000 0 ⌫`), maksimum 9 digit
- [ ] Fast-Cash 72 dp: Lapis 1 UANG PAS · Lapis 2 pembulatan cerdas · Lapis 3 pecahan tetap (nonaktif bila < total)
- [ ] Blok kembalian: `KURANG` → tombol selesai **nonaktif**; QRIS/DEBIT/TRANSFER → blok kembalian disembunyikan
- [ ] **P-07** `TransactionCubit` — *sealed* state machine; **persist ke Drift SEBELUM perintah cetak**
- [ ] Kegagalan cetak **tidak** membatalkan transaksi; tombol "Cetak Ulang" tersedia
- [ ] **P-08** `held_cart` — murni lokal, **tidak pernah** dikirim ke server
- [ ] Uji: `cart_math_test.dart`, `fast_cash_test.dart`, `bloc_test` `TransactionCubit` seluruh transisi

**Selesai bila:** aritmetika integer sen eksak pada 1.000 kombinasi acak · UUID transaksi & item
dibuat sekali dan tidak berubah setelah gagal cetak.

---

## Fase M5 — Sync Engine & Partial Success (P-13)

> 🔴 **Fase paling rawan salah — sediakan waktu ekstra.** [04 §C.6] dan [09 §10] sama-sama
> menandainya. Mayoritas bug produksi akan lahir di sini.

- [ ] `core/sync/wire_mapper.dart` — buang kolom lokal · `toMajor()` · **tidak** mengirim `business_id`/`outlet_id`
- [ ] Kunci payload **`wastes`**, bukan `product_wastes` ([09 §9.4](09-flutter-mobile-architecture.md))
- [ ] `core/sync/sync_engine.dart` — mutex `Lock` (`synchronized`), batas **200 transaksi/batch**, urut kronologis
- [ ] **ATURAN KRITIS:** sertakan **shift induk setiap transaksi** dalam batch, walau sudah tersinkron
- [ ] `core/sync/reconciler.dart`:
  - [ ] `failed_transactions` → tetap di antrean, `syncAttempts++`
  - [ ] `shifts_synced` tidak cocok → **tidak satu pun** shift ditandai tersinkron
  - [ ] `shifts_synced` tidak cocok → **tidak satu pun** transaksinya ditandai tersinkron, walau tidak muncul di `failed_transactions`
  - [ ] `wastes_synced` tidak cocok → seluruh waste batch tetap di antrean
- [ ] `core/sync/backoff.dart` — eksponensial 5 dtk → maks 5 mnt, jitter ±20 %, **tanpa batas percobaan**
- [ ] `core/sync/sync_triggers.dart` — online (jeda 2 dtk) · periodik 5 mnt · tutup shift · manual · startup · resume
- [ ] **P-13** `sync_status_page.dart` — antrean, daftar gagal, tombol sync manual (**mengabaikan backoff**)
- [ ] `status_bar.dart` — matriks prioritas: `syncError` › skew jam › offline › antrean › normal
- [ ] **Data lokal tidak pernah dihapus** setelah sync — hanya ditandai
- [ ] Uji: **seluruh 13 baris matriks uji** [09 §10](09-flutter-mobile-architecture.md)

**Selesai bila:** matriks uji M5 hijau seluruhnya, termasuk skenario "shift gagal → tidak satu pun
transaksi ditandai" dan "batch > 200 terpecah kronologis".

---

## Fase M6 — Printer & ESC/POS

- [ ] `core/printer/receipt_printer.dart` — kontrak `ReceiptPrinter` (domain murni, tanpa impor plugin)
- [ ] `core/printer/escpos_receipt_builder.dart` — `esc_pos_utils_2`, struk 58 mm, QR berisi UUID penuh
- [ ] Perintah buka laci (`drawer`) **hanya** untuk transaksi `CASH`
- [ ] `adapters/bt_classic_printer_adapter.dart` — SPP (**prioritas**, mayoritas printer murah)
- [ ] `adapters/ble_printer_adapter.dart`
- [ ] `adapters/usb_printer_adapter.dart`
- [ ] `adapters/network_printer_adapter.dart` — `Socket` ke `:9100`
- [ ] `adapters/sunmi_inner_printer_adapter.dart` + `SunmiPrinterPlugin.kt` (AIDL `IWoyouService`)
- [ ] `core/printer/printer_registry.dart` — deteksi vendor via `device_info_plus`; handheld internal **selalu menang**
- [ ] `core/printer/printer_manager.dart` — auto-reconnect backoff (2/4/8/16/32 dtk), antrean ber-mutex, timeout 8 dtk
- [ ] `PrinterCubit` + badge StatusBar — matriks 7 status ([09 §4.2](09-flutter-mobile-architecture.md))
- [ ] Izin runtime Android 12+: `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` (`neverForLocation`) diminta **sebelum operasi printer pertama**
- [ ] Deteksi kertas habis `DLE EOT 4` — **hanya** SPP/USB/TCP; dokumentasikan bahwa BLE tidak mendukung
- [ ] Uji: `escpos_builder_test.dart` (golden byte), uji manual di **printer SPP fisik**

**Selesai bila:** cetak berhasil di printer nyata (bukan emulator) · mencabut daya printer di
tengah shift tidak menghilangkan satu transaksi pun.

---

## Fase M7 — Riwayat, Void, Waste, Tutup Shift (P-09…P-12, P-14)

- [ ] **P-09** `history_page.dart` — tab "Hari Ini" (lokal) & "Sebelumnya" (`GET /v1/pos/transactions`)
- [ ] Tab "Sebelumnya" **wajib** memuat catatan: *"Menampilkan 50 transaksi terakhir dari server."* ([09 §9.5](09-flutter-mobile-architecture.md))
- [ ] Tombol "Cetak Ulang" tersedia di setiap baris riwayat
- [ ] **P-10** `void_page.dart` — layar terpisah (**bukan aksi inline**), `cancel_notes` wajib, konfirmasi ganda
- [ ] Void mengirim **UUID yang sama** dengan `status: CANCELLED` ([09 §8](09-flutter-mobile-architecture.md))
- [ ] **P-11** `waste_page.dart` — pilih produk, jumlah, alasan; antre untuk sync
- [ ] **P-12** `close_shift_page.dart` — `shift_math.dart`: `expected = opening + Σ(COMPLETED ∧ CASH)`, `discrepancy = closing − expected`
- [ ] Selisih dirender `MoneyText(signed: true)` dengan `tone` `danger`/`success`
- [ ] Tutup shift **memicu sync langsung** setelah tersimpan
- [ ] **P-14** `settings_page.dart` — info perangkat, sync master ulang, ganti kasir, pilih printer
- [ ] P-14 menyatakan apa adanya: device token tidak dapat dicabut; tidak ada endpoint unbind
- [ ] Uji: `shift_math_test.dart` (hanya CASH yang dihitung), `bloc_test` void & waste

**Selesai bila:** void transaksi yang sudah tersinkron memicu *reverse deduction* di server ·
`discrepancy` yang tampil di dashboard pemilik cocok dengan hitungan manual.

---

## Fase M8 — Sinkronisasi Latar (WorkManager)

- [ ] `core/sync/background_sync_worker.dart` — `@pragma('vm:entry-point') callbackDispatcher`
- [ ] DI **dibangun ulang** di isolate latar — tidak mewarisi dari isolate UI
- [ ] `registerPeriodicTask` 15 menit, `NetworkType.connected`, `ExistingWorkPolicy.keep`, backoff eksponensial
- [ ] Didaftarkan **sekali** setelah binding berhasil, bukan di setiap start
- [ ] P-14: tombol "Optimalkan Sinkronisasi Latar" → `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
- [ ] Uji lapangan di **perangkat target nyata** (bukan emulator) dengan aplikasi **tertutup penuh**
- [ ] Catat daftar perangkat/OEM yang tervalidasi (Xiaomi/Oppo/Vivo/handheld membunuh WorkManager secara agresif)

**Selesai bila:** transaksi yang dibuat offline tersinkron dengan aplikasi tertutup dan layar mati,
pada minimal satu perangkat handheld target.

---

## Fase M9 — Mode Kiosk (Lock Task)

- [ ] `KioskPlugin.kt` — `setLockTaskPackages`, `setLockTaskFeatures` (API 28+), `startLockTask`/`stopLockTask`
- [ ] `GodinovDeviceAdminReceiver` + `@xml/device_admin_receiver` + `android:lockTaskMode="if_whitelisted"`
- [ ] `intent-filter` `CATEGORY_HOME` agar tombol Home tidak memindahkan pelanggan keluar
- [ ] `core/kiosk/kiosk_service.dart` — `immersiveSticky` + `WakelockPlus.enable()`
- [ ] **P-14 menampilkan tingkat penguncian apa adanya** — banner peringatan bila perangkat **bukan** Device Owner ([09 §4.4](09-flutter-mobile-architecture.md))
- [ ] `core/kiosk/kiosk_guard.dart` — ketuk logo 5× dalam 3 dtk → dialog PIN → `PinVerifier` yang **sama**
- [ ] **K-01** layar sambutan · idle timeout **90 dtk** → keranjang dikosongkan
- [ ] **K-02** katalog: tile 240 × 260 dp, 3 kolom, target sentuh **64 dp**, nama 20 dp
- [ ] **K-03** tinjau & kirim — menulis transaksi `COMPLETED` seperti kasir
- [ ] Kiosk **menyembunyikan** seluruh jalur admin: pengaturan, binding, riwayat, void, waste, tutup shift, status sync
- [ ] Prosedur *provisioning* Device Owner didokumentasikan untuk teknisi (QR / `adb`)
- [ ] Uji: pelanggan tidak dapat keluar ke Home OS pada perangkat ber-Device Owner

**Selesai bila:** perangkat Kiosk bertahan 1 jam di tangan penguji yang berusaha keluar, tanpa
berhasil mencapai layar Home.

---

## Fase M10 — Pengerasan & Rilis

- [ ] **Keputusan enkripsi DB** ([09 §1.4](09-flutter-mobile-architecture.md)): opsi A `sqlcipher_flutter_libs` atau opsi B tanpa enkripsi
  - [ ] Bila A: ganti `sqlite3_flutter_libs` → `sqlcipher_flutter_libs` (**tidak boleh terpasang bersamaan**)
  - [ ] Bila A: aktifkan `PRAGMA key` dari `getOrCreateDatabaseKey()` di `openDatabase()`
  - [ ] Bila A: uji migrasi DB lama (tidak terenkripsi) → terenkripsi pada perangkat yang sudah dipakai
- [ ] **Kunci `PAYMENT_METHODS` secara formal** — isi tanggal & nama penyetuju di `constants.dart`
- [ ] `test/contract/payment_methods_test.dart` — bandingkan dengan `posgodinov-fe/lib/constants/payment.ts`
- [ ] Audit warna: `grep -rn "Color(0x" lib/ | grep -v godinov_colors.dart` kosong
- [ ] Audit nominal: seluruh render nominal lewat `MoneyText`
- [ ] Audit `Envelope.list()`: tidak ada `as List` langsung
- [ ] Aksesibilitas: `Semantics` pada nominal, kontras AA, target sentuh terverifikasi uji widget
- [ ] `integration_test/` — alur penuh: binding → sync master → login → buka shift → jual → tutup shift → sync
- [ ] Build release: `flutter build apk --release --split-per-abi`
- [ ] Penandatanganan APK + `key.properties` **tidak** di-commit
- [ ] Uji regresi pada ketiga kelas perangkat: tablet 10", tablet 8", handheld

**Selesai bila:** seluruh gerbang mutu hijau · seluruh checklist [09 §9](09-flutter-mobile-architecture.md) tercentang · APK release berjalan pada perangkat target.

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
