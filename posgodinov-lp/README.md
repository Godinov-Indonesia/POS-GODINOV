# Godinov POS - Official Landing Page (`posgodinov-lp`)

Landing page resmi berkinerja tinggi untuk **Godinov POS** — solusi Point of Sale (POS) modern multi-outlet dengan ketahanan offline dan perlindungan anti-kebocoran kas.

Dibangun dengan arsitektur modern berbasis **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, serta optimasi animasi Lottie yang sangat ringan, terisolasi, dan bebas render cascading.

---

## 📑 Daftar Isi

- [Tech Stack & Arsitektur](#-tech-stack--arsitektur)
- [Prinsip Desain & Rekayasa](#-prinsip-desain--rekayasa)
- [Struktur Direktori](#-struktur-direktori)
- [Fitur & Bagian Landing Page](#-fitur--bagian-landing-page)
- [Manajemen Konten (SSOT)](#-manajemen-konten-ssot)
- [Optimasi Performa & Aset](#-optimasi-performa--aset)
- [Panduan Pengembangan (Getting Started)](#-panduan-pengembangan-getting-started)
- [Skrip NPM](#-skrip-npm)
- [Kebijakan Kontribusi & Koding](#-kebijakan-kontribusi--koding)

---

## ⚡ Tech Stack & Arsitektur

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16.3.0](https://nextjs.org/) | App Router, Turbopack, Prerendering Statis (SSG) |
| **Library UI** | [React 19.2.8](https://react.dev/) | Hydration-safe external store, zero-flicker state |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | PostCSS, Variable Font integration, dark theme bawaan |
| **Ikonografi** | [Lucide React](https://lucide.dev/) | Tree-shakable micro SVG icons |
| **Animasi** | [lottie-react](https://github.com/Gamote/lottie-react) | Animasi mikro Lordicon berbasis JSON ringan (< 150KB) |
| **Font** | Geist & Geist Mono | Self-hosted via `next/font/google` |
| **Package Manager** | [pnpm v11](https://pnpm.io/) | Cepat, hemat ruang disk, isolasi dependensi ketat |

---

## 🎯 Prinsip Desain & Rekayasa

1. **Aturan Batas Berkas (< 100 Baris Kode):**
   - 100% file komponen dan logika bisnis (`.ts`, `.tsx`) dirancang modular dengan panjang maksimal **< 100 baris**.
   - Menghindari *God Component*, mempermudah *code review*, dan menjaga *Single Responsibility Principle* (SRP).

2. **Pendekatan Minimalis & Zero-Slop (Filosofi Ponytail):**
   - Menghindari abstraksi berlebih. Komponen dialog mobile ([MobileNav.tsx](components/layout/MobileNav.tsx)) diimplementasikan menggunakan state React native yang aksesibel (ESC key, backdrop tap, lock body scroll) tanpa membebani bundle dengan pustaka modal berat.
   - Pustaka `@radix-ui/react-dialog` dan 22 paket turunan berhasil dipangkas sepenuhnya.

3. **Zero-Flash Preloader:**
   - Preloader ([PagePreloader.tsx](components/common/PagePreloader.tsx)) dipasang pada server-level root layout dengan gaya inline background `#0B061A`.
   - Mengeliminasi layar putih berkedip (*white flash*) saat pemuatan awal pada dark theme sebelum JavaScript dieksekusi.

4. **Isolasi Memori & GPU-Acceleration Lottie:**
   - Menggunakan `WeakMap` in-memory cache pada [LottiePlayer.tsx](components/ui/LottiePlayer.tsx) untuk mencegah pemuatan ulang data JSON saat re-render.
   - CSS properties `transform: translate3d(0,0,0)`, `backface-visibility: hidden`, dan `contain: paint` mencegah animasi hilang (*disappearing bug*) saat scrolling cepat di browser mobile.

---

## 📂 Struktur Direktori

```text
posgodinov-lp/
├── app/
│   ├── favicon.ico
│   ├── globals.css                # Konfigurasi Tailwind v4 & tema warna
│   ├── icon.png                   # Favicon Next.js metadata
│   ├── layout.tsx                 # Root layout, preloader, metadata global (< 95 baris)
│   └── page.tsx                   # Halaman utama landing page (< 25 baris)
├── components/
│   ├── common/                    # Komponen modular reusable
│   │   ├── BentoCell.tsx          # Wrapper sel bento grid
│   │   ├── PagePreloader.tsx      # Preloader logo berdenyut
│   │   ├── SectionShell.tsx       # Kontainer standar tiap section
│   │   └── StatusPill.tsx         # Pill badge status
│   ├── interactive/               # Komponen interaktif & visual dinamis
│   │   ├── HeroCardDeck.tsx       # Fanned 3-card stack di Hero
│   │   ├── PosDeviceMock.tsx      # Mockup terminal POS kasir
│   │   └── pos-device/            # Sub-komponen mockup kasir (Cart & Telemetry)
│   ├── layout/                    # Struktur tata letak umum
│   │   ├── DesktopNav.tsx         # Menu navigasi layar desktop
│   │   ├── MobileNav.tsx          # Slide-over drawer navigasi mobile (Native)
│   │   ├── SiteFooter.tsx         # Footer resmi dengan info kontak & tautan
│   │   └── SiteHeader.tsx         # Navbar sticky responsif (h-20)
│   ├── sections/                  # Bagian-bagian halaman landing
│   │   ├── HeroSection.tsx        # Section 1: Hero utama + CTA
│   │   ├── TrustBar.tsx           # Section 2: Bar segmen industri terpercaya
│   │   ├── ProblemSection.tsx     # Section 3: Masalah kasir & kebocoran dana
│   │   ├── FeatureBento.tsx       # Section 4: Grid bento fitur unggulan
│   │   ├── PricingSection.tsx     # Section 5: Daftar paket harga (4 tier)
│   │   ├── FaqSection.tsx         # Section 6: FAQ merchant (Akordion native)
│   │   ├── FinalCtaSection.tsx    # Section 7: Banner ajakan bertindak penutup
│   │   ├── pricing/               # Sub-komponen kartu harga (PricingCard.tsx)
│   │   └── problem/               # Sub-komponen kartu masalah (ProblemCardItem.tsx)
│   └── ui/                        # Komponen atomik
│       ├── button.tsx             # Varian tombol (cva)
│       └── LottiePlayer.tsx       # Renderer animasi Lottie teroptimasi
├── docs/
│   └── LANDING_PAGE_MASTER_PLAN.md# Cetak biru rancangan landing page
├── lib/
│   ├── content/                   # Single Source of Truth (SSOT) konten teks
│   │   ├── brand.ts               # Identitas brand, kontak, URL WhatsApp & dashboard
│   │   ├── faq.ts                 # Daftar pertanyaan umum merchant
│   │   ├── features.ts            # Data sel bento fitur unggulan
│   │   ├── hero.ts                # Teks tajuk, sub-tajuk, dan metrik hero
│   │   ├── index.ts               # Hub export sentral modul konten
│   │   ├── navigation.ts          # Menu navigasi header & footer
│   │   ├── pricing.ts             # Skema & spesifikasi 4 paket langganan
│   │   ├── problem.ts             # Poin-poin masalah merchant
│   │   └── types.ts               # Definisi tipe TypeScript konten
│   └── utils.ts                   # Helper cn (clsx + tailwind-merge)
├── public/
│   ├── icons/                     # Aset Lottie animasi (< 150KB)
│   │   ├── countingmoney.json     # Animasi hitung uang (Problem Card 1)
│   │   ├── creditcard.json        # Animasi transaksi kasir
│   │   ├── graphicsales.json      # Animasi grafik analitik penjualan
│   │   ├── networkless.json       # Animasi mode offline (Problem Card 3)
│   │   └── storebuilding.json     # Animasi cabang toko
│   └── images/                    # Aset grafis statis (Logo PNG & WebP)
├── next.config.ts                 # Konfigurasi Next.js & cache headers aset
├── package.json                   # Dependensi & skrip proyek
└── tsconfig.json                  # Konfigurasi TypeScript
```

---

## 🌟 Fitur & Bagian Landing Page

### 1. Hero Section ([HeroSection.tsx](components/sections/HeroSection.tsx))
- **Value Proposition Jelas:** Headline fokus pada kasir yang tetap jalan walau internet mati dan uang kas yang aman dari kebocoran.
- **CTA Utama:** Tombol *"Coba Sekarang, Gratis!"* yang mengarahkan pengguna langsung ke aplikasi dashboard.
- **Fanned Card Deck:** Visualisasi 3 tumpuk kartu miring (*multi-cabang*, *analitik penjualan*, dan *live POS device interactive simulator*).

### 2. Trust Bar ([TrustBar.tsx](components/sections/TrustBar.tsx))
- Menampilkan segmen bisnis sasaran: *Coffee Shop & Cafe*, *Restoran & Eatery*, *Retail & Minimarket*, serta *Franchise Multi-Outlet*.

### 3. Problem Section ([ProblemSection.tsx](components/sections/ProblemSection.tsx))
- Mengangkat 3 masalah nyata pedagang:
  1. *Kebocoran Kas Tak Terlacak* (dengan mikro-animasi hitung uang & highlight kuning rata-rata kerugian).
  2. *Mental Fatigue Rekap Manual* (rekap akhir shift yang memakan waktu dan rentan salah).
  3. *Sistem Kasir Lumpuh Saat Internet Mati* (dengan pop-out animasi diskoneksi jaringan).

### 4. Bento Feature Grid ([FeatureBento.tsx](components/sections/FeatureBento.tsx))
- Tata letak asimetris menonjolkan fitur utama:
  - *Offline-First Resilience*: Transaksi tetap tercatat walau koneksi terputus total.
  - *Anti-Cheat Audit Trail*: Pencatatan pembatalan pesanan (*void*) dan diskon yang diawasi PIN manajer.
  - *Split Bill & Multi Payment*: Fleksibilitas pembayaran split tunai, QRIS, dan kartu.
  - *Multi-Outlet Synchronization*: Sinkronisasi otomatis stok antar cabang saat online kembali.

### 5. Pricing Section ([PricingSection.tsx](components/sections/PricingSection.tsx))
Daftar 4 paket terstruktur rapi:
1. **Gratis (Rp 0):** Akses selamanya untuk usaha rintisan (1 outlet, 1 kasir, maks 50 transaksi/hari).
2. **Warung (Rp 49.000/bln):** Usaha tunggal tanpa batasan transaksi harian.
3. **Bisnis (Rp 149.000/bln):** Pilihan terpopuler dengan analitik lengkap, manajemen shift, dan multi kasir.
4. **Enterprise (Kustom):** Khusus jaringan cabang besar. Tanpa label harga angka, langsung tombol **Hubungi Sales**, dengan benefit *Pengembangan Modul Custom Sesuai SOP*.

### 6. FAQ Section ([FaqSection.tsx](components/sections/FaqSection.tsx))
- Format akordion native yang ringan dan aksesibel.
- Berisi 6 pertanyaan umum merchant:
  - Apakah kasir tetap bisa transaksi jika internet/listrik mati?
  - Perangkat apa saja yang didukung? (HP, tablet, mesin POS Android)
  - Apakah paket gratis ada batasan waktu?
  - Apakah bisa mengelola banyak cabang toko sekaligus?
  - Bagaimana Godinov POS mencegah kecurangan staf kasir?
  - Bagaimana jika saya butuh bantuan teknis mendadak?

### 7. Final Call to Action ([FinalCtaSection.tsx](components/sections/FinalCtaSection.tsx))
- Banner berkontras tinggi dengan tombol ganda:
  - Tombol Utama: *"Coba Sekarang, Gratis!"* (Direct to Dashboard).
  - Tombol Konsultasi: *"Konsultasi via WhatsApp"* (Direct to Customer Success).

---

## 📝 Manajemen Konten (SSOT)

Seluruh copy teks, tautan, metadata, dan konfigurasi paket harga dipisahkan ke dalam folder [lib/content/](lib/content/):

- [brand.ts](lib/content/brand.ts): Nama brand, email resmi (`contact@pos.godinov.id`), link dashboard, link WhatsApp.
- [hero.ts](lib/content/hero.ts): Headline, sub-headline, trust points.
- [pricing.ts](lib/content/pricing.ts): Rincian harga, benefit, batas kuota transaksi/outlet, dan target persona.
- [faq.ts](lib/content/faq.ts): Daftar pertanyaan dan jawaban merchant.
- [navigation.ts](lib/content/navigation.ts): Tautan navigasi navbar dan footer.

> *Setiap perubahan teks atau harga dapat dilakukan cukup dengan mengedit berkas di `lib/content/` tanpa menyentuh struktur JSX komponen.*

---

## 🚀 Optimasi Performa & Aset

- **Header Caching Aset:**
  File animasi JSON di `/icons/*` dikonfigurasi melalui [next.config.ts](next.config.ts) dengan header cache `public, max-age=31536000, immutable` sehingga di-cache oleh browser pengguna selama 1 tahun.
- **Micro-Animations di Bawah 150KB:**
  Seluruh animasi Lottie (`public/icons/*.json`) telah dioptimasi dengan bobot < 150KB (rata-rata 18KB - 140KB) untuk memastikan waktu pemuatan instan.
- **Hydration Safe:**
  Komponen Lottie dimounting menggunakan `useSyncExternalStore` guna menjamin zero-mismatch antara Server-Side Rendering (SSR) dan Client-Side Hydration.

---

## 🛠️ Panduan Pengembangan (Getting Started)

### Prasyarat

- Node.js versi 20.x atau lebih baru.
- [pnpm](https://pnpm.io/) versi 9.x atau 11.x (`corepack enable pnpm`).

### Instalasi & Menjalankan Lokal

```bash
# 1. Clone repository & navigasi ke folder landing page
cd posgodinov-lp

# 2. Pasang dependensi
pnpm install

# 3. Jalankan server pengembangan lokal (Turbopack)
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.

---

## 📦 Skrip NPM

| Perintah | Deskripsi |
| :--- | :--- |
| `pnpm dev` | Menjalankan server dev dengan Next.js Turbopack |
| `pnpm build` | Membangun aset produksi statis dan memverifikasi type-safety |
| `pnpm start` | Menjalankan server produksi hasil kompilasi |
| `pnpm lint` | Menjalankan ESLint untuk memastikan kerapian dan standar kode |

---

## 📜 Kebijakan Koding

1. **Jaga Berkas Singkat:** Setiap berkas baru **wajib** memiliki panjang kurang dari 100 baris. Jika kode mulai membengkak, pecah menjadi sub-komponen terpisah di direktori yang relevan.
2. **Tanpa Library Berlebih:** Prioritaskan fitur standar HTML5/CSS3 dan hook native React sebelum memutuskan menambah package eksternal baru.
3. **Standar Aksesibilitas:** Pastikan elemen interaktif memiliki `aria-label`, dapat dioperasikan via keyboard, dan memiliki rasio kontras warna yang nyaman dibaca.

---

&copy; 2026 **PT Godinov Inovasi Indonesia**. Seluruh hak cipta dilindungi undang-undang.
