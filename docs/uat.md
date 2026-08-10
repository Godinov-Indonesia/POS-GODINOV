# UAT — Skenario Uji End-to-End

> **Lingkup:** `posgodinov-fe` — Admin Dashboard & Web POS PWA.
> **Tenant uji:** Godinov Digital · Godinov Coffee & Eatery - Sudirman
> **Sumber data:** [posgodinov-fe/lib/seed/fixtures.ts](../posgodinov-fe/lib/seed/fixtures.ts)
>
> Dokumen ini adalah **naskah uji**, bukan daftar fitur. Setiap skenario
> menyebutkan langkah, hasil yang diharapkan, dan **mengapa** hal itu penting —
> banyak di antaranya menguji perilaku yang lahir dari batasan backend, bukan
> dari pilihan desain.

---

## 0. Menyiapkan lingkungan

### 0.1 Dua jalur seeding — pilih sesuai yang diuji

| Jalur | Perintah | Untuk menguji | Backend perlu hidup? |
|---|---|---|---|
| **IndexedDB** | `/dev/seed` → **Isi IndexedDB** | POS offline: P-03 s.d. P-12 tanpa jaringan | ❌ Tidak |
| **Backend API** | `/dev/seed` → **Kirim ke Backend** | Admin (D-01…D-21), binding nyata, sinkronisasi dua arah | ✅ Ya |

Halaman `/dev/seed` **hanya ada saat `npm run dev`**. Pada build produksi,
route-nya tidak dikompilasi sama sekali (`pageExtensions` di `next.config.ts`),
sehingga fixture dan PIN uji tidak pernah terkirim ke peramban.

### 0.2 Menjalankan backend

```bash
cd posgodinov-be
cp .env.example .env          # PASETO_SYMMETRIC_KEY wajib tepat 32 karakter
docker compose up -d          # atau PostgreSQL sendiri di :5432
go run ./cmd/api
curl http://localhost:8080/health   # harus 200 sebelum lanjut
```

### 0.3 Menjalankan frontend

```bash
cd posgodinov-fe
cp .env.example .env.local    # NEXT_PUBLIC_API_BASE_URL
npm install
npm run dev
```

---

## 1. Data uji

### 1.1 Identitas

| Peran | Nilai |
|---|---|
| Bisnis | Godinov Digital · `GODBU100826` |
| Pemilik | Muhamad Rifki Firdaus · `owner@godinov.id` |
| Outlet | Godinov Coffee & Eatery - Sudirman |
| Serial Tenant | `GODBU100826001` |
| Kasir 1 | Siti Aminah · `kasir01` · PIN `1234` |
| Kasir 2 | Andi Pratama · `kasir02` · PIN `5678` |

### 1.2 Bahan baku (8)

| Bahan | Base unit | Kemasan | Stok awal | HPP/unit |
|---|---|---|---:|---:|
| Biji Kopi Arabika | gram | kg (1.000) | 5.000 | Rp 180 |
| Susu UHT Full Cream | ml | kotak (1.000) | 12.000 | Rp 18,5 |
| Gula Aren Cair | ml | — | 3.000 | Rp 30 |
| Bubuk Matcha Premium | gram | — | 1.000 | Rp 250 |
| Cup Plastik 16oz | pcs | dus (50) | 500 | Rp 450 |
| Croissant Frozen | pcs | — | 100 | Rp 8.000 |
| Daging Ayam Fillet | gram | — | 4.000 | Rp 50 |
| Rice/Beras | gram | karung (5.000) | 10.000 | Rp 14 |

### 1.3 Produk & HPP — **angka ini adalah oracle uji**

Nilai berikut diverifikasi secara independen terhadap spesifikasi; setiap
penyimpangan pada layar berarti bug pada kalkulator HPP atau pada konversi sen.

