# 19 · Laporan Eksekusi QA E2E — Rilis v2

| | |
|---|---|
| **Tanggal eksekusi awal** | 29 Agustus 2026, 09:44 – 10:09 WIB — *hasil: GAGAL, lihat §1.1* |
| **Tanggal Final Verification Run** | 29 Agustus 2026, 13:29 – 13:36 WIB |
| **Branch** | `dev-v2` |
| **Commit dasar** | `5ff552c` — *fix(pos): cegah bottom bar mengkerut dan label saling menempel* |
| **Penguji** | QA Automation (eksekusi otomatis) |
| **Runner** | `qa_runner_web.sh --skip-backend` (Playwright) · `qa_runner_mobile.sh` (Maestro) |
| **Kode produksi diubah** | **Ya, pada eksekusi final** — 3 berkas mobile untuk menutup BLOCK-01 & BLOCK-02. Nol baris pada `posgodinov-fe` dan `posgodinov-be`. Rincian di §7. |

---

## 1. Ringkasan Eksekutif

> ### STATUS KESELURUHAN: **LULUS PENUH — LAYAK RILIS**
>
> Kedua jalur lulus tanpa sisa. Jalur Web mempertahankan 8/8. Jalur Mobile —
> yang sebelumnya tidak dapat diselesaikan sama sekali — kini menembus alur M13
> dari peluncuran sampai baris audit tertulis, **nol `FATAL EXCEPTION`**, dan
> reproducible pada tiga eksekusi berturut-turut.
>
> Aturan bisnis M13 (Void Threshold, butir 5 & 6) **terbukti** pada rilis ini.

| Suite | Skenario | Hasil | Status |
|---|---|---|---|
| **Web PWA** — Playwright | M15 · Blind Closing (`UAT-V2-01`, P-12) | 8 lulus / 0 gagal (23,6 s) | ✅ **LULUS** |
| **Mobile** — Maestro | M13 · Void Threshold (`UAT-MV2-21`, `[11 §M13.4]`) | 37 perintah / 0 gagal | ✅ **LULUS** |

### 1.1 Temuan penghambat rilis — SELURUHNYA TERTUTUP

| ID | Ringkasan | Status | Bukti penutupan |
|---|---|---|---|
| ~~**BLOCK-01**~~ | Crash `FATAL EXCEPTION` pada plugin `flutter_pos_printer_platform_image_3`. | ✅ **DITUTUP** | Dua cacat berbeda ditemukan pada plugin yang sama, keduanya diperbaiki dari sisi aplikasi — lihat §7.1. Worker latar dijalankan paksa; engine headless terbentuk, `[bg-sync] ok=true`, lalu dibongkar **tanpa crash**. |
| ~~**BLOCK-02**~~ | Void Threshold tidak terverifikasi. | ✅ **DITUTUP** | Alur M13 selesai penuh. Baris `void_logs` tertulis dengan `quantity_before: 10 → quantity_after: 4`, `value_amount_minor: 10800000`, `reason_code: WRONG_QTY`. Kedua tangkapan layar bukti terbentuk. |
| ~~**NOTE-01**~~ | Urutan penanganan layar "Sinkronisasi Data" pada `M13-void-threshold.yaml`. | ✅ **DITUTUP** | Blok dipindah sebelum asersi layar utama. Menjalankannya menyingkap bahwa **isinya pun keliru** — lihat §7.2. |

**Rekomendasi:** v2 layak dirilis dari sudut pandang kedua suite ini. Sisa
tindak lanjut yang masih terbuka bersifat perluasan cakupan, bukan penghambat —
lihat §6.

---

## 2. Rincian Eksekusi Web (Playwright)

> **Final Verification Run (29 Agu 2026, 13:29 WIB) — hasil identik: 8 lulus / 0 gagal
> dalam 23,6 detik.** Rincian di bawah berasal dari eksekusi awal dan tetap berlaku;
> jalur Web tidak pernah gagal dan tidak menerima satu pun perubahan kode.

### 2.1 Ikhtisar

| Butir | Nilai |
|---|---|
| Perintah | `./qa_runner_web.sh --skip-backend` |
| Mulai / selesai | 09:44:42 → 09:45:10 WIB |
| Durasi total runner | **28 detik** |
| Durasi murni Playwright | **21,8 detik** |
| Jumlah tes | **8** |
| Lulus / Gagal / Dilewati | **8 / 0 / 0** |
| Worker | 1 (sesuai `playwright.config.ts` untuk mesin lokal) |
| Retry | 0 (disengaja — tes yang lulus pada percobaan kedua tidak dapat dipercaya) |
| Exit code | `0` |
| Status `.last-run.json` | `{"status":"passed","failedTests":[]}` |
| Artefak kegagalan | **Tidak ada** — `test-results/` hanya berisi `.last-run.json`, tanpa trace/screenshot/video |
| Laporan HTML | `posgodinov-fe/playwright-report/index.html` (532 KB) |

