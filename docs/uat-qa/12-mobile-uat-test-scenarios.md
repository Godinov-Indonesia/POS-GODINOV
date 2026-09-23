# Skenario Pengujian UAT (User Acceptance Testing) - POS Godinov Mobile (`posgodinov-mobile`)

Dokumen ini berisi skenario pengujian UAT (User Acceptance Testing) komprehensif untuk aplikasi kasir native Android **POS Godinov Mobile** (`posgodinov-mobile`). Skenario dirancang untuk memverifikasi fungsionalitas aplikasi kasir dalam keadaan online maupun offline penuh di perangkat tablet dan handheld POS.

---

## 1. Informasi Pengujian & Prasyarat

### 1.1 Lingkungan & Kredensial Pengujian

| Entitas | Parameter | Nilai Uji / Kredensial | Keterangan |
|---|---|---|---|
| **Bisnis** | Nama Bisnis | Godinov Digital / Godinov POS | Tenant SaaS Utama |
| **Owner** | Email / Password | `owner@godinov.id` / `rahasia123` | Kredensial Akses Admin Dashboard |
| **Outlet** | Nama / Serial Tenant | Godinov Coffee & Eatery - Sudirman / `GODBU100826001` | Outlet Utama untuk Uji Coba |
| **Staff Kasir 1** | Username / PIN | `kasir01` / PIN: `1234` | Siti Aminah (Akses Login PIN POS) |
| **Staff Kasir 2** | Username / PIN | `kasir02` / PIN: `5678` | Andi Pratama (Akses Login PIN POS) |
| **Device Emulator** | ID Perangkat / Profil | `emulator-5554` / Pixel Tablet (10.95") & Medium Tablet | Pengujian lokal/development |
| **Environment** | Endpoint Base API | Default Emulator: `http://10.0.2.2:8080` | Mengarah ke localhost server backend |

### 1.2 Data Master Produk Uji Coba
Data produk yang disinkronkan ke dalam SQLite lokal (Drift) perangkat POS:

* **Kopi Susu Gula Aren** (Kopi & Espresso) - Rp 22.000 (HPP: Rp 6.810)
* **Matcha Latte Ice** (Non-Kopi & Tea) - Rp 26.000 (HPP: Rp 8.225)
* **Americano Hot** (Kopi & Espresso) - Rp 18.000 (HPP: Rp 3.690)
* **Croissant Butter** (Pastry & Bakery) - Rp 18.000 (HPP: Rp 8.000)
* **Nasi Ayam Geprek** (Makanan Utama) - Rp 28.000 (HPP: Rp 10.300)
* **Es Teh Manis** (Non-Kopi & Tea) - Rp 8.000 (HPP: Rp 450)

---

## 2. Tabel Skenario Pengujian UAT - Mobile POS

### MODUL A: Device Binding & Provisioning (P-01)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-01` | POS Device Binding (P-01) | 1. Buka aplikasi POS pertama kali di emulator/tablet.<br>2. Masukkan serial tenant hasil provisioning.<br>3. Klik Lakukan Binding. | Serial Tenant: `GODBU100826001` | Aplikasi memvalidasi serial, mendapatkan `device_token` dari server, menyimpannya di `SecureStorage` secara terenkripsi, lalu otomatis lanjut ke layar sinkronisasi master data. | Online | `[ ] PASS` |
| `UAT-MOB-02` | Binding Error & Security Info (P-01) | 1. Coba lakukan binding dengan serial asal-asalan.<br>2. Amati pesan kesalahan.<br>3. Periksa informasi peringatan keamanan di bawah layar. | Serial: `SALAH12345` | Aplikasi menampilkan pesan kesalahan dari API backend. Layar secara eksplisit menginfokan bahwa tidak ada fitur *unbind* jarak jauh demi keamanan, sehingga perangkat harus dijaga baik-baik. | Online | `[ ] PASS` |

---

### MODUL B: Offline Master Sync & Cashier Authentication (P-02, P-03)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-03` | Master Data Sync (P-02) | 1. Setelah binding sukses, aplikasi otomatis melakukan sync master data.<br>2. Amati progres bar unduhan. | Trigger Sinkronisasi Otomatis | Aplikasi mengunduh data staff, kategori, dan produk via `Envelope.list()`. Data disimpan ke SQLite lokal (Drift) menggunakan metode upsert (tidak menghapus database) dan mengonversi harga ke integer sen. | Online | `[ ] PASS` |
| `UAT-MOB-04` | Cashier PIN Login (P-03) | 1. Set koneksi emulator ke Offline (Mode Pesawat).<br>2. Pilih/cari kasir `Siti Aminah`.<br>3. Masukkan PIN memakai virtual Numpad 56dp. | Username: `kasir01`<br>PIN: `1234` | Login sukses secara instan (<300ms) karena verifikasi bcrypt dijalankan di isolate terpisah (`compute`) tanpa membekukan UI. Aplikasi berlanjut ke layar Buka Shift. | Offline | `[ ] PASS` |
| `UAT-MOB-05` | Uniform Login Error Message (P-03) | 1. Coba login dengan username salah.<br>2. Coba login dengan PIN salah.<br>3. Amati pesan kesalahan. | Tes 1: `kasir99`, PIN: `1234`<br>Tes 2: `kasir01`, PIN: `9999` | Kedua kesalahan menampilkan pesan yang identik: "ID atau PIN salah" tanpa membocorkan apakah username-nya terdaftar atau tidak (staff profiling prevention). | Offline | `[ ] PASS` |

---

### MODUL C: Buka Shift & Manajemen Laci Kas (P-04)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-06` | Buka Shift Offline (P-04) | 1. Masukkan modal uang awal laci kas.<br>2. Klik tombol Buka Shift. | Modal Awal: `Rp 500.000` | Data shift baru tersimpan ke SQLite lokal dengan UUID v4 baru dan status `_synced = 0`. Kasir masuk ke layar utama penjualan. | Offline | `[ ] PASS` |

---

### MODUL D: Main Register & Multi-Profile Layout (P-05)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-07` | 10" Tablet Landscape Layout (P-05) | 1. Jalankan aplikasi pada emulator Pixel Tablet (1280x800+ dp) posisi landscape. | Deteksi layar otomatis | Tata letak layar split-screen permanen **62/38** (62% grid produk, 38% keranjang belanja). Grid produk menampilkan 4 kolom. | Offline | `[ ] PASS` |
| `UAT-MOB-08` | Handheld Portrait Layout (P-05) | 1. Jalankan aplikasi pada emulator ponsel/handheld POS (lebar < 600 dp) posisi portrait. | Deteksi layar otomatis | Layar menampilkan grid produk penuh. Keranjang belanja disembunyikan dan diakses via *bottom sheet*, tetapi tetap menyisakan bar ringkasan setinggi 72 dp di bawah layar. | Offline | `[ ] PASS` |
| `UAT-MOB-09` | Product Image Fallback (P-05) | 1. Pastikan beberapa produk uji tidak memiliki gambar (`image_url` bernilai `null`). | Produk: `Americano Hot` (tanpa gambar) | Tile produk tanpa gambar menampilkan inisial dua huruf berlatar warna solid deterministik (`AH` untuk Americano Hot) dan warnanya tetap konsisten saat dimuat ulang. | Offline | `[ ] PASS` |
| `UAT-MOB-10` | Cart Engine Persistence (P-05) | 1. Masukkan 3 item ke keranjang.<br>2. Tutup paksa aplikasi (*kill app*).<br>3. Buka kembali aplikasi dan login kasir. | Keranjang aktif saat aplikasi di-kill | Isi keranjang belanja kasir tetap utuh dan tidak hilang karena keranjang dipersistensikan secara real-time ke SQLite lokal. | Offline | `[ ] PASS` |

---

### MODUL E: Fast-Cash & Pencetakan Struk (P-06, P-07)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-11` | Aritmetika Uang Fast-Cash (P-06) | 1. Klik tombol Bayar Tunai.<br>2. Pilih tombol Fast-Cash.<br>3. Periksa nominal kembalian dan alignment font. | Keranjang: 1x Matcha Latte Ice (Rp 26.000) + 1x Nasi Ayam Geprek (Rp 28.000) = Rp 54.000.<br>Fast-Cash: `Rp 100.000` | Kembalian terhitung tepat `Rp 46.000` (aritmetika menggunakan integer sen). Seluruh angka nominal uang dirender rata kanan menggunakan font monospace (`tabularFigures`). | Offline | `[ ] PASS` |
| `UAT-MOB-12` | Opsi Pembayaran Terkunci (P-06) | 1. Buka layar metode pembayaran transaksi. | Pilihan metode bayar | Hanya tersedia 4 metode pembayaran: `Tunai`, `QRIS`, `Kartu Debit`, dan `Transfer Bank` tanpa kolom input teks bebas untuk mencegah *human error* input metode bayar. | Offline | `[ ] PASS` |
| `UAT-MOB-13` | Transaksi Disimpan Sebelum Cetak (P-07) | 1. Lakukan transaksi hingga selesai.<br>2. Tekan bayar.<br>3. Matikan koneksi printer sebelum mengeklik "Cetak Struk". | Skenario Printer Error | Transaksi tetap tersimpan dengan aman di database lokal dengan status `COMPLETED`. Aplikasi menampilkan toast peringatan cetak gagal dan tombol berubah menjadi "Cetak Ulang". | Offline | `[ ] PASS` |
| `UAT-MOB-14` | Cetak Ulang & Buka Laci Kas (P-07) | 1. Hubungkan kembali printer.<br>2. Klik tombol "Cetak Ulang" di layar struk.<br>3. Periksa fisik struk dan laci kas. | Cetak Ulang Tunai | Struk tercetak dengan tambahan header teks `--- CETAK ULANG ---`. Laci kas (*cash drawer*) otomatis terbuka secara fisik karena transaksi menggunakan metode `Tunai` (CASH). | Offline | `[ ] PASS` |

---

### MODUL F: Hold Order, Transaksi Void & Waste (P-08, P-10, P-11)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-15` | Hold Order Lokal-Saja (P-08) | 1. Isi keranjang belanja.<br>2. Klik "Tahan Pesanan" dan isi label.<br>3. Jalankan sinkronisasi background. | Label: `Meja 8` | Pesanan ditahan disimpan murni di SQLite lokal. Saat background sync berjalan, data pesanan ditahan ini tidak pernah dikirim ke server. Data hanya dihapus lokal setelah dipanggil kembali (*recall*) dan dibayar. | Offline | `[ ] PASS` |
| `UAT-MOB-16` | Void Transaksi Belum Ter-sync (P-10) | 1. Jalankan transaksi kasir saat Offline.<br>2. Masuk ke Riwayat, pilih transaksi tersebut, klik Void.<br>3. Masukkan alasan void.<br>4. Hubungkan internet dan jalankan sync. | Alasan: `Pelanggan batal` | Status transaksi lokal diubah menjadi `CANCELLED`. Saat sinkronisasi berjalan, transaksi dikirim ke server langsung dengan status `CANCELLED` (stok bahan baku di server tidak sempat berkurang). | Offline | `[ ] PASS` |
| `UAT-MOB-17` | Void Transaksi Sudah Ter-sync (P-10) | 1. Buat transaksi Americano Hot saat online (memotong stok biji kopi di server).<br>2. Masuk ke Riwayat, pilih transaksi tersebut, lakukan Void.<br>3. Tunggu sync selesai.<br>4. Cek stok bahan baku di Admin. | Transaksi: Americano Hot<br>Aksi: Void | Status transaksi di database server berubah menjadi `CANCELLED`. Stok Biji Kopi Arabika di server otomatis bertambah kembali 18g (BOM *reverse deduction* sukses). | Online | `[ ] PASS` |
| `UAT-MOB-18` | Kasir Waste Stock-Minus (P-11) | 1. Buka menu Lapor Waste kasir.<br>2. Input pembuangan produk dengan jumlah melebihi stok sistem (stok sistem bernilai 0). | Bahan: `Cup Plastik 16oz`<br>Stok: `0`<br>Waste input: `15 pcs` | Laporan waste berhasil disimpan lokal tanpa memblokir kasir. Hal ini membolehkan stok bernilai negatif agar operasional kasir tidak macet akibat telat opname. | Offline | `[ ] PASS` |

---

### MODUL G: Tutup Shift & Sinkronisasi Latar (P-12, P-13, P-14)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| ~~`UAT-MOB-19`~~ | ~~Perhitungan Expected Cash & Tutup Shift (P-12)~~ | **⛔ DIGANTI OLEH `UAT-MV2-01` — JANGAN DIJALANKAN.**<br><br>Skenario ini menuntut kasir MELIHAT expected cash dan discrepancy. Sejak **butir 9 (Blind Closing, M15.3)**, keduanya tidak boleh muncul di perangkat kasir sama sekali. Menjalankannya pada build v2 akan **GAGAL secara benar**. | — | Ekspektasi lama sudah tidak berlaku. Blind Closing diverifikasi `UAT-MV2-01`. | — | `[×] OBSOLETE` |
| `UAT-MOB-20` | Auto Background Sync (P-13) | 1. Lakukan 3 transaksi offline.<br>2. Amati indikator antrean di StatusBar (menampilkan angka antrean).<br>3. Nyalakan koneksi internet. | 3 Transaksi Antre | Antrean diproses otomatis secara kronologis oleh WorkManager latar belakang. Indikator antrean di StatusBar berubah menjadi `0` dan status menjadi Hijau (Tersinkron). | Online | `[ ] PASS` |
| `UAT-MOB-21` | Idempotency & Mutex Web Locks (P-13) | 1. Jalankan sinkronisasi secara bersamaan di isolate latar dan UI (tekan tombol sync manual cepat). | Double Sync Trigger | Transaksi hanya tercatat sekali di server dan stok bahan baku hanya terpotong satu kali berkat UUID v4 yang tetap serta mekanisme Mutex Lock (`synchronized`) pada sync engine. | Online | `[ ] PASS` |
| `UAT-MOB-22` | Clock Skew Warning (P-13) | 1. Geser waktu lokal tablet menjadi 10 menit lebih cepat daripada waktu server.<br>2. Periksa visual StatusBar. | Perbedaan waktu > 5 menit | Peringatan clock skew muncul di StatusBar. Namun, nilai `client_created_at` transaksi yang dikirim ke server tetap menggunakan waktu asli perangkat kasir untuk konsistensi cetak struk lokal. | Online | `[ ] PASS` |
| `UAT-MOB-23` | Settings Actions (P-14) | 1. Buka menu Pengaturan.<br>2. Uji tombol "Tarik ulang data outlet" dan "Ganti kasir". | Tap tarik data & ganti kasir | Tarik data menampilkan teks "Menarik data..." dan memblokir klik ganda, lalu memunculkan SnackBar hijau setelah selesai. Tombol Ganti Kasir mengeluarkan sesi kasir, menutup seluruh layar pengaturan, dan kembali ke halaman Login PIN. | Online | `[ ] PASS` |

---

### MODUL H: Mode Kiosk & Penguncian Layar (M9)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MOB-24` | Kiosk Idle Timeout (K-01) | 1. Aktifkan Mode Kiosk dari Pengaturan.<br>2. Masukkan produk ke keranjang belanja.<br>3. Diamkan tablet tanpa sentuhan selama 90 detik. | Masa diam 90 detik | Aplikasi otomatis menghapus seluruh isi keranjang belanja dan kembali ke layar sambutan utama Kiosk untuk menyambut pelanggan berikutnya. | Offline | `[ ] PASS` |
| `UAT-MOB-25` | Kiosk Order as Held Cart (K-03) | 1. Buat pesanan di layar Kiosk.<br>2. Klik Kirim Pesanan.<br>3. Amati laci kasir utama. | Pesanan Kiosk | Pesanan tidak memotong stok atau membuat transaksi baru di server, melainkan disimpan lokal sebagai *held cart* (pesanan ditahan). Pelanggan membayar di kasir dengan menyebut nomor antrean. | Offline | `[ ] PASS` |
| ~~`UAT-MOB-26`~~ | ~~Kiosk Safety Guard Escape (M9)~~ | **⛔ DIGANTI OLEH `UAT-MV2-14` — JANGAN DIJALANKAN.**<br><br>Skenario ini menerima **PIN staff kasir mana pun** sebagai kunci keluar Kiosk. Sejak **butir 14 (M17.4)**, PIN harus milik staff yang izinnya memuat `config.kiosk_exit_permission`; PIN kasir biasa kini DITOLAK — dan penolakan itulah perilaku yang benar. | — | Ekspektasi lama sudah tidak berlaku. Gerbang izin diverifikasi `UAT-MV2-14` dan `UAT-MV2-15`. | — | `[×] OBSOLETE` |
| `UAT-MOB-27` | Lock Task Mode & Device Owner (M9) | 1. Saat kiosk aktif di perangkat berstatus Device Owner, coba tekan tombol Home atau Recents di navigasi Android. | Tombol Home/Recents | Sistem operasi Android memblokir aksi tersebut. Pelanggan tidak dapat keluar dari aplikasi POS ke layar utama Android (home screen). | Offline | `[ ] PASS` |

---

### MODUL I: Alur v2 — Blind Closing, Void vs Retur, Navigasi & Kiosk Berizin

> **Prasyarat modul ini.** Backend menjalankan kontrak v2, master data sudah ditarik sekali
> sehingga blok `config` tersedia di SQLite, dan seluruh *feature flag* berada pada bawaan ketat.
>
> ⚠️ **Cakupan.** Modul Opname belum ada di aplikasi Flutter — M16 Tahap 1 hanya membangun PWA
> `/opname`, dan *flavor* Flutter dijadwalkan M16.6 yang belum dikerjakan. Skenario Blind Opname
> karena itu **hanya ada di [08](08-uat-test-scenarios.md)** (`UAT-V2-23` s.d. `UAT-V2-27`), bukan
> di sini. Ini batas yang dinyatakan apa adanya, bukan skenario yang terlewat.
>
> ⚠️ **Cara memeriksa "tidak boleh muncul".** Beberapa skenario menuntut sesuatu TIDAK terlihat.
> Gunakan `adb logcat`, inspeksi SQLite (`adb shell` → `posgodinov.db`), atau Flutter DevTools —
> memeriksa dengan mata saja tidak membuktikan nilai itu tidak ada di memori.

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-MV2-01` | Blind Closing — layar bersih dari angka sistem (butir 9, P-12) | 1. Buka shift modal `Rp 500.000`, lakukan 3 transaksi tunai.<br>2. Buka Tutup Shift lewat Bottom Bar → "Lainnya".<br>3. Amati SELURUH isi layar. | Modal `Rp 500.000` | Layar HANYA memuat tiga isian: Uang Fisik di Laci, Total Settle EDC, Total Settle QRIS. **Nol** kemunculan modal awal, penjualan tunai, "SEHARUSNYA DI LACI", blok SELISIH, maupun jumlah transaksi. Dialog "Selisih kas terdeteksi" yang lama tidak pernah muncul. | Offline | `[ ] PASS` |
| `UAT-MV2-02` | Blind Closing — deklarasi tersimpan apa adanya (butir 9) | 1. Isi Laci `Rp 544.000`, EDC `Rp 0`, QRIS `Rp 8.000`, tutup shift.<br>2. Inspeksi tabel `shifts` di SQLite. | Laci `544000`, QRIS `8000` | Baris memuat `declared_cash_minor: 54400000`, `declared_qris_total_minor: 800000`, `blind_close: true`. Kolom `expected_balance_minor` dan `discrepancy_minor` tetap **0** — klien tidak pernah menghitungnya. | Offline | `[ ] PASS` |
| `UAT-MV2-03` | Struk tutup shift memuat deklarasi saja (butir 9) | 1. Tutup shift dengan printer menyala.<br>2. Amati kertas yang keluar. | Printer aktif | Struk memuat kasir, jam mulai/tutup, dan **ketiga angka deklarasi**. Tidak ada baris ekspektasi, selisih, maupun total penjualan. Terdapat dua baris tanda tangan (Kasir & Penerima Setoran) dan keterangan bahwa rekonsiliasi dilakukan di kantor. | Offline | `[ ] PASS` |
| `UAT-MV2-04` | Guard Master Data memblokir Buka Shift (butir 10, P-04) | 1. Hapus `master_data_synced_at` dari `sync_meta`.<br>2. Login kasir, coba lanjut ke Buka Shift. | `sync_meta` kosong | Layar pemblokir seluruh layar muncul dengan pesan tegas + tombol "Unduh Data & Coba Lagi". **Tidak ada tombol "Lewati"**. Formulir modal awal tidak dibangun sama sekali. Baris `OPEN_SHIFT_BLOCKED_STALE_MASTER` lahir di `security_events`. | Offline | `[ ] PASS` |
| `UAT-MV2-05` | Shift membawa versi master & device id (butir 10, 12) | 1. Lolos gerbang, buka shift.<br>2. Inspeksi tabel `shifts`. | Shift baru | `master_data_version` terisi angka versi yang benar-benar dipegang perangkat, dan `device_id` terisi UUID stabil dari `sync_meta` — bukan `'legacy'`. Mengirim shift `OPEN` tanpa versi dijawab server `422 MASTER_DATA_REQUIRED`. | Online | `[ ] PASS` |
| `UAT-MV2-06` | Void vs Retur ditentukan struk (butir 15) | 1. Buat transaksi A tanpa mencetak struk.<br>2. Buat transaksi B, cetak struknya sampai kertas keluar.<br>3. Buka Riwayat, amati tombol pada kedua baris. | Transaksi A & B | Baris A menawarkan **Batalkan**; baris B menawarkan **Retur**. Tidak ada jalur dari layar itu menuju Void untuk B. Percobaan lewat API dijawab `422 VOID_AFTER_PRINT`. | Offline | `[ ] PASS` |
| `UAT-MV2-07` | Retur tanpa restock menuntut alasan pembuangan (butir 15) | 1. Buka Retur atas transaksi B.<br>2. Pilih 1 item, setel `restock` = tidak.<br>3. Kirim tanpa memilih alasan, lalu pilih `SPOILED` dan kirim. | `restock: false`, `SPOILED` | Pengiriman ditolak selama alasan kosong. Setelah diisi, retur tersimpan dan baris `wastes` lahir ber-`reason_code: SPOILED`. Stok bahan baku **tidak** bertambah. | Offline | `[ ] PASS` |
| `UAT-MV2-08` | Void wajib mencetak struk pembatalan (butir 6) | 1. Matikan printer.<br>2. Void transaksi A.<br>3. Amati banner dan tabel `print_jobs`. | Printer mati | Pembatalan tetap tersimpan (R6). Banner "N struk belum tercetak" menyala dan menetap lintas layar. Job `CANCEL_RECEIPT` berakhir `ABANDONED` setelah 3 percobaan dengan jeda 3 s / 10 s, disertai `VOID_RECEIPT_PRINT_FAILED` bertingkat CRITICAL. | Offline | `[ ] PASS` |
| `UAT-MV2-09` | Cetak ulang menghasilkan kertas identik (butir 6) | 1. Nyalakan printer, ketuk "Cetak Ulang" pada banner.<br>2. Bandingkan kertas kedua dengan yang pertama. | Job `ABANDONED` | Kertas kedua identik byte demi byte — payload ESC/POS yang tersimpan dikirim ulang, bukan dirender ulang dari data yang mungkin sudah berubah. `RECEIPT_REPRINTED` hanya lahir bila job memang pernah `PRINTED`. | Offline | `[ ] PASS` |
| `UAT-MV2-10` | Bottom Bar & AppBar tanpa aksi (butir 18) | 1. Buka layar Kasir pada handheld 6".<br>2. Hitung slot bar bawah dan periksa `AppBar`. | Handheld | Bar bawah berisi 5 slot setinggi 64 dp (di luar area aman perangkat), target sentuh ≥ 48 dp. `AppBar` **tidak memiliki satu pun `IconButton`** — hanya judul berisi nama kasir. "Lainnya" membuka *bottom sheet*. | Offline | `[ ] PASS` |
| `UAT-MV2-11` | Ringkasan keranjang tidak menutup navigasi (butir 18) | 1. Isi keranjang dengan 2 produk.<br>2. Amati area bawah layar.<br>3. Ketuk "Riwayat". | Keranjang berisi | Bar ringkasan keranjang muncul **di atas** bar navigasi, bukan menggantikannya. Kasir tetap dapat membuka Riwayat tanpa mengosongkan keranjang lebih dulu. | Offline | `[ ] PASS` |
| `UAT-MV2-12` | Payment full-page & back satu langkah (butir 11) | 1. Tekan BAYAR → pilih Kartu Debit.<br>2. Tekan tombol back perangkat.<br>3. Amati keranjang. | Keranjang 3 item | Pemilih metode dan form kartu adalah **halaman penuh** (`MaterialPageRoute`), bukan `showDialog`. Back mundur SATU langkah ke pemilih metode. Keranjang tetap utuh. | Offline | `[ ] PASS` |
| `UAT-MV2-13` | Validasi ketat kartu & split (butir 8) | 1. Di form Kartu Debit, coba ketik huruf pada Trace Number dan 4 Digit.<br>2. Isi trace `004512`, 4 digit `7788`, nominal `Rp 60.000` dari total `Rp 100.000`.<br>3. Simpan tender, tambah tender Tunai `Rp 40.000`. | 60.000 + 40.000 | Huruf **tidak dapat diketik sama sekali**. Tombol selesai nonaktif selama sisa ≠ 0. Setelah seimbang, transaksi tersimpan `payment_method: split` dengan **dua** baris `transaction_payments`; baris kartu memuat `trace_number` dan `card_last4`. | Offline | `[ ] PASS` |
| `UAT-MV2-14` | Keluar Kiosk menuntut IZIN, bukan sekadar PIN sah (butir 14) | 1. Aktifkan Kiosk.<br>2. Ketuk logo 5× dalam 3 detik.<br>3. Masukkan PIN **kasir biasa** (tanpa izin `KIOSK_EXIT`).<br>4. Masukkan PIN staff berizin. | PIN kasir, lalu PIN supervisor | PIN kasir **DITOLAK** — perilaku ini yang benar, dan pesannya identik dengan pesan PIN salah supaya penebak tidak tahu PIN-nya sudah benar. PIN berizin membuka Kiosk dan menulis `KIOSK_EXIT_GRANTED`. Dialog tidak pernah menampilkan kolom ID staff. | Offline | `[ ] PASS` |
| `UAT-MV2-15` | Tiga kegagalan berturut memicu jeda 60 detik (butir 14) | 1. Masukkan PIN salah tiga kali berturut-turut.<br>2. Ketuk logo 5× lagi.<br>3. Inspeksi tabel `security_events`. | 3 PIN salah | Percobaan keempat **tidak membuka dialog** — SnackBar menyatakan sisa detik jeda. Tabel memuat tiga `KIOSK_EXIT_DENIED` (CRITICAL) beserta `details.attempts`, ditambah satu `KIOSK_EXIT_LOCKED_OUT` (CRITICAL). | Offline | `[ ] PASS` |
| `UAT-MV2-16` | Isolasi riwayat & pencarian kode struk (butir 16) | 1. Tutup shift kasir A, buka shift kasir B.<br>2. Buka Riwayat.<br>3. Ketik `AB` lalu Cari; ketik kode penuh milik shift A lalu Cari. | Kode < 6 karakter, lalu penuh | Daftar hanya memuat transaksi shift B; tidak ada tab "Sebelumnya". Kode < 6 karakter ditolak. Kode penuh mengembalikan **satu** transaksi yang menawarkan **Retur** tetapi tidak **Batalkan**. | Online | `[ ] PASS` |
| `UAT-MV2-17` | Identity Lock: Ganti Kasir hilang saat shift terbuka (butir 12) | 1. Dengan shift terbuka, buka Pengaturan.<br>2. Cari tombol "Ganti kasir". | Shift `OPEN` | Tombol **tidak dibangun sama sekali** — digantikan kartu "Sesi terkunci oleh shift yang berjalan" beserta jalur darurat "Tutup Paksa Shift (Supervisor)". Percobaan keluar sesi lewat jalur lain menulis `LOGOUT_BLOCKED_ACTIVE_SHIFT`. | Offline | `[ ] PASS` |
| `UAT-MV2-18` | Force Close Shift oleh supervisor (butir 12) | 1. Buka "Tutup Paksa Shift".<br>2. Masukkan PIN kasir biasa.<br>3. Masukkan PIN supervisor + alasan 5 karakter, lalu ≥ 10 karakter. | PIN kasir, lalu supervisor | PIN kasir ditolak dengan pesan yang **sama persis** dengan PIN salah. Alasan < 10 karakter menonaktifkan tombol dan menampilkan sisa karakter. Setelah sah: shift tertutup dengan deklarasi **nol**, `blind_close: false`, dan `SHIFT_FORCE_CLOSED` (CRITICAL) tercatat. | Offline | `[ ] PASS` |
| `UAT-MV2-19` | Redirect pasca tutup shift tidak dapat di-back (butir 17) | 1. Tutup shift normal.<br>2. Amati layar konfirmasi.<br>3. Setelah mendarat di Login, tekan back perangkat 3×. | Back ×3 | Layar "Shift ditutup" tampil ±1,5 detik **tanpa satu angka pun**, lalu berpindah ke Login. `popUntil(isFirst)` membuang seluruh tumpukan; back tidak pernah kembali ke layar Tutup Shift maupun Kasir. | Offline | `[ ] PASS` |
| `UAT-MV2-20` | Tutup shift OFFLINE tetap mengarahkan ≤ 8 detik (butir 17) | 1. Aktifkan mode pesawat.<br>2. Tutup shift, hitung waktu sampai layar Login.<br>3. Matikan mode pesawat, tunggu tanpa menyentuh apa pun. | Mode pesawat | Kasir mendarat di Login dalam ≤ 8 detik meski sinkronisasi gagal. Shift tersimpan lokal dan terkirim otomatis begitu jaringan kembali. | Offline | `[ ] PASS` |
| `UAT-MV2-21` | Penurunan Qty > 5 memicu Void Sheet (butir 5) | 1. Tambahkan 8 pcs produk ke keranjang.<br>2. Tekan tombol minus enam kali berturut-turut. | 8 pcs → 2 pcs | Setelah penurunan gabungan melewati ambang 5, aplikasi menolak menurunkan diam-diam dan menuntut `reason_code` + catatan.<br><br>🤖 **Diotomasi** oleh [`.maestro/M13-void-threshold.yaml`](../posgodinov-mobile/.maestro/M13-void-threshold.yaml) (runner: `./qa_runner_mobile.sh`). Alur otomatisnya memakai 10 pcs → 4 pcs; aritmetika gerbangnya identik (`totalDecrease > threshold`, memakai PUNCAK kuantitas) dan tetap menyala pada ketukan minus **ke-6**.<br><br>Alur itu juga menguji **kontrol negatif** yang tidak disebut skenario manual ini: ketukan ke-1 s.d. ke-5 di-`assertNotVisible` terhadap judul Void Sheet. Tanpa itu, sheet yang muncul terlalu dini akan lulus diam-diam. | Offline | `[x] LULUS` |
| `UAT-MV2-22` | *Feature flag* aman saat `config` belum turun (M18.2) | 1. Pasang perangkat baru, **jangan** tarik master data.<br>2. Periksa Blind Closing, kewajiban supervisor untuk Void, dan isolasi riwayat. | `sync_meta` tanpa `remote_config` | Seluruh perilaku memakai bawaan KETAT: Blind Closing aktif, supervisor tetap diwajibkan, riwayat terbatas shift berjalan. Tidak ada pengendalian yang longgar hanya karena `config` belum tiba. | Offline | `[ ] PASS` |
| `UAT-MV2-23` | *Feature flag* `history_scope: ALL` (M18.2) | 1. Setel `history_scope: "ALL"` pada `config` outlet.<br>2. Tarik master data, buka Riwayat. | `history_scope: ALL` | Judul layar berubah menjadi "Riwayat Transaksi" (bukan "Riwayat Shift Ini"), spanduk peringatan menyatakan isolasi sedang dimatikan, dan daftar memuat transaksi seluruh shift. Mengembalikan flag memulihkan isolasi tanpa pemasangan ulang. | Online | `[ ] PASS` |

---

---

## 3. Catatan Keamanan & Batasan Operasional UAT Mobile

1. **Enkripsi SQLite lokal (SQLCipher):** Pengujian offline lokal memuat database `posgodinov.db` yang menyimpan `pin_hash` kasir. Jika tim belum memutuskan opsi enkripsi SQLCipher, pastikan berkas database terlindungi oleh hak akses sistem (R8 Obfuscation & Shrinking aktif) agar berkas tidak dapat diekstraksi.
2. **Pengecualian Baterai Android:** Sinkronisasi latar belakang memerlukan izin `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Pada perangkat vendor agresif (seperti Xiaomi/Oppo/Vivo/iMin), teknisi wajib membuka pengaturan Android secara manual untuk mengatur aplikasi POS Godinov ke status "Tanpa Batasan" agar sinkronisasi tidak terhenti saat tablet mati.
3. **Modul Opname tidak ada di aplikasi mobile.** M16 Tahap 1 hanya membangun PWA `/opname`; *flavor* Flutter dijadwalkan M16.6 dan belum dikerjakan. Skenario Blind Opname karena itu hanya ada di [08](08-uat-test-scenarios.md). Menandai butir 3 sebagai "lulus di mobile" tanpa modulnya adalah klaim yang tidak dapat dibuktikan.
4. **Butir 5 (Strict Qty Audit) SUDAH terpasang di UI keranjang mobile.** ✅ Catatan lama di butir ini menyatakan tombol minus `cart_panel.dart` memanggil `onDecrement` langsung tanpa melewati `CartCubit.canDecrementTo()`. Itu **tidak lagi berlaku**: `CartVoidGuard` kini menjadi satu-satunya jalan menurunkan kuantitas dari UI, dan **ketiga** jalur penurunan melewatinya — tombol **minus**, tombol **hapus baris**, dan tombol **"Kosongkan"**. Menjaga tombol minus saja akan membuat butir 5 punya pintu belakang selebar pintu depan: kasir yang ditahan tombol minus cukup menekan hapus, dan sepuluh unit lenyap tanpa satu pun baris audit. `UAT-MV2-21` terverifikasi otomatis dan **LULUS** (lihat [19 · Laporan Eksekusi QA](19-v2-qa-execution-report.md) §3).
5. **Pencetakan Handheld Sunmi/iMin:** Adapter printer internal Sunmi mendeteksi ketersediaan API secara otomatis. Jika tidak terdeteksi, printer akan jatuh ke koneksi Bluetooth lokal secara aman tanpa merusak alur transaksi kasir.