| Produk | Kategori | Harga | HPP | Margin | % |
|---|---|---:|---:|---:|---:|
| Kopi Susu Gula Aren | Kopi & Espresso | Rp 22.000 | Rp 6.810 | Rp 15.190 | 69,0% |
| Matcha Latte Ice | Non-Kopi & Tea | Rp 26.000 | Rp 8.225 | Rp 17.775 | 68,4% |
| Americano Hot | Kopi & Espresso | Rp 18.000 | Rp 3.690 | Rp 14.310 | 79,5% |
| Croissant Butter | Pastry & Bakery | Rp 18.000 | Rp 8.000 | Rp 10.000 | 55,6% |
| Nasi Ayam Geprek | Makanan Utama | Rp 28.000 | Rp 10.300 | Rp 17.700 | 63,2% |
| Es Teh Manis | Non-Kopi & Tea | Rp 8.000 | Rp 450 | Rp 7.550 | 94,4% |

> **Rp 18,5/ml adalah kasus uji, bukan kebetulan.** Ia satu-satunya harga
> pecahan di fixture dan akan mengungkap galat pembulatan bila aritmetika uang
> tidak benar-benar berjalan pada integer sen. `120 ml × Rp 18,5 = Rp 2.220`
> harus **eksak**.

---

## 2. Skenario Admin Dashboard

### UAT-A01 · Registrasi & login pemilik
1. Buka `/register`, daftarkan Godinov Digital dengan `owner@godinov.id`.
2. **Diharapkan:** diarahkan ke `/admin/outlets/new` karena belum ada outlet.
3. Logout, lalu login ulang di `/login`.
4. **Diharapkan:** outlet tunggal terpilih otomatis, mendarat di `/admin`.

**Mengapa penting:** alur 0/1/>1 outlet ([05 §1.4.4]) menentukan seluruh
navigasi awal. Salah di sini, pengguna baru mendarat di dashboard kosong.

### UAT-A02 · Serial tenant tampil di provisioning
1. Buat outlet "Godinov Coffee & Eatery - Sudirman".
2. **Diharapkan:** langsung diarahkan ke halaman Info Pemasangan, menampilkan
   `serial_business` **dan** `serial_tenant`.

**Mengapa penting:** `serial_tenant` **tidak dapat diambil kembali** lewat
endpoint lain. Bila tidak ditampilkan di sini, perangkat POS tidak akan pernah
bisa di-binding.

### UAT-A03 · Ganti outlet membuang cache outlet lama
1. Buat outlet kedua, isi produk berbeda lewat `/dev/seed`.
2. Buka daftar produk outlet A, lalu ganti ke outlet B lewat switcher di header.
3. **Diharapkan:** tabel **langsung kosong lalu memuat ulang** — bukan
   menampilkan produk outlet A sesaat.

**Mengapa penting:** ini bug paling berbahaya di aplikasi ini ([05 §1.2.2]).
Pada layar yang menampilkan uang, data outlet lain yang tampil sekejap pun tidak
dapat diterima.

### UAT-A04 · Kalkulator HPP & margin
1. Buka `/admin/products`, ubah **Kopi Susu Gula Aren**.
2. **Diharapkan:** ringkasan menampilkan HPP `Rp 6.810`, margin `Rp 15.190`,
   `69,0%` — cocok dengan tabel §1.3.
3. Ubah harga jual menjadi `Rp 5.000`.
4. **Diharapkan:** blok ringkasan berubah merah, muncul peringatan harga di
   bawah HPP, **tetapi tombol Simpan tetap aktif**.

**Mengapa penting:** margin negatif adalah **peringatan, bukan blokir**. Ada
produk yang memang dijual rugi, dan backend tidak menolaknya.

### UAT-A05 · Bahan baku ganda ditolak di klien
1. Pada penyusun resep, tambahkan baris kedua dengan bahan baku yang sama.
2. **Diharapkan:** bahan yang sudah dipakai **tidak muncul** di pemilih baris
   lain. Bila dipaksa, submit ditolak sebelum request terkirim.

