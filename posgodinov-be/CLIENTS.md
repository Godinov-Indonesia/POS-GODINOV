# Panduan Integrasi Klien POS (Frontend) - Offline-First Sync Hub

Dokumen ini adalah panduan resmi bagi developer Frontend/Klien (Mobile/Tablet/Desktop) yang akan mengimplementasikan aplikasi POS Kasir. Aplikasi kasir ini dirancang dengan arsitektur **Offline-First**, artinya aplikasi harus bisa berjalan normal tanpa internet, dan hanya membutuhkan koneksi saat awal pemasangan (*setup*) dan sinkronisasi (*sync*).

## 1. Konsep Utama (Offline-First)
* **Klien adalah Raja Lokal:** Klien bertanggung jawab atas penyediaan database lokal (seperti SQLite/Room). Semua validasi transaksi harian, perhitungan keranjang belanja, *pending* pesanan, dan buka/tutup laci kasir (shift) dilakukan murni oleh klien secara *offline*.
* **UUID dari Klien:** Klien wajib membuat `id` (UUID v4) untuk setiap baris data baru (Transaksi, Detail Transaksi, Shift, Waste). Backend tidak membuatkan ID. Ini untuk mencegah duplikasi jika Klien tidak sengaja mengirim data yang sama (*Idempotency*).
* **Toleransi Minus:** Saat *sync*, server akan memotong stok bahan baku berdasarkan resep. Jangan khawatir jika server merespons sukses walau Anda tahu stok harusnya minus. Server sengaja memperbolehkan stok tembus minus agar transaksi offline tetap tercatat sebagai prioritas utama.

---

## 2. Alur Penggunaan API (Flow)

### Tahap 1: Otorisasi Perangkat (Device Binding) - *Online 1x Saja*
Sistem ini menggunakan Otorisasi Perangkat. Kasir **tidak perlu tahu email dan password** Business Owner.
1. Klien menembak `POST /v1/auth/device/bind` dengan *body*:
   - `serial_business`
   - `serial_outlet`
   - `password` (Password Pemilik Bisnis)
2. Jika sukses, server mengembalikan **Device Token**.
3. **Simpan Device Token ini secara permanen** di penyimpanan aman perangkat (*secure storage*). Token ini **tidak akan expired** dan akan terus digunakan untuk menembak API *Sync*.

### Tahap 2: Tarik Master Data (Sync Down) - *Online Berkala*
Agar klien punya modal jualan saat *offline*, Klien harus menarik semua data master milik outlet.
1. Klien menembak `GET /v1/pos/sync/master-data` (Lampirkan Header `Authorization: Bearer <device_token>`).
2. Server akan mengembalikan JSON besar berisi:
   - Daftar Staf di outlet tersebut (beserta `staff_identifier` dan `PINHash`).
   - Daftar Kategori.
   - Daftar Produk.
   - Daftar Resep (BOM) & Bahan Baku yang menempel pada produk.
3. **Tugas Anda:** Simpan atau mutakhirkan (*upsert*) semua data ini ke SQLite lokal Anda. Klien harus menggunakan data ini untuk *rendering* antarmuka kasir.

### Tahap 3: Login Kasir (Harian) - *100% Offline Lokal*
1. Kasir membuka aplikasi POS dan disuguhi halaman Login (Masukkan ID Staf & PIN).
2. **Klien memvalidasi login secara LOKAL.** Cocokkan input PIN dengan `PINHash` yang sudah ditarik pada Tahap 2.
3. Saat berhasil masuk, **Klien langsung membuat `shift_id` (UUID)** dan menampilkan *prompt* "Input Modal Awal Kasir". Simpan data *Open Shift* ini di SQLite. Semua struk belanja pada hari itu akan dikaitkan dengan `shift_id` ini.

### Tahap 4: Mengirim Data (Sync Up) - *Online Berkala / End of Day*
Ketika internet tersedia, Klien harus melempar semua aktivitas ke server agar server bisa memotong stok bahan baku dan mencetak laporan bos.
1. Klien menembak `POST /v1/pos/sync` (Lampirkan Header `Authorization: Bearer <device_token>`).
2. *Payload* yang dikirim berbentuk JSON yang berisi gabungan (*array*) dari:
   - Data `shifts` (Satu baris berisi *opening* dan *closing balance* jika shift sudah ditutup).
   - Data `transactions` beserta `transaction_items` (Hanya yang berstatus COMPLETED atau CANCELLED).
   - Data `product_wastes` (Riwayat produk basi/dibuang yang diinput kasir).
3. **Partial Success:** Server akan membalas dengan status detail. Jika ada 100 transaksi, dan 2 di antaranya ditolak (karena format data kacau atau produk tidak dikenali), server akan mengembalikan rinciannya. **Tugas Anda:** Hapus/tandai 98 transaksi yang *sukses* di SQLite lokal Anda agar tidak dikirim ulang, dan tahan 2 transaksi yang gagal (mungkin butuh intervensi manual).

---

## 3. Tanggung Jawab Fitur Khusus

* **Pending Transaksi (Hold Cart):** Murni tugas *Frontend*. Simpan keranjang belanja ke memori/lokal. Jangan dikirim ke server. Server hanya peduli transaksi yang sudah LUNAS.
* **History Transaksi:**
  - **Hari Ini:** Gunakan data dari SQLite lokal agar super instan.
  - **Hari-Hari Lalu / Beda Shift:** Tembak API Server `GET /v1/pos/transactions` untuk menyedot riwayat dari gudang data pusat (Bisa menggunakan filter ID Kasir / Tanggal).
* **Refund / Void Transaksi:**
  - Klien merubah status transaksi di SQLite lokal menjadi `CANCELLED`.
  - Saat Klien men-*sync* transaksi ini, Server otomatis akan melakukan *Reverse Deduction* (Mengembalikan bahan baku yang telanjur terpotong ke dalam *inventory* pusat).

*Panduan detail untuk spesifikasi JSON Request/Response dari masing-masing API dapat dilihat pada dokumen Postman kami.*
