# Godinov POS V2 — Landing Page Master Plan

> **Status:** Blueprint (v1.0) — belum ada kode.
> **Owner:** Lead UI/UX Architect
> **Konsumen dokumen:** Frontend executor agent (per-modul), QA (fase Playwright)
> **Lokasi target build:** `posgodinov-landingpage/` (saat ini kosong).

---

## 0. Ringkasan Eksekutif

### 0.1 Positioning

Godinov POS V2 bukan dijual sebagai "aplikasi kasir". Ia dijual sebagai **sistem pengamanan uang tunai yang kebetulan berbentuk kasir**.

Dua musuh yang kita jual solusinya:

| Musuh | Rasa sakit di lapangan | Senjata Godinov |
|---|---|---|
| **Kebocoran kas** | Owner tidak pernah tahu selisih laci itu salah hitung atau diambil | Blind Closing, Void Guard, Kiosk Mode, Audit Trail |
| **Internet mati** | Antrian berhenti, transaksi dicatat di kertas, data hilang | Offline-First PWA + Sync Queue idempoten |

### 0.2 Target Persona (urutan prioritas)

1. **Owner multi-outlet F&B** (2–20 outlet) — pembuat keputusan, membayar. Motivasi: kontrol & ketenangan.
2. **Manajer Operasional** — evaluator teknis. Motivasi: SOP shift, stock opname, waste log.
3. **Kasir** — bukan pembeli, tapi penentu adopsi. Pesan ke persona ini: "tidak menambah kerja, tetap jalan saat sinyal hilang."

Landing page berbicara **80% ke Owner**, 20% ke Manajer. Kasir hanya disinggung di bagian kemudahan.

### 0.3 Prinsip Desain

| Prinsip | Implikasi konkret |
|---|---|
| **Enterprise Calm** | Tanpa gradient norak, tanpa glow berlebihan. Kepercayaan dibangun lewat *whitespace*, hirarki tipografi tegas, dan angka yang rapi. |
| **Show the mechanism** | Fitur keamanan tidak cukup disebut; harus divisualisasikan (animasi antrian sync, simulasi blind closing). Ini *kunci* diferensiasi vs kompetitor. |
| **Numbers are the hero** | Semua angka rupiah memakai `tabular-nums`. Angka yang bergeser-geser saat animasi = hilang kredibilitas. |
| **Dark-first "Operator Console"** | Tema gelap sebagai default (kesan sistem operasional / kontrol), tetap sediakan token untuk light mode. |
| **Static by default** | Semua section adalah React Server Component. `"use client"` hanya untuk pulau interaktif. |
| **Test-first DOM** | Struktur DOM rata, semantik, ber-`data-testid` stabil sejak hari pertama (lihat §6). |

### 0.4 Tech Stack & Batasan Lingkungan

- **Next.js 16.3 (App Router)** — ⚠️ Versi ini punya *breaking changes* vs pengetahuan umum. Executor agent **wajib** membaca `node_modules/next/dist/docs/` sebelum menulis kode (lihat `posgodinov-fe/AGENTS.md`).
- **React 19.2**
- **Tailwind CSS v4** — konfigurasi *CSS-first* lewat `@theme` di `app/globals.css`. **Tidak ada** `tailwind.config.ts`.
- **shadcn/ui + Radix** — dipasang lewat CLI, komponen di-*vendor* ke `components/ui/`.
- **Framer Motion** — hanya di client component.
- **lucide-react** — ikon.
- **Playwright** (fase berikutnya) — tidak diinstal sekarang, tapi kontrak DOM §6 wajib dipatuhi sekarang.

---

## 1. Information Architecture

Urutan naratif mengikuti alur psikologis: **Kenali diri → Rasakan sakit → Lihat obat → Percaya mekanismenya → Hilangkan keraguan → Bertindak.**

```
┌─ 01  NAVBAR ................. sticky, translucent        [always]
├─ 02  HERO ................... claim + dual CTA + visual  [above fold]
├─ 03  TRUST BAR .............. social proof ringan
├─ 04  PROBLEM ................ agitasi: 3 titik bocor
├─ 05  FEATURE BENTO .......... solusi: 7 sel grid
├─ 06  SYNC EDUCATION ......... deep-dive offline-first (scroll-driven)
├─ 07  CASH INTEGRITY ......... deep-dive Blind Closing (interaktif)
├─ 08  TESTIMONIAL ............ social proof berat
├─ 09  PRICING ................ 3 tier + toggle
├─ 10  FAQ .................... Accordion (objection handling)
├─ 11  FINAL CTA .............. konversi terakhir
└─ 12  FOOTER ................. nav sekunder + legal
```

### 1.1 Spesifikasi Per Section

| # | Section | `id` anchor | Tujuan tunggal | Ukuran visual | Prioritas |
|---|---|---|---|---|---|
| 01 | Navbar | — | Navigasi + CTA persisten | h-16, sticky top-0 | P0 |
| 02 | Hero | `#beranda` | Sampaikan klaim utama dalam 5 detik | min-h-[90svh] | P0 |
| 03 | Trust Bar | — | Turunkan skeptisisme awal | py-12 | P1 |
| 04 | Problem | `#masalah` | Bikin owner merasa "ini gue banget" | py-24 | P0 |
| 05 | Feature Bento | `#fitur` | Tunjukkan cakupan sistem sekali lihat | py-24, grid 12 kol | P0 |
| 06 | Sync Education | `#offline` | Buktikan offline-first itu nyata | py-32 (tinggi, scroll-driven) | P0 |
| 07 | Cash Integrity | `#keamanan` | Buktikan anti-fraud itu nyata | py-32 | P1 |
| 08 | Testimonial | — | Validasi sosial | py-24 | P2 |
| 09 | Pricing | `#harga` | Konversi + transparansi | py-24 | P1 |
| 10 | FAQ | `#faq` | Matikan 6 keberatan terakhir | py-24 | P1 |
| 11 | Final CTA | — | Aksi | py-28 | P0 |
| 12 | Footer | — | Kredibilitas + legal | py-16 | P1 |