**Mengapa penting:** unique constraint `(product_id, raw_material_id)` di
database. Menunggu round-trip untuk kesalahan yang terlihat di layar itu boros.

### UAT-A06 · Update produk mengirim BOM utuh
1. Ubah **hanya nama** Americano Hot, simpan.
2. Buka kembali produknya.
3. **Diharapkan:** kedua baris resep **masih ada**.

**Mengapa penting:** backend memperlakukan `recipes` sebagai penggantian total —
menghilangkan field itu **menghapus seluruh resep** ([03 §6.4]).

### UAT-A07 · Stok minus tersorot, bukan disembunyikan
1. Lakukan opname pada Cup Plastik dengan hitung fisik `0`.
2. Jual beberapa produk dari POS lalu sinkronkan.
3. **Diharapkan:** stok Cup Plastik menjadi **negatif**, tampil dengan ikon
   segitiga + warna danger + banner agregat.

**Mengapa penting:** stok negatif disengaja — pemotongan stok saat sync tidak
pernah ditolak. UI harus menampilkannya, bukan menyembunyikannya ([03 §7.3]).

### UAT-A08 · Waste Admin menolak stok tidak cukup
1. Buka `/admin/inventory/waste`, catat waste Croissant Frozen sebanyak `999`.
2. **Diharapkan:** ditolak backend; pesan galat ditampilkan **apa adanya**.

**Mengapa penting:** waste Admin **menolak** stok kurang, sedangkan waste kasir
**membolehkan** stok minus. Perbedaan ini disengaja ([03 §9.1]).

### UAT-A09 · Opname bersifat destruktif
1. Buka `/admin/inventory/opname`, isi Biji Kopi dengan `4800`.
2. **Diharapkan:** dialog konfirmasi menyatakan stok akan **ditimpa** dan tidak
   dapat dibatalkan. Setelah dikonfirmasi, stok sistem menjadi `4800`.
3. Buka laporan opname.
4. **Diharapkan:** selisih `−200`, nilai selisih `−Rp 36.000`.

### UAT-A10 · Batas rentang laporan 7 hari
1. Buka `/admin/reports/transactions`, pilih rentang 30 hari.
2. **Diharapkan:** peringatan muncul dan **request tidak dikirim**.

**Mengapa penting:** tidak ada paginasi di endpoint laporan mana pun. Rentang
lebar berarti payload puluhan megabita dalam satu response.

### UAT-A11 · Banner waktu server wajib tampil
1. Buka setiap layar laporan dan dashboard.
2. **Diharapkan:** banner amber menyatakan laporan dikelompokkan berdasarkan
   waktu data **diterima server**, bukan waktu transaksi di kasir.

**Mengapa penting:** transaksi Senin yang baru tersinkron Rabu tercatat sebagai
pendapatan Rabu ([03 §11.1] `[NEEDS DISCUSSION]`). Tanpa banner, pemilik akan
salah membaca laporannya sendiri.

### UAT-A12 · Aksi yang endpoint-nya tidak ada disembunyikan
1. Periksa halaman kategori, outlet, dan form staff.
2. **Diharapkan:** tidak ada tombol edit/hapus kategori, tidak ada edit/hapus
   outlet, tidak ada reset PIN. Masing-masing disertai penjelasan.

---

## 3. Skenario POS — offline

> Jalankan **Isi IndexedDB** di `/dev/seed`, lalu buka `/pos`.
> Untuk uji mode pesawat: DevTools → Network → **Offline**.

### UAT-P01 · Login kasir tanpa jaringan
1. Matikan jaringan sepenuhnya.
2. Buka `/pos`, masuk sebagai `kasir01` / PIN `1234`.
3. **Diharapkan:** berhasil masuk. Tombol MASUK menampilkan status memeriksa
   selama ±100–300 ms dan **UI tidak membeku**.

