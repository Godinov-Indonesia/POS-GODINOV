# 11 — Flutter Verification Runbook (`posgodinov-mobile`)

> **Untuk siapa dokumen ini:** agen atau pengembang yang menjalankan proyek ini
> di mesin **yang memiliki Flutter SDK**.
>
> Seluruh kode M0–M10 ditulis di mesin **tanpa SDK**. Konsekuensinya:
> `flutter pub get`, `dart run build_runner build`, `flutter analyze`, dan
> `flutter test` **belum pernah dijalankan satu kali pun**. Dokumen ini adalah
> daftar periksa untuk menutup celah itu.
>
> **Sumber kebenaran:** [09](09-flutter-mobile-architecture.md) (arsitektur) ·
> [10](10-flutter-implementation-plan.md) (status per fase).

---

## 0. Aturan main

1. **Jangan mengubah kontrak untuk membuat galat hilang.** Bila `analyze`
   mengeluh pada pemanggilan paket, sesuaikan pemanggilannya — bukan antarmuka
   `PrinterTransport`, `ReceiptPrinter`, atau kontrak repository mana pun.
2. **Jangan mencentang butir di [10](10-flutter-implementation-plan.md) yang
   belum benar-benar hijau.** Dokumen itu memakai status jujur (`🟢 kode lengkap`
   ≠ `terverifikasi`).
3. **Laporkan apa adanya.** Bila sebuah uji gagal dan perbaikannya butuh
   keputusan tim, catat dan lanjutkan ke butir berikutnya — jangan menebak.
4. **Urutan di §1 tidak boleh ditukar.** `build_runner` sebelum `analyze`;
   melewatinya menghasilkan ratusan galat palsu.

---

## 1. Urutan menjalankan — jangan ditukar

```bash
cd posgodinov-mobile

# 1. Toolchain
flutter --version                 # butuh ≥ 3.27 (lihat §2 catatan versi)
flutter doctor                    # Android toolchain harus hijau

# 2. Dependensi
flutter pub get

# 3. GENERASI KODE — WAJIB SEBELUM ANALYZE
dart run build_runner build --delete-conflicting-outputs

# 4. Analisis statis
flutter analyze                   # target: 0 issue
dart run import_lint              # target: 0 pelanggaran batas lapisan
bash tool/audit.sh                # aturan arsitektur yang tidak dilihat analyzer

# 5. Uji
flutter test                      # 21 berkas uji unit/widget/bloc

# 6. Build
flutter build apk --debug         # bukti rakitan lengkap
```

### Yang **normal** terjadi sebelum langkah 3

Sebelum `build_runner`, analyzer akan melaporkan ratusan galat *undefined*:
`_$AppDatabase`, `$TransactionsTable`, `TransactionsCompanion`, `LocalTransaction`,
`Product`, `Staff`, `_$MasterDaoMixin`, dan seluruh kerabatnya. **Itu bukan bug** —
semuanya dibangkitkan `drift_dev`. Jangan memperbaikinya satu per satu.

---

## 2. Titik gagal yang sudah diketahui, beserta perbaikannya

Diurutkan dari yang paling mungkin muncul.