### 1.2 Detail Naratif Tiap Section

**01 — Navbar.** Logo kiri. Menu tengah: `Fitur`, `Offline-First`, `Keamanan`, `Harga`, `FAQ`. Kanan: link `Masuk` (ghost) + `Coba Gratis` (primary). Mobile: Radix Sheet. Perilaku: transparan di `scrollY < 24`, lalu `backdrop-blur` + border bawah. **Indikator hidup:** badge kecil "Mode Offline Aktif" yang berkedip halus — teaser fitur utama.

**02 — Hero.** Layout asimetris 55/45. Kiri: eyebrow badge → H1 → sub-headline → dual CTA → micro-proof (3 titik: "Tanpa kartu kredit · Setup 15 menit · Data milik Anda"). Kanan: mockup device POS dengan **status pill** yang bergantian `● Online` → `● Offline — 12 transaksi dalam antrian` → `● Tersinkron`. Ini adalah *hook* visual utama halaman.

**03 — Trust Bar.** Satu baris: metrik agregat (`1.2jt+ transaksi diproses`, `99.9% sync success`, `0 data loss`) + deretan logo klien grayscale. ⚠️ **Data placeholder**: semua angka & logo wajib ditandai `TODO:` di kode dan tidak boleh mengarang nama bisnis nyata sampai owner memberi data asli.

**04 — Problem.** Heading agitasi + 3 kartu bergaya "laporan insiden": *Selisih laci yang tak terjelaskan*, *Void diam-diam setelah struk dicetak*, *Sinyal hilang, antrian berhenti*. Tiap kartu punya angka dampak (estimasi kerugian/bulan) dan nada dingin — bukan drama.

**05 — Feature Bento.** Grid 12 kolom, 7 sel dengan bobot berbeda (spesifikasi di §3.2). Sel besar = fitur pembeda (Blind Closing, Offline-First). Sel kecil = fitur pelengkap (Stock Opname, Waste Log, Multi-Outlet, Audit Trail, Kiosk Mode).

**06 — Sync Education.** Section paling "mahal" secara animasi. Scroll-driven 3 tahap: **(a) Online** — transaksi mengalir lurus ke cloud. **(b) Internet putus** — jalur ke cloud terputus, transaksi menumpuk sebagai kartu antrian di sisi device, counter naik, badge berubah amber. **(c) Sinyal kembali** — antrian terbang satu per satu ke cloud, counter turun ke 0, badge hijau, muncul ringkasan "12 transaksi · 1 shift · 3 waste — tersinkron". Disertai penjelasan teknis singkat: IndexedDB, idempotency key, `client_created_at` sebagai sumber waktu kebenaran.

**07 — Cash Integrity.** Simulator "Tutup Shift" dua panel berdampingan. Panel kiri (*Layar Kasir*): kasir hanya bisa mengetik jumlah fisik laci — angka sistem **disembunyikan/blur**. Panel kanan (*Layar Owner*): begitu disubmit, terungkap `Expected`, `Actual`, dan `Selisih` berwarna. Pesan: kasir tidak pernah tahu target, jadi tidak bisa mencocokkan angka. Di bawahnya 2 kartu pendamping: **Void Guard** (void wajib alasan + otorisasi PIN supervisor, tercatat permanen) dan **Kiosk Mode** (device terikat serial outlet, tidak bisa keluar aplikasi).

**08 — Testimonial.** 3 kartu kutipan + nama, jabatan, jenis usaha, jumlah outlet. Sama seperti Trust Bar: **placeholder bertanda `TODO:`**.

**09 — Pricing.** 3 tier: `Warung` / `Bisnis` (highlight) / `Enterprise`. Toggle Bulanan ↔ Tahunan (hemat 2 bulan). Tiap tier menyebut batas outlet & device. Baris fitur pakai ikon centang/silang yang jelas.

**10 — FAQ.** Radix Accordion, 6 pertanyaan (daftar lengkap di §2.6).

**11 — Final CTA.** Panel kontras penuh lebar, headline pengulangan janji utama, satu CTA dominan + satu link sekunder (Jadwalkan demo).

**12 — Footer.** 4 kolom: Produk, Perusahaan, Sumber Daya, Legal + baris bawah copyright & status sistem.

---

## 2. Copywriting Blueprint

Semua salinan berbahasa Indonesia, nada **tegas, faktual, sedikit dingin** — seperti laporan audit, bukan iklan. Hindari kata: "revolusioner", "canggih", "solusi terbaik", "all-in-one".

### 2.1 Hero — Headline

**Varian A (utama, dipakai untuk build pertama):**
> # Kasir tetap jalan. Uang tidak ikut jalan-jalan.

**Sub-headline:**
> Godinov POS V2 terus melayani transaksi walau internet mati total, lalu mengunci celah kebocoran kas lewat Blind Closing, Void Guard, dan Kiosk Mode. Setiap rupiah punya jejak.

**Varian B (uji A/B):**
> # Sistem kasir yang tidak bergantung pada sinyal — dan tidak percaya begitu saja pada siapa pun.

**Varian C (uji A/B):**
> # Internet mati bukan alasan tutup. Selisih laci bukan lagi misteri.

