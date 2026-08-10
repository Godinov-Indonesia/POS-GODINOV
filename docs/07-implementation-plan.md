# 07 — Implementation Plan (Frontend Web)

> **Lingkup:** `posgodinov-fe` saja — Admin Dashboard (SSR/RSC) + Web POS PWA (client SPA).
> Fondasi Flutter (`posgodinov-mobile`, F11 pada [05 §4](05-frontend-architecture-design.md)) **di luar lingkup dokumen ini**.
>
> **Sumber kebenaran:** [01](01-architecture-overview.md) · [02](02-database-schema.md) · [03](03-api-specifications.md) · [04](04-frontend-mobile-web-requirements.md) · [05](05-frontend-architecture-design.md) · [06](06-ui-ux-design-system.md)
>
> Dokumen ini adalah **rencana eksekusi**, bukan rancangan ulang. Setiap keputusan
> teknis sudah diambil di 05 dan 06; di sini hanya urutan, definisi selesai, dan
> status pengerjaan.

---

## 0. Aturan yang mengikat seluruh fase

Empat aturan berikut diperiksa ulang di akhir **setiap** fase. Pelanggaran satu
saja membatalkan definisi selesai fase tersebut.

| # | Aturan | Sumber | Cara verifikasi |
|---|---|---|---|
| 1 | Komponen hanya memakai token **Lapis 2** (`bg-accent`, `text-fg-muted`). `bg-[#2563EB]` dan `bg-godinov-blue-600` sama-sama dilarang | [06 §1.1](06-ui-ux-design-system.md) | `grep -rE "bg-\[#|godinov-" app features components` harus kosong |
| 2 | `lib/**`, `features/pos/**` bebas `next/*`; Admin tidak menyentuh `lib/db/*` maupun `dexie` | [05 §1.1.4](05-frontend-architecture-design.md) | `no-restricted-imports` di `eslint.config.mjs` |
| 3 | Uang = **integer sen** di seluruh state internal; ditampilkan lewat `formatIdr()` dengan `font-mono` + `tabular-nums` | [05 §1.8.1](05-frontend-architecture-design.md), [06 §2.4](06-ui-ux-design-system.md) | Tinjauan kode + `.tnum` pada setiap kolom nominal |
| 4 | Endpoint koleksi **selalu** lewat `requestList<T>()`, tidak pernah `request<T[]>()` | [05 §3.1](05-frontend-architecture-design.md) | Aturan `no-restricted-syntax` di ESLint |

**Gerbang mutu tiap fase:** `npx tsc --noEmit` bersih · `npx eslint .` bersih ·
`npx next build` sukses.

---

## Fase 1 — Theme & Core Infrastructure

**Tujuan:** seluruh lapisan yang tidak bergantung pada React siap dipakai, dan
tema terpasang. Tidak ada UI pada fase ini.

- [x] `app/globals.css` — Lapis 1 + Lapis 2 Godinov Palette, `@theme inline`, `.tnum`, `.pos-root`, `color-scheme: light` ([06 §1.4](06-ui-ux-design-system.md))
- [x] `lib/types/api.ts` — DTO transport seluruh modul backend ([03](03-api-specifications.md))
- [x] `lib/money/index.ts` — `toMinor`, `toMajor`, `formatIdr`
- [x] `lib/api/errors.ts` — `PosApiError` + `SessionExpiredError`
- [x] `lib/api/http.ts` — `request<T>()`, `requestList<T>()`, amplop/raw, `null → []`
- [x] `lib/auth/session-store.ts` — Zustand + persist terbelah (sessionStorage/localStorage)
- [x] `lib/db/models.ts` + `lib/db/dexie.ts` — DB `posgodinov` v1→v2, 9 tabel
- [x] `lib/constants/payment.ts` — `PAYMENT_METHODS` (kontrak beku, [05 §3.3](05-frontend-architecture-design.md))
- [x] `lib/constants/limits.ts` — `REPORT_MAX_RANGE_DAYS`, ukuran batch sync
- [x] `lib/time/index.ts` — `nowIso()`, `detectClockSkew()` ([05 §1.8.2](05-frontend-architecture-design.md))
- [x] `lib/uuid.ts` — `crypto.randomUUID()` + polyfill konteks non-secure
- [x] `lib/utils/cn.ts` — `clsx` + `tailwind-merge`
- [x] `eslint.config.mjs` — batas modul + larangan `request<T[]>()`
- [x] Dependensi terpasang: `zustand`, `dexie`, `dexie-react-hooks`, `zod`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `sonner`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `bcryptjs`, `recharts`, `@tanstack/react-table`