### 2.2 Rincian per skenario

| # | Skenario | Durasi | Status |
|---|---|---|---|
| 1 | `UAT-V2-01` · tidak membocorkan satu pun angka sistem | 2,1 s | ✅ |
| 2 | `UAT-V2-01` · memuat tepat tiga isian deklarasi yang dapat diisi | 2,9 s | ✅ |
| 3 | tombol TUTUP SHIFT terkunci sampai uang fisik laci diisi | 2,6 s | ✅ |
| 4 | dialog konfirmasi tidak membisikkan angka sistem | 2,6 s | ✅ |
| 5 | detektor memerah — Lapis 1 · nominal berlabel baru | 1,9 s | ✅ |
| 6 | detektor memerah — Lapis 2 · istilah terlarang | 2,1 s | ✅ |
| 7 | detektor memerah — Lapis 3 · prosa bersanding dengan angka | 2,0 s | ✅ |
| 8 | detektor memerah — Lapis 1 · nominal disembunyikan CSS | 2,0 s | ✅ |

### 2.3 Status detektor anti-bocor

Detektor `findSystemNumberLeaks()` membaca `.pos-root` lewat **`textContent`**
(bukan `innerText`), sehingga simpul yang disembunyikan CSS ikut terbaca.

| Lapis | Yang diperiksa | Pelanggaran | Terbukti dapat memerah |
|---|---|---|---|
| **Lapis 1 — NILAI** | Jumlah nominal `Rp` harus tepat 3 (ketiga isian deklarasi); modal awal `Rp 500.000` tidak boleh muncul dalam bentuk apa pun | **0** | ✅ tes #5 & #8 |
| **Lapis 2 — ISTILAH** | 10 istilah terlarang: `expected`, `discrepancy`, `variance`, `ekspektasi`, `diharapkan`, `seharusnya`, `total penjualan`, `jumlah transaksi`, `penjualan tunai`, `saldo` | **0** | ✅ tes #6 |
| **Lapis 3 — PROSA** | `selisih` / `modal awal` boleh sebagai prosa penjelas, tidak boleh berdampingan dengan angka (diperiksa per elemen daun) | **0** | ✅ tes #7 |

**Kesimpulan:** layar Tutup Shift **tidak membocorkan satu pun angka sistem**.
Dialog konfirmasi juga bersih — tidak memuat istilah terlarang maupun nominal
`Rp` apa pun.

> **Catatan mutu — mengapa tes #5–#8 penting.**
> Keempatnya menyuntikkan kebocoran palsu ke DOM saat runtime lalu menuntut
> detektor memerah. Tanpa keempatnya, hasil "0 pelanggaran" pada tes #1–#4 tidak
> dapat dibedakan dari detektor yang rusak dan diam. Karena keempatnya lulus,
> angka nol di atas adalah nol yang bermakna.

### 2.4 Penyimpangan prosedur — flag `--skip-backend`

Runner dijalankan dengan `--skip-backend`, **bukan** bentuk polosnya. Alasannya
teknis dan wajib dicatat:

- Port **8080** sudah dipegang `com.docker.backend.exe` (PID 25892) — backend
  berjalan lewat Docker, bukan lewat `go run`.
- Bentuk polos `./qa_runner_web.sh` akan menyalakan backend Go-nya sendiri di
  8080, lalu pada `cleanup()` menjalankan `taskkill //F //T //PID 25892` —
  **mematikan Docker Desktop penguji**, bukan proses miliknya sendiri.
- Bentuk polos juga menuntut PostgreSQL di `localhost:5432`, sementara container
  memetakan **5433→5432**. Langkah `CREATE DATABASE posgodinov_test` akan gagal
  lebih dulu.

`--skip-backend` adalah jalur yang didokumentasikan skrip itu sendiri untuk suite
ini (*"hanya FE (cukup untuk suite M15)"*), dan sahih secara metodologis:
`UAT-V2-01` bermodus **Offline** — `pos-bootstrap.ts` memutus seluruh trafik ke
`PW_API_ORIGIN` lewat `page.route(...).abort('internetdisconnected')`. Skenario
ini memang dirancang membuktikan layar Tutup Shift mandiri dari backend.

**Konsekuensi cakupan:** database `posgodinov_test` tidak pernah dibuat, migrasi
tidak dijalankan, dan skenario **Online** (mis. `UAT-V2-02`, yang membaca body
`POST /v1/pos/sync`) **tidak termasuk** dalam eksekusi ini.

---

## 3. Rincian Eksekusi Mobile (Maestro)