**Eyebrow badge:** `Offline-First PWA · Dirancang untuk outlet dengan sinyal 1 bar`

**CTA primer:** `Coba Gratis 14 Hari`
**CTA sekunder:** `Lihat Demo Interaktif` (scroll ke §06)
**Micro-proof:** `Tanpa kartu kredit · Setup 15 menit · Data tetap milik Anda`

### 2.2 Key Value Proposition (4 pilar)

| Pilar | Judul | Kalimat pendukung |
|---|---|---|
| **1. Ketahanan** | Tidak bergantung pada sinyal | Transaksi tersimpan di perangkat, antre otomatis, dan terkirim sendiri saat koneksi pulih. Nol transaksi hilang. |
| **2. Integritas Kas** | Kasir tidak pernah lihat angka targetnya | Blind Closing memaksa hitungan fisik dilakukan jujur. Sistem yang membuka selisihnya, bukan kasir. |
| **3. Kontrol** | Setiap pembatalan meninggalkan jejak | Void wajib alasan dan otorisasi supervisor. Riwayatnya tercatat permanen di audit trail. |
| **4. Kejelasan** | Laporan yang bisa ditindak, bukan ditebak | Selisih shift, waste, dan stock opname masuk satu laporan lintas outlet. |

### 2.3 Problem Section — Copy

**Heading:** `Uang Anda tidak hilang sekaligus. Ia menetes.`
**Sub:** `Tiga titik ini menyumbang mayoritas kerugian operasional di outlet retail dan F&B.`

| Kartu | Judul | Body |
|---|---|---|
| 1 | Selisih laci yang selalu "salah hitung" | Saat kasir tahu angka yang seharusnya, selisih akan selalu pas — termasuk ketika seharusnya tidak pas. |
| 2 | Void setelah struk tercetak | Transaksi dibatalkan setelah pelanggan pergi. Barang keluar, uang tidak masuk, laporan tetap terlihat rapi. |
| 3 | Sinyal hilang, catatan pindah ke kertas | Satu jam offline berarti puluhan transaksi yang direkonstruksi dari ingatan di akhir hari. |

### 2.4 Feature Bento — Copy Per Sel

| Sel | Judul | Deskripsi (≤ 18 kata) |
|---|---|---|
| A (besar) | Blind Closing | Kasir memasukkan hitungan fisik tanpa melihat angka sistem. Selisih muncul hanya di layar Anda. |
| B (besar) | Offline-First PWA | Transaksi jalan penuh tanpa internet. Antrian tersimpan lokal dan sinkron sendiri saat koneksi kembali. |
| C | Void Guard | Pembatalan wajib alasan dan otorisasi supervisor. Tercatat permanen di audit trail. |
| D | Kiosk Mode | Perangkat terikat serial outlet. Kasir tidak bisa keluar aplikasi atau berpindah akun. |
| E | Stock Opname & Waste | Selisih stok dan pembuangan bahan tercatat per staf, per outlet, per tanggal. |
| F | Multi-Outlet | Satu dasbor untuk semua cabang. Master data didorong dari pusat ke tiap perangkat. |
| G | Audit Trail | Siapa, kapan, dari perangkat mana. Riwayat bersifat append-only. |

### 2.5 Sync Education — Copy

**Heading:** `Apa yang terjadi saat internet Anda mati jam 7 malam?`
**Sub:** `Tiga fase berikut berjalan otomatis. Kasir tidak perlu menekan apa pun.`

| Fase | Label | Penjelasan |
|---|---|---|
| 1 | Normal | Setiap transaksi tercatat di perangkat lebih dulu, baru dikirim ke server. Perangkat adalah sumber kebenaran pertama. |
| 2 | Terputus | Koneksi hilang. Transaksi tetap diproses penuh dan masuk antrian lokal. Struk tetap tercetak. |
| 3 | Pulih | Antrian dikirim berurutan dengan kunci idempoten. Waktu asli transaksi dipertahankan, bukan waktu kirim. |

**Catatan teknis (tampilkan kecil, monospace):**
`IndexedDB · Service Worker · Idempotency Key · client_created_at dipertahankan · Konflik diselesaikan server-side`

### 2.6 FAQ — Daftar Pertanyaan

1. Apakah benar bisa transaksi tanpa internet sama sekali?
2. Bagaimana kalau perangkat rusak sebelum data tersinkron?
3. Apakah kasir bisa mengubah atau menghapus transaksi yang sudah terkirim?
4. Berapa lama proses migrasi dari sistem kasir lama?
5. Perangkat apa saja yang didukung?
6. Siapa yang memiliki data saya?

### 2.7 Final CTA — Copy

**Heading:** `Hari ini juga, selisih laci berhenti jadi tebakan.`
**Sub:** `Pasang di satu outlet dulu. Bandingkan laporan minggu pertama dengan sistem lama Anda.`
**CTA:** `Mulai Uji Coba 14 Hari` · sekunder: `Jadwalkan Demo 20 Menit`

---

## 3. Component Breakdown

### 3.1 Struktur Direktori