**Mengapa penting:** backend tidak punya endpoint login kasir. Verifikasi
bcrypt berjalan di Web Worker (ADR-08); bila ia jalan di main thread, layar
membeku persis saat kasir menekan tombol.

### UAT-P02 · Pesan galat login disamakan
1. Masuk dengan `kasir99` (tidak ada) → catat pesannya.
2. Masuk dengan `kasir01` + PIN `9999` → catat pesannya.
3. **Diharapkan:** **identik** — "ID atau PIN salah".

**Mengapa penting:** mencegah penebakan daftar staff dari layar yang terpasang
di area publik.

### UAT-P03 · Buka shift & aritmetika kas
1. Buka shift dengan modal awal `Rp 500.000`.
2. Jual: 2× Kopi Susu Gula Aren (tunai), 1× Es Teh Manis (QRIS).
3. Buka Tutup Shift.
4. **Diharapkan:**
   - Penjualan tunai `Rp 44.000`
   - Penjualan non-tunai `Rp 8.000`
   - Seharusnya di laci `Rp 544.000` — **QRIS tidak menambah isi laci**

**Mengapa penting:** server **tidak** menghitung ulang `expected_balance` dan
`discrepancy`, padahal `discrepancy` inilah yang muncul di dashboard pemilik.

### UAT-P04 · Uang eksak, tanpa galat pembulatan
1. Tambahkan 1× Matcha Latte Ice (`Rp 26.000`) dan 1× Nasi Ayam Geprek (`Rp 28.000`).
2. **Diharapkan:** total **tepat** `Rp 54.000`.
3. Bayar tunai `Rp 100.000`.
4. **Diharapkan:** kembalian **tepat** `Rp 46.000`.
5. Periksa seluruh nominal di layar.
6. **Diharapkan:** semuanya monospace, rata kanan, dan **tidak bergoyang** saat
   angka berubah.

### UAT-P05 · Metode pembayaran terkunci
1. Buka layar pembayaran.
2. **Diharapkan:** tepat empat tombol — Tunai, QRIS, Kartu Debit, Transfer Bank.
   **Tidak ada** input teks bebas dan **tidak ada** opsi "Lainnya".

**Mengapa penting:** `payment_method` adalah VARCHAR bebas tanpa enum di
database. Satu salah ketik memecah pengelompokan laporan **secara permanen** —
tidak ada endpoint untuk memperbaiki data lama.

### UAT-P06 · Kegagalan cetak tidak menghapus transaksi
1. Selesaikan transaksi tanpa printer terpasang.
2. Tekan **Cetak** dan biarkan gagal.
3. **Diharapkan:** toast galat muncul, **transaksi tetap ada** di riwayat, dan
   tombol berubah menjadi **Cetak Ulang**.
4. Cetak ulang.
5. **Diharapkan:** struk memuat penanda `--- CETAK ULANG ---`.

**Mengapa penting:** printer mati adalah masalah operasional, bukan alasan
menghilangkan penjualan yang uangnya sudah diterima ([05 §1.6.5]).

### UAT-P07 · Keranjang bertahan melewati reload
1. Isi keranjang dengan 3 item.
2. Tekan `F5`.
3. **Diharapkan:** keranjang **masih utuh**.

**Mengapa penting:** pada tab peramban biasa, reload tidak dapat dicegah.
Tanpa persistensi, keranjang hilang di depan pelanggan ([06 §5.1]).

### UAT-P08 · Pesanan ditahan murni lokal
1. Tahan pesanan dengan label "Meja 4".
2. Ambil kembali, lalu selesaikan pembayarannya.
3. **Diharapkan:** pesanan tertahan hilang dari daftar **hanya setelah**
   pembayaran berhasil.
4. Periksa payload sinkronisasi.
5. **Diharapkan:** pesanan tertahan **tidak pernah** terkirim ke server.