> ### ⚠️ Bagian ini adalah CATATAN EKSEKUSI AWAL (09:44 – 10:09 WIB) — sudah TERTUTUP
>
> Isinya dipertahankan apa adanya sebagai jejak diagnosis, bukan sebagai status
> rilis. **Hasil final: LULUS.** Seluruh temuan di §3.3 dan §3.5 sudah
> diselesaikan; solusinya diuraikan di **§7**.
>
> Final Verification Run (29 Agu 2026, 13:34 WIB · `~/.maestro/tests/2026-08-29_133406/`):
>
> | | |
> |---|---|
> | Perintah Maestro | **37 COMPLETED / 0 FAILED** |
> | `FATAL EXCEPTION` di logcat | **0** |
> | Void Sheet pada ketukan minus ke-6 | ✅ muncul — `Rp 108.000` (6 × Rp 18.000) |
> | Kontrol negatif (ketukan ke-1…5) | ✅ sheet **tidak** muncul |
> | Baris audit `void_logs` | `scope=cartLine`, `quantity_before=10`, `quantity_after=4`, `reason_code=WRONG_QTY`, `synced=1` |
> | Reproducibility | 3 eksekusi penuh berturut-turut, hasil identik |

### 3.1 Ikhtisar — empat percobaan, empat kegagalan *(eksekusi awal)*

| # | Waktu | Konfigurasi | Berhenti di | Penyebab |
|---|---|---|---|---|
| 1 | 09:44 | `./qa_runner_mobile.sh` (apa adanya) | Precheck toolchain | `maestro` tidak terpasang di mesin |
| 2 | 09:53:41 → 09:57:21 | `DEVICE=emulator-5556` | Langkah 2 — assert layar awal | Emulator tablet **tanpa jaringan**; sync master-data gagal |
| 3 | 10:03:05 → 10:04:23 | `DEVICE=…5556 SKIP_BUILD=1` | Langkah 2 — assert layar awal | **Aplikasi crash**; Maestro menemukan Home screen Android |
| 4 | 10:06:18 → 10:07:12 | idem | Langkah 2.4 — tap keypad PIN | **Aplikasi crash** setelah `hideKeyboard` |
| 5 | 10:08:11 → 10:09:05 | idem | Langkah 2.4 — tap keypad PIN | **Aplikasi crash** — identik dengan #4 |

Build APK debug dilakukan segar pada percobaan #2 (`assembleDebug` **126,5 detik**,
APK 190 MB, 29 Agu 09:56). Percobaan #3–#5 memakai APK yang sama (`SKIP_BUILD=1`).

### 3.2 Status alur *peak quantity* dan kemunculan Void Sheet

> ### ❌ **TIDAK TERVERIFIKASI**

Alur tidak pernah mencapai layar kasir, sehingga **tidak satu pun** asersi inti
M13 sempat dijalankan:

| Langkah alur | Yang seharusnya dibuktikan | Status |
|---|---|---|
| 5 — naikkan kuantitas ke 10 | Puncak kuantitas tercatat 10; menaikkan tidak pernah diaudit | ⬜ tidak dijalankan |
| 6 — lima ketukan minus | Penurunan 5 (== ambang) **lolos tanpa gesekan** — kontrol negatif | ⬜ tidak dijalankan |
| 7 — ketukan minus **keenam** | Penurunan 6 (> ambang 5) **DIBLOKIR** | ⬜ tidak dijalankan |
| 8 — **Void Reason Sheet muncul** | Sheet "Penurunan besar memerlukan pembatalan" tampil, memuat "6 unit Espresso akan lenyap", "melewati ambang 5 unit", peringatan struk audit | ⬜ **tidak dijalankan** |
| 8b — kuantitas belum berubah | Gerbang memutuskan sebelum `CartCubit.applyAudited` | ⬜ tidak dijalankan |
| 9–10 — pilih alasan, terapkan | Setelah alasan tercatat, kuantitas turun 10 → 4 | ⬜ tidak dijalankan |

**Tangkapan layar bukti** (`m13-01-void-sheet`, `m13-02-setelah-void`) **tidak
terbentuk.** Direktori `posgodinov-mobile/build/maestro/` kosong.