```
posgodinov-landingpage/
├── app/
│   ├── layout.tsx                 # RSC · font, metadata, ThemeProvider
│   ├── page.tsx                   # RSC · komposisi 12 section, tanpa logic
│   ├── globals.css                # Tailwind v4 @theme tokens
│   └── opengraph-image.tsx        # OG image generatif
├── components/
│   ├── ui/                        # shadcn (button, badge, accordion, sheet, tabs…)
│   ├── layout/
│   │   ├── SiteHeader.tsx         # client
│   │   ├── MobileNav.tsx          # client (Radix Sheet)
│   │   └── SiteFooter.tsx         # server
│   ├── sections/
│   │   ├── HeroSection.tsx        # server shell
│   │   ├── TrustBar.tsx           # server
│   │   ├── ProblemSection.tsx     # server
│   │   ├── FeatureBento.tsx       # server
│   │   ├── SyncSection.tsx        # server shell
│   │   ├── CashIntegritySection.tsx
│   │   ├── TestimonialSection.tsx # server
│   │   ├── PricingSection.tsx     # server shell
│   │   ├── FaqSection.tsx         # server shell
│   │   └── FinalCta.tsx           # server
│   ├── interactive/
│   │   ├── PosDeviceMock.tsx      # client · mockup + status pill bergantian
│   │   ├── SyncAnimation.tsx      # client · scroll-driven 3 fase
│   │   ├── BlindClosingDemo.tsx   # client · simulator dua panel
│   │   ├── PricingToggle.tsx      # client · bulanan/tahunan
│   │   └── FaqAccordion.tsx       # client · Radix Accordion
│   └── common/
│       ├── SectionShell.tsx       # wrapper: <section>, eyebrow, h2, sub
│       ├── BentoCell.tsx          # sel grid generik
│       ├── Reveal.tsx             # wrapper animasi masuk (Framer Motion)
│       └── StatusPill.tsx         # badge online/offline/syncing
├── lib/
│   ├── content.ts                 # SEMUA copy terpusat (single source of truth)
│   ├── motion.ts                  # varian & easing Framer Motion bersama
│   └── utils.ts                   # cn()
└── docs/
    └── LANDING_PAGE_MASTER_PLAN.md
```

### 3.2 Kontrak Komponen Inti

| Komponen | Tipe | Tanggung jawab tunggal | Props kunci | `data-testid` |
|---|---|---|---|---|
| `SectionShell` | server | Bungkus semantik + spasi konsisten | `id, eyebrow, title, subtitle, children` | `section-{id}` |
| `SiteHeader` | client | Sticky nav + state scroll | — | `site-header` |
| `HeroSection` | server | Klaim utama + CTA | — | `hero` |
| `PosDeviceMock` | client | Mockup POS, siklus status pill 3 fase | `autoPlay?: boolean` | `hero-device-mock` |
| `StatusPill` | client | Visual state koneksi | `state: 'online' \| 'offline' \| 'syncing'`, `queueCount?: number` | `status-pill` |
| `BentoCell` | server | 1 sel bento | `span, title, description, icon, tone, children?` | `bento-cell-{slug}` |
| `FeatureBento` | server | Layout grid 12 kolom, 7 sel | `items: BentoItem[]` | `feature-bento` |
| `SyncAnimation` | client | Animasi scroll-driven 3 fase | `phases: SyncPhase[]` | `sync-animation` |
| `BlindClosingDemo` | client | Simulator input kasir vs reveal owner | `expectedAmount: number` | `blind-closing-demo` |
| `PricingToggle` | client | Ganti periode harga | `onChange(period)` | `pricing-toggle` |
| `FaqAccordion` | client | Accordion aksesibel | `items: FaqItem[]` | `faq-accordion` |
| `Reveal` | client | Fade+rise saat masuk viewport | `delay?, as?` | — (transparan) |

### 3.3 Aturan Konten

Seluruh teks tinggal di `lib/content.ts` sebagai objek ber-*type*. Komponen **tidak boleh** menuliskan string salinan secara *hardcoded*. Alasan: memudahkan revisi copy oleh owner, A/B testing headline, dan kelak i18n.

---

## 4. Design System & Motion

### 4.1 Token (Tailwind v4 `@theme` di `globals.css`)

| Token | Nilai | Pemakaian |
|---|---|---|
| `--color-ink-950` | `#070B0A` | Background utama (dark) |
| `--color-ink-900` | `#0F1513` | Permukaan kartu |
| `--color-ink-800` | `#1A211F` | Border halus |
| `--color-brand-500` | `#10B981` | Aksi utama, state tersinkron |
| `--color-brand-300` | `#6EE7B7` | Aksen teks/ikon |
| `--color-signal-500` | `#F59E0B` | State offline / antrian |
| `--color-alert-500` | `#EF4444` | Void, selisih negatif |
| `--color-paper-50` | `#F8FAF9` | Teks utama di dark |
| `--radius-card` | `1rem` | Kartu & sel bento |
| `--font-display` | Geist Sans, `tracking-tight` | H1–H3 |
| `--font-mono` | Geist Mono | Angka teknis, catatan sistem |

**Wajib:** setiap tampilan nominal rupiah memakai `tabular-nums`.

### 4.2 Skala Tipografi

`H1 clamp(2.5rem, 6vw, 4.5rem)` · `H2 clamp(2rem, 4vw, 3rem)` · `H3 1.5rem` · `body 1rem/1.7` · `caption 0.875rem`. Lebar baris paragraf dibatasi `max-w-[58ch]`.

### 4.3 Aturan Motion

1. Easing tunggal untuk seluruh situs: `[0.16, 1, 0.3, 1]`. Definisikan sekali di `lib/motion.ts`.
2. Durasi: masuk `0.5s`, mikro-interaksi `0.2s`, sekuens sync `0.8s` per fase.
3. `whileInView` selalu dengan `viewport={{ once: true, margin: "-80px" }}` — animasi tidak boleh berulang saat scroll naik-turun.
4. Hanya animasikan `transform` dan `opacity`. Tidak ada animasi `width`/`height`/`top` (layout thrash).
5. **`prefers-reduced-motion` wajib dihormati**: semua animasi dinonaktifkan, state akhir langsung ditampilkan. Ini juga membuat Playwright stabil.
6. Tidak ada animasi *blocking* di atas lipatan — LCP element (H1) harus terender tanpa menunggu JS.

