# posgodinov-android

Aplikasi kasir POS Godinov berbasis **Android Kotlin Native** untuk Tablet Android dan Handheld POS (Sunmi / iMin). Proyek ini menggantikan implementasi Flutter lama yang kini diarsipkan di [`../posgodinov-mobile-flutter`](../posgodinov-mobile-flutter).

### Dokumen Referensi Utama
- **Spesifikasi API Backend:** [`../docs/03-api-specifications.md`](../docs/03-api-specifications.md)
- **Skema Database:** [`../docs/02-database-schema.md`](../docs/02-database-schema.md)
- **Kebutuhan Fitur Mobile & Kiosk:** [`../docs/04-frontend-mobile-web-requirements.md`](../docs/04-frontend-mobile-web-requirements.md)
- **Design System & Brand:** [`../docs/06-ui-ux-design-system.md`](../docs/06-ui-ux-design-system.md) · [`../docs/brand-guideline-godinov-pos.md`](../docs/brand-guideline-godinov-pos.md)
- **Aturan Struktur Kode (wajib):** [`RULES.md`](RULES.md)

---

## 1. Spesifikasi Toolchain & SDK

Seluruh versi di bawah dikunci di [`gradle-wrapper.properties`](gradle/wrapper/gradle-wrapper.properties), [`libs.versions.toml`](gradle/libs.versions.toml), dan [`app/build.gradle.kts`](app/build.gradle.kts):

| Komponen | Versi / Nilai | Catatan Penting |
|---|---|---|
| **Gradle Wrapper** | `9.5.1` | Jangan ubah kecuali memang upgrade terencana (mempengaruhi cache CI). |
| **Android Gradle Plugin** | `9.0.1` | Memiliki *Built-in Kotlin* aktif secara bawaan. **Jangan** menambahkan `alias(libs.plugins.kotlin.android)` di `app/build.gradle.kts` karena akan ditolak AGP 9.0. |
| **Kotlin** | `2.3.20` | Dideklarasikan `apply false` di root untuk mengunci versi compiler Kotlin AGP. |
| **Java / JVM Target** | `17` | `sourceCompatibility`, `targetCompatibility`, dan `jvmTarget = 17`. |
| **Compile / Target SDK** | `36` | Minimum SDK: `24` (Android 7.0+, mencakup mayoritas handheld POS). |
| **NDK Version** | `28.2.13676358` | Disamakan dengan standar toolchain repositori. |

---

## 2. Setup & Build Lokal

1. Pastikan berkas `local.properties` tersedia di root `posgodinov-android/` (otomatis dibuat Android Studio, dan **tidak pernah di-commit**):
   ```properties
   sdk.dir=/opt/android-sdk
   # Opsional — override URL backend khusus mesin lokal:
   # api.base.url=http://10.0.2.2:8080
   ```

2. Jalankan build melalui wrapper dari dalam folder `posgodinov-android/`:
   ```bash
   ./gradlew assembleDebug      # Output: app/build/outputs/apk/debug/app-debug.apk
   ./gradlew assembleRelease    # Output: app/build/outputs/apk/release/app-release.apk
   ```

---

## 3. Konfigurasi `API_BASE_URL` & `BuildConfig`

Aplikasi membaca alamat server melalui konstanta *compile-time* `id.godinov.pos.BuildConfig.API_BASE_URL` (tanpa garis miring `/` di akhir).

### Urutan Prioritas Resolusi URL (Saat Build)
1. **Argumen CLI / Environment Variable (`API_BASE_URL`):**
   Dipakai oleh CI/CD atau *one-off build* manual (`./gradlew assembleRelease -PAPI_BASE_URL=https://...`).
2. **Properti Lokal (`api.base.url` di `local.properties`):**
   Dipakai saat pengembangan di emulator (`http://10.0.2.2:8080`) atau perangkat POS fisik di jaringan LAN (`http://192.168.1.10:8080`) tanpa mengotori Git.
3. **Nilai Bawaan Produksi:**
   `https://api-pos.godinov.web.id`

### Mengapa `BuildConfig.kt` Dibangkitkan oleh Task Kustom?
`buildFeatures { buildConfig = true }` bawaan AGP menghasilkan berkas Java (`BuildConfig.java`) yang memicu `javac` dan `JdkImageTransform` (`jlink --disable-plugin system-modules`), yang gagal pada mesin pengembangan Linux dengan OpenJDK 24+.

Sebagai gantinya, [`GenerateBuildConfigTask`](app/build.gradle.kts) membangkitkan `BuildConfig.kt` dalam **Kotlin murni** dan mendaftarkannya lewat Variant API resmi AGP (`variant.sources.kotlin.addGeneratedSourceDirectory`). Hasilnya:
- Cara pakai di kode tetap identik (`BuildConfig.API_BASE_URL`, `BuildConfig.DEBUG`, `BuildConfig.VERSION_NAME`).
- Bebas kompilasi `.java` (`NO-SOURCE`), berjalan mulus di JDK 17 (CI), JBR Android Studio, maupun OpenJDK terbaru.
- Mendukung penuh Gradle Build Cache (`@CacheableTask`).

### Kebijakan Keamanan HTTP vs HTTPS
- **Build Release ([`src/main/AndroidManifest.xml`](app/src/main/AndroidManifest.xml)):** `android:usesCleartextTraffic="false"` — **wajib HTTPS**; koneksi `http://` ditolak oleh sistem operasi Android.
- **Build Debug ([`src/debug/AndroidManifest.xml`](app/src/debug/AndroidManifest.xml)):** Meng-override `android:usesCleartextTraffic="true"` hanya untuk APK Debug agar pengembangan lokal ke `localhost` / IP LAN tetap berjalan.

