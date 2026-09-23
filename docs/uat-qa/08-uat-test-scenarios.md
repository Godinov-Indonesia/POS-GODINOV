# Skenario Pengujian UAT (User Acceptance Testing) - POS Godinov

Dokumen ini berisi skenario pengujian UAT (User Acceptance Testing) komprehensif untuk proyek SaaS POS Godinov. Skenario mencakup pengujian fungsionalitas sisi bisnis melalui **Admin Dashboard** dan operasional kasir melalui **Web POS PWA**.

---

## 1. Informasi Pengujian & Prasyarat

### 1.1 Lingkungan & Kredensial Pengujian

| Entitas | Parameter | Nilai Uji / Kredensial | Keterangan |
|---|---|---|---|
| **Bisnis** | Nama Bisnis | Godinov Digital / Godinov POS | Tenant SaaS Utama |
| **Owner** | Email / Password | `owner@godinov.id` / `rahasia123` | Kredensial Akses Admin Dashboard |
| **Outlet** | Nama / Serial Tenant | Godinov Coffee & Eatery - Sudirman / `GODBU100826001` | Outlet Utama untuk Uji Coba |
| **Staff Kasir 1** | Username / PIN | `kasir01` / PIN: `1234` | Siti Aminah (Akses POS PWA) |
| **Staff Kasir 2** | Username / PIN | `kasir02` / PIN: `5678` | Andi Pratama (Akses POS PWA) |
| **Environment** | Endpoint Base | Frontend: `http://localhost:3000`<br>Backend API: `http://localhost:8080` | Pengujian lokal/development |

### 1.2 Data Master Bahan Baku (Raw Materials)

Data bahan baku awal digunakan sebagai komponen resep dalam penyusunan Bill of Materials (BOM) produk.

| ID Bahan | Nama Bahan | Base Unit | Kemasan | Stok Awal | HPP per Unit | Total Nilai Stok |
|---|---|:---:|---|---:|---:|---:|
| `RM-001` | Biji Kopi Arabika | gram | kg (1.000 g) | 5.000 g | Rp 180 | Rp 900.000 |
| `RM-002` | Susu UHT Full Cream | ml | kotak (1.000 ml) | 12.000 ml | Rp 18,5 | Rp 222.000 |
| `RM-003` | Gula Aren Cair | ml | botol | 3.000 ml | Rp 30 | Rp 90.000 |
| `RM-004` | Bubuk Matcha Premium | gram | bungkus | 1.000 g | Rp 250 | Rp 250.000 |
| `RM-005` | Cup Plastik 16oz | pcs | dus (50 pcs) | 500 pcs | Rp 450 | Rp 225.000 |
| `RM-006` | Croissant Frozen | pcs | - | 100 pcs | Rp 8.000 | Rp 800.000 |
| `RM-007` | Daging Ayam Fillet | gram | - | 4.000 g | Rp 50 | Rp 200.000 |
| `RM-008` | Rice/Beras | gram | karung (5.000 g) | 10.000 g | Rp 14 | Rp 140.000 |

### 1.3 Daftar Produk & Oracle HPP Pengujian

Nilai HPP dan Margin di bawah ini dihitung menggunakan satuan integer sen secara internal di backend dan frontend untuk mencegah galat pembulatan akibat pecahan mengambang (float).

| Nama Produk | Kategori | Harga Jual | HPP (Sen) | HPP (Rupiah) | Margin (Rupiah) | Margin (%) | Detail Resep (BOM) |
|---|---|---:|---:|---:|---:|---:|---|
| **Kopi Susu Gula Aren** | Kopi & Espresso | Rp 22.000 | 681.000 | Rp 6.810 | Rp 15.190 | 69,0% | 18g Kopi, 120ml Susu UHT, 30ml Gula Aren, 1x Cup Plastik 16oz |
| **Matcha Latte Ice** | Non-Kopi & Tea | Rp 26.000 | 822.500 | Rp 8.225 | Rp 17.775 | 68,4% | 20g Matcha, 150ml Susu UHT, 1x Cup Plastik 16oz |
| **Americano Hot** | Kopi & Espresso | Rp 18.000 | 369.000 | Rp 3.690 | Rp 14.310 | 79,5% | 18g Kopi, 1x Cup Plastik 16oz |
| **Croissant Butter** | Pastry & Bakery | Rp 18.000 | 800.000 | Rp 8.000 | Rp 10.000 | 55,6% | 1x Croissant Frozen |
| **Nasi Ayam Geprek** | Makanan Utama | Rp 28.000 | 1.030.000 | Rp 10.300 | Rp 17.700 | 63,2% | 120g Daging Ayam, 100g Rice/Beras |
| **Es Teh Manis** | Non-Kopi & Tea | Rp 8.000 | 45.000 | Rp 450 | Rp 7.550 | 94,4% | 1x Cup Plastik 16oz |

---

## 2. Tabel Skenario Pengujian UAT

### MODUL A: Authentication & Business Onboarding (D-01, D-02, D-06)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-ADM-01` | Registrasi Owner Baru (D-01) | 1. Buka `/register`<br>2. Masukkan Nama Bisnis, Nama Owner, Email, dan Password<br>3. Klik Daftar | Nama Bisnis: `Godinov Digital`<br>Owner: `Muhamad Rifki Firdaus`<br>Email: `owner@godinov.id`<br>Password: `rahasia123` | Pengguna berhasil terdaftar dan langsung diarahkan ke form pembuatan outlet `/admin/outlets/new` karena sistem mendeteksi tenant belum memiliki outlet. | Online | `[ ] PASS` |
| `UAT-ADM-02` | Login Owner (D-01) | 1. Buka `/login`<br>2. Masukkan email & password<br>3. Klik Masuk | `owner@godinov.id`<br>`rahasia123` | Redirect ke Dashboard `/admin`, Token PASETO tersimpan di `sessionStorage`, dan `activeOutlet` otomatis diset ke outlet pertama. | Online | `[ ] PASS` |
| `UAT-ADM-03` | Pembuatan Outlet & Provisioning (D-02) | 1. Buka `/admin/outlets/new`<br>2. Masukkan data nama outlet<br>3. Klik Simpan<br>4. Akses halaman Info Pemasangan (Device Provisioning) | Nama Outlet: `Godinov Coffee & Eatery - Sudirman` | Outlet tersimpan di server. Pengguna langsung diarahkan ke Info Pemasangan yang menyajikan `serial_business` dan `serial_tenant` (`GODBU100826001`) untuk proses binding POS. | Online | `[ ] PASS` |
| `UAT-ADM-04` | Switcher Outlet & Cache Clear (D-06) | 1. Buat outlet kedua ("Godinov Coffee - Kuningan") dengan data produk berbeda<br>2. Buka daftar produk Outlet A (Sudirman)<br>3. Ganti ke Outlet B melalui switcher di header | Switcher: Ganti ke `Godinov Coffee - Kuningan` | Tabel produk langsung dikosongkan seketika (menampilkan loading state), lalu memuat ulang data produk Outlet B. Data produk Outlet A tidak bocor atau tampil sesaat (cache lama dibuang). | Online | `[ ] PASS` |