| # | Gejala | Berkas | Perbaikan |
|---|---|---|---|
| 1 | Galat pada `PrinterManager.instance`, `PrinterType`, `BluetoothPrinterInput`, `UsbPrinterInput`, `PrinterDevice` | `lib/core/printer/adapters/platform_printer_adapter.dart` | **Satu-satunya berkas yang bergantung pada API `flutter_pos_printer_platform_image_3`.** Sesuaikan pemanggilan paket dengan versi yang benar-benar terpasang; jangan ubah `PrinterTransport` |
| 2 | `CardThemeData` / `DialogThemeData` tidak dikenal | `lib/shared/theme/app_theme.dart` | Tipe ini milik Flutter **3.27+**. Pada 3.24–3.26 namanya `CardTheme` / `DialogTheme` — turunkan nama tipenya, jangan hapus temanya |
| 3 | `registerPeriodicTask` menolak parameter | `lib/core/sync/background_sync_worker.dart` | Tanda tangan `workmanager` berubah antar-minor. Sesuaikan nama parameter; pertahankan `ExistingWorkPolicy.keep` dan `NetworkType.connected` |
| 4 | `Generator.drawer` / `QRSize` / `PosFontType` tidak ada | `lib/core/printer/escpos_receipt_builder.dart` | API `esc_pos_utils_plus` bergeser antar-versi. **Pertahankan aturan:** laci hanya untuk `CASH`, QR berisi UUID **penuh** |
| 5 | `CapabilityProfile.load()` gagal di `flutter test` | `test/unit/printer_test.dart` | Memuat aset paket. Bila gagal di lingkungan uji, tandai grup `EscPosReceiptBuilder` dengan `skip:` dan pindahkan verifikasinya ke uji integrasi |
| 6 | `Permission.ignoreBatteryOptimizations` tidak dikenal | `lib/core/sync/battery_optimization.dart` | Tersedia sejak `permission_handler` 10. Periksa versi terpasang |
| 7 | Uji kontrak dilewati | `test/contract/payment_methods_test.dart` | Normal bila `posgodinov-fe/` tidak ada di sebelahnya. Bila ADA tetapi uji gagal → **daftar metode pembayaran menyimpang; ini kegagalan sungguhan, jangan diabaikan** |

---

## 3. Yang belum pernah dijalankan sama sekali

Ketiga kategori ini adalah alasan sebagian fase di
[10](10-flutter-implementation-plan.md) berstatus 🟡, bukan 🟢.

### 3.1 Uji integrasi — butuh perangkat/emulator

```bash
flutter test integration_test/offline_flow_test.dart -d <device-id>
```

Menutup skenario matriks [09 §10] yang tidak dapat diuji sebagai unit:

| Skenario | Yang diverifikasi |
|---|---|
| #1 Antrean menumpuk | Transaksi + shift induk sama-sama menunggu |
| #8 Batch > 200 | Terpotong tepat 200, urut kronologis |
| #6/#7 Void | UUID **tidak berubah**, baris kembali ke antrean |
| #11 Penulisan atomik | Transaksi tanpa shift induk ditolak FK, tidak menyisakan baris yatim |
| Tutup shift | `expected` & `discrepancy` dari transaksi nyata |

### 3.2 Uji perangkat keras — tidak ada penggantinya

| Fase | Yang harus diuji | Tanpa ini |
|---|---|---|
| **M6** | Cetak di **printer SPP fisik**; cabut daya printer di tengah shift | Tidak ada bukti transport bekerja; kegagalan cetak mungkin membatalkan transaksi |
| **M8** | Aplikasi **ditutup penuh**, layar mati, tunggu 20 menit | WorkManager bekerja di emulator dan diam di outlet — tanpa pesan error apa pun |
| **M9** | Perangkat ter-*provision* Device Owner; penguji berusaha keluar 1 jam | Kiosk hanya *screen pinning* yang ditembus dalam 3 detik |

Prosedur rincinya ada di [10](10-flutter-implementation-plan.md) fase masing-masing.

### 3.3 Build rilis

```bash
# Tanpa android/key.properties → memakai kunci debug (TIDAK layak edar)
flutter build apk --release --split-per-abi

# Dengan keystore sungguhan: salin android/key.properties.example dulu
```

---

## 4. Keputusan tim yang memblokir rilis

Empat butir ini **tidak dapat diselesaikan dengan menjalankan perintah**.