**Selesai bila:** `tsc --noEmit` bersih; utility `p-touch`/`text-pos-2xl`/`bg-accent` terbukti terbangkitkan di CSS hasil build.

---

## Fase 2 — Design System Primitives

**Tujuan:** kosakata visual bersama, supaya tidak ada fase berikutnya yang
mengarang tombol sendiri.

- [x] `components/ui/button.tsx` — varian `primary`/`secondary`/`danger`/`success`/`ghost`, ukuran `md`/`lg`/`xl` sesuai skala touch ([06 §4.1](06-ui-ux-design-system.md))
- [x] `components/ui/input.tsx`, `label.tsx`, `field.tsx` — tinggi minimum `touch`, border `border-strong`
- [x] `components/ui/card.tsx`, `badge.tsx`, `table.tsx`, `dialog.tsx`, `skeleton.tsx`, `empty-state.tsx`
- [x] `components/ui/money.tsx` — `<Money minor={…} />` satu-satunya cara merender nominal (`font-mono tnum`)
- [x] `components/ui/toaster.tsx` — `sonner`, dipakai untuk pesan error `400` apa adanya ([05 §3.2](05-frontend-architecture-design.md))
- [x] Badge status memakai **penanda kedua** (ikon + teks), bukan warna saja ([06 §1.5](06-ui-ux-design-system.md))

**Selesai bila:** tidak ada warna heksadesimal literal di `components/ui/`; seluruh nominal hanya lewat `<Money/>`.

---

## Fase 3 — Session Manager, API Client & Auth Pages (D-01, D-02)

- [x] `lib/auth/token-storage.ts` — pembacaan/penulisan `refresh_token`
- [x] `lib/auth/session-manager.ts` — 4 mekanisme: timer proaktif, cek pra-request, pemulihan `401`, `BroadcastChannel` lintas tab ([05 §1.4.3](05-frontend-architecture-design.md))
- [x] `lib/api/admin-client.ts` — `adminRequest()` dengan retry `401` sekali
- [x] `lib/api/pos-client.ts` — `posRequest()` terikat device token
- [x] `lib/api/endpoints/auth.ts`, `outlets.ts`
- [x] `lib/query/query-client.ts` + `lib/query/keys.ts` ([05 §1.2.2](05-frontend-architecture-design.md))
- [x] `lib/validation/auth.ts` — skema Zod login & register
- [x] `app/layout.tsx` — `RootProviders`, font Geist, `lang="id"`
- [x] `app/(public)/layout.tsx`, `login/page.tsx` (D-01), `register/page.tsx` (D-02)
- [x] Alur pasca-login: prefetch `['outlets']` → 0 outlet ke `/admin/outlets/new`, 1 outlet auto-pilih, >1 tampilkan pemilih ([05 §1.4.4](05-frontend-architecture-design.md))

**Selesai bila:** login berhasil → token tersimpan sesuai kebijakan §1.4.2; logout di satu tab menutup tab lain.

---

## Fase 4 — Admin Shell, Outlets & Staff (D-04 … D-08)

- [x] `app/(admin)/layout.tsx` — `AdminShell`: sidebar `bg-surface-inverse`, header, `OutletSwitcher`, penjaga hidrasi
- [x] `features/admin/outlets` — daftar (D-04), form tambah (D-05), provisioning (D-06 menampilkan `serial_business` + `serial_tenant`)
- [x] `useOutletSwitcher` — `removeQueries(outletScope(previous))`, bukan `invalidateQueries`
- [x] `features/admin/staff` — daftar (D-07), form tambah/ubah (D-08), hapus (soft delete)
- [x] UI menyembunyikan aksi yang endpoint-nya tidak ada: edit/hapus outlet, reset PIN ([05 §3.5](05-frontend-architecture-design.md))
- [x] `app/(admin)/admin/onboarding/page.tsx` — checklist urutan setup