---

### MODUL B: Admin Inventory, Product & BOM Builder (D-11, D-13, D-14)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-ADM-05` | BOM Builder & HPP (D-11) | 1. Buka `/admin/products/new`<br>2. Isi Nama & Harga<br>3. Tambahkan resep Kopi, Susu, Gula Aren, dan Cup Plastik<br>4. Klik Simpan | Produk: `Kopi Susu Gula Aren`<br>Harga: `Rp 22.000`<br>Resep: 18g Kopi + 120ml Susu + 30ml Aren + 1x Cup Plastik | HPP terhitung otomatis Rp 6.810 (681.000 sen). Margin kotor Rp 15.190 (~69,0%). Resep tersimpan di database tanpa galat pembulatan decimal. | Online | `[ ] PASS` |
| `UAT-ADM-06` | Peringatan Margin Negatif (D-11) | 1. Buka halaman edit produk Kopi Susu Gula Aren<br>2. Ubah harga jual di bawah nilai HPP<br>3. Amati visual form | Harga Jual baru: `Rp 5.000`<br>(HPP tetap `Rp 6.810`) | Ringkasan margin berubah warna merah (danger) dan muncul banner peringatan margin negatif (< HPP). Tombol "Simpan" tetap aktif untuk membolehkan strategi jual rugi. | Online | `[ ] PASS` |
| `UAT-ADM-07` | Validasi Bahan Baku Ganda BOM (D-11) | 1. Pada form resep produk, coba tambahkan baris bahan baku baru<br>2. Pilih bahan baku yang sudah dipakai di baris resep sebelumnya | Bahan: `Susu UHT Full Cream` terpilih di dua baris resep | Bahan baku yang sudah dipilih tidak muncul di dropdown baris lain. Jika diakali, pengiriman form ditolak di sisi klien sebelum request API terkirim untuk menghindari duplikasi key `raw_material_id`. | Online | `[ ] PASS` |
| `UAT-ADM-08` | BOM Update Integrity (D-11) | 1. Buka edit produk Americano Hot<br>2. Ubah HANYA nama produk saja<br>3. Klik Simpan<br>4. Buka kembali form edit produk tersebut | Nama: `Americano Hot Special` | Resep BOM Americano Hot tetap utuh (18g Kopi + 1x Cup). Pengiriman update mengirimkan payload BOM lengkap untuk mencegah terhapusnya resep di backend. | Online | `[ ] PASS` |
| `UAT-ADM-09` | Sorot Stok Negatif (D-13) | 1. Lakukan opname Cup Plastik ke nilai `0`<br>2. Jual produk menggunakan Cup Plastik di POS, lalu sinkronkan<br>3. Buka menu persediaan di Admin | Penjualan memotong stok di bawah `0` | Stok Cup Plastik bernilai negatif (misal `-5 pcs`) tampil dengan warna latar merah (danger) dan ikon peringatan. Stok minus tetap ditampilkan secara detail (tidak disembunyikan). | Online | `[ ] PASS` |
| `UAT-ADM-10` | Validasi Waste Stock Admin (D-13) | 1. Buka `/admin/inventory/waste`<br>2. Masukkan data pembuangan melebihi stok tersedia<br>3. Klik Simpan | Produk: `Croissant Frozen`<br>Stok: `100 pcs`<br>Waste input: `999 pcs` | Backend menolak request karena stok tidak cukup. Pesan galat ditampilkan apa adanya di UI. (Admin waste bersifat ketat, kasir waste longgar). | Online | `[ ] PASS` |
| `UAT-ADM-11` | Destructive Stock Opname (D-14) | 1. Buka `/admin/inventory/opname`<br>2. Input stok fisik untuk Biji Kopi<br>3. Simpan dan buka Laporan Opname | Stok Sistem: `5.000g`<br>Stok Fisik Aktual: `4.800g` | Muncul dialog konfirmasi yang menyatakan stok sistem akan langsung ditimpa (bersifat destruktif). Setelah konfirmasi, stok sistem berubah menjadi `4.800g`. Laporan opname mencatat selisih `-200g` bernilai `-Rp 36.000`. | Online | `[ ] PASS` |

---

### MODUL C: POS Device Binding, Offline Master Sync & Login Kasir (P-01, P-02, P-03, P-04)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-POS-01` | POS Device Binding (P-01) | 1. Buka `/pos/bind` di browser kasir<br>2. Masukkan serial tenant hasil provisioning<br>3. Klik Lakukan Binding | Serial Tenant: `GODBU100826001` | Browser memvalidasi serial, mendapatkan `device_token` dari server, menyimpannya secara lokal, dan mengarahkan ke halaman login kasir. | Online | `[ ] PASS` |
| `UAT-POS-02` | Offline Master Sync (P-02) | 1. Akses halaman `/dev/seed` (hanya saat dev)<br>2. Klik tombol "Isi IndexedDB"<br>3. Periksa DB lokal melalui DevTools | Trigger Seeder Lokal | Database IndexedDB (Dexie) berhasil terisi data master produk, bahan baku, data staff kasir, dan PIN kasir terenkripsi untuk kebutuhan transaksi offline. | Online | `[ ] PASS` |
| `UAT-POS-03` | Kasir Login Offline (P-03) | 1. Matikan jaringan internet peramban (Offline)<br>2. Masukkan username kasir<br>3. Masukkan PIN melalui virtual Numpad | Username: `kasir01`<br>PIN: `1234` | Proses verifikasi PIN sukses dalam waktu <300ms melalui Web Worker (bcrypt) tanpa memblokir/membekukan UI thread utama. Kasir langsung masuk ke menu P-04 (Buka Shift). | Offline | `[ ] PASS` |
| `UAT-POS-04` | Uniform Login Error Message (P-03) | 1. Coba login dengan username salah<br>2. Coba login dengan PIN salah<br>3. Amati pesan kesalahan yang muncul | Tes 1: `kasir99`, PIN: `1234`<br>Tes 2: `kasir01`, PIN: `9999` | Kedua kondisi kesalahan menghasilkan pesan yang identik: "ID atau PIN salah" demi mencegah serangan tebak username (staff profiling). | Offline | `[ ] PASS` |
| `UAT-POS-05` | Buka Shift & Simpan Lokal (P-04) | 1. Buka shift kasir dengan modal awal kas<br>2. Klik Buka Shift | Modal awal: `Rp 500.000` | Data shift tersimpan di Dexie dengan penanda `_synced = 0`. UUID v4 di-generate secara lokal dan status kasir aktif tercatat di lokal. | Offline | `[ ] PASS` |