### 4.4 Target Performa

| Metrik | Target |
|---|---|
| LCP | < 2.0s (4G) |
| CLS | < 0.05 |
| Lighthouse Performance | ≥ 92 |
| Lighthouse Accessibility | 100 |
| JS bundle awal | < 180KB gzip |

---

## 5. SEO & Aksesibilitas

- Metadata di `app/layout.tsx`: title template, description, OG, Twitter card, `metadataBase`.
- JSON-LD `SoftwareApplication` + `FAQPage` (dibangun dari data FAQ yang sama).
- Tepat satu `<h1>` di seluruh halaman. Hirarki heading tidak boleh melompat.
- Semua `<section>` punya `aria-labelledby` menunjuk ke id heading-nya.
- Kontras minimum AA (4.5:1) untuk teks, 3:1 untuk elemen UI besar.
- Fokus keyboard terlihat jelas: `focus-visible:ring-2 ring-brand-500`.
- Animasi murni dekoratif ditandai `aria-hidden="true"`.
- Skip-link ke `#main` sebagai elemen pertama di `<body>`.

---

## 6. Kontrak DOM untuk Playwright (WAJIB)

Fase berikutnya adalah pengujian E2E. Kode yang dibangun sekarang harus siap diuji tanpa refactor.

1. **Penamaan:** `data-testid` kebab-case, unik di seluruh halaman. Pola: `{section}-{elemen}-{varian}` → `hero-cta-primary`, `pricing-card-bisnis`, `faq-item-3`.
2. **Elemen wajib ber-testid:** semua CTA, semua input, semua trigger accordion/tab/toggle, semua kartu berulang (sel bento, kartu harga, item FAQ), dan setiap indikator state (`status-pill` dengan atribut `data-state`).
3. **State lewat atribut, bukan kelas:** komponen stateful mengekspos `data-state="online|offline|syncing"` atau `data-active="true"`. Tes tidak boleh bergantung pada nama kelas Tailwind.
4. **DOM rata:** maksimal 3 lapis `div` pembungkus per sel. Tidak ada `div` yang hanya untuk spasi — gunakan utilitas gap/padding.
5. **Semantik lebih dulu:** tombol memakai `<button>`, tautan navigasi memakai `<a>`/`<Link>`. Jangan pernah `div` dengan `onClick`.
6. **Deterministik:** setiap animasi otomatis/looping (seperti status pill hero) harus bisa dimatikan lewat prop atau `prefers-reduced-motion`, sehingga tes tidak *flaky*.
7. **Tanpa teks acak:** tidak ada `Math.random()` atau `new Date()` yang memengaruhi teks terender.

---

## 7. Execution Prompts

Empat prompt berikut dirancang **berurutan dan saling bergantung**. Berikan satu per satu ke coding agent; jangan gabungkan. Setiap prompt punya Definition of Done sendiri.

### 7.0 Urutan & Dependensi

```
PROMPT 1 (Fondasi + Navbar + Hero)
      └─> PROMPT 2 (Problem + Trust + Bento)
                └─> PROMPT 3 (Sync Animation + Blind Closing)
                          └─> PROMPT 4 (Pricing + FAQ + CTA + Footer + SEO/a11y)
```

---

### PROMPT 1 — Fondasi, Design System, Navbar & Hero