---

## 4. Kontrak Kritis yang Wajib Dijaga

1. **Jangan Mengubah `applicationId = "id.godinov.pos"`**
   ID paket ini dipakai langsung pada prosedur teknisi lapangan untuk *provisioning* Kiosk / Device Owner:
   ```bash
   adb shell dpm set-device-owner id.godinov.pos/...
   ```
   Mengubah `applicationId` akan merusak prosedur instalasi perangkat di outlet.

2. **Jangan Mengubah `android:allowBackup="false"`**
   Database lokal aplikasi kasir menyimpan data sensitif outlet (termasuk hash PIN seluruh kasir dan antrean transaksi offline). Mengaktifkan Auto Backup akan menyalin basis data tersebut ke Google Drive akun perangkat di luar kendali outlet.

3. **Aturan Integrasi Backend Go ([`03-api-specifications.md`](../docs/03-api-specifications.md))**
   - **Uang = Bilangan Bulat (`Long`):** Jangan pernah menggunakan `Double` atau `Float` untuk harga, diskon, pajak, maupun kembalian.
   - **List Kosong Bernilai `null`:** Endpoint backend Go kerap mengembalikan `null` alih-alih `[]` saat koleksi kosong. Pastikan parser JSON selalu memetakan `null` menjadi `emptyList()`.
   - **Pemisahan Ketat Jenis Token:** Endpoint `/v1/business/*` hanya menerima *access token*, sedangkan `/v1/pos/*` hanya menerima *device token* (salah token menghasilkan HTTP `401`). Backend tidak memakai header `X-Tenant-ID`.

---

## 5. Penandatanganan APK (Release Signing)

- **Pengembangan Lokal:** Salin [`key.properties.example`](key.properties.example) menjadi `key.properties` dan arahkan ke berkas `.jks` Anda. Berkas `key.properties` dan `*.jks` sudah di-ignore di [`.gitignore`](.gitignore).
- **GitHub Actions CI:** Simpan 4 **Repository Secrets** berikut di GitHub (*Settings → Secrets and variables → Actions → Secrets*):
  - `ANDROID_KEYSTORE_BASE64` — hasil encode base64 satu baris (`base64 -w 0 godinov-release.jks`)
  - `ANDROID_STORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- **Fallback Otomatis:** Jika `key.properties` maupun GitHub Secrets belum diisi, task `assembleRelease` otomatis menggunakan kunci `debug` agar APK tetap ter-sign dan dapat dipasang untuk pengujian awal.
  > **Peringatan Produksi:** Pastikan keempat GitHub Secrets sudah dipasang sebelum mendistribusikan APK ke perangkat kasir outlet. Android menolak pembaruan APK (update) bila kunci penandatangan berubah.

---

## 6. Pipeline CI/CD & Strategi Caching

Workflow didefinisikan di [`../.github/workflows/android-ci-cd.yml`](../.github/workflows/android-ci-cd.yml).

### Pemicu (Trigger)
- **Otomatis:** Saat ada `push` / *merge* ke branch `main` yang mengubah berkas di dalam `posgodinov-android/**` atau `.github/workflows/android-ci-cd.yml` (perubahan pada sub-proyek lain di monorepo tidak memicu runner Android).
- **Manual (`workflow_dispatch`):** Melalui tab **Actions → Android CI/CD → Run workflow**, dengan opsi memilih tipe build (`release` / `debug`) dan override `api_base_url` sementara.

### Mengubah Domain Produksi di CI Tanpa Edit Kode
Tambahkan atau ubah **GitHub Repository Variable** (*Settings → Secrets and variables → Actions → Variables*) bernama `API_BASE_URL`. Selama tidak diisi di input manual, workflow otomatis memprioritaskan `vars.API_BASE_URL` sebelum jatuh ke default `https://api-pos.godinov.web.id`.

### Perilaku Cache Gradle di Runner
Workflow dijalankan pada branch `main` dengan `gradle/actions/setup-gradle@v4` serta flag optimasi di [`gradle.properties`](gradle.properties) (`caching`, `parallel`, `vfs.watch`):
- **Build pertama** mengunduh distribusi Gradle `9.5.1` dan seluruh dependencies lalu mengunggahnya ke GitHub Cache milik branch `main`.
- **Build berikutnya** langsung melakukan **Cache Hit** (0 unduhan ulang binary Gradle maupun dependencies, serta task yang tidak berubah diambil dari `FROM-CACHE`).
- Unduh ulang hanya terjadi jika `distributionUrl` Gradle diubah, kuota cache repo (10 GB) penuh, atau tidak ada eksekusi sama sekali selama **lebih dari 7 hari**.

### Mengunduh Hasil Build APK
Runner GitHub bersifat *ephemeral* (langsung dihapus seusai job). Berkas APK hasil build disimpan selama **7 hari** dan dapat diunduh dari:
**GitHub → Tab Actions → Pilih Run Execution → Bagian Artifacts (bawah halaman Summary)**.

---

## 7. Dukungan AI Coding Agent (Antigravity)

Repositori ini menyertakan *project-scoped skill* khusus desain antarmuka Android Native (`mobile-android-design` — Material Design 3 & Jetpack Compose) di `../.agents/skills/mobile-android-design/SKILL.md` yang otomatis aktif saat sesi Antigravity dibuka di workspace ini.