---

### MODUL D: Kasir Main Register, Cart Engine & Payment Fast-Cash (P-05, P-06, P-07)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-POS-06` | Cart Engine Persistence (P-05) | 1. Tambahkan 3 item produk ke keranjang<br>2. Tekan tombol `F5` atau muat ulang browser<br>3. Periksa isi keranjang | Keranjang: 2x Kopi Susu Aren + 1x Croissant Butter | Keranjang belanja kasir tetap utuh setelah reload browser karena data keranjang dipersistensikan secara real-time di IndexedDB. | Offline | `[ ] PASS` |
| `UAT-POS-07` | Product Image Fallback (P-05) | 1. Masuk ke halaman penjualan kasir<br>2. Pastikan fixture produk memiliki `image_url` bernilai `null`<br>3. Amati tile produk di grid | Produk: `Kopi Susu Gula Aren` (image_url: null) | Setiap tile produk tanpa gambar menampilkan inisial dua huruf berlatar warna solid deterministik (`KS` untuk Kopi Susu Aren) yang warnanya tetap sama setiap kali dimuat ulang. | Offline | `[ ] PASS` |
| `UAT-POS-08` | Stock-Free Cashier Grid (P-05) | 1. Periksa grid produk dan panel detail penjualan kasir | Halaman penjualan kasir | Tidak ada informasi jumlah stok tersisa, tidak ada indikator barang habis, dan tidak ada tombol beli yang dinonaktifkan. Kasir dapat menjual bebas untuk fleksibilitas operasional. | Offline | `[ ] PASS` |
| `UAT-POS-09` | Uang Eksak & Fast-Cash (P-06) | 1. Tambahkan produk ke keranjang<br>2. Klik Bayar dan pilih Tunai<br>3. Klik tombol Fast-Cash Rp 100.000<br>4. Amati perhitungan kembalian dan font | Keranjang: 1x Matcha Latte Ice (Rp 26.000) + 1x Nasi Ayam Geprek (Rp 28.000)<br>Bayar Tunai: `Rp 100.000` | Total belanja terhitung tepat Rp 54.000. Kembalian terhitung tepat Rp 46.000. Seluruh angka nominal uang menggunakan font monospace, rata kanan, dan posisinya stabil tidak bergoyang saat nilai berubah. | Offline | `[ ] PASS` |
| `UAT-POS-10` | Locked Payment Methods (P-07) | 1. Masuk ke halaman metode pembayaran transaksi | Menu Pembayaran Kasir | Hanya ada 4 opsi pembayaran: `Tunai`, `QRIS`, `Kartu Debit`, dan `Transfer Bank`. Tidak ada inputan teks bebas untuk menghindari data kotor akibat salah ketik metode pembayaran. | Offline | `[ ] PASS` |
| `UAT-POS-11` | Printer Error Resilience (P-06) | 1. Putuskan sambungan printer struk kasir<br>2. Selesaikan transaksi dan klik Cetak Struk<br>3. Klik Cetak Ulang setelah notifikasi galat muncul | Skenario Cetak Gagal | Muncul notifikasi toast galat cetak. Transaksi tetap tersimpan aman di database lokal. Tombol cetak berubah menjadi "Cetak Ulang". Hasil cetak ulang memuat teks penanda `--- CETAK ULANG ---`. | Offline | `[ ] PASS` |

---

### MODUL E: Offline Hold Order, Void & Waste Product (P-08, P-10, P-11)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-POS-12` | Hold Order Local-Only (P-08) | 1. Tambahkan produk ke keranjang<br>2. Klik Tahan Pesanan<br>3. Isi label pesanan<br>4. Jalankan sinkronisasi background | Item: 2x Kopi Susu Aren<br>Label: `Meja 4` | Pesanan tertahan tersimpan di penyimpanan lokal kasir. Data ini bersifat murni lokal dan tidak pernah dikirim ke server saat background sync. Data terhapus dari daftar hold order hanya jika pesanan di-recall lalu diselesaikan transaksinya. | Offline | `[ ] PASS` |
| `UAT-POS-13` | Void Transaksi Belum Sinkron (P-10) | 1. Set koneksi peramban ke Offline<br>2. Buat transaksi baru sampai selesai<br>3. Buka riwayat, pilih transaksi, klik Void<br>4. Masukkan alasan void<br>5. Aktifkan koneksi internet hingga sync berjalan | Alasan Void: `Salah input menu` | Transaksi ditandai sebagai `CANCELLED` secara lokal. Saat sync aktif, data dikirim ke server dengan status `CANCELLED`. Stok bahan baku tidak pernah dikurangi di server untuk transaksi ini. | Offline | `[ ] PASS` |
| `UAT-POS-14` | Void Transaksi Sudah Sinkron (P-10) | 1. Catat stok Biji Kopi di Admin (misal `4.800g`)<br>2. Buat transaksi 1x Americano Hot di POS saat online (memotong `18g` Biji Kopi)<br>3. Lakukan void transaksi tersebut dari POS<br>4. Tunggu sinkronisasi selesai<br>5. Periksa stok Biji Kopi di Admin | Transaksi: Americano Hot<br>Aksi: Void Transaksi Ter-sync | Transaksi berubah status menjadi `CANCELLED` di database server. Stok Biji Kopi Arabika di Admin otomatis kembali ke nilai semula (bertambah kembali `18g`), membuktikan pengembalian stok BOM berjalan sukses. | Online | `[ ] PASS` |
| `UAT-POS-15` | Kasir Waste Stock-Minus (P-11) | 1. Buka menu pencatatan waste kasir di POS PWA<br>2. Masukkan pembuangan bahan baku melebihi stok yang ada<br>3. Simpan data waste | Bahan: `Cup Plastik 16oz`<br>Stok sistem: `0 pcs`<br>Waste input: `10 pcs` | Pencatatan waste kasir sukses disimpan secara lokal tanpa validasi batas stok minimum. Kasir diizinkan membuat stok bernilai negatif agar transaksi operasional tidak terhambat akibat keterlambatan opname. | Offline | `[ ] PASS` |

---