```text
KONTEKS
Kamu membangun landing page Godinov POS V2 di direktori `posgodinov-landingpage/`
(saat ini kosong). Blueprint lengkap ada di
`posgodinov-landingpage/docs/LANDING_PAGE_MASTER_PLAN.md` — BACA DULU
bagian §0, §1, §2.1, §2.2, §3, §4, dan §6 sebelum menulis kode apa pun.

PERINGATAN VERSI (jangan dilewati)
Proyek memakai Next.js 16.3 + React 19 + Tailwind CSS v4. Versi ini punya
breaking changes dibanding pengetahuan umummu. SEBELUM menulis kode,
baca dokumentasi terpasang di `node_modules/next/dist/docs/` (App Router,
metadata, fonts). Tailwind v4 memakai konfigurasi CSS-first via `@theme`
di `app/globals.css` — JANGAN membuat `tailwind.config.ts`.

TUGAS
1. Inisialisasi project Next.js (App Router, TypeScript, Tailwind v4,
   ESLint, alias `@/*`) di `posgodinov-landingpage/`.
2. Pasang: framer-motion, lucide-react, clsx, tailwind-merge, dan
   inisialisasi shadcn/ui (tambahkan komponen: button, badge, sheet).
3. Buat `app/globals.css` dengan blok `@theme` berisi SEMUA token warna,
   radius, dan font pada §4.1 blueprint. Set dark sebagai tema default.
4. Buat `lib/utils.ts` (fungsi `cn`) dan `lib/motion.ts` berisi easing
   bersama `[0.16, 1, 0.3, 1]` plus varian `fadeUp` dan `stagger`.
5. Buat `lib/content.ts` — objek ber-type berisi SELURUH copy dari §2
   blueprint (hero, nav, value props, problem, bento, sync, faq, pricing,
   cta, footer). Ini satu-satunya sumber teks; komponen dilarang
   hardcode string salinan.
6. Buat `components/common/SectionShell.tsx` (server) dan
   `components/common/Reveal.tsx` (client, hormati prefers-reduced-motion).
7. Buat `components/layout/SiteHeader.tsx` (client) + `MobileNav.tsx`:
   sticky, transparan saat scrollY < 24 lalu backdrop-blur + border bawah,
   menu desktop, Radix Sheet untuk mobile, CTA "Coba Gratis".
8. Buat `components/sections/HeroSection.tsx` (server) sesuai §1.2 no.02:
   layout asimetris 55/45, eyebrow badge, H1 varian A, sub-headline,
   dua CTA, tiga micro-proof.
9. Buat `components/interactive/PosDeviceMock.tsx` (client) dan
   `components/common/StatusPill.tsx`: mockup perangkat POS dengan status
   pill yang bersiklus online → offline (dengan hitungan antrian) →
   syncing → online. Siklus HARUS bisa dimatikan lewat prop `autoPlay`
   dan otomatis mati saat prefers-reduced-motion.
10. Rakit `app/page.tsx` yang merender header + hero saja.

ATURAN KERAS
- Semua section adalah React Server Component. `"use client"` hanya pada
  SiteHeader, MobileNav, PosDeviceMock, StatusPill, Reveal.
- Ikuti kontrak DOM §6 secara harfiah: data-testid kebab-case
  (`site-header`, `hero`, `hero-cta-primary`, `hero-cta-secondary`,
  `hero-device-mock`, `status-pill`), state lewat atribut `data-state`
  bukan nama kelas, maksimal 3 lapis div pembungkus, semantik HTML benar.
- Animasi hanya `transform` dan `opacity`. H1 harus terender tanpa
  menunggu JS (jangan bungkus H1 dengan animasi masuk yang memblokir).
- Tulis SEMUA copy dalam Bahasa Indonesia persis seperti di blueprint.
- Jangan menyentuh direktori `posgodinov-fe/` atau `posgodinov-be/`.

DEFINITION OF DONE
- `npm run build` dan `npm run lint` lulus tanpa error maupun warning.
- Halaman responsif di 360px, 768px, dan 1440px tanpa scroll horizontal.
- Navigasi keyboard penuh dengan focus ring terlihat.
- Laporkan daftar file yang dibuat beserta data-testid yang terpasang.
```

---

### PROMPT 2 — Problem Section, Trust Bar & Feature Bento Grid

```text
KONTEKS
Lanjutan Prompt 1 pada `posgodinov-landingpage/`. Fondasi, design system,
`lib/content.ts`, `SectionShell`, `Reveal`, header, dan hero sudah ada.
Baca `docs/LANDING_PAGE_MASTER_PLAN.md` §1.2 (no. 03–05), §2.3, §2.4,
§3.2, dan §6 sebelum mulai. Gunakan ulang komponen dan token yang sudah
ada — jangan membuat sistem spasi/warna baru.

TUGAS
1. `components/sections/TrustBar.tsx` (server): satu baris metrik agregat
   (3 angka + label) dan deretan placeholder logo klien grayscale.
   PENTING: ini data placeholder. Beri komentar `// TODO: ganti dengan
   data klien asli` dan gunakan nama generik ("Klien A", "Klien B") —
   JANGAN mengarang nama bisnis yang terdengar nyata.
2. `components/sections/ProblemSection.tsx` (server): heading agitasi +
   3 kartu bergaya laporan insiden sesuai §2.3, masing-masing dengan
   ikon lucide, judul, body, dan satu angka dampak. Nada visual dingin:
   border tipis, aksen `--color-alert-500` tipis di satu sisi.
3. `components/common/BentoCell.tsx` (server): sel generik dengan props
   `span` (lebar kolom), `tone` ('default' | 'brand' | 'signal'), `icon`,
   `title`, `description`, `children` opsional untuk visual kustom.
4. `components/sections/FeatureBento.tsx` (server): grid 12 kolom dengan
   7 sel dari §2.4. Bobot: sel A (Blind Closing) span 7, sel B
   (Offline-First) span 5 dengan tone 'brand', sel C dan D span 6,
   sel E, F, G span 4 masing-masing. Di bawah 768px semua menjadi 1 kolom.
   Sel A dan B masing-masing berisi visual mini dekoratif (SVG/CSS murni,
   tanpa gambar eksternal) yang merangkum fiturnya.
5. Sisipkan ketiga section ke `app/page.tsx` sesuai urutan blueprint:
   Hero → TrustBar → Problem → FeatureBento.

ATURAN KERAS
- Semuanya React Server Component. Animasi masuk hanya lewat `Reveal`
  yang sudah ada — jangan menambah client component baru.
- data-testid wajib: `trust-bar`, `section-masalah`, `problem-card-1..3`,
  `feature-bento`, dan tiap sel `bento-cell-{slug}` dengan slug:
  blind-closing, offline-first, void-guard, kiosk-mode, stock-opname,
  multi-outlet, audit-trail.
- Semua teks diambil dari `lib/content.ts` — tambahkan entri baru di sana,
  jangan hardcode di komponen.
- Grid bento harus rapi tanpa celah kosong di breakpoint md dan lg.
  Verifikasi visual sebelum melapor selesai.
- Visual dekoratif ditandai `aria-hidden="true"`.

DEFINITION OF DONE
- `npm run build` + `npm run lint` bersih.
- Grid bento tidak pecah di 360px / 768px / 1024px / 1440px.
- Tidak ada pergeseran layout (CLS) saat animasi Reveal berjalan.
- Laporkan struktur grid final dan daftar data-testid.
```

---

### PROMPT 3 — Sync Animation & Blind Closing Demo (modul paling kompleks)

```text
KONTEKS
Lanjutan Prompt 2 pada `posgodinov-landingpage/`. Ini modul dengan bobot
animasi tertinggi dan merupakan pembeda utama halaman. Baca
`docs/LANDING_PAGE_MASTER_PLAN.md` §1.2 (no. 06–07), §2.5, §4.3, dan §6.

Rujukan perilaku sistem nyata (dari backend Go di `posgodinov-be/`,
untuk menjaga animasi tetap jujur):
- Endpoint sync mengirim batch `shifts`, `transactions`, `wastes` sekaligus
  dan mengembalikan jumlah tersinkron plus `failed_transactions`.
- Setiap transaksi menyimpan `client_created_at` (waktu asli di perangkat)
  terpisah dari `created_at` (waktu terima server).
- Shift menyimpan `opening_balance`, `closing_balance`, `expected_balance`,
  dan `discrepancy`.

TUGAS
1. `components/interactive/SyncAnimation.tsx` (client):
   Animasi scroll-driven 3 fase memakai `useScroll` + `useTransform`
   Framer Motion pada kontainer tinggi (visual sticky di dalamnya).
   - Fase 1 "Normal": kartu transaksi mengalir dari ikon device ke ikon
     cloud melalui garis penghubung hijau.
   - Fase 2 "Terputus": garis penghubung terputus (dashed, amber), kartu
     menumpuk sebagai antrian di sisi device, counter antrian naik 0→12,
     StatusPill berubah ke state 'offline'.
   - Fase 3 "Pulih": garis tersambung, kartu terbang satu per satu ke
     cloud, counter turun 12→0, StatusPill ke 'syncing' lalu 'online',
     muncul ringkasan "12 transaksi · 1 shift · 3 waste — tersinkron".
   Di samping visual, tampilkan tiga blok penjelasan (§2.5) yang
   ter-highlight sesuai fase aktif. Tampilkan juga catatan teknis
   monospace dari §2.5.
2. `components/sections/SyncSection.tsx` (server shell) yang membungkus
   SyncAnimation dengan SectionShell (`id="offline"`).
3. `components/interactive/BlindClosingDemo.tsx` (client):
   Simulator dua panel. Panel kiri "Layar Kasir": input angka (hitungan
   fisik laci) — angka sistem DISEMBUNYIKAN dengan placeholder blur/dot.
   Tombol "Tutup Shift". Panel kanan "Layar Owner": sebelum submit
   menampilkan status menunggu; setelah submit menampilkan
   Expected (Rp 4.850.000), Actual (input pengguna), dan Selisih dengan
   warna: hijau bila 0, merah bila kurang, amber bila lebih.
   Sediakan tombol "Ulangi Simulasi" untuk reset.
4. `components/sections/CashIntegritySection.tsx` (server, `id="keamanan"`):
   membungkus BlindClosingDemo + 2 kartu pendamping (Void Guard,
   Kiosk Mode) sesuai §1.2 no.07.
5. Sisipkan kedua section ke `app/page.tsx` setelah FeatureBento.

ATURAN KERAS (kritis untuk pengujian)
- `prefers-reduced-motion: reduce` HARUS menonaktifkan seluruh animasi
  scroll-driven dan langsung menampilkan state akhir fase 3 beserta ketiga
  blok penjelasan. Tanpa ini, tes E2E akan flaky.
- Hanya animasikan `transform` dan `opacity`. Dilarang menganimasikan
  `width`, `height`, `top`, atau `left`.
- Fase aktif diekspos ke DOM lewat `data-phase="1|2|3"` pada elemen
  ber-testid `sync-animation`. Counter antrian ber-testid
  `sync-queue-count` dan menampilkan angka murni.
- BlindClosingDemo: testid `blind-closing-demo`, `blind-closing-input`,
  `blind-closing-submit`, `blind-closing-result`, dan hasil mengekspos
  `data-variance="match|short|over"`.
- Semua nominal rupiah memakai `tabular-nums` dan format
  `Intl.NumberFormat('id-ID')` yang dipanggil secara deterministik
  (tanpa `new Date()`).
- Input kasir harus punya `<label>` terhubung; seluruh demo dapat
  dioperasikan dengan keyboard saja.
- Jangan memakai library animasi tambahan selain framer-motion.
- Jangan memanggil API apa pun — ini murni simulasi frontend.

DEFINITION OF DONE
- `npm run build` + `npm run lint` bersih.
- Animasi berjalan mulus (tanpa jank) saat scroll di viewport 1440px, dan
  seluruh section tetap terbaca penuh di 360px (fallback: sekuens
  bertahap tanpa sticky jika ruang tidak cukup).
- Dengan reduced-motion aktif, seluruh konten tetap terbaca dan
  BlindClosingDemo tetap berfungsi.
- Laporkan daftar data-testid, atribut data-state/data-phase, dan
  bagaimana reduced-motion ditangani.
```

---

### PROMPT 4 — Pricing, FAQ, Final CTA, Footer, SEO & Audit Aksesibilitas

```text
KONTEKS
Modul penutup landing page Godinov POS V2 di `posgodinov-landingpage/`.
Baca `docs/LANDING_PAGE_MASTER_PLAN.md` §1.2 (no. 08–12), §2.6, §2.7,
§5, dan §6. Gunakan token, SectionShell, Reveal, dan `lib/content.ts`
yang sudah ada.

TUGAS
1. Tambahkan komponen shadcn yang dibutuhkan: accordion, tabs (atau
   switch untuk toggle harga), card, separator.
2. `components/sections/TestimonialSection.tsx` (server): 3 kartu kutipan
   dengan nama, jabatan, jenis usaha, jumlah outlet.
   PENTING: placeholder. Beri `// TODO: ganti dengan testimoni asli` dan
   gunakan atribusi generik ("Owner, jaringan kopi 6 outlet") tanpa nama
   orang atau merek yang terdengar nyata.
3. `components/interactive/PricingToggle.tsx` (client) +
   `components/sections/PricingSection.tsx` (server shell, `id="harga"`):
   3 tier (Warung / Bisnis [highlight] / Enterprise), toggle Bulanan ↔
   Tahunan (tahunan hemat 2 bulan, dihitung deterministik dari data di
   `lib/content.ts`), daftar fitur dengan ikon centang/silang, batas
   outlet & device disebut eksplisit, CTA per tier.
4. `components/interactive/FaqAccordion.tsx` (client, Radix Accordion) +
   `components/sections/FaqSection.tsx` (server, `id="faq"`): 6 pertanyaan
   dari §2.6 dengan jawaban yang kamu susun konsisten dengan klaim produk
   di blueprint — jangan menambah klaim teknis baru yang belum ada di §2.
5. `components/sections/FinalCta.tsx` (server): panel kontras penuh lebar
   sesuai §2.7.
6. `components/layout/SiteFooter.tsx` (server): 4 kolom (Produk,
   Perusahaan, Sumber Daya, Legal) + baris copyright. Tahun copyright
   HARUS konstan/statis, bukan `new Date()`, agar DOM deterministik.
7. SEO: lengkapi metadata di `app/layout.tsx` (title template, description,
   openGraph, twitter, metadataBase), buat `app/opengraph-image.tsx`, dan
   sisipkan JSON-LD `SoftwareApplication` + `FAQPage` yang dibangun dari
   data FAQ yang sama di `lib/content.ts`.
8. Audit aksesibilitas menyeluruh seluruh halaman sesuai §5: tepat satu
   `<h1>`, hirarki heading tidak melompat, setiap `<section>` punya
   `aria-labelledby`, kontras AA, focus-visible ring, skip-link ke `#main`,
   visual dekoratif `aria-hidden`. Perbaiki temuan pada section dari
   Prompt 1–3 bila ada.
9. Rakit `app/page.tsx` final dengan 12 section lengkap sesuai urutan §1.

ATURAN KERAS
- data-testid wajib: `testimonial-section`, `pricing-section`,
  `pricing-toggle` (dengan `data-period="monthly|yearly"`),
  `pricing-card-warung|bisnis|enterprise`, `faq-accordion`,
  `faq-item-1..6` (trigger memakai `data-state` bawaan Radix), `final-cta`,
  `final-cta-primary`, `site-footer`.
- Tidak ada nilai non-deterministik dalam teks terender (tanpa
  `new Date()`, tanpa `Math.random()`).
- Harga ditulis `tabular-nums` dengan format `Intl.NumberFormat('id-ID')`.
- Semua copy baru masuk ke `lib/content.ts`.

DEFINITION OF DONE
- `npm run build` + `npm run lint` bersih.
- Lighthouse pada build produksi: Performance ≥ 92, Accessibility 100,
  Best Practices ≥ 95, SEO 100. Lampirkan skornya di laporan.
- Seluruh halaman dapat dinavigasi penuh dengan keyboard, urutan fokus logis.
- Rich Results Test menerima JSON-LD FAQPage tanpa error.
- Laporkan inventaris LENGKAP data-testid seluruh halaman dalam bentuk
  tabel — ini akan menjadi dasar penulisan test Playwright di fase berikutnya.
```

---

## 8. Definition of Done (Tingkat Proyek)

| # | Kriteria | Alat verifikasi |
|---|---|---|
| 1 | 12 section terender sesuai urutan §1 | Inspeksi visual |
| 2 | Build & lint bersih | `npm run build`, `npm run lint` |
| 3 | Lighthouse: Perf ≥ 92, A11y 100, SEO 100 | Lighthouse (build produksi) |
| 4 | Responsif 360 / 768 / 1024 / 1440 tanpa scroll horizontal | DevTools |
| 5 | Reduced-motion menampilkan seluruh konten dalam state akhir | Emulasi DevTools |
| 6 | Seluruh `data-testid` §6 terpasang dan unik | `document.querySelectorAll('[data-testid]')` |
| 7 | Nol string copy ter-hardcode di luar `lib/content.ts` | Code review |
| 8 | Semua data placeholder bertanda `TODO:` | `grep -rn "TODO:" components/` |

---

## 9. Risiko & Catatan untuk Fase Berikutnya

| Risiko | Mitigasi |
|---|---|
| **Konten placeholder lolos ke produksi** | Trust Bar & Testimonial berisi data karangan. Wajib diganti data asli sebelum rilis publik; jangan mencantumkan logo atau nama bisnis yang belum memberi izin. |
| **SyncAnimation berat di perangkat low-end** | Batasi jumlah elemen animasi ≤ 16, gunakan `will-change` seperlunya, sediakan fallback statis di bawah 768px. |
| **Breaking change Next 16 / Tailwind v4** | Setiap prompt mewajibkan agent membaca `node_modules/next/dist/docs/` lebih dulu. |
| **Klaim produk melampaui kemampuan sistem** | Klaim di §2 dipetakan ke kemampuan backend nyata (`Shift.expected_balance`/`discrepancy`, `SyncUp` batch, `Transaction.cancel_notes`, device bind per serial outlet). Klaim baru harus divalidasi ke `posgodinov-be/internal/domain/` lebih dulu. |
| **Drift copy antara halaman dan aplikasi** | `lib/content.ts` sebagai sumber tunggal; revisi copy hanya lewat file ini. |

**Fase berikutnya (di luar cakupan dokumen ini):** setup Playwright, penulisan test E2E berdasarkan inventaris `data-testid` dari Prompt 4, visual regression, dan integrasi form lead capture ke backend.