| # | Butir | Status | Konsekuensi bila diabaikan |
|---|---|---|---|
| 1 | **Enkripsi basis data** — SQLCipher (opsi A) vs tanpa enkripsi (opsi B), [09 §1.4] | 🔴 Belum diputuskan | `posgodinov.db` memuat `pin_hash` bcrypt **seluruh kasir**. PIN 4–6 digit dapat di-*brute force* offline dalam hitungan menit |
| 2 | **`PAYMENT_METHODS` disepakati formal**, [09 §9.3] | 🔴 Belum | Mengganti nama nilai setelah produksi memecah laporan historis **secara permanen** |
| 3 | **Provisioning Device Owner** untuk Kiosk, [09 §4.4] | 🔴 Belum | Kiosk hanya *screen pinning* |
| 4 | **Perilaku K-03** — keranjang tertahan (implementasi) vs transaksi `COMPLETED` (09 §3.6) | 🟠 Menunggu persetujuan | Lihat [10](10-flutter-implementation-plan.md) fase M9, penyimpangan #1 |

### Cara menerapkan opsi A (SQLCipher)

Bila tim memilih enkripsi:

```yaml
# pubspec.yaml — KEDUANYA TIDAK BOLEH terpasang bersamaan
# (bentrok simbol sqlite3_open)
- sqlite3_flutter_libs: ^0.5.24
+ sqlcipher_flutter_libs: ^0.6.0
```

```dart
// lib/core/database/app_database.dart — buka komentar pada openAppDatabase()
setup: (Database raw) {
  raw.execute("PRAGMA key = '${await storage.getOrCreateDatabaseKey()}'");
},
```

Lalu **uji migrasi**: perangkat yang sudah membawa `posgodinov.db` tidak
terenkripsi harus tetap dapat membuka datanya, atau prosedur pemasangan ulang
harus disiapkan. Jangan lewati langkah ini — antrean penjualan yang belum
tersinkron ada di berkas itu.

---

## 5. Sisa pekerjaan di sisi kode

Butir yang ditandai `[ ]` di [10](10-flutter-implementation-plan.md) dan **dapat
dikerjakan tanpa keputusan tim**:

| Berkas | Pekerjaan | Fase |
|---|---|---|
| `android/.../printer/SunmiPrinterPlugin.kt` | Belum ada. Butuh `IWoyouService.aidl` resmi dari SDK Sunmi, **atau** adopsi paket `sunmi_printer_plus`. AIDL yang ditulis dari ingatan akan ter-*compile* tetapi memanggil metode yang salah | M6 |
| `test/` | Uji `ConnectivityMonitor` (butuh `Connectivity` tiruan + jam palsu untuk debounce 2 dtk) | M2 |
| `assets/fonts/` | Verifikasi keenam berkas font benar-benar ada; blok `fonts:` di `pubspec.yaml` sudah aktif | M0 |
| `lib/app.dart` | Tambah `flutter_localizations` saat date picker pertama dibutuhkan — saat ini `locale` sengaja tidak diset | M1 |

---

## 6. Setelah semuanya hijau

Perbarui [10](10-flutter-implementation-plan.md):

1. Ubah status fase dari `🟢 Kode lengkap — menunggu …` menjadi `✅ Terverifikasi`
2. Centang butir M0.2 yang sudah dijalankan
3. Isi tabel perangkat tervalidasi pada fase M8
4. Catat versi Flutter dan tanggal verifikasi di bawah tabel status

Perbarui dokumen ini bila menemukan titik gagal baru — §2 adalah tempatnya, dan
nilainya justru bertambah setiap kali seseorang menabrak sesuatu yang belum
tercatat.

---

## Ringkasan satu layar

```bash
cd posgodinov-mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # WAJIB DULU
flutter analyze && dart run import_lint && bash tool/audit.sh
flutter test
flutter test integration_test/offline_flow_test.dart -d <device>
flutter build apk --release --split-per-abi
```

| Yang tidak dapat diverifikasi perintah mana pun |
|---|
| Cetak di printer SPP fisik (M6) |
| Sinkronisasi latar pada perangkat OEM, aplikasi tertutup (M8) |
| Kiosk pada perangkat Device Owner (M9) |
| Empat keputusan tim di §4 |
