# Panduan Integrasi Klien POS (Frontend) - Offline-First Sync Hub

Dokumen ini adalah panduan resmi bagi developer Frontend/Klien (Mobile/Tablet/Desktop) yang akan mengimplementasikan aplikasi POS Kasir. Aplikasi kasir ini dirancang dengan arsitektur **Offline-First**, artinya aplikasi harus bisa berjalan normal tanpa internet, dan hanya membutuhkan koneksi saat awal pemasangan (*setup*) dan sinkronisasi (*sync*).

## 1. Konsep Utama (Offline-First)
* **Klien adalah Raja Lokal:** Klien bertanggung jawab atas penyediaan database lokal (seperti SQLite/Room). Semua validasi transaksi harian, perhitungan keranjang belanja, *pending* pesanan, dan buka/tutup laci kasir (shift) dilakukan murni oleh klien secara *offline*.
* **UUID dari Klien:** Klien wajib membuat `id` (UUID v4) untuk setiap baris data baru (Transaksi, Detail Transaksi, Shift, Waste). Backend tidak membuatkan ID. Ini untuk mencegah duplikasi jika Klien tidak sengaja mengirim data yang sama (*Idempotency*).
* **Toleransi Minus & Dual-Stock Auto-Unpack:** Server melacak inventori menggunakan model **Dual-Stock** (`package_stock` untuk kemasan utuh dan `loose_stock` untuk eceran terbuka). Saat *sync*, server memotong stok bahan baku berdasarkan resep BOM. Jika stok eceran terbuka kurang dari kebutuhan resep, server secara atomik membongkar kemasan utuh (*auto-unpack*) menjadi stok eceran. Bahkan jika total stok tidak mencukupi, server tetap memperbolehkan stok tembus minus agar transaksi offline kasir tetap sukses tercatat. Klien POS tidak perlu melakukan kalkulasi pecahan kemasan lokal.

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

---

# Panduan Integrasi Klien SO (Stock Opname) — App Mobile

Dokumen ini adalah panduan bagi developer Frontend/Klien yang akan mengimplementasikan aplikasi **Stock Opname (posgodinov-so)**. Aplikasi SO digunakan oleh kasir/petugas gudang untuk menghitung stok fisik berdasarkan form SO yang dibuat oleh Admin.

## 1. Konsep Utama

* **Blind Opname:** Kasir **tidak pernah melihat angka stok sistem**. Mereka hanya melihat daftar material yang harus dihitung, lalu menginput jumlah aktual. Ini mencegah manipulasi data.
* **Multi-Kasir:** Satu form SO bisa diisi oleh banyak kasir. Setiap kasir punya "lembar hitungan" sendiri. Hasil akhir = SUM dari semua kasir per material.
* **Partial Submit:** Kasir boleh submit sebagian material dulu, lalu lanjut nanti. Submit ulang material yang sama akan meng-update hitungan sebelumnya.

## 2. Alur Penggunaan API (Flow)

### Tahap 1: Otorisasi Perangkat (Device Binding) — *Online 1x Saja*

Sama persis dengan POS, kecuali scope-nya `OPNAME`:

1. Klien menembak `POST /v1/auth/device/bind` dengan *body*:
   ```json
   {
     "serial_business": "SB001",
     "serial_outlet": "SO001",
     "password": "password_pemilik",
     "scope": "OPNAME"
   }
   ```
2. Simpan **Device Token** secara permanen. Token ini berisi `business_id` dan `outlet_id`.
3. **Tidak perlu** mengirim header `X-Business-ID` — middleware otomatis mengambilnya dari token.

### Tahap 2: Login Kasir — *Offline Lokal*

1. Tarik master data via `GET /v1/pos/sync/master-data` (endpoint ini dibuka untuk semua scope device).
2. Kasir login di app menggunakan Staff ID + PIN, validasi secara lokal.
3. Simpan `staff_id` kasir — dibutuhkan sebagai header `X-Staff-Id` untuk setiap request submit.

### Tahap 3: Lihat Form SO Tersedia — *Online*

```
GET /v1/so/available
Authorization: Bearer <device_token>
```

Response berisi daftar form SO yang berstatus `PUBLISHED` atau `COUNTING` untuk outlet ini:
```json
{
  "status": "success",
  "data": [
    {
      "id": "form-uuid-1",
      "status": "PUBLISHED",
      "scope": "FULL",
      "materials": [
        {
          "raw_material_id": "rm1",
          "raw_material_name": "Gula Pasir",
          "unit": "gram",
          "package_unit": "karung",
          "quantity_per_package": 50000.0
        },
        {
          "raw_material_id": "rm2",
          "raw_material_name": "Susu UHT",
          "unit": "ml",
          "package_unit": "karton",
          "quantity_per_package": 12000.0
        }
      ]
    }
  ]
}
```

### Tahap 4: Submit Hasil Hitungan — *Online*

Klien mengirim hitungan fisik dalam format **Dual-Stock**:
- `actual_packages` (`int`): Jumlah kemasan utuh fisik (misal: 2 karung). Isi `0` jika tidak ada kemasan utuh.
- `actual_loose` (`float`): Jumlah eceran terbuka dalam unit dasar (`unit`, misal: 450.0 gram). Isi `0` jika tidak ada eceran terbuka.
- `notes` (`string`): Catatan fisik opsional.

```
PUT /v1/so/{form_id}/counts
Authorization: Bearer <device_token>
X-Staff-Id: <staff_id_kasir>
```

Body:
```json
{
  "items": [
    {
      "raw_material_id": "rm1",
      "actual_packages": 2,
      "actual_loose": 450.0,
      "notes": ""
    },
    {
      "raw_material_id": "rm2",
      "actual_packages": 5,
      "actual_loose": 0.0,
      "notes": "di rak belakang"
    }
  ]
}
```

> **Penting:**
> - Header `X-Staff-Id` **WAJIB** — mengidentifikasi kasir mana yang menghitung.
> - Bisa submit berkali-kali. Submit ulang material yang sama akan meng-update hitungan sebelumnya (upsert).
> - Boleh submit sebagian material (partial submit).

### Tahap 5: Lihat Hitungan Sendiri — *Online*

```
GET /v1/so/{form_id}/my-counts
Authorization: Bearer <device_token>
X-Staff-Id: <staff_id_kasir>
```

Response mengembalikan lembar hitungan kasir yang bersangkutan beserta total unit yang dihitung:
```json
{
  "status": "success",
  "data": {
    "counted_by": "staff-uuid-1",
    "staff_name": "Budi",
    "items": [
      {
        "raw_material_id": "rm1",
        "raw_material_name": "Gula Pasir",
        "unit": "gram",
        "actual_packages": 2,
        "actual_loose": 450.0,
        "actual_stock": 100450.0,
        "notes": ""
      }
    ]
  }
}
```

## 3. Status Form SO

| Status | Arti bagi kasir |
|--------|----------------|
| `PUBLISHED` | Form baru, belum ada kasir yang submit |
| `COUNTING` | Sudah ada kasir lain yang submit, masih bisa dikerjakan |
| `CLOSED` | Admin sudah menutup, tidak bisa submit lagi |

## 4. Yang TIDAK Perlu Dilakukan Klien SO

* **Menghitung selisih** — dilakukan server saat Admin close form.
* **Mengirim stok sistem** — klien tidak punya dan tidak perlu data ini.
* **Membuat form SO** — hanya Admin via dashboard yang bisa membuat form.

*Panduan detail untuk spesifikasi JSON Request/Response dapat dilihat pada dokumen Postman kami.*
