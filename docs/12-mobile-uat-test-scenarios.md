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
| `UAT-MOB-19` | Perhitungan Expected Cash & Tutup Shift (P-12) | 1. Buka layar Tutup Shift kasir.<br>2. Masukkan jumlah uang tunai fisik di laci kas. | Modal: `Rp 500.000`<br>Penjualan Tunai: `Rp 44.000`<br>Uang Fisik: `Rp 544.000` | Sistem menghitung expected cash = Rp 544.000 (penjualan non-tunai diabaikan). Selisih (*discrepancy*) bernilai `Rp 0`. Laci kas berhasil ditutup dan memicu sinkronisasi antrean instan. | Offline | `[ ] PASS` |
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
| `UAT-MOB-26` | Kiosk Safety Guard Escape (M9) | 1. Ketuk logo POS Godinov sebanyak 5 kali dalam waktu 3 detik di layar kiosk.<br>2. Masukkan PIN salah.<br>3. Masukkan PIN staff kasir yang sah. | PIN: `1234` | Layar menampilkan dialog PIN. PIN salah ditolak. PIN benar berhasil membuka penguncian kiosk dan mengarahkan kasir kembali ke register utama. | Offline | `[ ] PASS` |
| `UAT-MOB-27` | Lock Task Mode & Device Owner (M9) | 1. Saat kiosk aktif di perangkat berstatus Device Owner, coba tekan tombol Home atau Recents di navigasi Android. | Tombol Home/Recents | Sistem operasi Android memblokir aksi tersebut. Pelanggan tidak dapat keluar dari aplikasi POS ke layar utama Android (home screen). | Offline | `[ ] PASS` |

---

## 3. Catatan Keamanan & Batasan Operasional UAT Mobile

1. **Enkripsi SQLite lokal (SQLCipher):** Pengujian offline lokal memuat database `posgodinov.db` yang menyimpan `pin_hash` kasir. Jika tim belum memutuskan opsi enkripsi SQLCipher, pastikan berkas database terlindungi oleh hak akses sistem (R8 Obfuscation & Shrinking aktif) agar berkas tidak dapat diekstraksi.
2. **Pengecualian Baterai Android:** Sinkronisasi latar belakang memerlukan izin `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Pada perangkat vendor agresif (seperti Xiaomi/Oppo/Vivo/iMin), teknisi wajib membuka pengaturan Android secara manual untuk mengatur aplikasi POS Godinov ke status "Tanpa Batasan" agar sinkronisasi tidak terhenti saat tablet mati.
3. **Pencetakan Handheld Sunmi/iMin:** Adapter printer internal Sunmi mendeteksi ketersediaan API secara otomatis. Jika tidak terdeteksi, printer akan jatuh ke koneksi Bluetooth lokal secara aman tanpa merusak alur transaksi kasir.
