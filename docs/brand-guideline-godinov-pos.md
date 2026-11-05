# Brand Guideline — Godinov POS

> **Status:** Draft v1 — disusun dari aset & dokumen yang sudah ada di codebase (`docs/06-ui-ux-design-system.md`, `posgodinov-lp`, `posgodinov-fe`) per 5 Nov 2026.
> **Tujuan:** jadi rujukan tunggal saat membuat logo, banner, konten sosial, dan materi marketing lain untuk **Godinov POS**, supaya hasilnya konsisten dengan produk (app POS & admin dashboard) yang sudah berjalan.

---

## 1. Arsitektur Brand

Godinov adalah **brand induk/grup**. Godinov POS adalah **sub-brand produk** di bawahnya (seperti "Google" → "Google Workspace").

```
GODINOV (induk)
└── Godinov POS — produk SaaS kasir (fokus dokumen ini)
```

**Aturan turunan:**
- Logo Godinov POS = elemen visual Godinov (warna/bentuk dasar logo induk) **+** penanda produk (ikon/tipografi "POS") supaya tetap terasa satu keluarga, tapi bisa dibedakan dari produk Godinov lain di masa depan.
- Warna korporat Godinov (ungu, dari logo existing) boleh dipakai sebagai **aksen sekunder/identitas** (misal watermark, splash, footer), tapi **bukan** warna utama UI produk.
- Warna utama produk Godinov POS mengikuti *design system* resmi app (Navy + Blue) — ini yang dilihat user setiap hari saat memakai POS, sehingga logo & materi marketing harus terasa "satu dunia" dengannya.

---

## 2. Palet Warna

### 2.1 Warna Korporat Godinov (dari logo existing)

| Peran | Hex | Catatan |
|---|---|---|
| Ungu Godinov | `#2A0573` | Warna signature logo induk. Dipakai terbatas: watermark, splash screen, elemen dekoratif kecil pada materi korporat |

### 2.2 Warna Produk Godinov POS (sumber kebenaran: `docs/06-ui-ux-design-system.md`)

Ini warna yang **wajib** jadi basis logo POS, banner produk, dan semua materi yang mengarah ke aplikasi:

**Primitif (Layer 1 — hex mentah)**

| Peran | Token | Hex | Pemakaian |
|---|---|---|---|
| **Primary / Brand** | `navy-950` | `#0F172A` | Teks utama, latar gelap, identitas |
| | `navy-900` | `#1E293B` | Permukaan gelap sekunder |
| | `navy-800` | `#334155` | Border di atas permukaan gelap |
| **Accent / Action** | `blue-600` | `#2563EB` | **Warna aksi utama** — CTA, tombol, link, highlight logo |
| | `blue-700` | `#1D4ED8` | Hover / state aktif |
| | `blue-50` | `#EFF6FF` | Latar terpilih, aksen lembut |
| | `cyan-600` | `#0284C7` | Aksen sekunder, ikon info |
| **Success** | `emerald-600` | `#059669` | Konfirmasi positif, "lunas" |
| **Warning** | `amber-600` | `#D97706` | Peringatan |
| **Danger** | `red-600` | `#DC2626` | Error, void, hapus |
| **Neutral / Background** | `slate-50` | `#F8FAFC` | Kanvas (BUKAN putih murni) |
| | `slate-100` | `#F1F5F9` | Panel sekunder |
| | `slate-200` | `#E2E8F0` | Border standar |
| | `slate-500` | `#64748B` | Teks tersier |
| | `slate-600` | `#475569` | Teks sekunder |
| **Surface** | `white` | `#FFFFFF` | Kartu, modal — **bukan kanvas penuh** |

**Kombinasi logo/banner yang disarankan:**
- Latar gelap: `navy-950` + aksen `blue-600`
- Latar terang: `slate-50`/`white` + teks `navy-950` + aksen `blue-600`
- Highlight/CTA: selalu `blue-600` → hover `blue-700`

### 2.3 Larangan warna
- ❌ Warna mentah jenuh di luar palet ini (contoh: merah/hijau/kuning generik Tailwind seperti `red-500`, `green-400`)
- ❌ Hitam murni (`#000000`) / putih murni (`#FFFFFF`) sebagai kanvas penuh satu layar
- ❌ Gradient neon atau warna psikadelik — bertentangan dengan mood "Enterprise SaaS / Professional Retail" yang jadi arah resmi produk

> **Catatan migrasi:** `posgodinov-lp` (landing page) saat ini masih pakai tema gelap + neon teal (`#00FFD1`). Ini **akan di-revamp** mengikuti palet di atas agar selaras dengan app. Jangan jadikan tema LP lama sebagai acuan warna untuk aset baru.

---

## 3. Tipografi

| Elemen | Font | Keterangan |
|---|---|---|
| Teks umum / UI | **Geist Sans** | Sudah dipakai konsisten di semua sub-project (fe, lp, landlord) |
| Angka / nominal / kode | **Geist Mono** | Wajib untuk nominal uang — tabular, tidak goyang |