Langkah terjauh yang tercapai (percobaan #4 dan #5):

```
Launch app "id.godinov.pos"................................... COMPLETED
Assert ".*(MASUK SEBAGAI KASIR|Modal Awal Laci|KERANJANG).*".. COMPLETED
Assert "Pemasangan Perangkat" is not visible.................. COMPLETED
Run flow when "Sinkronisasi Data" is visible.................. SKIPPED
Run flow when "MASUK SEBAGAI KASIR" is visible:
  Tap on "kasir01"............................................ COMPLETED
  Input text ${STAFF_ID}...................................... COMPLETED
  Hide Keyboard............................................... COMPLETED
  Tap on "${STAFF_PIN[0]}".................................... FAILED
      Element not found: Text matching regex: 1
```

Pemilih keypad **tidak salah**. Tangkapan layar Maestro pada detik kegagalan
menunjukkan **Home screen Android** — proses aplikasi sudah mati. Digit `1`
memang tidak ada, karena aplikasinya tidak ada.

### 3.3 BLOCK-01 — Crash reproducible pada penghancuran Activity

Dikonfirmasi lewat `adb logcat -b crash` pada dua percobaan berturut-turut
(buffer dikosongkan sebelum percobaan #5 untuk memastikan bukan sisa lama):

```
FATAL EXCEPTION: main
Process: id.godinov.pos, PID: 6380
java.lang.RuntimeException: Unable to destroy activity
    {id.godinov.pos/id.godinov.pos.posgodinov_mobile.MainActivity}:
    kotlin.UninitializedPropertyAccessException:
        lateinit property bluetoothService has not been initialized
Caused by: kotlin.UninitializedPropertyAccessException:
        lateinit property bluetoothService has not been initialized
    at com.sersoluciones.flutter_pos_printer_platform
        .FlutterPosPrinterPlatformPlugin.onDetachedFromActivity(
            FlutterPosPrinterPlatformPlugin.kt:244)
```

**Varian kedua** dengan akar yang sama, dipicu dari jalur latar belakang:

```
FATAL EXCEPTION: main
kotlin.UninitializedPropertyAccessException:
    lateinit property bluetoothService has not been initialized
  at com.sersoluciones.flutter_pos_printer_platform
      .FlutterPosPrinterPlatformPlugin.onDetachedFromEngine(
          FlutterPosPrinterPlatformPlugin.kt:180)
  at io.flutter.embedding.engine.FlutterEngine.destroy(FlutterEngine.java:511)
  at dev.fluttercommunity.workmanager.BackgroundWorker
      .stopEngine$lambda$0(BackgroundWorker.kt:309)
...
W/ActivityTaskManager: Force finishing activity
    id.godinov.pos/.posgodinov_mobile.MainActivity
I/ActivityManager: Process id.godinov.pos (pid 4264) has died: fg TOP
```

**Analisis.** Plugin `flutter_pos_printer_platform_image_3` menginisialisasi
`bluetoothService` hanya pada jalur *attach* yang melibatkan Activity. Kedua jalur
pembongkarannya — `onDetachedFromActivity` dan `onDetachedFromEngine` — mengakses
field `lateinit` itu tanpa penjagaan. Ketika:

- **MainActivity dihancurkan** (aplikasi ditutup, di-update lewat `adb install -r`,
  atau perubahan konfigurasi), atau
- **`workmanager` membongkar headless engine**-nya setelah tugas sync latar selesai
  (`BackgroundWorker.stopEngine`) — engine latar tidak pernah punya Activity,
  sehingga field itu memang tidak pernah terinisialisasi,

pengecualian dilempar di thread `main` dan **seluruh proses aplikasi mati**.

Ini bukan kegagalan emulator. Ini jalur kode yang akan dilalui setiap perangkat
produksi setiap kali kasir menutup aplikasi atau `WorkManager` menyelesaikan sync
latar terjadwal.

| Butir | Nilai |
|---|---|
| Paket bermasalah | `flutter_pos_printer_platform_image_3` **1.2.4** (`pubspec.yaml`: `^1.0.8`) |
| Pemicu latar | `workmanager` **0.10.7** / `workmanager_android` **0.10.6** |
| Titik pakai di produksi | `lib/core/printer/adapters/platform_printer_adapter.dart` |
| Penjadwal sync latar | `lib/core/sync/background_sync_worker.dart` (`registerPeriodicTask`) |
| Reproduksibilitas | **2 dari 2** percobaan setelah lingkungan sehat (#4, #5) |
| Kontrol negatif | Aplikasi bertahan **45 detik idle** tanpa crash — crash terikat pada siklus hidup Activity/engine, bukan pada lama berjalan |

> **Sesuai constraint, tidak ada kode yang diperbaiki.** Temuan dicatat apa adanya
> untuk ditindaklanjuti tim pengembang.

### 3.4 Kendala lingkungan yang ditemui dan diperbaiki

Ketiganya adalah cacat **lingkungan uji**, bukan cacat produk. Dicatat agar
runbook berikutnya tidak mengulang jam yang sama.

**(a) Maestro CLI tidak terpasang** — `~/.maestro` tidak ada, `java` juga tidak
ada di `PATH`. Runner berhenti benar di precheck-nya sendiri dengan pesan yang
tepat. *Tindakan:* Maestro **2.9.0** dipasang lewat installer resmi; JDK memakai
**JetBrains Runtime bawaan Android Studio (OpenJDK 25.0.2)** yang sudah ada di
mesin — tidak ada JDK baru yang dipasang.

**(b) Runner memilih emulator yang salah.** `qa_runner_mobile.sh` mengambil baris
pertama `adb devices` berstatus `device`. Baris pertama adalah **emulator-5554
(ponsel, 1080×2400)**, sedangkan alur M13 mensyaratkan tata letak **tablet**
(panel keranjang menempel di kanan). *Tindakan:* memakai variabel env
`DEVICE=emulator-5556` yang sudah didokumentasikan skrip. **Rekomendasi:** jadikan
pemilihan perangkat eksplisit di runbook, atau tambahkan pemeriksaan
`ro.build.characteristics=tablet` pada skrip.

**(c) Emulator tablet kehilangan jaringan.** Pada percobaan #2 aplikasi tersangkut
di layar **"Sinkronisasi Data"** dengan galat:

```
I/flutter: uri: http://10.0.2.2:8080/v1/pos/sync/master-data
I/flutter: DioException [connection error]: null
I/flutter: Error: NetworkFailure: Tidak dapat terhubung ke server.
```

Diagnosis pada perangkat: `eth0` DOWN, `wlan0` `NO-CARRIER`,
`Active default network: none`, dan jam perangkat tertinggal 3 hari (26 Agu).
Emulator **ponsel** pada saat bersamaan sehat (`wlan0` UP di `10.0.2.16/24`,
`nc 10.0.2.2 8080` → `CONNECT_OK`) — membuktikan backend host memang terjangkau
dan cacatnya khusus instance AVD tablet. Toggle Wi-Fi lewat `adb` tidak memulihkan.
*Tindakan:* **cold boot** `Medium_Tablet` (`-no-snapshot-load`). Jaringan pulih
(`CONNECT_OK`), jam terkoreksi, binding perangkat & master data tetap utuh, dan
aplikasi mencapai layar **MASUK SEBAGAI KASIR** dengan benar — yang justru
membuka jalan bagi ditemukannya BLOCK-01.

### 3.5 NOTE-01 — Urutan langkah pada `M13-void-threshold.yaml`

Alur menempatkan penanganan layar sinkronisasi **setelah** asersi layar utama:

```yaml
- extendedWaitUntil:                 # ← langkah 2, gagal lebih dulu
    visible:
      text: ".*(MASUK SEBAGAI KASIR|Modal Awal Laci|KERANJANG).*"
    timeout: 30000
- assertNotVisible: "Pemasangan Perangkat"
- runFlow:                           # ← langkah 4, tidak pernah tercapai
    when:
      visible: "Sinkronisasi Data"
```

Ketika aplikasi memang mendarat di "Sinkronisasi Data" (percobaan #2), langkah 2
kehabisan waktu lebih dulu dan blok `runFlow` yang dirancang persis untuk keadaan
itu tidak pernah menyala. Akibatnya kegagalan jaringan dilaporkan sebagai
"layar utama tidak muncul" — pesan yang menunjuk ke arah yang salah.

Perbaikannya menyentuh berkas uji, bukan kode produksi; **tidak dilakukan** dalam
eksekusi ini sesuai constraint.

---

## 4. Catatan Lingkungan

### 4.1 Mesin penguji

| Butir | Nilai |
|---|---|
| Sistem operasi | Microsoft Windows 10 Home, build **19045** |
| Shell runner | Git Bash (MINGW64) |
| Docker | `posgodinov_backend` — `godinov/posgodinov-backend:latest`, `0.0.0.0:8080→8080` |
| | `posgodinov_db` — `postgres:17-alpine` (**PostgreSQL 17.11**), `0.0.0.0:5433→5432` |
| Kesehatan backend | `GET http://localhost:8080/health` → `OK` |
| Database tersedia | `posgodinov` (database `posgodinov_test` **tidak dibuat** — lihat §2.4) |

### 4.2 Tumpukan Web

| Butir | Versi |
|---|---|
| **Chromium (bundel Playwright)** | **151.0.7922.34** (revisi build `chromium-1234`) |
| Playwright | **1.62.1** (`@playwright/test ^1.62.1`) |
| Proyek Playwright | `chromium` saja — sesuai keputusan konfigurasi (armada outlet seluruhnya Blink) |
| Viewport | **1280 × 800** (tablet 10" landscape, di atas breakpoint `lg` 1024 px) |
| Locale / timezone | `id-ID` / `Asia/Jakarta` |
| Service Worker | **Diblokir** (`serviceWorkers: 'block'`) demi determinisme |
| Next.js | **16.3.0** (Turbopack), `Ready in 473ms` |
| Node.js | **v24.19.0** |
| pnpm | **11.22.0** |
| Server FE | `pnpm dev` di `http://localhost:3000`, dinyalakan oleh runner |

### 4.3 Tumpukan Mobile

| Butir | Versi / Nilai |
|---|---|
| **Maestro** | **2.9.0** (dipasang saat eksekusi ini) |
| JDK | **OpenJDK 25.0.2** — JetBrains Runtime bawaan Android Studio |
| Flutter | **3.47.1** (channel `stable`) |
| Dart | **3.13.1** |
| Engine revision | `5d531788691ec3404cac0cee66ead4007b177363` |
| Gradle | **9.1.0** |
| Build | `flutter build apk --debug` — `assembleDebug` **126,5 s**, APK **190 MB** |
| `applicationId` | `id.godinov.pos` |

### 4.4 Emulator

**Perangkat target — dipakai:**

| Butir | Nilai |
|---|---|
| Serial | **`emulator-5556`** |
| AVD | **`Medium_Tablet`** |
| Model | **Pixel Tablet** |
| Android | **15** (API level **35**) |
| Resolusi | **2560 × 1600**, density **320 dpi** |
| ABI | `x86_64` |
| Mode boot | **Cold boot** (`-no-snapshot-load`) setelah pemulihan jaringan |
| Jaringan | `Active default network: 100`; `10.0.2.2:8080` → `CONNECT_OK` |

**Perangkat lain yang menyala — TIDAK dipakai:**

| Butir | Nilai |
|---|---|
| Serial | `emulator-5554` |
| Model | `sdk_gphone16k_x86_64` |
| Android | 17 (API level 37) |
| Resolusi | 1080 × 2400, density 420 dpi |
| Alasan tidak dipakai | Tata letak **handheld** — keranjang menjadi bottom sheet, pemilih M13 tidak berlaku |

---

## 5. Artefak

| Artefak | Lokasi |
|---|---|
| Laporan HTML Playwright | `posgodinov-fe/playwright-report/index.html` |
| Status ringkas Playwright | `posgodinov-fe/test-results/.last-run.json` |
| Log layanan runner web | `.qa-logs/frontend.log` |
| Artefak debug Maestro #2 | `~/.maestro/tests/2026-08-29_095625/` — tangkapan layar "Sinkronisasi Data" |
| Artefak debug Maestro #3 | `~/.maestro/tests/2026-08-29_100325/` — tangkapan layar Home screen (aplikasi mati) |
| Artefak debug Maestro #4 | `~/.maestro/tests/2026-08-29_100622/` — tangkapan layar Home screen + hierarki |
| Artefak debug Maestro #5 | `~/.maestro/tests/2026-08-29_100814/` |
| **Final Verification Run — Web** | `posgodinov-fe/playwright-report/index.html` — 8 lulus / 0 gagal |
| **Final Verification Run — Mobile** | `~/.maestro/tests/2026-08-29_133406/` |
| **Tangkapan layar bukti M13** | `…/2026-08-29_133406/…/takeScreenshot/build/maestro/m13-01-void-sheet.png` (Void Sheet terbuka, `Rp 108.000`, keranjang masih 5 item) dan `m13-02-setelah-void.png` (kembali ke keranjang, `× 4`) |

---

## 6. Tindak Lanjut yang Disarankan

Ketiga butir P0/P2 yang menghambat rilis sudah **selesai** dan dicoret. Yang
tersisa adalah perluasan cakupan, bukan penghambat.

| Prioritas | Tindakan | Pemilik |
|---|---|---|
| ~~**P0**~~ | ~~Perbaiki BLOCK-01 — daftarkan plugin hanya pada engine ber-Activity.~~ ✅ **SELESAI** — §7.1 | ~~Tim Mobile~~ |
| ~~**P0**~~ | ~~Jalankan ulang `M13-void-threshold.yaml` sampai selesai untuk menutup BLOCK-02.~~ ✅ **SELESAI** — alur lolos penuh, kedua tangkapan layar terbentuk. | ~~QA~~ |
| ~~**P2**~~ | ~~Perbaiki NOTE-01 — pindahkan blok `runFlow "Sinkronisasi Data"`.~~ ✅ **SELESAI** — §7.2 | ~~QA~~ |
| ~~**P2**~~ | ~~Buat `qa_runner_mobile.sh` menolak perangkat non-tablet, atau wajibkan `DEVICE` eksplisit.~~ ✅ **SELESAI** — runner kini berhenti dan menampilkan model + resolusi tiap perangkat bila lebih dari satu siap. | ~~QA / DevOps~~ |
| **P1** | Jalankan skenario **Online** yang belum tercakup (mis. `UAT-V2-02`, yang membaca body `POST /v1/pos/sync`) dengan stack backend penuh. Port 8080 masih dipegang Docker, sehingga bentuk polos `qa_runner_web.sh` belum dapat dipakai. | QA |
| **P2** | Beri `qa_runner_web.sh` deteksi "port 8080 dimiliki proses lain" agar `cleanup()` tidak pernah mematikan proses yang bukan miliknya. Pada eksekusi final, 8080 terbukti dipegang `wslrelay` (PID 4408) + `com.docker.backend` (PID 25892). | DevOps |

---

## 7. Catatan Teknis — Solusi yang Menyelamatkan Suite Maestro

Tiga hal berbeda menghalangi suite ini, dan hanya satu yang tercatat pada
laporan awal. Ketiganya diringkas di sini karena masing-masing punya gejala
yang **menyesatkan penguji berikutnya**.

### 7.1 BLOCK-01 — dua cacat pada `flutter_pos_printer_platform_image_3` 1.2.4

Versi 1.2.4 sudah **yang terbaru** di pub.dev (diperiksa 29 Agu 2026); tidak ada
rilis yang memperbaikinya, dan kelas pluginnya `final` sehingga tidak dapat
diturunkan. Keduanya karena itu ditangani dari sisi aplikasi.

**Cacat 1 — engine tanpa Activity meledak saat dibongkar.** `bluetoothService`
dan `adapter` hanya diisi di `onAttachedToActivity`, tetapi `onDetachedFromEngine`
membongkarnya tanpa penjagaan — padahal plugin yang sama sudah memakai
`this::bluetoothService.isInitialized` di dua tempat lain. Yang terkena adalah
engine headless `workmanager`, yang tidak pernah punya Activity:

```
BackgroundWorker.kt:101  engine = FlutterEngine(applicationContext)   → registrant otomatis
BackgroundWorker.kt:309  engine?.destroy()                            → onDetachedFromEngine()
                                                                      → UninitializedPropertyAccessException
                                                                      → FATAL EXCEPTION: main
```

`FlutterEngineConnectionRegistry.remove()` tidak membungkus panggilan itu dengan
try/catch, sehingga lemparannya membunuh proses.

> **Solusi — Gradle plugin stripping.** `GeneratedPluginRegistrant.java`
> dibangkitkan Flutter tool dan **ter-gitignore**, jadi menyuntingnya tidak
> bertahan semenit pun. Tugas Gradle `stripPrinterPluginAutoRegistration`
> (`android/app/build.gradle.kts`) melepas blok registrasi plugin itu pada
> `preBuild` — setelah Flutter tool menulisnya, sebelum Kotlin/Java dikompilasi.
> `MainActivity.configureFlutterEngine()` lalu mendaftarkannya **manual**, dan
> karena `attachToActivity()` sudah berjalan lebih dulu, `add()` langsung
> menyusulkan `onAttachedToActivity`. Hasilnya: hanya engine ber-Activity yang
> memuat plugin ini, `bluetoothService` selalu terisi, dan engine latar tidak
> lagi membongkar sesuatu yang tidak pernah ia rakit.
>
> Tugas itu **gagal nyaring** (`GradleException`) bila bentuk templat Flutter
> berubah — bukan diam. Melewatkannya tanpa suara akan menghidupkan kembali
> BLOCK-01 tanpa satu baris pun yang terlihat salah di repositori.

**Cacat 2 — `registerReceiver` tanpa flag export (Android 14+).**
`USBPrinterService.init()` memanggil `registerReceiver(receiver, filter)` dengan
filter beraksi **kustom** (`ACTION_USB_PERMISSION`). Sejak Android 14, aplikasi
ber-`targetSdk` ≥ 34 wajib menyatakan `RECEIVER_EXPORTED` atau
`RECEIVER_NOT_EXPORTED`. `targetSdk` proyek ini **36** (bawaan Flutter 3.47):

```
Unable to start activity ... java.lang.SecurityException:
One of RECEIVER_EXPORTED or RECEIVER_NOT_EXPORTED should be specified ...
```

Cacat ini **tidak** disebabkan pemindahan registrasi di atas: sebelum perubahan
pun `onAttachedToActivity` dipanggil (dari `attachToActivity()`) dan meledak
persis sama — yang berpindah hanya frame pemanggilnya.

> **Solusi — ContextWrapper Android 14.** `PrinterReceiverExportCompat`
> (`MainActivity.kt`) menimpa `registerReceiver` dua-argumen dan menambahkan
> `RECEIVER_NOT_EXPORTED`. Pembungkus itu diserahkan ke plugin **hanya selama
> jendela satu panggilan sinkron** saat ia menyambung — `MainActivity`
> menimpa `getApplicationContext()` di balik satu bendera yang hidup persis
> selama `plugins.add(...)` berjalan.
>
> Jendelanya sengaja sesempit itu: mengembalikan pembungkus kepada **semua**
> pemanggil akan membuat plugin lain yang menulis `applicationContext as
> Application` — pola lazim untuk `registerActivityLifecycleCallbacks` — gagal
> dengan `ClassCastException`.
>
> `NOT_EXPORTED` adalah pilihan yang **benar**, bukan yang paling longgar:
> `ACTION_USB_PERMISSION` dikirim balik sistem lewat `PendingIntent` milik
> aplikasi sendiri, dan `ACTION_USB_DEVICE_DETACHED` adalah siaran sistem
> terlindungi. `EXPORTED` justru akan membuka penerima printer kepada seluruh
> aplikasi lain di perangkat kasir.

**Bukti pencetakan foreground tetap utuh** (logcat eksekusi final):

```
D/FlutterPosPrinterPlatformPlugin: onAttachedToEngine
D/FlutterPosPrinterPlatformPlugin: onAttachedToActivity
V/ESC POS Printer: ESC/POS Printer initialized     ← baris SESUDAH registerReceiver yang dulu melempar
```

**Bukti engine headless aman** (job WorkManager dijalankan paksa):

```
D/WM-WorkerWrapper: Starting work for dev.fluttercommunity.workmanager.BackgroundWorker
I/flutter : [bg-sync] ok=true tx=0 skip=empty
I/WM-WorkerWrapper: Worker result SUCCESS          ← lalu engine.destroy(), tanpa crash
```

### 7.2 NOTE-01 — urutannya benar, isinya juga harus benar

Blok `runFlow "Sinkronisasi Data"` dipindah ke atas seperti direkomendasikan.
Menjalankannya menyingkap bahwa **isinya** pun keliru: `MasterSyncPage` memanggil
`onCompleted` dari `BlocConsumer.listener` begitu state menjadi `MasterSyncDone`,
sehingga halaman itu **menutup dirinya sendiri** dan tombol "Lanjutkan" hanya
tergambar satu frame. Menunggu tombol itu membuat alur kehabisan waktu justru
pada jalur yang **berhasil**. Yang ditunggu sekarang adalah akibatnya — layar
berikutnya muncul, atau tombol pemulihan muncul.

### 7.3 Pohon semantik Flutter — penyebab kegagalan yang paling menipu

Maestro membaca pohon **aksesibilitas** Android. Flutter menggambar seluruh
layarnya ke satu `Surface` dan baru membangun pohon semantik ketika
`AccessibilityManager.isEnabled()` bernilai `true` — yaitu ketika ada layanan
aksesibilitas yang terikat. Pada emulator polos tidak ada satu pun.

Akibatnya bukan kegagalan yang jujur: Maestro tetap menerima hierarki berisi
**4 node milik status bar**, lalu melapor `Element not found` untuk teks yang
jelas terbaca pada tangkapan layarnya sendiri.

> **Solusi — pengaktifan Accessibility Menu.** `qa_runner_mobile.sh` kini
> memastikan `accessibility_enabled=1` dengan mengikat
> `com.android.systemui.accessibility.accessibilitymenu`. Dipilih itu, **bukan
> TalkBack**: TalkBack menyalakan *explore-by-touch*, yang mengubah arti setiap
> ketukan dan justru merusak Maestro. Setelah diaktifkan, hierarki yang sama
> berisi 65 node — termasuk seluruh label `Semantics` tombol stepper keranjang.
>
> Setelan ini sengaja dibiarkan menyala setelah tes: emulator ini perangkat QA,
> dan mematikannya membuat eksekusi berikutnya gagal lagi dengan gejala yang
> sama membingungkannya.

### 7.4 Dua temuan tambahan pada berkas alur

| Temuan | Gejala yang menipu | Perbaikan |
|---|---|---|
| `hideKeyboard` menekan **BACK** di Android, dan P-03 adalah rute pertama aplikasi — sehingga ia **menutup aplikasi**. | Langkah berikutnya melapor `Element not found: 1`, seolah keypad PIN yang salah; padahal yang tersisa di layar tinggal launcher Android. | Diganti `pressKey: Enter` — `TextField` satu baris memakai `TextInputAction.done`, fokus lepas tanpa tombol sistem ditekan. |
| Flutter **menggabung** teks anak sebuah kartu menjadi satu node ber-baris-baru: `ProductTile "Espresso"` → `"E\nEspresso\nRp 18.000"`. Regex Maestro dicocokkan ke seluruh teks node, dan `.` tidak melintasi baris baru. | `Element not found: Espresso` — pada kartu yang terpampang jelas di tangkapan layar. | Awalan `(?s)` (DOTALL) pada setiap regex yang memakai `.*`. Label berdiri sendiri (mis. `Kurangi Espresso`) tetap dicocokkan utuh tanpa `(?s)`. |

### 7.5 Perubahan kode produksi pada eksekusi final

| Berkas | Perubahan | Alasan |
|---|---|---|
| `android/app/build.gradle.kts` | Tugas `stripPrinterPluginAutoRegistration` | BLOCK-01 cacat 1 |
| `android/app/src/main/kotlin/.../MainActivity.kt` | Registrasi manual plugin printer + `PrinterReceiverExportCompat` | BLOCK-01 cacat 1 & 2 |
| `lib/features/register/presentation/pages/register_page.dart` | `heightFactor: 1` pada `Align` di slot `bottomNavigationBar` | **Temuan baru saat verifikasi.** Tanpa `heightFactor`, `Align` memuai memenuhi tinggi layar; bar 72 dp mengklaim ~1000 px dan layar kasir tampak nyaris kosong — nol exception, nol galat layout, pohon semantik utuh. Gejalanya muncul sebagai `Element not found: Espresso`. Regresi berasal dari `c9d94d7`, bukan commit terakhir. |

Nol baris diubah pada `posgodinov-fe` dan `posgodinov-be`.

---

*Laporan ini mencatat hasil apa adanya. Tidak ada kegagalan yang disembunyikan.
Kode produksi yang diubah dicatat lengkap di §7.5 beserta alasannya — tidak satu
pun di antaranya mengendurkan asersi agar pengujian menjadi hijau.*