### UAT-P09 · Layar kasir tidak menyebut stok sama sekali
1. Periksa grid produk, tile, dan panel keranjang.
2. **Diharapkan:** **tidak ada** indikator stok, tidak ada penanda "habis",
   tidak ada tile yang dinonaktifkan.

**Mengapa penting:** master data POS tidak memuat stok ([03 §2.2]). Menampilkan
angka stok apa pun di sini berarti menampilkan angka yang dikarang.

### UAT-P10 · Fallback gambar produk
1. Seluruh produk fixture ber-`image_url` `null`.
2. **Diharapkan:** setiap tile menampilkan **inisial dua huruf** berlatar warna
   deterministik — `KS`, `ML`, `AH`, `CB`, `NA`, `ET`.
3. Muat ulang halaman.
4. **Diharapkan:** warna tiap tile **tetap sama**.

**Mengapa penting:** tidak ada endpoint unggah gambar, sehingga mayoritas produk
nyata akan ber-`image_url` `NULL`. Fallback harus terlihat disengaja.

---

## 4. Skenario sinkronisasi — paling rawan

> Memerlukan binding **nyata** lewat `/pos/bind`. Device token dari seeder
> IndexedDB sengaja palsu dan akan ditolak `401`.

### UAT-S01 · Offline lalu online
1. Matikan jaringan, buat 5 transaksi.
2. **Diharapkan:** hitungan antrean di StatusBar menjadi `6` (5 transaksi + 1 shift).
3. Hidupkan jaringan, tunggu ±2 detik.
4. **Diharapkan:** antrean menjadi `0`; tidak ada duplikasi di laporan Admin.

### UAT-S02 · Idempotensi
1. Setelah UAT-S01, tekan **Sinkronkan Sekarang** di P-13 berulang kali.
2. **Diharapkan:** laporan Admin **tidak bertambah**, dan stok bahan baku
   **tidak terpotong dua kali**.

**Mengapa penting:** UUID dibuat klien dan tidak pernah diregenerasi — itulah
seluruh dasar idempotensi.

### UAT-S03 · Dua tab tidak mengirim ganda
1. Buka `/pos` di dua tab.
2. Picu sinkronisasi bersamaan.
3. **Diharapkan:** satu tab melaporkan dilewati "Tab lain sedang menyinkronkan".

### UAT-S04 · Void mengembalikan bahan baku
1. Catat stok Biji Kopi.
2. Jual 1× Americano Hot, sinkronkan.
3. **Diharapkan:** stok berkurang 18 gram.
4. Void transaksi tersebut lewat P-10 (alasan wajib + konfirmasi ganda), sinkronkan.
5. **Diharapkan:** stok **kembali** ke angka semula.

### UAT-S05 · Void sebelum pernah tersinkron
1. Offline, buat transaksi, void, lalu online.
2. **Diharapkan:** terkirim sebagai `CANCELLED`; stok **tidak pernah** terpotong.

### UAT-S06 · Jam perangkat melenceng
1. Geser jam sistem perangkat 1 jam ke depan.
2. Lakukan operasi apa pun yang menyentuh jaringan.
3. **Diharapkan:** peringatan skew muncul di StatusBar dan P-14.
4. **Diharapkan:** `client_created_at` **tidak** dikoreksi diam-diam.

**Mengapa penting:** menggeser waktu otomatis membuat data lokal tidak konsisten
dengan struk yang sudah tercetak.

### UAT-S07 · Backend mati saat sinkronisasi
1. Hentikan backend, picu sinkronisasi manual.
2. **Diharapkan:** pesan menyebut alamat yang dituju —
   *"Server tidak merespons di http://localhost:8080…"* — bukan pesan generik.
3. Matikan jaringan perangkat, picu lagi.
4. **Diharapkan:** pesan berbeda — *"Perangkat sedang offline. Data tetap
   tersimpan…"*.

**Mengapa penting:** tindakan operator untuk kedua kondisi ini berbeda jauh.

---