**Aturan nominal uang** (berlaku juga untuk materi marketing yang menampilkan harga):
- Minimal 16px
- Tidak pernah abu-abu muda
- Tidak pernah dipotong elipsis
- Selalu `font-variant-numeric: tabular-nums`

**Untuk logo & banner (headline besar):** Geist Sans weight 600–700 (semibold/bold). Hindari font dekoratif/script — produk ini B2B, bukan lifestyle brand.

---

## 4. Logo

- **Logo Godinov (induk)** sudah ada: `posgodinov-lp/public/images/logo.png`, `logo-transparent.webp`, `logo-transparent-dark.webp`. Warna signature: ungu `#2A0573`.
- **Logo Godinov POS (produk)** — *belum ada, akan dibuat*. Arahan:
  - Basis dari logo Godinov induk (bentuk/karakter visual tetap terasa satu keluarga)
  - Palet mengikuti §2.2 (Navy `#0F172A` + Blue `#2563EB`), bukan ungu korporat
  - Tambahkan penanda "POS" — bisa lewat wordmark tambahan ("Godinov **POS**") atau ikon kecil yang menyiratkan kasir/transaksi (tanpa jadi klise ikon kasir generik)
  - Harus tetap legible dalam versi monokrom (hitam/putih) untuk kebutuhan stempel, invoice, favicon kecil

**Varian yang dibutuhkan:**
1. Logo warna penuh (latar terang)
2. Logo warna penuh (latar gelap/navy)
3. Logo monokrom (hitam) — dokumen, invoice
4. Logo monokrom (putih) — overlay di atas foto/banner gelap
5. Icon-only / favicon (persegi, untuk app icon, social profile picture)

---

## 5. Tone of Voice

- **Bahasa:** Indonesia, langsung, tidak bertele-tele
- **Nada:** tegas, problem-solving, berbicara langsung ke rasa sakit pemilik usaha (bukan teknis/jargon)
- **Fokus pesan utama** (sudah terbukti dipakai di LP existing):
  - Anti-kebocoran kas
  - Tetap jalan tanpa internet (offline-first)
  - Multi-outlet, dipantau dari HP
  - Audit trail / riwayat tidak bisa dihapus
- **Contoh headline existing yang bisa jadi acuan gaya:**
  - *"Satu Aplikasi Kasir. Nol Titik Kebocoran."*
  - *"Jalan Penuh Tanpa Internet"*
  - *"Bergerak Menuju Hasil Profesional · Sistem Pengamanan Kas & Operasional"* (tagline resmi)

---

## 6. Gaya Visual yang DILARANG

Berlaku untuk UI produk **dan** materi marketing (logo, banner, social post), supaya satu bahasa visual:

| Dilarang | Kenapa | Ganti dengan |
|---|---|---|
| Neo-brutalism (border hitam tebal, shadow offset keras) | Bertentangan dengan mood "Enterprise SaaS" | Border halus 1px `slate-200`, shadow lembut berlapis |
| Warna neon/psikadelik jenuh | Tidak match palet resmi | Palet §2.2 |
| Sudut nol (`rounded-none`) pada elemen interaktif | Terkesan kaku/dingin | Radius 8–14px |
| Rotasi/skew dekoratif | Tidak profesional untuk B2B tool | Layout lurus, grid rapi |
| Font eksentrik/display tebal ekstrem pada nominal | Mengganggu keterbacaan uang | Geist Mono semibold |
| Hitam murni untuk teks | Terlalu keras kontrasnya | `navy-950` (#0F172A) |

---

## 7. Identitas & Kontak Resmi

| Item | Nilai |
|---|---|
| Nama produk | Godinov POS |
| Domain produk | posgodinov.com |
| App URL | dashboard-pos.godinov.id |
| WhatsApp CS | +62 882-9479-9116 |
| Email | contact@pos.godinov.id |
| Instagram | instagram.com/godinov.id |
| LinkedIn | linkedin.com/company/godinov-indonesia |
| TikTok | tiktok.com/@godinovid |
| Lokasi | Tangerang, Banten, Indonesia |

---

## 8. Checklist sebelum aset dianggap "sesuai brand"

- [ ] Warna utama diambil dari §2.2 (Navy + Blue), ungu korporat (§2.1) hanya aksen minor
- [ ] Tidak ada warna neon/psikadelik di luar palet
- [ ] Kanvas besar tidak putih/hitam murni
- [ ] Font Geist Sans (teks) / Geist Mono (angka)
- [ ] Logo tetap legible saat di-scale kecil (favicon 32x32)
- [ ] Ada versi logo monokrom (hitam & putih)
- [ ] Copy/tagline berbahasa Indonesia, nada tegas & problem-solving
- [ ] Tidak ada border tebal hitam / shadow offset brutal / rotasi dekoratif

---

## 9. Referensi sumber

- `docs/06-ui-ux-design-system.md` §0–1 — sumber kebenaran palet & gaya produk
- `posgodinov-lp/lib/content/brand.ts` — identitas & kontak
- `posgodinov-lp/public/images/logo*.{png,webp}` — logo induk existing
- `posgodinov-fe/lib/constants/brand.ts` — alasan desain theme color app
