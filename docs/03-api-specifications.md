# 03 — API Specifications

> **Sumber kebenaran:** [internal/handler/router.go](../posgodinov-be/internal/handler/router.go) beserta seluruh handler, service, dan DTO domain.
> **Total: 39 rute terdaftar** (38 endpoint API + 1 health check).
> Seluruh contoh payload di bawah diturunkan langsung dari struct Go — bukan karangan.

---

## 0. Konvensi Global

### Base URL

| Environment | URL |
|---|---|
| Local | `http://localhost:8080` |
| Docker Compose | `http://localhost:8080` |
| Production | Ditentukan saat deployment |

Port dikonfigurasi lewat `APP_PORT` (default `8080`).

### Header

| Header | Kapan diperlukan | Nilai |
|---|---|---|
| `Content-Type` | Semua request dengan body | `application/json` |
| `Authorization` | Semua endpoint kecuali `/v1/auth/*` dan `/health` | `Bearer <token>` |

> ⚠️ **Tidak ada header `X-Tenant-ID`.** Konteks tenant sepenuhnya diturunkan dari token dan path parameter. Mengirim header ini tidak berpengaruh apa pun — backend tidak membacanya.

### Jenis token per kelompok endpoint

| Kelompok | Token yang wajib | `Type` di dalam payload |
|---|---|---|
| `/v1/business/*` | Access token dari login Business | `access` |
| `/v1/pos/*` | Device token dari device binding | `device` |
| `/v1/auth/*` | — (publik) | — |

Menggunakan device token pada endpoint `/v1/business/*` (atau sebaliknya) akan menghasilkan **`401`** — pemeriksaan jenis token bersifat ketat.

### Bentuk response

Backend memakai **dua bentuk response yang berbeda**. Frontend harus menangani keduanya.

**Bentuk A — Amplop standar** (dipakai oleh 35 dari 38 endpoint):

```json
{
  "status": "success",
  "message": "Deskripsi hasil dalam Bahasa Indonesia",
  "data": { }
}
```

**Bentuk B — Tanpa amplop** (hanya 3 endpoint auth Business: `register`, `login`, `refresh`):

```json
{
  "business": { },
  "access_token": "v4.local...",
  "refresh_token": "v4.local..."
}
```

`[NEEDS DISCUSSION]` — Ketidakkonsistenan ini nyata dan berada tepat di jalur paling awal yang disentuh frontend. API client sebaiknya menangani ketiga endpoint auth sebagai kasus khusus, sambil mengusulkan penyeragaman ke Bentuk A di backend.

**Bentuk error** (seluruh endpoint):

```json
{
  "status": "fail",
  "message": "Pesan yang dapat dibaca manusia",
  "errors": { "server": "detail teknis error" }
}
```