**Selesai bila:** ganti outlet membersihkan seluruh scope; `serial_tenant` tampil di D-06.

---

## Fase 5 — Categories & Raw Materials (D-09, D-13, D-14)

- [x] `lib/api/endpoints/categories.ts`, `raw-materials.ts`
- [x] `features/admin/categories` — daftar + tambah satuan + tambah massal (array telanjang ke `/bulk`)
- [x] Tombol edit/hapus kategori **disembunyikan** — endpoint tidak ada ([03 §5.3](03-api-specifications.md))
- [x] `features/admin/inventory` — daftar bahan baku (D-13) dengan **stok minus tersorot** (`text-danger` + ikon, bukan warna saja)
- [x] Form bahan baku (D-14) — **tanpa** field `stock` pada mode ubah ([03 §7.4](03-api-specifications.md))

**Selesai bila:** stok negatif tampil apa adanya dan tersorot; tidak ada jalan mengubah stok lewat form.

---

## Fase 6 — Products, BOM Builder & HPP (D-10 … D-12)

- [x] `lib/api/endpoints/products.ts`
- [x] `features/admin/products/lib/hpp.ts` — akumulasi dulu, bulatkan sekali di akhir ([05 §1.8.1](05-frontend-architecture-design.md))
- [x] Daftar produk (D-10) — kategori, harga, jumlah resep
- [x] Form produk + `BomBuilder` (D-11) — tolak bahan baku ganda di klien; `PUT` **selalu** mengirim array `recipes` lengkap
- [x] `HppSummary` — HPP, margin, dan peringatan bila harga jual < HPP
- [x] Impor massal CSV (D-12) — pratinjau + validasi sebelum kirim

**Selesai bila:** update produk tanpa menyentuh BOM tetap mengirim BOM utuh; bahan baku ganda ditolak sebelum request.

---

## Fase 7 — Inventory Operations (D-15, D-17, D-19)

- [x] `lib/api/endpoints/restock.ts`, `waste.ts`, `opname.ts`
- [x] Form restock satuan & massal (D-15) — konversi kemasan → base unit
- [x] Form waste bahan baku (D-17)
- [x] Lembar hitung opname massal (D-19) — input boleh dalam `package_unit`, dikonversi `× quantity_per_package`

**Selesai bila:** seluruh form massal mengirim array telanjang; konversi satuan benar.

---

## Fase 8 — Reports & Dashboard (D-03, D-16, D-18, D-20, D-21)

- [x] `lib/api/endpoints/reports.ts`
- [x] `DateRangePicker` — batas keras 7 hari, preset "Hari Ini"/"7 Hari"/"Bulan Ini", **tanpa** "Semua waktu" ([05 §1.8.3](05-frontend-architecture-design.md))
- [x] **Banner wajib**: laporan difilter `created_at` (waktu tiba di server), bukan `client_created_at` ([05 §0.4](05-frontend-architecture-design.md))
- [x] Dashboard (D-03) — kartu statistik + 5 produk terlaris, `top_products ?? []`
- [x] Laporan transaksi (D-21), restock (D-16), waste (D-18), opname (D-20 dengan `fraud_flag` tersorot)

**Selesai bila:** rentang > 7 hari tidak dapat dikirim; banner tampil di setiap layar laporan.

---

## Fase 9 — POS Foundation: Dexie, Binding, Master Sync, PIN & Shift (P-01 … P-04)

- [x] `lib/db/repositories/*` — `master`, `shift`, `transaction`, `waste`, `held-cart`, `meta`
- [x] `lib/auth/device-session.ts` — `device_token` **hanya** di Dexie `meta`, tidak pernah `localStorage` ([04 §A.2](04-frontend-mobile-web-requirements.md))
- [x] `lib/sync/master-sync.ts` — `bulkPut` (bukan `clear()`), `toMinor(price)`, rekonsiliasi baris yatim
- [x] `workers/bcrypt.worker.ts` — verifikasi PIN di luar main thread (ADR-08)
- [x] `features/pos/PosApp.tsx` + `router/` — router internal berbasis Zustand + History API
- [x] `app/(pos)/layout.tsx`, `pos/page.tsx` (`force-static`), `pos/bind/page.tsx` (P-01), `pos/offline/page.tsx`
- [x] P-02 Sync master · P-03 Login kasir · P-04 Buka shift
- [x] PWA: `app/manifest.ts`, ikon, service worker