### MODUL F: Background Sync Engine & Mutex Lock (P-13, Sync Engine)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-SYNC-01` | Auto Background Sync Queue (P-13) | 1. Putuskan koneksi internet<br>2. Lakukan 3 transaksi kasir berbeda<br>3. Periksa antrean pada StatusBar POS<br>4. Sambungkan kembali internet | 3 Transaksi Baru | StatusBar menampilkan antrean `4` (3 transaksi + 1 open shift). Setelah internet terhubung kembali, sync engine memproses antrean secara otomatis tanpa intervensi. Antrean berubah menjadi `0` dan status berubah menjadi Terhubung. | Online | `[ ] PASS` |
| `UAT-SYNC-02` | Sync Idempotency (P-13) | 1. Buat transaksi saat offline<br>2. Hubungkan internet<br>3. Tekan tombol "Sinkronkan Sekarang" berkali-kali secara manual dengan cepat | Aksi klik ganda sinkronisasi | Transaksi hanya tercatat sekali di server dan stok bahan baku hanya terpotong satu kali. Idempotensi terjaga karena transaksi diidentifikasi menggunakan UUID v4 yang dibuat di klien saat transaksi awal dibentuk. | Online | `[ ] PASS` |
| `UAT-SYNC-03` | Multi-Tab Sync Prevention (Sync Engine) | 1. Buka aplikasi POS pada dua tab browser terpisah<br>2. Picu proses sinkronisasi pada kedua tab secara bersamaan | Sync request bersamaan dari 2 tab | Web Locks API mengaktifkan mutex lock. Hanya satu tab yang melakukan proses sinkronisasi ke server. Tab kedua mendeteksi lock aktif dan menampilkan pesan log: "Tab lain sedang menyinkronkan" untuk mencegah duplikasi payload. | Online | `[ ] PASS` |
| `UAT-SYNC-04` | Device Clock Skew Detection (P-14) | 1. Ubah waktu perangkat POS 1 jam lebih cepat dibanding waktu server<br>2. Jalankan transaksi atau sinkronisasi data<br>3. Periksa StatusBar | Selisih waktu lokal vs server > 5 menit | Peringatan clock skew muncul di StatusBar dan panel sistem. Nilai `client_created_at` tetap dikirim apa adanya tanpa koreksi otomatis untuk menjaga konsistensi data waktu antara cetak struk lokal dan server. | Online | `[ ] PASS` |
| `UAT-SYNC-05` | Server Connection Failure Handling (P-13) | 1. Hentikan/matikan API Backend server<br>2. Lakukan sinkronisasi manual dari POS | Backend offline | Sistem menampilkan pesan kesalahan yang spesifik mencantumkan alamat API tujuan, misal: *"Server tidak merespons di http://localhost:8080. Data Anda aman secara lokal."* (Bukan pesan kesalahan generik). | Online | `[ ] PASS` |
| `UAT-SYNC-06` | Network Offline Failure Handling (P-13) | 1. Matikan jaringan internet perangkat POS<br>2. Lakukan sinkronisasi manual dari POS | Jaringan perangkat terputus | Sistem langsung mendeteksi ketiadaan koneksi internet tanpa menunggu timeout API dan menampilkan pesan kesalahan lokal: *"Perangkat sedang offline. Data transaksi tetap tersimpan dengan aman di perangkat."* | Offline | `[ ] PASS` |

---

### MODUL G: Laporan Analytics & Laci Shift Close (D-03, D-21, P-12)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| ~~`UAT-REP-01`~~ | ~~Penutupan Shift & Aritmetika Kas (P-12)~~ | **⛔ DIGANTI OLEH `UAT-V2-01` — JANGAN DIJALANKAN.**<br><br>Skenario ini menuntut kasir MELIHAT expected balance dan discrepancy di layar Tutup Shift. Sejak **butir 9 (Blind Closing, M15.3)**, keduanya tidak boleh muncul di perangkat kasir sama sekali — angka deklarasi yang diketik sambil melihat ekspektasi tidak memiliki nilai audit apa pun.<br><br>Menjalankannya pada build v2 akan **GAGAL secara benar**. Dipertahankan dengan coretan, bukan dihapus, supaya penguji yang mencari `UAT-REP-01` menemukan alasannya alih-alih mengira dokumennya rusak. | — | Ekspektasi lama sudah tidak berlaku. Verifikasi Blind Closing memakai `UAT-V2-01`; verifikasi angka ekspektasi memakai `UAT-V2-03` (layar pemilik). | — | `[×] OBSOLETE` |
| `UAT-REP-02` | Validasi Rentang Tanggal Laporan (D-21) | 1. Buka Laporan Transaksi di Admin Dashboard<br>2. Ubah rentang tanggal melebihi 7 hari<br>3. Amati respon UI dan log network | Rentang tanggal: `01 Agustus 2026` s.d `31 Agustus 2026` | Sistem memblokir proses pencarian dan menampilkan banner peringatan rentang maksimal 7 hari. Request API ke backend dicegah di sisi klien demi menghindari payload megabita tanpa paginasi. | Online | `[ ] PASS` |
| `UAT-REP-03` | Server Time Zone Warning Banner (D-03) | 1. Akses Dashboard utama Admin atau halaman laporan grafik penjualan | Dashboard / Laporan | Terlihat banner peringatan berwarna amber (warning) yang menyatakan bahwa laporan dikelompokkan berdasarkan waktu transaksi diterima oleh server (Server Timezone), bukan waktu lokal perangkat kasir. | Online | `[ ] PASS` |
| `UAT-REP-04` | Non-Existent Endpoint Button Hiding (D-03) | 1. Buka form kategori, outlet, dan detail staff kasir di Admin<br>2. Cari tombol hapus/edit yang tidak didukung backend | Halaman Config Admin | Tombol "Hapus Outlet", "Edit Kategori", dan "Reset PIN Kasir" disembunyikan dari UI. Halaman memuat catatan/keterangan yang menjelaskan bahwa fungsionalitas tersebut belum didukung oleh API backend saat ini. | Online | `[ ] PASS` |

---