`status` bernilai `"fail"` untuk 4xx dan `"error"` untuk 5xx ([pkg/response/response.go:19-22](../posgodinov-be/pkg/response/response.go#L19-L22)). Kunci di dalam `errors` bervariasi: `server`, `password`, `credentials`, `token`, `rate_limit`, atau `error`.

### ⚠️ Pemetaan kode status — WAJIB dibaca frontend

Backend **tidak** memakai kode status HTTP secara semantik. Hampir seluruh kegagalan pada layer service dikembalikan sebagai **`400 Bad Request`**, termasuk kasus yang seharusnya `403` atau `404`:

| Kondisi sesungguhnya | Kode yang dikembalikan | Pesan |
|---|---|---|
| Outlet milik tenant lain (seharusnya `403`) | **`400`** | `"akses ditolak: outlet ini bukan milik bisnis Anda"` |
| Produk tidak ditemukan (seharusnya `404`) | **`400`** | `"produk tidak ditemukan"` |
| Kesalahan validasi | `400` | bervariasi |
| Token hilang / tidak valid / salah jenis | `401` | dari middleware |
| Batas rate terlampaui | `429` | hanya pada endpoint register |
| Kegagalan internal | `500` | hanya pada reports, POS sync, business login |

**Implikasi bagi frontend:** jangan membuat percabangan berdasarkan `403`/`404` — keduanya tidak akan pernah muncul. Gunakan `response.message` untuk membedakan jenis kegagalan, dan tampilkan pesan tersebut apa adanya (seluruhnya sudah berbahasa Indonesia dan layak ditampilkan ke pengguna).

`[NEEDS DISCUSSION]` — Pemetaan kode status ini sebaiknya diperbaiki di backend. Selama belum diperbaiki, frontend terpaksa melakukan pencocokan string pada `message`, yang rapuh terhadap perubahan kalimat.

### Daftar path parameter

| Parameter | Tipe | Contoh |
|---|---|---|
| `{outlet_id}` | `VARCHAR(6)` | `A3K9P1` |
| `{staff_id}` | UUID | `550e8400-e29b-41d4-a716-446655440000` |
| `{product_id}` | UUID | — |
| `{raw_material_id}` | UUID | — |

---

## 1. Modul: Auth & Session (Business Owner)

### 1.1 `POST /v1/auth/business/register`

Mendaftarkan tenant baru (Business Owner) dan langsung mengembalikan token aktif.

**Auth:** tidak perlu · **Rate limit:** 10 request/menit per IP

**Request Body**

```json
{
  "name": "Kopi Senja",
  "owner_name": "Budi Santoso",
  "email": "budi@kopisenja.id",
  "password": "rahasia123",
  "confirmation_password": "rahasia123"
}
```

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `name` | string | ya | Digunakan untuk 3 karakter pertama `serial_business` |
| `owner_name` | string | ya | Digunakan untuk 2 karakter berikutnya |
| `email` | string | ya | Harus unik (dijaga oleh constraint DB) |
| `password` | string | ya | Di-hash bcrypt. **Tidak ada validasi panjang minimum** |
| `confirmation_password` | string | ya | Harus persis sama dengan `password` |

**Response `201 Created`** — ⚠️ *tanpa amplop*

```json
{
  "business": {
    "id": "K7M2P9X4",
    "serial_business": "KOPBU100826",
    "email": "budi@kopisenja.id",
    "name": "Kopi Senja",
    "owner_name": "Budi Santoso",
    "created_at": "2026-08-10T09:15:00Z"
  },
  "access_token": "v4.local.xxxxx",
  "refresh_token": "v4.local.yyyyy"
}
```

> Simpan `serial_business` — nilai ini dibutuhkan untuk *device binding* POS dan tidak dapat diambil kembali lewat endpoint lain.

**Error**

`400` — password tidak cocok:
```json
{ "status": "fail", "message": "Gagal mendaftarkan bisnis",
  "errors": { "password": "password dan konfirmasi password tidak cocok" } }
```

`400` — email sudah terdaftar:
```json
{ "status": "fail", "message": "Gagal mendaftarkan bisnis",
  "errors": { "server": "ERROR: duplicate key value violates unique constraint ..." } }
```

`429` — terlalu banyak percobaan:
```json
{ "status": "fail", "message": "Terlalu banyak permintaan",
  "errors": { "rate_limit": "Anda telah melewati batas pendaftaran (10x per menit). Harap tunggu beberapa saat." } }
```

`[NEEDS DISCUSSION]` — Tidak ada validasi kekuatan password (panjang, kompleksitas) dan tidak ada validasi format email. Password `"a"` akan diterima. Sebaiknya divalidasi di backend; validasi frontend saja tidak cukup.

---

### 1.2 `POST /v1/auth/business/login`

**Auth:** tidak perlu · **Rate limit:** ❌ **tidak ada**

**Request Body**

```json
{ "email": "budi@kopisenja.id", "password": "rahasia123" }
```

**Response `200 OK`** — ⚠️ *tanpa amplop*, bentuknya identik dengan register.

**Error**

`401` — kredensial salah:
```json
{ "status": "fail", "message": "Gagal login",
  "errors": { "credentials": "email atau password salah" } }
```

`500` — kegagalan pembuatan token.

> Backend mengembalikan pesan generik yang sama baik email tidak ditemukan maupun password salah — praktik yang tepat untuk mencegah *user enumeration*.

`[NEEDS DISCUSSION]` — Endpoint login **tidak dibatasi rate limit**, padahal endpoint register dibatasi. Ini membuka peluang *credential stuffing* dan *brute force* tanpa hambatan.

---

### 1.3 `POST /v1/auth/business/refresh`

Menukar refresh token dengan access token baru.

**Auth:** tidak perlu (refresh token dikirim di dalam body, bukan di header)

**Request Body**

```json
{ "refresh_token": "v4.local.yyyyy" }
```

**Response `200 OK`** — ⚠️ *tanpa amplop*

```json
{ "access_token": "v4.local.zzzzz" }
```

**Error `401`**
```json
{ "status": "fail", "message": "Gagal memperbarui token",
  "errors": { "token": "refresh token tidak valid atau sudah kadaluarsa" } }
```

> Refresh token **tidak dirotasi** — refresh token lama tetap sah sampai 7 hari penuh. Tidak ada mekanisme pencabutan.

---

## 2. Modul: POS Device Auth & Sync

Endpoint pada modul ini melayani aplikasi kasir yang bersifat *offline-first*. Panduan alur lengkap ada di [CLIENTS.md](../posgodinov-be/CLIENTS.md).

### 2.1 `POST /v1/auth/device/bind`

Mengikat perangkat POS ke satu outlet dan menerbitkan device token berumur panjang. Dijalankan **satu kali** saat pemasangan perangkat.

**Auth:** tidak perlu · **Rate limit:** ❌ tidak ada

**Request Body**

```json
{
  "serial_business": "KOPBU100826",
  "serial_outlet": "KOPBU100826001",
  "password": "rahasia123"
}
```

| Field | Keterangan |
|---|---|
| `serial_business` | `businesses.serial_business` |
| `serial_outlet` | `outlets.serial_tenant` (bukan `outlets.id`) |
| `password` | **Password Business Owner** — teknisi pemasang harus mengetahuinya |

**Response `200 OK`** (perhatikan: `200`, bukan `201`)

```json
{
  "status": "success",
  "message": "Device berhasil diikat dengan outlet",
  "data": { "device_token": "v4.local.dddddd" }
}
```

**Error**

`400` — ada field yang kosong:
```json
{ "status": "fail", "message": "Serial business, serial outlet, dan password wajib diisi" }
```

`401` — kredensial salah atau serial outlet bukan milik bisnis tersebut:
```json
{ "status": "fail", "message": "kredensial bisnis tidak valid" }
```

> **Device token berlaku ~10 tahun (87.600 jam) dan tidak dapat dicabut.** Simpan di *secure storage* (Keychain / Keystore / EncryptedSharedPreferences), bukan di `localStorage`.

`[NEEDS DISCUSSION]` — Tidak ada endpoint *unbind*, tidak ada daftar perangkat, tidak ada mekanisme pencabutan. Perangkat yang hilang atau dicuri mempertahankan akses sinkronisasi selamanya. Endpoint ini juga menerima password owner dalam bentuk teks polos tanpa rate limit. **Ini adalah temuan keamanan paling mendesak dari audit.**

---

### 2.2 `GET /v1/pos/sync/master-data`

Menarik seluruh master data outlet untuk operasi offline (*Sync Down*).

**Auth:** `Authorization: Bearer <device_token>`

Konteks tenant otomatis diambil dari token — `payload.ID` = Outlet ID, `payload.Email` = Business ID. Tidak ada parameter.

**Response `200 OK`**

```json
{
  "status": "success",
  "message": "Master data berhasil disinkronisasi",
  "data": {
    "staffs": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "staff_identifier": "kasir01",
        "name": "Siti Aminah",
        "pin_hash": "$2a$10$N9qo8uLOickgx2ZMRZoMy..."
      }
    ],
    "categories": [
      { "id": "uuid", "name": "Minuman Panas", "description": "Kopi & teh seduh" }
    ],
    "products": [
      {
        "id": "uuid",
        "name": "Kopi Susu Gula Aren",
        "price": 22000,
        "image_url": "https://cdn.example.com/kopi.jpg",
        "category_id": "uuid"
      }
    ]
  }
}
```

**Error `401`** — token hilang / bukan bertipe `device`.
**Error `500`** — kegagalan query database.

> ⚠️ **`pin_hash` bcrypt dikirim ke perangkat.** Klien memvalidasi login kasir secara lokal dengan membandingkan PIN terhadap hash ini. Backend tidak memiliki endpoint login kasir.

> ⚠️ **Setiap array bisa bernilai `null`, bukan `[]`.** Service membangun slice dengan `append` ke variabel `nil`; jika outlet belum memiliki produk, JSON yang dihasilkan adalah `"products": null`. Frontend wajib menangani `null` (mis. `products ?? []`).

`[NEEDS DISCUSSION]` — **Payload ini TIDAK menyertakan resep (BOM) maupun bahan baku**, meskipun [README.md](../posgodinov-be/README.md) dan [CLIENTS.md](../posgodinov-be/CLIENTS.md) Tahap 2 menyatakan sebaliknya. Kode adalah sumber kebenaran: `POSMasterProduct` hanya memuat `id`, `name`, `price`, `image_url`, `category_id`, dengan komentar eksplisit bahwa data resep *"SENGAJA DIHAPUS dari payload klien"* ([pos_master_data.go:15-17](../posgodinov-be/internal/domain/pos_master_data.go#L15-L17)). Konsekuensinya: **aplikasi POS tidak dapat menampilkan ketersediaan stok maupun memperingatkan stok habis saat offline.** Pemotongan stok terjadi sepenuhnya di server ketika sinkronisasi. Dokumentasi backend perlu dikoreksi, atau payload perlu diperluas — keputusan ada di tim.

> Endpoint ini tidak memiliki mekanisme sinkronisasi inkremental (`updated_since`). Setiap pemanggilan mengirim seluruh master data. Untuk outlet dengan katalog besar, ini akan menjadi beban.

---

### 2.3 `POST /v1/pos/sync`

Mengirim seluruh aktivitas offline ke server (*Sync Up*). Bersifat **idempotent** — aman dikirim ulang.

**Auth:** `Authorization: Bearer <device_token>`

**Request Body**

```json
{
  "shifts": [
    {
      "id": "9f8e7d6c-1111-4222-8333-444455556666",
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "opening_balance": 200000,
      "closing_balance": 1450000,
      "expected_balance": 1450000,
      "discrepancy": 0,
      "status": "CLOSED",
      "client_opened_at": "2026-08-10T01:00:00Z",
      "client_closed_at": "2026-08-10T14:00:00Z"
    }
  ],
  "transactions": [
    {
      "id": "aaaa1111-2222-4333-8444-555566667777",
      "shift_id": "9f8e7d6c-1111-4222-8333-444455556666",
      "customer_name": "Andi",
      "total_amount": 44000,
      "payment_method": "CASH",
      "status": "COMPLETED",
      "cancel_notes": "",
      "client_created_at": "2026-08-10T03:22:11Z",
      "items": [
        {
          "id": "bbbb1111-2222-4333-8444-555566667777",
          "transaction_id": "aaaa1111-2222-4333-8444-555566667777",
          "product_id": "uuid-produk",
          "quantity": 2,
          "unit_price": 22000
        }
      ]
    }
  ],
  "wastes": [
    {
      "id": "cccc1111-2222-4333-8444-555566667777",
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "product_id": "uuid-produk",
      "quantity": 1,
      "reason": "Tumpah saat penyajian",
      "client_created_at": "2026-08-10T05:10:00Z"
    }
  ]
}
```

> ⚠️ **Nama field adalah `wastes`, bukan `product_wastes`.** [CLIENTS.md](../posgodinov-be/CLIENTS.md) menyebut `product_wastes` — itu **keliru**. Struct-nya adalah `Wastes []*ProductWaste \`json:"wastes"\`` ([pos_sync.go:8](../posgodinov-be/internal/domain/pos_sync.go#L8)). Menggunakan nama yang salah menyebabkan data waste diabaikan tanpa error apa pun.

**Aturan payload**

| Aturan | Detail |
|---|---|
| **UUID dibuat klien** | `id` pada shift, transaction, transaction item, dan waste **wajib** diisi klien (UUID v4). Server tidak membuatkan. Inilah dasar idempotensi. |
| **`business_id` / `outlet_id` diabaikan** | Bila dikirim, nilainya akan ditimpa paksa dari device token. Tidak perlu dikirim. |
| **Shift harus lebih dulu ada** | `transactions.shift_id` memiliki FK ke `shifts(id)`. Kirim shift pada payload yang sama (diproses lebih dulu) atau pada sinkronisasi sebelumnya. |
| **Urutan pemrosesan** | Shifts → Transactions → Wastes |
| **Status transaksi** | `COMPLETED` (memotong stok via BOM) atau `CANCELLED` |

**Response `200 OK`**

```json
{
  "status": "success",
  "message": "Proses sinkronisasi transaksi selesai",
  "data": {
    "shifts_synced": 1,
    "transactions_synced": 47,
    "wastes_synced": 3,
    "failed_transactions": ["aaaa1111-2222-4333-8444-555566667777"]
  }
}
```

**Penanganan partial success — inilah kontrak terpenting endpoint ini:**

- `failed_transactions` memuat `id` transaksi yang gagal. **Hanya transaksi yang dilacak per-ID.** Shift dan waste yang gagal dilewati secara diam-diam; jumlah `*_synced` yang lebih kecil dari jumlah yang dikirim adalah satu-satunya petunjuk.
- Frontend **wajib** menandai transaksi yang berhasil sebagai *synced* di database lokal, dan menahan yang gagal untuk dikirim ulang.
- Endpoint tetap mengembalikan `200` walau sebagian gagal. **Jangan memperlakukan `200` sebagai "semua berhasil".**

**Perilaku void / refund:** kirim transaksi dengan `id` yang sama dan `status: "CANCELLED"`. Bila server mendapati transaksi tersebut sudah tersimpan berstatus `COMPLETED`, server akan mengembalikan bahan baku ke inventori (*reverse deduction*) lalu memperbarui status.

**Error**
`400` — JSON tidak valid · `401` — token tidak valid · `500` — kegagalan tak terduga (perlakukan sebagai *retry*).

`[NEEDS DISCUSSION]` — Kegagalan shift dan waste tidak dilaporkan per-ID. Karena transaksi bergantung pada shift lewat foreign key, shift yang gagal secara diam-diam akan menyebabkan **seluruh transaksinya gagal** tanpa petunjuk jelas bagi klien. `SyncUpResponse` sebaiknya diperluas dengan `failed_shifts` dan `failed_wastes`.

---

### 2.4 `GET /v1/pos/transactions`

Mengambil riwayat transaksi dari server (untuk hari-hari sebelumnya atau shift lain).

**Auth:** `Authorization: Bearer <device_token>` · Cakupan: outlet dari token.

**Query Parameters:** ⚠️ **tidak ada yang berfungsi.**

**Response `200 OK`**

```json
{
  "status": "success",
  "message": "Riwayat transaksi berhasil didapatkan",
  "data": [
    {
      "id": "uuid",
      "shift_id": "uuid",
      "outlet_id": "A3K9P1",
      "business_id": "K7M2P9X4",
      "customer_name": "Andi",
      "total_amount": 44000,
      "payment_method": "CASH",
      "status": "COMPLETED",
      "cancel_notes": "",
      "client_created_at": "2026-08-10T03:22:11Z",
      "created_at": "2026-08-10T14:05:00Z",
      "items": [
        { "id": "uuid", "transaction_id": "uuid", "product_id": "uuid", "quantity": 2, "unit_price": 22000 }
      ]
    }
  ]
}
```

Diurutkan `created_at DESC`.

`[NEEDS DISCUSSION]` — **Paginasi tidak berfungsi.** Handler menetapkan `limit = 50`, `offset = 0` secara *hard-coded*; kode pembacaan query parameter masih dalam bentuk komentar ([pos_sync_handler.go:97-101](../posgodinov-be/internal/handler/pos_sync_handler.go#L97-L101)). Service sebenarnya sudah siap menerima paginasi (default 50, maksimum 100). **Endpoint ini hanya akan mengembalikan 50 transaksi terbaru — selamanya.** Tidak ada filter tanggal maupun filter kasir, walaupun CLIENTS.md menjanjikannya. Perbaikan backend kecil (±6 baris) akan membuka `?limit=` dan `?offset=`.

---

## 3. Modul: Outlet Management

### 3.1 `POST /v1/business/outlets`

**Auth:** access token

**Request Body**

```json
{ "name": "Cabang Kemang", "address": "Jl. Kemang Raya No. 12, Jakarta Selatan" }
```

`name` wajib dan tidak boleh kosong; `address` opsional.

**Response `201 Created`**

```json
{
  "status": "success",
  "message": "Outlet berhasil didaftarkan",
  "data": {
    "id": "A3K9P1",
    "business_id": "K7M2P9X4",
    "serial_tenant": "KOPBU100826001",
    "name": "Cabang Kemang",
    "address": "Jl. Kemang Raya No. 12, Jakarta Selatan",
    "created_at": "2026-08-10T09:20:00Z"
  }
}
```

> `serial_tenant` dibuat otomatis (`serial_business` + nomor urut 3 digit) di dalam transaksi ber-*lock*, sehingga aman dari race condition. Tampilkan nilai ini di UI — teknisi membutuhkannya untuk *device binding*.

**Error:** `400` (nama kosong / bisnis tidak ditemukan) · `401`.

---

### 3.2 `GET /v1/business/outlets`

Mengambil seluruh outlet milik bisnis pada token. Tidak ada parameter, tidak ada paginasi.

**Response `200 OK`**

```json
{
  "status": "success",
  "message": "Berhasil mengambil daftar outlet",
  "data": [ { "id": "A3K9P1", "business_id": "K7M2P9X4", "serial_tenant": "KOPBU100826001",
              "name": "Cabang Kemang", "address": "...", "created_at": "..." } ]
}
```

Diurutkan `created_at ASC`. **Error:** `401` · `500`.

> Endpoint inilah yang menjadi sumber data untuk **outlet switcher** di Dashboard Admin.

`[NEEDS DISCUSSION]` — Tidak ada endpoint `PUT` maupun `DELETE` untuk outlet. Nama dan alamat outlet tidak dapat diubah setelah dibuat.

---

## 4. Modul: Staff Management

### 4.1 `POST /v1/business/staff`

⚠️ `outlet_id` dikirim **di dalam body**, bukan di path.

**Request Body**

```json
{
  "outlet_id": "A3K9P1",
  "staff_identifier": "kasir01",
  "email": "siti@kopisenja.id",
  "name": "Siti Aminah",
  "pin": "1234"
}
```

| Field | Wajib | Validasi |
|---|---|---|
| `outlet_id` | ya | Harus milik bisnis pada token |
| `staff_identifier` | ya | Unik per outlet |
| `name` | ya | — |
| `pin` | ya | **Panjang 4-6 karakter.** Di-hash bcrypt |
| `email` | tidak | Nullable |

**Response `201 Created`**

```json
{
  "status": "success",
  "message": "Staff berhasil didaftarkan",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "outlet_id": "A3K9P1",
    "staff_identifier": "kasir01",
    "email": "siti@kopisenja.id",
    "name": "Siti Aminah",
    "role": "CASHIER",
    "is_active": true,
    "created_at": "2026-08-10T09:25:00Z"
  }
}
```

`pin_hash` tidak pernah dikembalikan pada endpoint ini (`json:"-"`) — berbeda dengan endpoint master-data POS.

**Error `400`:** `"data pendaftaran tidak lengkap"` · `"PIN harus terdiri dari 4 sampai 6 karakter"` · `"outlet tidak ditemukan"` · `"akses ditolak: outlet ini bukan milik bisnis Anda"` · `"ID/Username staff sudah digunakan di outlet ini"`.

> `role` selalu bernilai `"CASHIER"` — tidak dapat ditentukan saat pembuatan.
> PIN hanya divalidasi panjangnya, tidak divalidasi harus berupa angka. `"abcd"` akan diterima.

---

### 4.2 `GET /v1/business/staff`

Seluruh staff di **semua outlet** milik bisnis. Berguna untuk halaman manajemen staff terpusat. Diurutkan `created_at DESC`.

**Response `200 OK`** — array objek staff seperti di atas, dengan `message: "Daftar semua staff bisnis berhasil didapatkan"`.

---

### 4.3 `GET /v1/business/outlets/{outlet_id}/staff`

Staff pada satu outlet saja. Memverifikasi kepemilikan outlet.

**Error `400`:** `"outlet tidak ditemukan"` · `"akses ditolak: outlet ini bukan milik bisnis Anda"`.

---

### 4.4 `PUT /v1/business/staff/{staff_id}`

Update parsial — field kosong akan diabaikan.

**Request Body**

```json
{ "staff_identifier": "kasir01b", "email": "siti.baru@kopisenja.id",
  "name": "Siti Aminah Rahayu", "is_active": false }
```

| Field | Perilaku |
|---|---|
| `staff_identifier` | Diperbarui hanya jika tidak kosong dan berbeda; keunikan per-outlet diperiksa ulang |
| `name` | Diperbarui hanya jika tidak kosong |
| `email` | `*string` — kirim `null` untuk mengosongkan, hilangkan field untuk membiarkan |
| `is_active` | `*bool` — hilangkan field untuk membiarkan |

> **PIN tidak dapat diubah melalui endpoint ini.** `UpdateStaffRequest` tidak memiliki field PIN. Tidak ada endpoint reset PIN sama sekali. `[NEEDS DISCUSSION]` — kasir yang lupa PIN harus dihapus lalu dibuat ulang.

**Response `200 OK`** dengan objek staff yang telah diperbarui.

---

### 4.5 `DELETE /v1/business/staff/{staff_id}`

**Soft delete** — mengatur `is_deleted = true`.

**Response `200 OK`** — ⚠️ tanpa field `data`:

```json
{ "status": "success", "message": "Staff berhasil dihapus" }
```

> Staff yang dihapus tetap memiliki foreign key dari `shifts` dan `product_wastes`, sehingga riwayat historis tetap utuh.

---

## 5. Modul: Product Categories

### 5.1 `POST /v1/business/outlets/{outlet_id}/categories`

```json
{ "name": "Minuman Panas", "description": "Kopi & teh seduh" }
```

`name` wajib; `description` opsional. **Response `201`** dengan objek kategori.

### 5.2 `POST /v1/business/outlets/{outlet_id}/categories/bulk`

⚠️ Body adalah **array JSON telanjang**, bukan objek berpembungkus:

```json
[
  { "name": "Minuman Panas", "description": "Kopi & teh seduh" },
  { "name": "Minuman Dingin", "description": "Es kopi & smoothie" },
  { "name": "Makanan Ringan", "description": "" }
]
```

**Response `201`** dengan array kategori. Bersifat *all-or-nothing*: satu nama kosong akan menggagalkan seluruh batch.

### 5.3 `GET /v1/business/outlets/{outlet_id}/categories`

**Response `200`** — array kategori, diurutkan `name ASC`, hanya yang `is_deleted = false`.

`[NEEDS DISCUSSION]` — **Tidak ada endpoint `PUT` maupun `DELETE` untuk kategori** — satu-satunya modul CRUD yang tidak lengkap. Kolom `is_deleted` ada di tabel tetapi tidak ada cara mengaktifkannya. Nama kategori yang salah ketik bersifat permanen. UI sebaiknya menyembunyikan tombol edit/hapus kategori sampai backend menyediakannya.

---

## 6. Modul: Products & BOM

### 6.1 `POST /v1/business/outlets/{outlet_id}/products`

**Request Body**

```json
{
  "name": "Kopi Susu Gula Aren",
  "price": 22000,
  "image_url": "https://cdn.example.com/kopi-susu.jpg",
  "category_id": "uuid-kategori",
  "recipes": [
    { "raw_material_id": "uuid-kopi",      "quantity": 18 },
    { "raw_material_id": "uuid-susu",      "quantity": 150 },
    { "raw_material_id": "uuid-gula-aren", "quantity": 20 }
  ]
}
```

| Field | Wajib | Validasi |
|---|---|---|
| `name` | ya | Tidak boleh kosong |
| `price` | ya | Harus ≥ 0 |
| `image_url` | tidak | URL saja — **tidak ada endpoint upload file** |
| `category_id` | tidak | Nullable; tidak divalidasi kepemilikannya terhadap outlet |
| `recipes` | tidak | Boleh kosong (produk tanpa BOM). `quantity` harus > 0, dalam **base unit** bahan baku, dan tidak boleh ada bahan baku ganda |

**Response `201 Created`**

```json
{
  "status": "success",
  "message": "Produk berhasil ditambahkan",
  "data": {
    "id": "uuid-produk",
    "outlet_id": "A3K9P1",
    "name": "Kopi Susu Gula Aren",
    "price": 22000,
    "image_url": "https://cdn.example.com/kopi-susu.jpg",
    "category_id": "uuid-kategori",
    "created_at": "...", "updated_at": "...",
    "recipes": [
      { "id": "uuid", "product_id": "uuid-produk", "raw_material_id": "uuid-kopi",
        "quantity": 18, "created_at": "..." }
    ]
  }
}
```

**Error `400`:** `"nama dan harga produk tidak valid"` · `"kuantitas resep harus lebih dari 0"` · `"terdapat bahan baku ganda di dalam resep"` · `"bahan baku tidak ditemukan atau tidak valid untuk outlet ini"` · `"akses ditolak: outlet ini bukan milik bisnis Anda"`.

> Produk dan resepnya disimpan dalam satu transaksi database — resep yang tidak valid akan membatalkan pembuatan produk.

### 6.2 `POST /v1/business/outlets/{outlet_id}/products/bulk`

Body berupa array `CreateProductRequest`. Seluruh bahan baku diambil sekali di muka (menghindari N+1). Bersifat *all-or-nothing*. **Response `201`** dengan array produk.

### 6.3 `GET /v1/business/outlets/{outlet_id}/products`

**Response `200`** — array produk dengan `recipes` dan `category` ter-*preload*:

```json
{
  "status": "success",
  "message": "Berhasil mengambil data produk",
  "data": [
    {
      "id": "uuid", "outlet_id": "A3K9P1", "name": "Kopi Susu Gula Aren",
      "price": 22000, "image_url": "...", "category_id": "uuid",
      "recipes": [
        { "id": "uuid", "raw_material_id": "uuid-kopi", "quantity": 18,
          "raw_material": { "id": "uuid-kopi", "name": "Biji Kopi Arabika", "unit": "gram",
                            "stock": 4500, "cost_per_unit": 180 } }
      ],
      "category": { "id": "uuid", "name": "Minuman Panas", "description": "..." }
    }
  ]
}
```

> Berbeda dengan endpoint master-data POS, **endpoint Admin ini menyertakan BOM lengkap beserta detail bahan baku** — inilah sumber data untuk kalkulator HPP di Dashboard.

### 6.4 `PUT /v1/business/outlets/{outlet_id}/products/{product_id}`

> ⚠️ `{outlet_id}` ada di path tetapi **diabaikan** — service melakukan otorisasi lewat `product_id` → `outlet_id` → `business_id`. Tetap kirim nilai yang benar agar konsisten.

Body sama dengan create. **Semantik update penting:**

| Field | Perilaku |
|---|---|
| `name` | Diperbarui hanya jika tidak kosong |
| `price` | Diperbarui jika ≥ 0 (**mengirim `0` akan menetapkan harga menjadi 0**) |
| `image_url` | Diperbarui hanya jika tidak kosong — **tidak dapat dikosongkan** |
| `category_id` | **Selalu ditimpa**, termasuk dengan `null` |
| `recipes` | **Penggantian total.** Menghilangkan field ini akan **menghapus seluruh resep** |

> Frontend harus selalu mengirim array `recipes` yang lengkap saat update, bukan hanya bagian yang berubah.

### 6.5 `DELETE /v1/business/outlets/{outlet_id}/products/{product_id}`

Soft delete. **Response `200`** tanpa `data`. Baris `transaction_items` historis tetap merujuk ke produk ini.

---

## 7. Modul: Raw Materials (Inventory)

### 7.1 `POST /v1/business/outlets/{outlet_id}/raw-materials`

```json
{
  "name": "Susu UHT Full Cream",
  "unit": "ml",
  "package_unit": "kotak",
  "quantity_per_package": 1000,
  "stock": 12000,
  "cost_per_unit": 18.5
}
```

| Field | Wajib | Keterangan |
|---|---|---|
| `name` | ya | — |
| `unit` | ya | **Base unit** — semua stok dan resep memakai satuan ini |
| `package_unit` | tidak | Satuan kemasan untuk opname (`"kotak"`, `"kaleng"`, `"dus"`) |
| `quantity_per_package` | tidak | Isi per kemasan. **Wajib jika ingin opname dengan `package_unit`** |
| `stock` | tidak | Stok awal, dalam base unit. Default `0` |
| `cost_per_unit` | tidak | HPP awal per base unit. Default `0` |

**Response `201`** dengan objek bahan baku lengkap.

### 7.2 `POST /v1/business/outlets/{outlet_id}/raw-materials/bulk`

Body berupa array. Validasi: `name` dan `unit` tidak boleh kosong pada tiap item. *All-or-nothing*. **Response `201`**.

### 7.3 `GET /v1/business/outlets/{outlet_id}/raw-materials`

**Response `200`** — array, diurutkan `name ASC`, hanya `is_deleted = false`:

```json
{
  "status": "success",
  "message": "Berhasil mengambil data bahan baku",
  "data": [
    { "id": "uuid", "outlet_id": "A3K9P1", "name": "Susu UHT Full Cream",
      "unit": "ml", "package_unit": "kotak", "quantity_per_package": 1000,
      "stock": 11250, "cost_per_unit": 18.5,
      "created_at": "...", "updated_at": "..." }
  ]
}
```

> **`stock` bisa bernilai negatif** — konsekuensi yang disengaja dari sinkronisasi POS offline. UI harus menampilkannya (misalnya dengan penanda merah), bukan menyembunyikannya.

### 7.4 `PUT /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}`

```json
{ "name": "Susu UHT Full Cream 1L", "unit": "ml",
  "package_unit": "kotak", "quantity_per_package": 1000, "cost_per_unit": 19.0 }
```

> ⚠️ **`stock` sengaja tidak ada di payload update.** Stok hanya dapat berubah melalui restock, waste, opname, atau sinkronisasi POS. Ini desain yang tepat — jangan menyediakan field "edit stok" di UI; arahkan pengguna ke Stock Opname.

### 7.5 `DELETE /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}`

Soft delete. **Response `200`** tanpa `data`.

> Menghapus bahan baku **tidak** menghapus baris `product_recipes` yang merujuknya. Resep yatim akan tetap ada dan dilewati secara diam-diam saat pemotongan stok. `[NEEDS DISCUSSION]`

---

## 8. Modul: Restock (Pembelian Bahan Baku)

### 8.1 `POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/restock`

```json
{ "quantity": 12000, "cost_per_unit": 19.0, "supplier_name": "PT Sumber Segar" }
```

`quantity` harus > 0; `cost_per_unit` harus ≥ 0; `supplier_name` opsional.

**Response `201 Created`**

```json
{
  "status": "success",
  "message": "Restock berhasil dicatat",
  "data": {
    "id": "uuid", "outlet_id": "A3K9P1", "raw_material_id": "uuid",
    "quantity": 12000, "cost_per_unit": 19.0, "total_cost": 228000,
    "supplier_name": "PT Sumber Segar", "recorded_by": "K7M2P9X4",
    "created_at": "2026-08-10T10:00:00Z"
  }
}
```

**Efek samping:** menambah `raw_materials.stock` dan **menghitung ulang HPP dengan moving average**:

```text
cost_baru = (stock_lama × cost_lama + qty_masuk × cost_masuk) / (stock_lama + qty_masuk)
```

Berjalan di dalam transaksi ber-*lock*, aman dari race condition.

> `recorded_by` berisi **Business ID**, bukan Staff ID — endpoint ini hanya bisa diakses Business Owner.

### 8.2 `POST /v1/business/outlets/{outlet_id}/restock/bulk`

Body array; tiap item menyertakan `raw_material_id`:

```json
[
  { "raw_material_id": "uuid-susu", "quantity": 12000, "cost_per_unit": 19.0, "supplier_name": "PT Sumber Segar" },
  { "raw_material_id": "uuid-kopi", "quantity": 5000,  "cost_per_unit": 185.0, "supplier_name": "Koperasi Tani" }
]
```

Seluruh bahan baku di-*lock* sekaligus (`LockByIDs`). *All-or-nothing*. **Response `201`**.

### 8.3 `GET /v1/business/outlets/{outlet_id}/reports/restock`

Seluruh riwayat restock outlet. **Tidak ada filter tanggal dan tidak ada paginasi** — mengembalikan seluruh riwayat. **Response `200`** dengan array log restock.

---

## 9. Modul: Waste — Bahan Baku (sisi Admin)

> Berbeda dengan waste produk jadi yang dilaporkan kasir lewat `POST /v1/pos/sync`.

### 9.1 `POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/waste`

```json
{ "quantity": 500, "reason": "Susu kedaluwarsa" }
```

`quantity` harus > 0; `reason` **wajib** diisi.

**Response `201`** dengan objek waste log (`recorded_by` = Business ID).

**Error `400` khusus:**
```json
{ "status": "fail", "message": "stok bahan baku tidak mencukupi untuk dicatat sebagai waste" }
```

> ⚠️ **Waste sisi Admin MENOLAK bila stok tidak mencukupi**, sedangkan waste produk dari POS **membolehkan stok minus**. Perbedaan perilaku ini disengaja dan perlu tercermin di UI.

### 9.2 `POST /v1/business/outlets/{outlet_id}/waste/bulk`

```json
[ { "raw_material_id": "uuid-susu", "quantity": 500, "reason": "Kedaluwarsa" },
  { "raw_material_id": "uuid-kopi", "quantity": 100, "reason": "Tumpah" } ]
```

**Response `201`**.

### 9.3 `GET /v1/business/outlets/{outlet_id}/reports/waste`

Seluruh riwayat waste bahan baku. Tanpa filter, tanpa paginasi. **Response `200`**.

---

## 10. Modul: Stock Opname

### 10.1 `POST /v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/opnames`

```json
{ "input_type": "package_unit", "actual_stock": 11, "notes": "Hitung fisik akhir bulan" }
```

| Field | Wajib | Keterangan |
|---|---|---|
| `input_type` | tidak | `"base_unit"` (default) atau `"package_unit"` |
| `actual_stock` | ya | Hasil hitung fisik. Harus ≥ 0. Diinterpretasikan sesuai `input_type` |
| `notes` | tidak | — |

**Konversi satuan.** Bila `input_type = "package_unit"`, bahan baku **wajib** memiliki `quantity_per_package` yang valid; jika tidak, `400` — `"bahan baku ini tidak memiliki quantity_per_package yang valid"`. Perhitungan: `actual_stock_base = actual_stock × quantity_per_package`.

**Response `201 Created`**

```json
{
  "status": "success",
  "message": "Stock Opname berhasil dicatat",
  "data": {
    "id": "uuid", "outlet_id": "A3K9P1", "raw_material_id": "uuid",
    "system_stock": 12000, "actual_stock": 11000, "difference": -1000,
    "fraud_flag": true,
    "input_type": "package_unit",
    "system_package_quantity": 12, "actual_package_quantity": 11,
    "difference_value": -18500,
    "notes": "Hitung fisik akhir bulan",
    "recorded_by": "K7M2P9X4",
    "created_at": "2026-08-10T11:00:00Z"
  }
}
```

**Cara membaca field-nya:**

| Field | Arti |
|---|---|
| `difference` | `actual − system` dalam base unit. Negatif = kekurangan |
| `difference_value` | **Nilai selisih dalam Rupiah** = `difference × cost_per_unit`. Tampilkan sebagai kerugian |
| `fraud_flag` | `true` bila selisih > 5% dari stok sistem (atau stok sistem 0 tetapi selisih ≠ 0). Ambang 5% *hard-coded* |
| `system_package_quantity` | Stok sistem yang dikonversi ke satuan kemasan (hanya terisi pada mode `package_unit`) |

**Efek samping:** `raw_materials.stock` **ditimpa** dengan `actual_stock` (dalam base unit). Bersifat destruktif dan tidak dapat dibatalkan.

### 10.2 `POST /v1/business/outlets/{outlet_id}/opnames/bulk`

```json
[ { "raw_material_id": "uuid-susu", "input_type": "package_unit", "actual_stock": 11, "notes": "" },
  { "raw_material_id": "uuid-kopi", "input_type": "base_unit",    "actual_stock": 4200, "notes": "" } ]
```

Ini adalah bentuk yang paling berguna — opname biasanya dilakukan untuk seluruh gudang sekaligus. **Response `201`**.

### 10.3 `GET /v1/business/outlets/{outlet_id}/reports/opnames`

Seluruh riwayat opname. Tanpa filter, tanpa paginasi. **Response `200`**.

> Frontend dapat memfilter `fraud_flag === true` di sisi klien untuk menampilkan dasbor kecurigaan kecurangan.

---

## 11. Modul: Reports & Analytics

### 11.1 `GET /v1/business/outlets/{outlet_id}/reports/dashboard`

**Query Parameters**

| Parameter | Format | Wajib | Keterangan |
|---|---|---|---|
| `start_date` | `YYYY-MM-DD` | tidak | Batas bawah, inklusif |
| `end_date` | `YYYY-MM-DD` | tidak | Batas atas, inklusif |

Contoh: `GET /v1/business/outlets/A3K9P1/reports/dashboard?start_date=2026-08-01&end_date=2026-08-10`

**Response `200 OK`**

```json
{
  "status": "success",
  "message": "Berhasil memuat dashboard statistik",
  "data": {
    "stats": {
      "total_revenue": 15750000,
      "total_transactions": 412,
      "total_wastes": 23,
      "total_discrepancy": -45000
    },
    "top_products": [
      { "product_id": "uuid", "product_name": "Kopi Susu Gula Aren", "quantity_sold": 187 },
      { "product_id": "uuid", "product_name": "Americano",           "quantity_sold": 134 }
    ]
  }
}
```

**Cara menghitungnya:**

| Field | Sumber |
|---|---|
| `total_revenue` | `SUM(total_amount)` dari `transactions` berstatus `COMPLETED` |
| `total_transactions` | `COUNT` transaksi `COMPLETED` |
| `total_wastes` | `SUM(quantity)` dari `product_wastes` — **jumlah item produk, bukan nilai Rupiah, dan tidak mencakup waste bahan baku** |
| `total_discrepancy` | `SUM(discrepancy)` dari `shifts` berstatus `CLOSED` — selisih kas laci |
| `top_products` | **Top 5** berdasarkan kuantitas terjual (limit *hard-coded*) |

**Error:** `401` · `500`.

**Catatan penting:**

- Menghilangkan filter tanggal berarti **seluruh data sejak awal**.
- `top_products` selalu berjumlah maksimal 5 dan tidak dapat dikonfigurasi.
- Outlet milik tenant lain menghasilkan **statistik nol**, bukan `403` — query selalu menyertakan `WHERE business_id = ?`.

`[NEEDS DISCUSSION]` — **Laporan memfilter berdasarkan `created_at` (waktu tiba di server), bukan `client_created_at` (waktu transaksi sesungguhnya)** ([report_repository.go:26-31](../posgodinov-be/internal/repository/report_repository.go#L26-L31)). Pada sistem offline-first, ini adalah perbedaan yang berdampak nyata: penjualan hari Senin yang baru tersinkronisasi hari Rabu akan **tercatat sebagai pendapatan hari Rabu**. Laporan harian menjadi tidak akurat setiap kali sinkronisasi tertunda. Kolom `client_created_at` sudah tersedia di tabel dan berisi waktu yang benar — memindahkan filter ke kolom tersebut adalah perbaikan satu baris, dan sebaiknya diprioritaskan sebelum peluncuran.

`[NEEDS DISCUSSION]` — Tidak ada endpoint agregasi harian/bulanan (mis. deret waktu pendapatan per hari). Untuk membuat grafik tren, frontend harus memanggil `/reports/transactions` dan mengagregasi sendiri di klien — tidak akan berskala baik. Endpoint `/reports/summary?group_by=day` sebaiknya dipertimbangkan.

---

### 11.2 `GET /v1/business/outlets/{outlet_id}/reports/transactions`

Riwayat transaksi lengkap beserta item, untuk Dashboard Admin.

**Query Parameters:** `start_date`, `end_date` (sama seperti dashboard).

**Response `200 OK`**

```json
{
  "status": "success",
  "message": "Berhasil memuat detail transaksi",
  "data": [
    {
      "id": "uuid", "shift_id": "uuid", "outlet_id": "A3K9P1", "business_id": "K7M2P9X4",
      "customer_name": "Andi", "total_amount": 44000,
      "payment_method": "CASH", "status": "COMPLETED", "cancel_notes": "",
      "client_created_at": "2026-08-10T03:22:11Z",
      "created_at": "2026-08-10T14:05:00Z",
      "items": [ { "id": "uuid", "transaction_id": "uuid", "product_id": "uuid",
                   "quantity": 2, "unit_price": 22000 } ]
    }
  ]
}
```

Diurutkan `created_at DESC`. Mencakup transaksi `COMPLETED` **dan** `CANCELLED`.

`[NEEDS DISCUSSION]` — **Tidak ada paginasi.** Endpoint ini mengembalikan setiap transaksi dalam rentang tanggal, lengkap dengan seluruh item-nya. Outlet sibuk dengan rentang satu bulan dapat menghasilkan payload puluhan megabita. Frontend **harus** selalu mengirim `start_date` dan `end_date` yang sempit (maksimal 7 hari disarankan) sampai backend menyediakan paginasi.

> **Item transaksi tidak menyertakan nama produk** — hanya `product_id`. Frontend perlu menggabungkannya sendiri dengan data dari `GET .../products`.

---

## 12. Sistem

### 12.1 `GET /health`

**Auth:** tidak perlu. **Response `200 OK`**, `Content-Type: text/plain`, body: `OK`.

> Health check ini **tidak** memverifikasi koneksi database — hanya memastikan proses HTTP hidup. Kurang memadai sebagai *readiness probe*. `[NEEDS DISCUSSION]`

---

## 13. Tabel Ringkasan Seluruh Endpoint

| # | Method | Path | Auth | Modul | Sukses |
|---|---|---|---|---|---|
| 1 | POST | `/v1/auth/business/register` | — | Auth | `201` |
| 2 | POST | `/v1/auth/business/login` | — | Auth | `200` |
| 3 | POST | `/v1/auth/business/refresh` | — | Auth | `200` |
| 4 | POST | `/v1/auth/device/bind` | — | POS Auth | `200` |
| 5 | GET | `/v1/pos/sync/master-data` | device | POS Sync | `200` |
| 6 | POST | `/v1/pos/sync` | device | POS Sync | `200` |
| 7 | GET | `/v1/pos/transactions` | device | POS Sync | `200` |
| 8 | POST | `/v1/business/outlets` | access | Outlet | `201` |
| 9 | GET | `/v1/business/outlets` | access | Outlet | `200` |
| 10 | POST | `/v1/business/staff` | access | Staff | `201` |
| 11 | GET | `/v1/business/staff` | access | Staff | `200` |
| 12 | GET | `/v1/business/outlets/{outlet_id}/staff` | access | Staff | `200` |
| 13 | PUT | `/v1/business/staff/{staff_id}` | access | Staff | `200` |
| 14 | DELETE | `/v1/business/staff/{staff_id}` | access | Staff | `200` |
| 15 | POST | `/v1/business/outlets/{outlet_id}/categories` | access | Kategori | `201` |
| 16 | POST | `/v1/business/outlets/{outlet_id}/categories/bulk` | access | Kategori | `201` |
| 17 | GET | `/v1/business/outlets/{outlet_id}/categories` | access | Kategori | `200` |
| 18 | POST | `/v1/business/outlets/{outlet_id}/products` | access | Produk | `201` |
| 19 | POST | `/v1/business/outlets/{outlet_id}/products/bulk` | access | Produk | `201` |
| 20 | GET | `/v1/business/outlets/{outlet_id}/products` | access | Produk | `200` |
| 21 | PUT | `/v1/business/outlets/{outlet_id}/products/{product_id}` | access | Produk | `200` |
| 22 | DELETE | `/v1/business/outlets/{outlet_id}/products/{product_id}` | access | Produk | `200` |
| 23 | POST | `/v1/business/outlets/{outlet_id}/raw-materials` | access | Inventori | `201` |
| 24 | POST | `/v1/business/outlets/{outlet_id}/raw-materials/bulk` | access | Inventori | `201` |
| 25 | GET | `/v1/business/outlets/{outlet_id}/raw-materials` | access | Inventori | `200` |
| 26 | PUT | `/v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}` | access | Inventori | `200` |
| 27 | DELETE | `/v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}` | access | Inventori | `200` |
| 28 | POST | `/v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/restock` | access | Restock | `201` |
| 29 | POST | `/v1/business/outlets/{outlet_id}/restock/bulk` | access | Restock | `201` |
| 30 | GET | `/v1/business/outlets/{outlet_id}/reports/restock` | access | Restock | `200` |
| 31 | POST | `/v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/waste` | access | Waste | `201` |
| 32 | POST | `/v1/business/outlets/{outlet_id}/waste/bulk` | access | Waste | `201` |
| 33 | GET | `/v1/business/outlets/{outlet_id}/reports/waste` | access | Waste | `200` |
| 34 | POST | `/v1/business/outlets/{outlet_id}/raw-materials/{raw_material_id}/opnames` | access | Opname | `201` |
| 35 | POST | `/v1/business/outlets/{outlet_id}/opnames/bulk` | access | Opname | `201` |
| 36 | GET | `/v1/business/outlets/{outlet_id}/reports/opnames` | access | Opname | `200` |
| 37 | GET | `/v1/business/outlets/{outlet_id}/reports/dashboard` | access | Laporan | `200` |
| 38 | GET | `/v1/business/outlets/{outlet_id}/reports/transactions` | access | Laporan | `200` |
| 39 | GET | `/health` | — | Sistem | `200` |

---

## 14. Modul yang TIDAK Ada di Backend

Modul-modul berikut disebut dalam permintaan dokumentasi, namun **tidak ditemukan di dalam kode**. Frontend tidak boleh mengasumsikan keberadaannya.

| Modul | Status | Catatan |
|---|---|---|
| **Payments / Payment Gateway** | ❌ Tidak ada | Tidak ada tabel `payments`, tidak ada integrasi Midtrans/Xendit/QRIS, tidak ada status pembayaran, tidak ada webhook. `transactions.payment_method` hanyalah `VARCHAR(50)` bebas yang dicatat oleh klien POS. Uang tidak pernah bergerak melalui backend ini. `[NEEDS DISCUSSION]` |
| **Upload file / gambar** | ❌ Tidak ada | `products.image_url` hanya menyimpan string. Frontend harus menyediakan hosting sendiri. |
| **Login kasir (server-side)** | ❌ Disengaja | Kasir memvalidasi PIN secara lokal terhadap `pin_hash` dari master data. |
| **Reset password / lupa password** | ❌ Tidak ada | Tidak ada alur pemulihan untuk Business Owner maupun PIN kasir. |
| **Manajemen customer** | ❌ Tidak ada | `transactions.customer_name` hanyalah teks bebas. Tidak ada tabel customer, tidak ada loyalitas. |
| **Diskon / promo / pajak** | ❌ Tidak ada | `total_amount` dihitung sepenuhnya oleh klien. Tidak ada field diskon, pajak, atau *service charge*. |
| **Cetak struk / template** | ❌ Tidak ada | Sepenuhnya tanggung jawab klien. |
| **Notifikasi (stok menipis, dll.)** | ❌ Tidak ada | Tidak ada push notification, email, maupun webhook. |
| **API pembacaan audit log** | ❌ Tidak ada | Tabel `audit_logs` terisi, tetapi tidak ada endpoint untuk membacanya. |
| **RBAC / hak akses berbasis peran** | ❌ Tidak ada | Kolom `role` ada tetapi tidak pernah dipakai untuk otorisasi. |
| **Pembatalan transaksi dari sisi Admin** | ❌ Tidak ada | Void hanya bisa dilakukan lewat sinkronisasi POS. Dashboard tidak dapat membatalkan transaksi. |