**Selesai bila:** setelah binding, aplikasi terbuka penuh dalam mode pesawat.

---

## Fase 10 — POS Register: Cart, Payment, Receipt, Hold (P-05 … P-08)

- [x] `features/pos/cart/cart-store.ts` + `cart-math.ts` — aritmetika **integer sen**, eksak
- [x] P-05 — grid produk + tab kategori + panel keranjang; **tanpa** indikator stok apa pun
- [x] P-06 — metode pembayaran hanya dari `PAYMENT_METHODS.map()`, numpad, Fast-Cash, kembalian
- [x] P-07 — struk; **transaksi ditulis ke Dexie sebelum perintah cetak** ([05 §1.6.5](05-frontend-architecture-design.md))
- [x] P-08 — pesanan ditahan, murni lokal, tidak pernah dikirim

**Selesai bila:** UUID dibuat sekali; kegagalan cetak tidak menghapus transaksi.

---

## Fase 11 — Sync Engine & Sisa Layar POS (P-09 … P-14)

- [x] `lib/sync/lock.ts` (Web Locks), `backoff.ts`, `wire.ts` (`stripLocal` + `toMajor`), `reconcile.ts`, `sync-engine.ts`, `sync-triggers.ts`
- [x] Aturan kritis: sertakan **shift induk** setiap transaksi dalam batch, walau sudah tersinkron ([05 §1.6.2](05-frontend-architecture-design.md))
- [x] Rekonsiliasi partial success: bila `shifts_synced` tidak cocok, **tidak satu pun** transaksi ditandai tersinkron
- [x] P-13 status sync · P-09 riwayat · P-10 void · P-11 waste produk · P-12 tutup shift · P-14 pengaturan
- [x] Peringatan clock skew dan hitungan antrean di `StatusBar`

**Selesai bila:** matriks uji [05 §4](05-frontend-architecture-design.md) untuk F7 terpenuhi secara logika kode.

---

## Fase 12 — Printer & Pengerasan Akhir

- [x] `lib/printer/` — `types.ts`, `escpos.ts`, `receipt-renderer.ts`, `registry.ts`
- [x] Adapter: Web Bluetooth, LAN ePOS, RawBT, Browser print (fallback universal)
- [x] Pintasan keyboard POS + overlay bantuan `F1` ([06 §5](06-ui-ux-design-system.md))
- [x] Dukungan pemindai barcode (deteksi ketikan cepat + Enter)
- [x] Audit akhir: token warna, batas impor, `tabular-nums`, kontras

**Selesai bila:** seluruh gerbang mutu hijau dan checklist [06 §7.2](06-ui-ux-design-system.md) terpenuhi.

---

## Catatan pelaksanaan

Seluruh 12 fase dieksekusi. Gerbang mutu akhir: `tsc --noEmit` bersih ·
`eslint .` bersih · `next build` sukses (31 route) · seluruh route menjawab
`200` pada `next start`.

### Penyimpangan sadar dari rancangan 05/06