### MODUL H: PWA, Keyboard Shortcuts & Accessibility (W-01 s.d W-05)

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-PWA-01` | PWA Full Offline Load (W-01) | 1. Lakukan binding perangkat dan sync master data<br>2. Tutup aplikasi POS<br>3. Aktifkan mode pesawat pada perangkat<br>4. Buka kembali halaman `/pos` | Buka POS saat offline penuh | Halaman aplikasi POS PWA terbuka penuh secara instan dan menampilkan antarmuka login kasir. Service Worker melayani file HTML, JS, CSS, dan icon langsung dari cache lokal tanpa memunculkan halaman galat browser. | Offline | `[ ] PASS` |
| `UAT-PWA-02` | Service Worker Isolation (W-02) | 1. Buka DevTools -> Application -> Cache Storage<br>2. Periksa daftar URL yang di-cache oleh Service Worker | Cache Storage POS | Hanya melokalisasi route `/pos*`, file build static Next.js (`/_next/static/*`), dan folder `/icons`. Route Admin (`/admin*`) dan endpoint API (`/v1*`) bersih dari cache PWA kasir untuk alasan privasi data. | Offline | `[ ] PASS` |
| `UAT-PWA-03` | Pintasan Keyboard POS (W-03) | 1. Tekan tombol shortcut pada keyboard fisik<br>2. Arahkan kursor ke dalam input pencarian barang<br>3. Ketik nama barang disertai spasi | Tekan `F1`, Tekan `F2`, lalu tekan `Space` | F1 memunculkan overlay bantuan shortcut. F2 langsung memfokuskan kursor ke input pencarian. Saat kursor di input pencarian, menekan `Space` mengetik karakter spasi (tidak membuka layar bayar). Saat kursor di luar input, menekan `Space` membuka layar bayar. | Offline | `[ ] PASS` |
| `UAT-PWA-04` | Touch Target Minimum Size (W-04) | 1. Periksa elemen-elemen tombol POS menggunakan Inspector DevTools<br>2. Ukur dimensi area sentuh tombol utama | Elemen Numpad PIN, Tombol Bayar, Fast-Cash | Area sentuh Numpad PIN berukuran ≥ 56px, tombol "Bayar" ≥ 64px, tombol Fast-Cash ≥ 72px, dan tombol interaktif lainnya memiliki ukuran target sentuh minimal ≥ 48px untuk kemudahan navigasi layar sentuh. | Offline | `[ ] PASS` |
| `UAT-PWA-05` | Non-Color Dependent Status Indicator (W-05) | 1. Aktifkan simulasi buta warna (DevTools -> Rendering -> Emulate vision deficiencies)<br>2. Periksa visual indikator sinkronisasi, status shift, dan stok minus | Visual checking status badges | Status tidak hanya bergantung pada warna merah/hijau/kuning. Setiap status memiliki ikon visual yang khas (misal: centang, silang, tanda seru) beserta label teks yang eksplisit (misal: "Tersinkron", "Gagal Sync", "Stok Minus"). | Offline | `[ ] PASS` |

---

### MODUL I: Alur v2 — Blind Closing, Void vs Retur, Guard & Navigasi Baru

> **Prasyarat modul ini.** Backend menjalankan kontrak v2 (`X-POS-Contract-Version: 2`), master
> data sudah ditarik sekali sehingga blok `config` tersedia di perangkat, dan seluruh *feature
> flag* berada pada nilai bawaan yang ketat: `blind_close_enabled = true`,
> `require_supervisor_for_void = true`, `history_scope = ACTIVE_SHIFT`.
>
> ⚠️ **Cara membaca ekspektasi "tidak boleh muncul".** Beberapa skenario di bawah menuntut sesuatu
> TIDAK terlihat. Memeriksanya dengan mata saja tidak cukup — nilai dapat hadir di DOM tetapi
> tersembunyi CSS, dan itu tetap kebocoran. Setiap skenario semacam itu menyebutkan cara periksa
> yang mengikat (DevTools → Network, `grep` pada body respons, atau IndexedDB).

| ID Skenario | Fitur / Layar | Langkah Pengujian (Steps) | Data Uji (Input) | Ekspektasi Hasil (Expected Result) | Modus | Status |
|---|---|---|---|---|:---:|:---:|
| `UAT-V2-01` | Blind Closing — layar bersih dari angka sistem (butir 9, P-12) | 1. Buka shift dengan modal `Rp 500.000`, lakukan 3 transaksi tunai<br>2. Buka Tutup Shift lewat Bottom Bar → "Lainnya"<br>3. Amati SELURUH isi layar<br>4. DevTools → Elements → `Ctrl+F`, cari `expected`, `selisih`, `discrepancy` | Modal `Rp 500.000`<br>Tunai `Rp 44.000` | Layar HANYA memuat tiga isian: Uang Fisik Laci, Total Settle EDC, Total Settle QRIS. **Nol** kemunculan total penjualan sistem, jumlah transaksi, saldo ekspektasi, selisih, ringkasan per metode bayar, maupun modal awal. Pencarian DOM ketiga kata kunci tidak menemukan satu pun elemen nilai.<br><br>🤖 **Diotomasi penuh** oleh 8 tes Playwright — lihat **MODUL I-A** di bawah. | Offline | `[x] LULUS` |
| `UAT-V2-02` | Blind Closing — deklarasi tersimpan & terkirim apa adanya (butir 9) | 1. Isi Laci `Rp 544.000`, EDC `Rp 0`, QRIS `Rp 8.000`<br>2. Tutup shift<br>3. DevTools → Network, buka body `POST /v1/pos/sync`<br>4. DevTools → IndexedDB → `posgodinov` → `shifts` | Laci `544000`, EDC `0`, QRIS `8000` | Payload memuat `declared_cash: 5440.00`, `declared_edc_total: 0`, `declared_qris_total: 80.00`, `blind_close: true`. Body respons **tidak memuat** substring `expected_` maupun `variance`. Baris Dexie menyimpan `expected_balance: 0` dan `discrepancy: 0` — klien tidak pernah menghitungnya. | Online | `[ ] PASS` |
| `UAT-V2-03` | Rekonsiliasi milik PEMILIK, bukan kasir (butir 9, R3) | 1. Login Admin Dashboard sebagai pemilik<br>2. Buka Laporan → **Rekonsiliasi Shift**<br>3. Bandingkan dengan shift dari `UAT-V2-02` | Rentang: hari ini | Layar pemilik menampilkan angka LENGKAP: deklarasi, ekspektasi sistem, dan selisih per kelompok tender. Shift yang selisihnya melewati ambang `Rp 5.000` diberi penanda "Perlu ditinjau" — dan ditandai untuk selisih ke **dua arah**, kelebihan maupun kekurangan. | Online | `[ ] PASS` |
| `UAT-V2-04` | Klien dimodifikasi tidak dapat menentukan selisihnya sendiri (R4) | 1. Cegat `POST /v1/pos/sync` (DevTools → Override / proxy)<br>2. Sisipkan `"expected_cash": 1` dan `"expected_balance": 1` pada objek shift<br>3. Kirim, lalu periksa nilai tersimpan di server | `expected_cash: 1` | Server **mengabaikan** kiriman itu sepenuhnya. Nilai tersimpan tetap hasil hitung `ShiftReconcileService`. Baris `shifts` tidak pernah memuat angka `1`. | Online | `[ ] PASS` |
| `UAT-V2-05` | Guard Master Data memblokir Buka Shift (butir 10, P-04) | 1. Kosongkan `master.lastSyncAt` (DevTools → IndexedDB → `meta`)<br>2. Login kasir<br>3. Coba capai Buka Shift lewat menu **dan** lewat deep link `/pos#open-shift` | Deep link `#open-shift` | Kedua jalur mendarat di layar pemblokir seluruh layar berisi pesan tegas + tombol "Unduh Data & Coba Lagi". **Tidak ada tombol "Lewati"** di mana pun. Formulir modal awal tidak dirender sama sekali. | Offline | `[ ] PASS` |
| `UAT-V2-06` | Guard mencatat penolakannya (butir 10, R9) | 1. Ulangi `UAT-V2-05`<br>2. DevTools → IndexedDB → `posgodinov` → `securityEvents` | — | Terdapat baris `OPEN_SHIFT_BLOCKED_STALE_MASTER` dengan `details.reason` (`never-pulled` / `stale` / `outdated`) dan `_synced: 0`. Baris tersebut ikut terkirim pada sinkronisasi berikutnya. | Offline | `[ ] PASS` |
| `UAT-V2-07` | Penurunan Qty > 5 memicu Void Sheet (butir 5, P-05) | 1. Tambahkan 8 pcs "Kopi Susu" ke keranjang<br>2. Tekan tombol minus enam kali berturut-turut<br>3. Amati layar pada penurunan ke-6 | 8 pcs → 2 pcs | Setelah penurunan gabungan melewati ambang 5, aplikasi **menolak** menurunkan diam-diam dan membuka Void Sheet yang menuntut `reason_code` + catatan. Kuantitas baru baru diterapkan SETELAH pembatalan tercatat. | Offline | `[ ] PASS` |
| `UAT-V2-08` | "Kosongkan" tunduk pada ambang yang sama (butir 5) | 1. Isi keranjang dengan 3 produk, total 10 pcs<br>2. Tekan "Kosongkan" di kepala panel keranjang | 10 pcs total | Void Sheet muncul, BUKAN dialog konfirmasi biasa. Menekan "Kosongkan" tidak dapat dipakai sebagai jalan pintas menghindari audit penurunan kuantitas. Satu baris `void_logs` ber-`scope: CART_LINE` lahir per produk. | Offline | `[ ] PASS` |
| `UAT-V2-09` | Void vs Retur ditentukan struk, bukan pilihan kasir (butir 15) | 1. Buat transaksi A, **jangan** cetak struknya<br>2. Buat transaksi B, cetak struknya sampai printer benar-benar mengeluarkan kertas<br>3. Buka Riwayat, amati tombol pada kedua baris | Transaksi A & B | Transaksi A menawarkan **Batalkan** (Void). Transaksi B menawarkan **Retur** — dan tidak ada jalur apa pun dari layar itu menuju Void untuknya. Percobaan Void atas B lewat API dijawab `422 VOID_AFTER_PRINT`. | Offline | `[ ] PASS` |
| `UAT-V2-10` | Retur tanpa restock menuntut alasan pembuangan (butir 15) | 1. Buka Retur atas transaksi B<br>2. Pilih 1 item, setel `restock` = **tidak**<br>3. Coba kirim tanpa memilih alasan<br>4. Pilih alasan `SPOILED`, kirim | `restock: false`<br>alasan: `SPOILED` | Pengiriman ditolak selama alasan pembuangan kosong — kolomnya wajib bila barang tidak kembali ke stok. Setelah alasan diisi, retur tersimpan dan baris `product_wastes` lahir dengan `waste_reason_code: SPOILED`. Stok bahan baku **tidak** bertambah. | Offline | `[ ] PASS` |
| `UAT-V2-11` | Retur melebihi kuantitas asli ditolak server (butir 15) | 1. Retur 2 pcs dari transaksi yang hanya berisi 2 pcs<br>2. Kirim retur KEDUA atas item yang sama | Retur ke-2 | Server menjawab `422 RETURN_EXCEEDS_ORIGINAL`. Baris masuk karantina di perangkat (`_synced: -1`) dan muncul di P-13 sebagai "Butuh tindakan" — bukan dikirim ulang selamanya. | Online | `[ ] PASS` |
| `UAT-V2-12` | Void wajib mencetak struk pembatalan (butir 6) | 1. Matikan printer<br>2. Lakukan Void atas transaksi A<br>3. Amati banner dan IndexedDB | Printer mati | Pembatalan **tetap tersimpan** — kegagalan cetak tidak pernah menggulung penulisan (R6). Banner "N struk belum tercetak" menyala dan menetap. `print_jobs` memuat job `CANCEL_RECEIPT` yang berakhir `ABANDONED` setelah 3 percobaan, disertai `pos_security_events` `VOID_RECEIPT_PRINT_FAILED` bertingkat CRITICAL. | Offline | `[ ] PASS` |
| `UAT-V2-13` | Bottom Bar & header tanpa aksi (butir 18) | 1. Buka layar Kasir<br>2. Hitung slot pada bar bawah dan ukur tingginya<br>3. Coba ketuk setiap elemen di header | Layar Kasir | Bar bawah berisi tepat 5 slot (Kasir, Tahan, Riwayat, Waste, Lainnya) setinggi 64 dp dengan target sentuh ≥ 48 dp. Header **tidak memiliki satu pun elemen yang dapat diketuk**, kecuali lonceng "struk belum tercetak" yang hanya muncul bila memang ada job tertinggal. "Lainnya" membuka *bottom sheet*, bukan menu ke atas. | Offline | `[ ] PASS` |
| `UAT-V2-14` | Payment full-page & back satu langkah (butir 11) | 1. Tekan BAYAR → pilih Kartu Debit<br>2. Tekan tombol back perangkat<br>3. Amati keranjang | Keranjang berisi 3 item | Pemilihan metode dan form kartu adalah **halaman penuh**, bukan modal. Back mundur SATU langkah ke pemilih metode — bukan menutup seluruh pembayaran. Keranjang tetap utuh berisi 3 item. Bottom Bar tersembunyi sepanjang alur pembayaran. | Offline | `[ ] PASS` |
| `UAT-V2-15` | Validasi ketat kartu: trace number & 4 digit (butir 8) | 1. Di layar Kartu Debit, kosongkan Trace Number<br>2. Isi 4 Digit Akhir dengan `12ab`<br>3. Coba selesaikan transaksi<br>4. Isi Trace `004512`, 4 digit `7788` | `12ab` lalu `7788` | Karakter non-angka **tidak dapat diketik sama sekali** pada kedua kolom. Tombol selesai tetap nonaktif selama trace kosong atau 4 digit belum tepat empat angka, disertai pesan galat di bawah kolom yang salah. Setelah keduanya sah, transaksi tersimpan dengan `payments[0].trace_number` dan `card_last4` terisi. | Offline | `[ ] PASS` |
| `UAT-V2-16` | Split payment menuntut Σ tender = total (butir 8) | 1. Total `Rp 100.000`<br>2. Tambah tender Debit `Rp 60.000`<br>3. Amati tombol selesai<br>4. Tambah tender Tunai `Rp 40.000` | 60.000 + 40.000 | Tombol selesai nonaktif selama sisa ≠ 0, dan layar menampilkan sisa tagihan apa adanya. Setelah seimbang, transaksi tersimpan dengan `payment_method: SPLIT` dan **dua** baris `payments`. Kelebihan bayar juga ditolak. | Offline | `[ ] PASS` |
| `UAT-V2-17` | Isolasi riwayat pada shift berjalan (butir 16) | 1. Tutup shift kasir A, buka shift baru sebagai kasir B<br>2. Buka Riwayat lewat Bottom Bar | Dua shift berbeda | Daftar HANYA memuat transaksi shift B. Transaksi shift A tidak terlihat, dan tidak ada tab "Sebelumnya" di mana pun. Layar menyatakan bahwa transaksi shift sebelumnya dicari lewat kode struk. | Offline | `[ ] PASS` |
| `UAT-V2-18` | Pencarian kode struk lintas shift (butir 16) | 1. Catat kode struk transaksi milik shift A<br>2. Di shift B, ketik `AB` lalu tekan Cari<br>3. Ketik kode lengkap, tekan Cari<br>4. Ulangi pencarian 11 kali berturut-turut | Kode < 6 karakter, lalu kode penuh | Input < 6 karakter ditolak dengan penjelasan. Kode penuh mengembalikan **satu** transaksi — bukan daftar. Baris hasil menawarkan **Retur** tetapi tidak menawarkan **Batalkan**. Pencarian ke-11 dalam satu menit dijawab pesan batas laju beserta sisa detiknya. | Online | `[ ] PASS` |
| `UAT-V2-19` | Identity Lock: tidak ada jalan keluar sesi (butir 12) | 1. Dengan shift terbuka, buka Pengaturan<br>2. Cari tombol "Ganti Kasir"<br>3. Buka konsol, jalankan `usePosAuthStore.getState()` dan periksa metodenya | Konsol peramban | Tombol "Ganti Kasir" **tidak dirender** — digantikan kartu penjelasan beserta jalur darurat Force Close. Store tidak lagi mengekspos `logout()`; yang tersedia hanya `clearSession()` (dipakai saga) dan `requestLogout()` yang menolak dan menulis `LOGOUT_BLOCKED_ACTIVE_SHIFT`. | Offline | `[ ] PASS` |
| `UAT-V2-20` | Force Close Shift oleh supervisor (butir 12) | 1. Buka Pengaturan → "Tutup Paksa Shift (Supervisor)"<br>2. Masukkan PIN kasir biasa<br>3. Masukkan PIN supervisor + alasan 5 karakter<br>4. Masukkan alasan ≥ 10 karakter | PIN kasir, lalu PIN supervisor | PIN kasir ditolak dengan pesan yang **sama persis** dengan PIN salah — perbedaannya tidak dibocorkan. Alasan < 10 karakter menonaktifkan tombol. Setelah sah, shift tertutup dengan deklarasi **nol** dan `blind_close: false`, disertai `pos_security_events` `SHIFT_FORCE_CLOSED` bertingkat CRITICAL. | Offline | `[ ] PASS` |
| `UAT-V2-21` | Redirect pasca tutup shift tidak dapat di-back (butir 17) | 1. Tutup shift secara normal<br>2. Setelah mendarat di Login, tekan back perangkat 3 kali | Tombol back ×3 | Layar Login menampilkan konfirmasi ringkas "Shift ditutup" **tanpa satu angka pun**. Tombol back tidak pernah mengembalikan ke layar Tutup Shift maupun ke layar Kasir milik shift yang sudah ditutup. | Offline | `[ ] PASS` |
| `UAT-V2-22` | Tutup shift OFFLINE tetap mengarahkan ≤ 8 detik (butir 17) | 1. Aktifkan mode pesawat<br>2. Tutup shift<br>3. Hitung waktu sampai layar Login muncul<br>4. Matikan mode pesawat, tunggu tanpa menyentuh apa pun | Mode pesawat | Kasir mendarat di Login dalam ≤ 8 detik meski sinkronisasi gagal. Shift tersimpan lokal dan terkirim otomatis begitu jaringan kembali, tanpa interaksi. | Offline | `[ ] PASS` |
| `UAT-V2-23` | Blind Opname — fase DRAFT bersih dari stok sistem (butir 3) | 1. Buka `/opname` pada perangkat gudang<br>2. Mulai sesi, isi hitungan untuk 5 bahan baku<br>3. DevTools → Network, periksa body respons `PUT .../items`<br>4. `Ctrl+F` cari `system_stock`, `difference`, `fraud_flag` | 5 bahan baku | Layar hitung **tidak menampilkan** stok sistem, selisih, nilai rupiah, maupun indikator warna. Body respons mentah tidak memuat satu pun dari ketiga substring tersebut. Lencana baris terisi bernada netral, bukan hijau. | Offline | `[ ] PASS` |
| `UAT-V2-24` | Blind Opname — DRAFT → LOCKED satu arah (butir 3) | 1. Tekan "Selesai Menghitung", amati dialog konfirmasi<br>2. Tekan "Kunci & Hitung Selisih"<br>3. Coba kirim `PUT .../items` lagi lewat API | Sesi opname | Dialog konfirmasi memuat jumlah bahan terhitung dan belum dihitung — **tanpa** jumlah bahan yang menyimpang. Setelah terkunci, layar hasil menampilkan Fisik / Sistem / Selisih / nilai rupiah / penanda ambang. `PUT .../items` dijawab `409 OPNAME_ALREADY_LOCKED`; tidak ada jalur UI kembali ke DRAFT. | Online | `[ ] PASS` |
| `UAT-V2-25` | Snapshot opname diambil saat LOCK, bukan saat sesi dibuka (butir 3) | 1. Buka sesi opname untuk bahan "Susu UHT", catat hitungan fisik<br>2. **Sebelum** mengunci, lakukan penjualan yang memakai Susu UHT di perangkat kasir dan biarkan tersinkron<br>3. Kunci sesi opname<br>4. Bandingkan `system_stock` pada hasil | Penjualan di sela hitung & kunci | `system_stock` mencerminkan stok SETELAH penjualan tersebut — bukan stok saat sesi dibuka. Ini yang membuat selisihnya jujur bagi petugas yang menghitung berjam-jam sementara toko tetap berjualan. | Online | `[ ] PASS` |
| `UAT-V2-26` | Isolasi modul Opname dari sesi kasir (butir 4) | 1. Login kasir di `/pos`<br>2. Buka `/opname` pada tab yang sama<br>3. DevTools → Application → IndexedDB | Dua modul | Terlihat **dua database berbeda**: `posgodinov` dan `posgodinov-opname`. Sesi kasir tidak ikut terbawa ke modul opname, dan sebaliknya. Modul opname tidak memiliki jalur menuju layar Void, Riwayat, maupun Tutup Shift. | Offline | `[ ] PASS` |
| `UAT-V2-27` | Perangkat opname ditolak jalur kasir (butir 4) | 1. Bind perangkat dengan `scope: OPNAME`<br>2. Panggil `POST /v1/pos/sync` memakai token tersebut (curl / Postman) | Device token ber-scope OPNAME | Server menjawab `403` dengan `code: SCOPE_FORBIDDEN`. Pemisahan tugas ditegakkan di lapisan transport, bukan hanya dengan menyembunyikan tombol. | Online | `[ ] PASS` |
| `UAT-V2-28` | *Feature flag* `history_scope: ALL` mengembalikan perilaku v1 (M18.2) | 1. Setel `history_scope: "ALL"` pada `config` outlet<br>2. Tarik master data di perangkat<br>3. Buka Riwayat | `history_scope: ALL` | Riwayat menampilkan transaksi seluruh shift, DAN spanduk peringatan menyatakan bahwa isolasi riwayat sedang dimatikan. Mengembalikan flag ke `ACTIVE_SHIFT` memulihkan isolasi tanpa perlu memasang ulang aplikasi. | Online | `[ ] PASS` |
| `UAT-V2-29` | *Feature flag* aman saat `config` belum pernah turun (M18.2) | 1. Pasang perangkat baru, **jangan** tarik master data<br>2. Periksa perilaku Blind Closing, ambang Void, dan isolasi riwayat | Perangkat baru, `config` kosong | Seluruh perilaku memakai bawaan KETAT: Blind Closing aktif, supervisor tetap diwajibkan untuk Void, riwayat terbatas shift berjalan, ambang Qty = 5. Tidak ada satu pun pengendalian yang longgar hanya karena `config` belum tiba. | Offline | `[ ] PASS` |

---

#### MODUL I-A: Suite Otomatis Playwright — M15 Blind Closing

Berkas: [`posgodinov-fe/tests/e2e/M15-blind-closing.spec.ts`](../posgodinov-fe/tests/e2e/M15-blind-closing.spec.ts)
· Runner: `./qa_runner_web.sh` · Modus: **Offline** (`goOffline()` pada `beforeEach`)

Kedelapan tes di bawah adalah pelaksanaan otomatis dari `UAT-V2-01`. Empat yang pertama menguji
layar Tutup Shift; **empat yang terakhir menguji detektornya sendiri**, dan itu bukan tes
basa-basi:

> Seluruh nilai suite ini bergantung pada satu hal — `findSystemNumberLeaks()` benar-benar
> memerah ketika ada kebocoran. Detektor yang rusak (locator `.pos-root` berganti nama,
> `innerText` mengembalikan string kosong) akan **meluluskan setiap skenario di atasnya**, dan
> suite ini berubah menjadi stempel hijau yang tidak memeriksa apa pun. Kegagalan seperti itu
> tidak pernah terlihat, karena bentuknya adalah tes yang lulus. Karena itu kebocoran
> disuntikkan ke DOM **saat tes berjalan** — bukan ke berkas sumber — lalu detektor dituntut
> memerah.

Ketiga lapis diserang terpisah karena satu kasus hanya membuktikan satu lapis hidup dan
menyembunyikan dua yang mati.

| # | Nama tes (persis seperti di berkas spec) | Lapis / Sasaran | Yang dibuktikan | Status |
|:---:|---|---|---|:---:|
| 1 | `UAT-V2-01 · tidak membocorkan satu pun angka sistem` | Layar Tutup Shift | Nol kebocoran; tepat tiga baris bernominal, semuanya masih `Rp —`; tidak ada baris keempat. | `[x] LULUS` |
| 2 | `UAT-V2-01 · memuat tepat tiga isian deklarasi yang dapat diisi` | Layar Tutup Shift | Ketiga isian hadir dan dapat diisi (Laci `544.000`, EDC `0`, QRIS `8.000`); mengisinya tidak memunculkan nominal agregat keempat. | `[x] LULUS` |
| 3 | `tombol TUTUP SHIFT terkunci sampai uang fisik laci diisi` | Layar Tutup Shift | Laci wajib; QRIS saja tidak membuka tombol — sesuai [11 §M15.3]. | `[x] LULUS` |
| 4 | `dialog konfirmasi tidak membisikkan angka sistem` | Dialog konfirmasi | Kesempatan terakhir sistem membisikkan angka ("selisih Rp 4.000, lanjutkan?") tertutup: nol istilah terlarang, nol substring `rp`. | `[x] LULUS` |
| 5 | `detektor memerah pada kebocoran — Lapis 1 — nominal berlabel baru` | **Lapis 1** | Angka ekspektasi yang kembali dengan judul di luar daftar kata mana pun tetap tertangkap. | `[x] LULUS` |
| 6 | `detektor memerah pada kebocoran — Lapis 2 — istilah terlarang` | **Lapis 2** | Istilah `Expected Balance` tertangkap. | `[x] LULUS` |
| 7 | `detektor memerah pada kebocoran — Lapis 3 — prosa bersanding dengan angka` | **Lapis 3** | Prosa bernominal (`Selisih kas terdeteksi: 4.000`) tertangkap. | `[x] LULUS` |
| 8 | `detektor memerah pada kebocoran — Lapis 1 — nominal disembunyikan CSS` | **Lapis 1** (kasus tersulit) | Nilai yang ADA di DOM tetapi disembunyikan `display:none` tetap tertangkap — `innerText` tidak melihatnya sama sekali, dan kasus inilah yang menjaga detektor tidak diam-diam dikembalikan ke sana. | `[x] LULUS` |

**Hasil eksekusi terakhir: 8 lulus / 0 gagal.** Rincian dan durasi per tes ada di
[19 · Laporan Eksekusi QA](19-v2-qa-execution-report.md) §2.

---

---

## 3. Catatan Keamanan & Batasan Operasional UAT

1. **Keamanan Kredensial Uji:** PIN uji `1234` dan `5678` hanya terdaftar pada data seeder lokal di lingkungan development. **DILARANG KERAS** menggunakan PIN default ini pada basis data outlet produksi nyata.
2. **Ketersediaan Route `/dev/seed`:** Halaman seeding data lokal `/dev/seed` dikonfigurasi menggunakan Next.js `pageExtensions` agar hanya terkompilasi pada mode development (`npm run dev`). Halaman ini tidak akan dapat diakses pada versi production build.
3. **Validasi Sinkronisasi Offline:** Token perangkat yang di-generate dari seeder IndexedDB offline merupakan token tiruan. Sinkronisasi dengan token ini akan menghasilkan respon HTTP `401 Unauthorized` dari server API backend. Hal ini disengaja agar pengujian offline lokal tidak merusak/mencemari data transaksi riil di server.
4. **Resiko Duplicate Seed:** Menjalankan seeder API backend lebih dari satu kali pada outlet yang sama dapat menyebabkan duplikasi data kategori barang secara permanen karena tidak tersedianya fitur penghapusan kategori pada backend. Selalu gunakan outlet uji sekali pakai untuk pengujian API.