## 5. Skenario PWA & aksesibilitas

### UAT-W01 · Aplikasi terbuka dalam mode pesawat
1. Setelah binding dan sync master, tutup aplikasi.
2. Aktifkan mode pesawat, buka kembali `/pos`.
3. **Diharapkan:** aplikasi terbuka **penuh** — bukan halaman galat peramban.

### UAT-W02 · Service worker tidak menyentuh Admin
1. DevTools → Application → Cache Storage.
2. **Diharapkan:** hanya URL `/pos*`, `/_next/static`, dan `/icons` tersimpan.
   **Tidak ada** `/admin*` maupun `/v1*`.

**Mengapa penting:** data Admin bersifat per-tenant. Menyimpannya di cache
perangkat kasir bersama adalah kebocoran, bukan optimasi.

### UAT-W03 · Pintasan keyboard
1. Tekan `F1` → overlay bantuan muncul.
2. Tekan `F2` → fokus ke kolom pencarian.
3. Ketik di kolom pencarian, tekan `Space`.
4. **Diharapkan:** spasi **diketik**, pembayaran **tidak** terbuka.
5. Klik area grid (fokus bukan di input), tekan `Space`.
6. **Diharapkan:** layar pembayaran terbuka.

### UAT-W04 · Ukuran target sentuh
1. Ukur tombol dengan DevTools.
2. **Diharapkan:** numpad ≥ 56 px · Bayar ≥ 64 px · Fast-Cash ≥ 72 px ·
   seluruh target interaktif ≥ 48 px.

### UAT-W05 · Status tidak bergantung warna saja
1. Aktifkan simulasi buta warna (DevTools → Rendering → Emulate vision deficiencies).
2. Periksa badge status sinkronisasi, badge staff aktif/nonaktif, dan penanda
   stok minus.
3. **Diharapkan:** setiap status tetap dapat dibedakan lewat **ikon dan teks**.

---

## 6. Yang **tidak** dicakup seeder ini

Kondisi berikut sengaja tidak dibuat oleh fixture karena semuanya bermargin
sehat dan berstok cukup. Buat secara manual bila hendak menguji jalurnya:

| Kondisi | Cara membuatnya |
|---|---|
| Margin negatif | Ubah harga Croissant Butter menjadi `Rp 5.000` (HPP `Rp 8.000`) |
| Stok minus | Opname Cup Plastik ke `0`, lalu jual beberapa minuman dan sinkronkan |
| `fraud_flag` opname | Opname Biji Kopi dari `5.000` ke `4.000` (selisih 20% > ambang 5%) |
| Produk tanpa resep | Buat produk baru dan kosongkan penyusun BOM |
| Antrean sinkronisasi besar | Offline, buat > 200 transaksi — menguji pemecahan batch |
| Kategori ganda | Jalankan seeder API dua kali pada outlet yang sama (**permanen — pakai outlet sekali pakai**) |

---

## 7. Catatan keamanan lingkungan uji

1. **PIN uji `1234` dan `5678` tertulis jelas** di fixture. Itu memang
   disengaja — penguji perlu tahu PIN-nya. **Jangan pernah** memakai fixture ini
   untuk membuat akun produksi.
2. **Halaman `/dev/seed` tidak ada di build produksi.** Dijaga di lapisan build
   lewat `pageExtensions`, bukan lewat pemeriksaan runtime — sudah diverifikasi
   bahwa fixture dan PIN tidak muncul di bundle produksi.
3. **Device token dari seeder IndexedDB adalah palsu.** Ia hanya membuka gerbang
   UI; setiap sinkronisasi dengannya dijawab `401`. Ini disengaja agar seeder
   offline tidak dapat mencemari data server.
4. **Seeder API menolak outlet yang sudah berisi data.** Kategori ganda tidak
   dapat dihapus lewat API mana pun, sehingga satu kali salah jalan
   meninggalkan outlet kotor selamanya.