| # | Butir | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Service worker ([05 §1.5.2]) | Ditulis tangan di `public/sw.js`, bukan hasil `workbox injectManifest` | Kompatibilitas `@serwist/next` / `injectManifest` terhadap Next 16 + Turbopack belum terverifikasi ([05 §0.5]). Strategi runtime (`cache-first` untuk `/_next/static`, `network-first` untuk dokumen `/pos`) tidak memerlukan manifest build, sehingga tidak dapat rusak diam-diam saat nama berkas hasil build berubah. Penyaringan `/admin/*` dan `/v1/*` tetap ditegakkan |
| 2 | Persistensi keranjang ([06 §5.1]) | `sessionStorage` lewat `zustand/persist`, bukan Dexie | Keranjang bersifat **per-tab** — dua tab POS tidak boleh berbagi keranjang. `sessionStorage` memberi batas itu secara bawaan dan menghindari migrasi skema Dexie untuk data yang belum menjadi transaksi. Sasaran spesifikasinya (bertahan melewati `F5`) tetap terpenuhi |
| 3 | Ikon PWA | Placeholder yang dibangkitkan (tiga balok biru di atas navy) | Tidak ada aset merek di repositori. Ukuran, format, dan `purpose: maskable` sudah benar; **ganti berkasnya sebelum rilis** |
| 4 | Warna chrome peramban | `lib/constants/brand.ts` memuat dua nilai heksadesimal | `theme_color` manifest dan `viewport.themeColor` dibaca OS sebelum CSS dievaluasi, sehingga tidak dapat merujuk `var(--brand)`. Satu-satunya pengecualian sah terhadap [06 §1.1], disentralisasi supaya rebranding tetap satu berkas |

### Belum dikerjakan — memerlukan keputusan atau perubahan backend

| # | Butir | Penghalang |
|---|---|---|
| 1 | **Pemetaan barcode → produk** ([06 §5.4.1]) | Deteksi pemindai (`useBarcodeScanner`) sudah ada, tetapi tabel pemetaan lokal `db.barcodes` **belum** dibuat. Tabel `products` tidak punya kolom `barcode`/`sku`, dan solusi lokal per-perangkat membawa konsekuensi operasional yang harus disetujui pemilik lebih dulu: pemetaan **tidak tersinkronisasi** antar-perangkat dan hilang bila data situs dibersihkan |
| 2 | **Grafik tren penjualan** pada D-03 ([06 §3.8]) | Tidak ada endpoint agregasi harian ([03 §11.1] `[NEEDS DISCUSSION]`). Membuatnya berarti menarik seluruh `/reports/transactions` lalu mengagregasi di klien — tepat jenis payload yang dilarang [05 §1.8.3]. `recharts` sudah terpasang; tinggal dipakai begitu endpoint `?group_by=day` tersedia |
| 3 | **Delta persentase** pada kartu statistik D-03 | Memerlukan pemanggilan kedua untuk periode sebelumnya. Dapat ditambahkan tanpa perubahan backend, tetapi menggandakan beban laporan yang sudah tanpa paginasi |
| 4 | **Sidebar ciut 72 px** & navigasi mobile Admin ([06 §3.8]) | Kosmetik; sidebar saat ini tersembunyi di bawah `lg`. Tidak memblokir alur mana pun |
| 5 | **Prefiks pengali kuantitas** `1`–`9` di P-05 ([06 §5.1]) | Berinteraksi dengan `useBarcodeScanner` yang juga menyimak digit cepat. Perlu dirancang bersama agar tidak saling merebut ketukan |
| 6 | **Uji kontrak `PAYMENT_METHODS` lintas platform** ([05 §3.3]) | Membaca `posgodinov-mobile/lib/core/config/constants.dart` yang belum ada. Belum ada test runner di proyek ini |
| 7 | **`@tanstack/react-table`** | Terpasang tetapi tidak dipakai — seluruh tabel Admin memakai `components/ui/table.tsx` yang lebih ringan. Hapus dari `package.json` bila tidak ada rencana sort/filter kompleks |

### Yang tidak diputuskan sepihak

Seluruh butir `[NEEDS DISCUSSION]` dari 01–06 tetap terbuka. Yang paling
mendesak dan berdampak langsung pada kode ini:

1. **Laporan difilter `created_at`, bukan `client_created_at`** ([03 §11.1]) —
   perbaikan satu baris di backend. Selama belum diperbaiki, setiap layar
   laporan menampilkan banner peringatan.
2. **Tidak ada endpoint unbind perangkat** ([03 §2.1]) — perangkat hilang
   mempertahankan akses sinkronisasi selamanya. Dinyatakan apa adanya di D-06
   dan P-01.
3. **`PAYMENT_METHODS` belum disepakati formal** ([05 §3.3]) — harus dikunci
   **sebelum** transaksi produksi pertama. Menambah nilai baru nanti masih
   mungkin; mengganti nama nilai lama tidak.
