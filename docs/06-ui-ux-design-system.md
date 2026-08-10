# 06 — UI/UX Design System

> **Ruang lingkup:** sistem desain visual, aturan interaksi, dan spesifikasi komponen untuk **Web POS Client (`/pos`)** dan **Admin Dashboard (`/admin`)** pada SaaS POS Godinov.
> **Sumber kebenaran yang mengikat:** [01-architecture-overview.md](01-architecture-overview.md) · [02-database-schema.md](02-database-schema.md) · [03-api-specifications.md](03-api-specifications.md) · [04-frontend-mobile-web-requirements.md](04-frontend-mobile-web-requirements.md) · [05-frontend-architecture-design.md](05-frontend-architecture-design.md)
> **Basis kode:** [posgodinov-fe/](../posgodinov-fe/) — Next.js `16.3.0`, React `19.2.8`, **Tailwind CSS v4 (CSS-first, tanpa `tailwind.config.js`)**, TypeScript `5.x`.
>
> Dokumen ini adalah **spesifikasi rancangan**, bukan laporan audit. Setiap token, ukuran, dan aturan interaksi di sini diturunkan dari dua hal: (a) analisis pola POS ritel & F&B kelas dunia, dan (b) batasan backend yang sudah terverifikasi di dokumen 01–05. Di mana keduanya bertabrakan, batasan backend menang dan konsekuensinya dinyatakan eksplisit.

---

## Daftar Isi

| § | Bagian |
|---|---|
| [0](#0-dasar-rancangan) | Dasar Rancangan — Benchmark, Prinsip, Larangan Gaya |
| [1](#1-brand-color-palette--tokens-godinov-palette) | Brand Color Palette & Tokens (Godinov Palette) |
| [2](#2-touch-target--typography-rules-standar-pos-ritel) | Touch Target & Typography Rules |
| [3](#3-layout-architecture--ascii-wireframes) | Layout Architecture & ASCII Wireframes |
| [4](#4-interactive-component-specifications) | Interactive Component Specifications |
| [5](#5-hardware--keyboard-support) | Hardware & Keyboard Support |
| [6](#6-motion-elevation--feedback) | Motion, Elevation & Feedback |
| [7](#7-checklist-implementasi--butir-terbuka) | Checklist Implementasi & Butir Terbuka |

---

## 0. Dasar Rancangan

### 0.1 Analisis benchmark — apa yang diambil, dan mengapa

Rancangan ini tidak meniru satu produk. Ia mengambil pola yang **terbukti menurunkan waktu per transaksi atau menurunkan tingkat salah-tekan**, lalu menyatukannya di bawah satu bahasa visual.

| Sumber | Pola yang diadopsi | Alasan operasional | Diterapkan di |
|---|---|---|---|
| **Square POS** | **Split-screen persisten** — keranjang selalu terlihat, tidak pernah menjadi layar terpisah | Kasir dan pelanggan sama-sama memverifikasi isi keranjang sambil item ditambahkan. Keranjang yang tersembunyi memaksa navigasi bolak-balik dan memicu sengketa di meja kasir | §3.3, §3.4, §4.4 |
| **Square POS** | **Grid produk bersih, teks-dulu** — nama produk dominan, gambar opsional | `products.image_url` boleh `NULL` dan **tidak ada endpoint unggah gambar** ([02 §2.6](02-database-schema.md), [03 §14](03-api-specifications.md)). Grid yang bergantung pada gambar akan kosong di sebagian besar tenant | §4.2 |
| **Square POS** | **Alur checkout minim klik** — tambah → bayar → selesai dalam ≤ 4 ketukan | Setiap ketukan tambahan dikalikan ratusan transaksi per hari | §3.5, §4.6 |
| **Toast POS** | **Touch target besar (≥ 56 px) untuk aksi tak-terbatalkan** | Toast dirancang untuk F&B: tangan basah, sarung tangan, layar berminyak, kasir bergerak cepat. Salah tekan pada tombol bayar berarti transaksi salah nominal | §2.1 |
| **Toast POS** | **Status bar transparan & permanen** — koneksi, antrean, kasir, shift selalu terbaca | Sistem ini **offline-first** ([05 ADR-03](05-frontend-architecture-design.md)). Kasir wajib tahu apakah data sudah aman di server tanpa harus membuka layar lain | §4.7 |
| **Toast POS** | **Pemisahan fisik aksi destruktif dari aksi utama** | Void dan Bayar tidak boleh bertetangga | §2.2 |
| **Clover** | **Fast-Cash preset** — uang pas + pembulatan cerdas + pecahan umum | Menghilangkan pengetikan nominal pada > 70 % transaksi tunai; pengetikan nominal adalah sumber kesalahan kembalian terbesar | §4.6.3 |
| **Lightspeed** | **Tab kategori horizontal + pencarian permanen**, bukan drill-down folder | Master data POS mengirim kategori datar satu tingkat ([03 §sync master-data](03-api-specifications.md)) — tidak ada hierarki untuk di-*drill* | §4.3 |
| **Lightspeed** | **Numpad virtual besar berdampingan dengan preset** | Tablet tanpa keyboard fisik adalah target utama; keyboard OS menutupi setengah layar dan menyembunyikan total | §4.6.4 |

### 0.2 Tujuh prinsip yang mengikat seluruh keputusan

1. **Uang selalu terbaca.** Nominal tidak pernah lebih kecil dari 16 px, tidak pernah berwarna abu-abu muda, tidak pernah dipotong elipsis, dan selalu monospace bertabular.
2. **Keranjang tidak pernah hilang.** Tidak ada navigasi yang menyembunyikan keranjang aktif. Pembayaran adalah *overlay*, bukan halaman.
3. **Aksi tak-terbatalkan butuh ruang dan warna.** Bayar (emerald), Void/Hapus (crimson), dan keduanya tidak pernah berdampingan tanpa pemisah ≥ 24 px.
4. **Status sistem tidak pernah disembunyikan.** Online/offline, antrean sinkronisasi, dan peringatan jam melenceng ([05 §1.8.2](05-frontend-architecture-design.md)) selalu terlihat di POS.
5. **Layar kasir menampilkan hanya yang benar-benar diketahui perangkat.** Master data POS **tidak memuat stok maupun BOM** ([03 §sync master-data](03-api-specifications.md)) — dilarang menampilkan indikator ketersediaan. Menampilkan angka stok yang tidak dijamin benar lebih buruk daripada tidak menampilkannya.
6. **Kelelahan mata adalah masalah delapan jam, bukan lima menit.** Latar putih murni `#FFFFFF` sebagai kanvas penuh layar ditolak; kanvas memakai `#F8FAFC`/`#F1F5F9` dan hanya *surface* kartu yang putih.
7. **Setiap keadaan punya tampilan.** Kosong, memuat, gagal, offline, dan tersinkronisasi-sebagian semuanya dirancang — bukan diserahkan ke *spinner* generik.

### 0.3 Gaya yang **dilarang**

Sistem ini memakai gaya **Clean Modern Enterprise SaaS / Professional Retail UI**. Yang berikut ditolak secara eksplisit dan tidak boleh masuk lewat pintu belakang berupa "utility Tailwind lepas":

| Dilarang | Contoh kelas yang tidak boleh muncul | Pengganti yang benar |
|---|---|---|
| Neo-Brutalism / border tebal hitam | `border-4 border-black`, `border-2 border-neutral-900` | `border border-slate-200` (1 px, `--color-border`) |
| Bayangan keras *offset* (brutalist drop shadow) | `shadow-[6px_6px_0_0_#000]`, `shadow-[4px_4px_0_rgb(0,0,0)]` | `shadow-card` / `shadow-elevated` (§6.2) |
| Warna mentah jenuh di luar palet | `bg-red-500`, `bg-green-400`, `bg-blue-600`, `text-yellow-400` | Token semantik: `bg-danger`, `bg-success`, `bg-accent`, `text-warning` |
| Sudut nol pada permukaan interaktif | `rounded-none` pada tombol/kartu | `rounded-lg` (10 px) / `rounded-xl` (14 px) |
| Rotasi/miring dekoratif | `rotate-2`, `-skew-y-1` | — (tidak ada dekorasi geometris) |
| Font display/eksentrik | `font-black` pada nominal, tipografi tebal-ekstrem | `font-mono` + `font-semibold`/`font-bold` |
| Kontras hitam-murni pada teks | `text-black` | `text-slate-900` (`#0F172A`) |

> **Penegakan.** Tambahkan aturan ESLint/`stylelint` atau sekadar *code review checklist* di §7. Tanpa penegakan, palet akan bocor dalam hitungan minggu — persis seperti batas modul di [05 §1.1.4](05-frontend-architecture-design.md).

### 0.4 Batasan produk yang membentuk UI ini

Diringkas dari [05 §3.5](05-frontend-architecture-design.md) dan [03 §14](03-api-specifications.md), disusun ulang menurut komponen yang menanggungnya:

| Batasan | Konsekuensi desain |
|---|---|
| Master data POS tanpa stok & BOM | `ProductTile` **tanpa** badge stok, tanpa status "habis", tanpa *disable* otomatis (§4.2) |
| `products` **tidak memiliki kolom `barcode` maupun `sku`** ([02 §2.6](02-database-schema.md)) | Dukungan pemindai barcode memerlukan tabel pemetaan lokal di perangkat — lihat §5.4. Ini kesenjangan backend, bukan pilihan desain |
| Tidak ada endpoint unggah gambar | `ProductTile` wajib punya *fallback* teks yang tetap indah, bukan ikon "gambar rusak" (§4.2.3) |
| Kategori tanpa `PUT`/`DELETE` | Tab kategori tidak punya menu konteks edit/hapus (§4.3) |
| Hampir semua error backend = `400` dengan pesan bahasa Indonesia | Pola *feedback* utama = Toast pesan-langsung, bukan kode error (§4.8) |
| Laporan difilter `created_at`, bukan `client_created_at` | Banner peringatan permanen di D-03 & D-21 (§3.8) |
| Hold order 100 % lokal, tidak pernah dikirim | Tombol *Tahan* diberi warna netral, bukan aksen — ia bukan aksi yang mengamankan data (§4.4.4) |
| Uang = integer sen di seluruh state klien ([05 ADR-05](05-frontend-architecture-design.md)) | Setiap komponen penampil nominal menerima **sen**, bukan Rupiah desimal (§2.5) |

---

## 1. Brand Color Palette & Tokens (Godinov Palette)

### 1.1 Arsitektur token — tiga lapis

```text
Lapis 1 — PRIMITIF        Lapis 2 — SEMANTIK           Lapis 3 — KOMPONEN
nilai heksadesimal        makna dalam produk           penggunaan spesifik
--godinov-navy-900   ──▶  --color-brand           ──▶  --color-statusbar-bg
--godinov-blue-600   ──▶  --color-accent          ──▶  --color-btn-primary-bg
--godinov-emerald-600──▶  --color-success         ──▶  --color-btn-cash-bg
```

**Aturan mutlak:** komponen **tidak pernah** merujuk Lapis 1. `bg-[#2563EB]` dan `bg-godinov-blue-600` sama-sama dilarang di dalam komponen; yang benar adalah `bg-accent`. Ini yang membuat *rebranding* atau penyesuaian kontras menjadi perubahan satu berkas.

### 1.2 Lapis 1 — Primitif Godinov

| Peran | Token | Hex | Catatan |
|---|---|---|---|
| **Primary / Brand** | `--godinov-navy-950` | `#0F172A` | Teks utama, latar StatusBar, sidebar Admin |
| | `--godinov-navy-900` | `#1E293B` | Permukaan gelap sekunder, *hover* sidebar |
| | `--godinov-navy-800` | `#334155` | Border pada permukaan gelap, teks sekunder di atas gelap |
| **Accent / Action** | `--godinov-blue-600` | `#2563EB` | **Aksi utama** — Checkout, Submit, Primary Button |
| | `--godinov-blue-700` | `#1D4ED8` | *Hover* / *active* aksi utama |
| | `--godinov-blue-50` | `#EFF6FF` | Latar terpilih (tab aktif, baris terseleksi) |
| | `--godinov-cyan-600` | `#0284C7` | Aksen sekunder — info, tautan, ikon status sinkronisasi |
| **Success / Paid** | `--godinov-emerald-600` | `#059669` | Lunas, tombol **BAYAR TUNAI**, tersinkronisasi |
| | `--godinov-emerald-700` | `#047857` | Teks hijau di atas latar terang (kontras) |
| | `--godinov-emerald-50` | `#ECFDF5` | Latar badge "LUNAS" |
| **Warning / Alert** | `--godinov-amber-600` | `#D97706` | Stok minus, transaksi tertunda, jam melenceng |
| | `--godinov-amber-700` | `#B45309` | Teks amber di atas latar terang |
| | `--godinov-amber-50` | `#FFFBEB` | Latar banner peringatan |
| **Danger / Void** | `--godinov-red-600` | `#DC2626` | Void, Hapus, Cancel, gagal sinkronisasi |
| | `--godinov-red-700` | `#B91C1C` | *Hover* / teks merah di atas latar terang |
| | `--godinov-red-50` | `#FEF2F2` | Latar dialog konfirmasi destruktif |
| **Background** | `--godinov-slate-50` | `#F8FAFC` | Kanvas aplikasi (POS & Admin) |
| | `--godinov-slate-100` | `#F1F5F9` | Kanvas panel sekunder, *header* tabel |
| | `--godinov-slate-200` | `#E2E8F0` | **Border halus standar** |
| | `--godinov-slate-300` | `#CBD5E1` | Border input, pemisah kuat |
| | `--godinov-slate-500` | `#64748B` | Teks tersier / *placeholder* |
| | `--godinov-slate-600` | `#475569` | Teks sekunder |
| **Surface** | `--godinov-white` | `#FFFFFF` | Permukaan kartu, tile produk, modal |

### 1.3 Lapis 2 — Token semantik

| Token semantik | Nilai | Dipakai untuk |
|---|---|---|
| `--color-bg` | `slate-50` | Kanvas aplikasi |
| `--color-bg-muted` | `slate-100` | Panel keranjang, header tabel, area numpad |
| `--color-surface` | `white` | Kartu, tile, modal, baris keranjang |
| `--color-surface-inverse` | `navy-950` | StatusBar POS, sidebar Admin |
| `--color-border` | `slate-200` | **Border default seluruh permukaan** |
| `--color-border-strong` | `slate-300` | Border input, pemisah kolom |
| `--color-border-inverse` | `navy-800` | Pemisah di dalam permukaan gelap |
| `--color-fg` | `navy-950` | Teks utama |
| `--color-fg-muted` | `slate-600` | Teks sekunder (label, satuan, catatan) |
| `--color-fg-subtle` | `slate-500` | *Placeholder*, teks tersier |
| `--color-fg-inverse` | `white` | Teks di atas permukaan gelap/berwarna |
| `--color-brand` | `navy-950` | Identitas, header gelap |
| `--color-accent` | `blue-600` | **Aksi utama** |
| `--color-accent-hover` | `blue-700` | *Hover*/*active* aksi utama |
| `--color-accent-subtle` | `blue-50` | Latar keadaan terpilih |
| `--color-info` | `cyan-600` | Ikon informasi, indikator sinkronisasi berjalan |
| `--color-success` | `emerald-600` | Lunas, tombol tunai, badge tersinkronisasi |
| `--color-success-text` | `emerald-700` | **Teks hijau di atas latar terang** (§1.5) |
| `--color-success-subtle` | `emerald-50` | Latar badge sukses |
| `--color-warning` | `amber-600` | Stok minus, antrean tertunda, jam melenceng |
| `--color-warning-text` | `amber-700` | Teks amber di atas latar terang |
| `--color-warning-subtle` | `amber-50` | Latar banner peringatan |
| `--color-danger` | `red-600` | Void, hapus, batal, gagal sinkronisasi |
| `--color-danger-hover` | `red-700` | *Hover* aksi destruktif |
| `--color-danger-subtle` | `red-50` | Latar dialog konfirmasi destruktif |
| `--color-focus-ring` | `blue-600` | Cincin fokus keyboard (§5.6) |

### 1.4 Implementasi — Tailwind v4 CSS-first

Berkas [posgodinov-fe/app/globals.css](../posgodinov-fe/app/globals.css) saat ini masih berisi scaffold `create-next-app` (`--background: #ffffff`, blok `prefers-color-scheme: dark`, `font-family: Arial`). Berikut penggantinya secara utuh.

```css
/* app/globals.css */
@import "tailwindcss";

/* ───────────────────────── LAPIS 1 — PRIMITIF ───────────────────────── */
:root {
  /* Primary / Brand */
  --godinov-navy-950: #0F172A;
  --godinov-navy-900: #1E293B;
  --godinov-navy-800: #334155;

  /* Accent / Action */
  --godinov-blue-600: #2563EB;
  --godinov-blue-700: #1D4ED8;
  --godinov-blue-50:  #EFF6FF;
  --godinov-cyan-600: #0284C7;

  /* Success / Paid */
  --godinov-emerald-600: #059669;
  --godinov-emerald-700: #047857;
  --godinov-emerald-50:  #ECFDF5;

  /* Warning / Alert */
  --godinov-amber-600: #D97706;
  --godinov-amber-700: #B45309;
  --godinov-amber-50:  #FFFBEB;

  /* Danger / Void */
  --godinov-red-600: #DC2626;
  --godinov-red-700: #B91C1C;
  --godinov-red-50:  #FEF2F2;

  /* Neutral */
  --godinov-slate-50:  #F8FAFC;
  --godinov-slate-100: #F1F5F9;
  --godinov-slate-200: #E2E8F0;
  --godinov-slate-300: #CBD5E1;
  --godinov-slate-500: #64748B;
  --godinov-slate-600: #475569;
  --godinov-white:     #FFFFFF;

  /* ─────────────────────── LAPIS 2 — SEMANTIK ─────────────────────── */
  --bg:               var(--godinov-slate-50);
  --bg-muted:         var(--godinov-slate-100);
  --surface:          var(--godinov-white);
  --surface-inverse:  var(--godinov-navy-950);
  --border:           var(--godinov-slate-200);
  --border-strong:    var(--godinov-slate-300);
  --border-inverse:   var(--godinov-navy-800);

  --fg:               var(--godinov-navy-950);
  --fg-muted:         var(--godinov-slate-600);
  --fg-subtle:        var(--godinov-slate-500);
  --fg-inverse:       var(--godinov-white);

  --brand:            var(--godinov-navy-950);
  --accent:           var(--godinov-blue-600);
  --accent-hover:     var(--godinov-blue-700);
  --accent-subtle:    var(--godinov-blue-50);
  --info:             var(--godinov-cyan-600);

  --success:          var(--godinov-emerald-600);
  --success-text:     var(--godinov-emerald-700);
  --success-subtle:   var(--godinov-emerald-50);

  --warning:          var(--godinov-amber-600);
  --warning-text:     var(--godinov-amber-700);
  --warning-subtle:   var(--godinov-amber-50);

  --danger:           var(--godinov-red-600);
  --danger-hover:     var(--godinov-red-700);
  --danger-subtle:    var(--godinov-red-50);

  --focus-ring:       var(--godinov-blue-600);
}

/* ─────────────── PEMETAAN KE UTILITY TAILWIND v4 ─────────────── */
@theme inline {
  /* Warna → menghasilkan bg-*, text-*, border-*, ring-*, fill-* */
  --color-bg:              var(--bg);
  --color-bg-muted:        var(--bg-muted);
  --color-surface:         var(--surface);
  --color-surface-inverse: var(--surface-inverse);
  --color-border:          var(--border);
  --color-border-strong:   var(--border-strong);
  --color-border-inverse:  var(--border-inverse);
  --color-fg:              var(--fg);
  --color-fg-muted:        var(--fg-muted);
  --color-fg-subtle:       var(--fg-subtle);
  --color-fg-inverse:      var(--fg-inverse);
  --color-brand:           var(--brand);
  --color-accent:          var(--accent);
  --color-accent-hover:    var(--accent-hover);
  --color-accent-subtle:   var(--accent-subtle);
  --color-info:            var(--info);
  --color-success:         var(--success);
  --color-success-text:    var(--success-text);
  --color-success-subtle:  var(--success-subtle);
  --color-warning:         var(--warning);
  --color-warning-text:    var(--warning-text);
  --color-warning-subtle:  var(--warning-subtle);
  --color-danger:          var(--danger);
  --color-danger-hover:    var(--danger-hover);
  --color-danger-subtle:   var(--danger-subtle);

  /* Tipografi */
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace;

  /* Skala teks POS (§2.3) */
  --text-pos-xs:   0.75rem;   /* 12px — meta, timestamp            */
  --text-pos-sm:   0.875rem;  /* 14px — label, satuan              */
  --text-pos-base: 1rem;      /* 16px — teks dasar, nama produk    */
  --text-pos-md:   1.125rem;  /* 18px — nominal baris keranjang    */
  --text-pos-lg:   1.375rem;  /* 22px — subtotal, label tombol besar */
  --text-pos-xl:   1.75rem;   /* 28px — total keranjang            */
  --text-pos-2xl:  2.5rem;    /* 40px — nominal bayar & kembalian   */

  /* Touch target (§2.1) */
  --spacing-touch:    3rem;    /* 48px — minimum absolut  */
  --spacing-touch-md: 3.5rem;  /* 56px — numpad, aksi kritis */
  --spacing-touch-lg: 4rem;    /* 64px — tombol bayar utama */
  --spacing-touch-xl: 4.5rem;  /* 72px — Fast-Cash preset  */

  /* Radius — lembut, konsisten; TIDAK ADA rounded-none pada permukaan */
  --radius-sm:  0.375rem;  /*  6px — badge, chip         */
  --radius-md:  0.5rem;    /*  8px — input, tab          */
  --radius-lg:  0.625rem;  /* 10px — tombol              */
  --radius-xl:  0.875rem;  /* 14px — kartu, tile produk  */
  --radius-2xl: 1.125rem;  /* 18px — modal, panel        */

  /* Elevasi — lembut & berlapis; BUKAN offset keras (§6.2) */
  --shadow-card:     0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06);
  --shadow-raised:   0 2px 4px -1px rgb(15 23 42 / 0.06), 0 4px 8px -2px rgb(15 23 42 / 0.08);
  --shadow-elevated: 0 8px 16px -4px rgb(15 23 42 / 0.10), 0 16px 32px -8px rgb(15 23 42 / 0.12);
  --shadow-overlay:  0 24px 48px -12px rgb(15 23 42 / 0.22);

  /* Motion (§6.1) */
  --ease-out-pos: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-pos:  cubic-bezier(0.4, 0, 1, 1);
}

/* ─────────────────────────── DASAR ─────────────────────────── */
html {
  color-scheme: light;          /* POS dikunci terang — lihat §1.6 */
  -webkit-text-size-adjust: 100%;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-synthesis-weight: none;
}

/* Angka selalu bertabular — kolom nominal tidak boleh bergoyang saat berubah */
.tnum, table, input[inputmode="numeric"], input[inputmode="decimal"] {
  font-variant-numeric: tabular-nums;
}

/* Cincin fokus tunggal untuk seluruh sistem (§5.6) */
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

/* Pengerasan permukaan sentuh POS (§5.7) */
.pos-root {
  overscroll-behavior: none;              /* mematikan pull-to-refresh */
  -webkit-tap-highlight-color: transparent;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.pos-root button,
.pos-root [role="button"] {
  touch-action: manipulation;             /* mematikan double-tap zoom */
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

> **Verifikasi sebelum implementasi** — sejalan dengan [05 §0.5](05-frontend-architecture-design.md): pastikan Tailwind v4 pada versi terpasang benar-benar membangkitkan utility `p-touch` / `min-h-touch-lg` dari kunci `--spacing-*` bernama. Bila tidak, ganti dengan nilai arbitrer (`min-h-[3.5rem]`) dan pertahankan token CSS-nya sebagai satu-satunya sumber angka. Token warna, radius, dan shadow tidak punya keraguan ini.

### 1.5 Kontras & aksesibilitas — angka nyata

Rasio dihitung terhadap WCAG 2.1. **Ambang:** 4.5:1 teks normal · 3:1 teks besar (≥ 24 px, atau ≥ 18.66 px bold) dan komponen UI.

| Kombinasi | Rasio | Status | Aturan pakai |
|---|---:|---|---|
| `navy-950 #0F172A` di atas `white` | **17.85:1** | ✅ AAA | Teks utama |
| `navy-900 #1E293B` di atas `white` | **14.63:1** | ✅ AAA | Teks di kartu gelap-terang |
| `slate-600 #475569` di atas `slate-50` | **7.24:1** | ✅ AAA | Teks sekunder |
| `slate-500 #64748B` di atas `slate-50` | **4.55:1** | ✅ AA | *Placeholder* / teks tersier — **jangan** untuk nominal |
| `white` di atas `blue-600 #2563EB` | **5.17:1** | ✅ AA | Label tombol aksi utama, semua ukuran |
| `white` di atas `cyan-600 #0284C7` | **4.10:1** | ⚠️ **Gagal AA normal** | **Hanya** untuk teks besar ≥ 24 px, ikon, dan border. Dilarang untuk label tombol kecil |
| `white` di atas `emerald-600 #059669` | **3.77:1** | ⚠️ Lulus AA-large saja | Boleh untuk label **BAYAR TUNAI** (≥ 22 px bold). **Dilarang** untuk teks ≤ 18 px |
| `white` di atas `emerald-700 #047857` | **5.48:1** | ✅ AA | Badge sukses kecil, teks hijau di atas latar hijau |
| `white` di atas `red-600 #DC2626` | **4.83:1** | ✅ AA | Label tombol Void/Hapus |
| `white` di atas `amber-600 #D97706` | **3.19:1** | ❌ **Gagal** | **Dilarang.** Badge amber wajib memakai teks `navy-950` |
| `navy-950` di atas `amber-600` | **6.45:1** | ✅ AA | **Pola resmi badge peringatan** |

**Tiga aturan yang lahir dari tabel ini — bukan preferensi, melainkan konsekuensi:**

1. **Amber tidak pernah membawa teks putih.** Badge stok minus dan banner peringatan memakai `bg-warning text-fg` (navy di atas amber) atau `bg-warning-subtle text-warning-text`.
2. **Emerald putih hanya untuk teks besar.** Tombol `BAYAR TUNAI` memenuhi syarat (22 px bold). Untuk badge kecil "LUNAS", gunakan `bg-success-subtle text-success-text`.
3. **Cyan bukan warna tombol.** `#0284C7` dipakai untuk ikon status, garis grafik, dan tautan pada latar terang (`text-info` di atas `slate-50` = 4.10:1 — tetap di bawah ambang, sehingga tautan wajib **digarisbawahi**, tidak hanya diberi warna).

**Ketergantungan warna dilarang berdiri sendiri.** Setiap status wajib punya penanda kedua (ikon, teks, atau bentuk) — 8 % pria mengalami defisiensi penglihatan warna merah-hijau, dan sistem ini membedakan "lunas" (hijau) dari "gagal" (merah) pada layar yang sama:

| Status | Warna | Penanda kedua (wajib) |
|---|---|---|
| Tersinkronisasi | `success` | Ikon centang + teks "Tersinkron" |
| Menunggu antrean | `warning` | Ikon jam + angka antrean |
| Gagal sinkron | `danger` | Ikon segitiga seru + teks "Gagal" |
| Offline | `fg-muted` | Ikon awan-tercoret + teks "Offline" |

### 1.6 Mode gelap — dikunci mati untuk POS

Blok `@media (prefers-color-scheme: dark)` pada scaffold **wajib dihapus**. Alasannya operasional, bukan estetis:

- Perangkat POS berada di bawah pencahayaan toko yang terang; tema gelap menurunkan keterbacaan nominal dan meningkatkan pantulan pada layar tablet berlapis kaca.
- Tema yang berubah mengikuti preferensi sistem membuat kasir melihat antarmuka berbeda antar-perangkat pada satu outlet — sumber kebingungan pelatihan.
- Struk cetak dan layar harus tampak konsisten.

`html { color-scheme: light }` mengunci ini termasuk untuk kontrol bawaan peramban (scrollbar, kalender, autofill).

> **Admin Dashboard** boleh mendapat mode gelap di kemudian hari; arsitektur tiga lapis di §1.1 membuatnya cukup dengan menambahkan blok `:root[data-theme="dark"]` yang menimpa **Lapis 2 saja**. Di luar lingkup v1.

---

## 2. Touch Target & Typography Rules (Standar POS Ritel)

### 2.1 Fat-Finger Proof Standard

Ukuran diturunkan dari **konsekuensi kesalahan**, bukan dari kepadatan visual. Semakin sulit sebuah aksi dibatalkan, semakin besar targetnya.

| Kelas | Ukuran minimum | Token | Dipakai untuk | Konsekuensi salah tekan |
|---|---|---|---|---|
| **Kritis** | **72 × 72 px** | `--spacing-touch-xl` | Preset Fast-Cash, tombol `BAYAR` di modal | Nominal/kembalian salah — uang fisik keluar salah |
| **Utama** | **64 px tinggi** | `--spacing-touch-lg` | Tombol Bayar di CartPanel, Konfirmasi transaksi | Transaksi terkirim prematur |
| **Sering** | **56 × 56 px** | `--spacing-touch-md` | Numpad, keypad PIN, stepper qty `+`/`−`, tab kategori | Kuantitas salah — terkoreksi, tapi memperlambat |
| **Standar** | **48 × 48 px** | `--spacing-touch` | **Batas bawah absolut.** Ikon toolbar, tombol tutup, baris daftar | Navigasi salah — mudah dibatalkan |
| **Admin desktop** | 40 px tinggi | — | Kontrol Dashboard yang dioperasikan dengan tetikus | Tidak berlaku standar sentuh |

**Aturan tambahan yang menyertai ukuran:**

- **Target ≠ visual.** Ikon boleh berukuran 20 px selama area sentuhnya 48 px. Gunakan *padding*, bukan pembesaran ikon. Bila tidak memungkinkan, pakai pseudo-elemen:
  ```css
  .hit-48::after { content:""; position:absolute; inset:50% auto auto 50%;
                   width:3rem; height:3rem; transform:translate(-50%,-50%); }
  ```
- **Jarak antar target ≥ 8 px**, dan **≥ 24 px bila salah satunya destruktif**. Tombol `Void` tidak pernah bersebelahan langsung dengan `Bayar`.
- **Tidak ada aksi destruktif di tepi layar** yang bisa tersentuh telapak tangan saat memegang tablet. `Kosongkan Keranjang` diletakkan di header panel, bukan di sudut bawah.
- **Tidak ada `hover` sebagai satu-satunya pengungkap.** Kontrol yang hanya muncul saat *hover* tidak pernah muncul di tablet.
- **Zona jempol.** Pada tablet 10" *landscape* yang dipegang dua tangan, aksi paling sering (Bayar, Numpad) berada di **kanan-bawah** — persis di mana panel keranjang berakhir (§3.3).

### 2.2 Pemisahan aksi destruktif

| Pasangan | Pemisahan minimum | Perlindungan tambahan |
|---|---|---|
| `Bayar` ↔ `Kosongkan Keranjang` | Beda area layout (footer vs header panel) | Dialog konfirmasi bila keranjang ≥ 1 item |
| `Bayar` ↔ `Tahan Pesanan` | 24 px + beda bobot warna (emerald solid vs netral *outline*) | — |
| Baris keranjang ↔ tombol hapus baris | Hapus hanya muncul via *swipe* atau setelah baris dipilih | Undo 5 detik lewat Toast |
| `Void Transaksi` (P-10) | Layar terpisah, bukan aksi inline | Wajib isi `cancel_notes` + konfirmasi ganda |

### 2.3 Skala tipografi

Dua skala terpisah: POS (jarak pandang 50–70 cm, sering sambil berdiri) dan Admin (jarak pandang meja).

**Skala POS**

| Token | Ukuran / *line-height* | Bobot | Font | Penggunaan |
|---|---|---|---|---|
| `text-pos-2xl` | 40 / 44 px | 700 | **mono** | Total di modal bayar, nominal kembalian |
| `text-pos-xl` | 28 / 34 px | 700 | **mono** | Total keranjang, saldo shift |
| `text-pos-lg` | 22 / 28 px | 600 | sans / **mono** | Label tombol besar (sans); subtotal (mono) |
| `text-pos-md` | 18 / 26 px | 600 | **mono** | Nominal baris keranjang, harga di tile |
| `text-pos-base` | 16 / 24 px | 500 | sans | Nama produk, teks dasar, isi input |
| `text-pos-sm` | 14 / 20 px | 500 | sans | Label, satuan, nama kategori |
| `text-pos-xs` | 12 / 16 px | 500 | sans / mono | Meta, *timestamp*, nomor transaksi (mono) |

**Skala Admin** — mengikuti skala Tailwind bawaan (`text-sm` … `text-3xl`), dengan satu pengecualian yang tidak bisa ditawar: **setiap sel tabel dan kartu statistik yang berisi nominal tetap memakai `font-mono` + `tabular-nums`.**

**Batas bawah yang tidak boleh dilanggar:**

- Teks apa pun di POS: **≥ 14 px**. Tidak ada `text-[11px]`.
- Nominal uang di POS: **≥ 16 px**. Tidak pernah `fg-subtle`.
- Nama produk pada `ProductTile`: **≥ 16 px**, maksimum 2 baris, dipotong dengan `line-clamp-2` — **bukan** elipsis satu baris (nama produk F&B panjang: *"Kopi Susu Gula Aren Large"*).

### 2.4 Tipografi data keuangan — wajib monospace

**Aturan:** seluruh nominal uang, harga, kuantitas, persentase, nomor transaksi, dan selisih shift **WAJIB** `font-mono` dengan `font-variant-numeric: tabular-nums`.

Alasannya bukan estetika:

1. **Pemindaian kolom.** Digit berlebar sama membuat `Rp 22.000` dan `Rp 220.000` berbeda panjang secara proporsional — kasir mendeteksi kesalahan orde besaran secara visual tanpa membaca.
2. **Tidak ada goyangan.** Total yang berubah dari `Rp 99.000` ke `Rp 100.000` tidak menggeser tata letak. Tanpa `tabular-nums`, angka proporsional membuat total "berdenyut" setiap penambahan item.
3. **Kesejajaran kanan.** Kolom nominal disejajarkan kanan (`text-right`); ini hanya bekerja benar dengan lebar digit tetap.

```tsx
// components/ui/Money.tsx
import { formatIdr } from '@/lib/money'

type MoneyProps = {
  /** Nominal dalam INTEGER SEN (ADR-05). Bukan Rupiah desimal. */
  minor: number
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  tone?: 'default' | 'muted' | 'success' | 'danger'
  /** Menampilkan tanda + / − eksplisit — untuk selisih shift & kembalian. */
  signed?: boolean
}

const SIZE = {
  sm:  'text-pos-sm',  md: 'text-pos-md',  lg: 'text-pos-lg',
  xl:  'text-pos-xl',  '2xl': 'text-pos-2xl',
} as const

const TONE = {
  default: 'text-fg',
  muted:   'text-fg-muted',
  success: 'text-success-text',   // emerald-700 — lulus AA di latar terang (§1.5)
  danger:  'text-danger',
} as const

export function Money({ minor, size = 'md', tone = 'default', signed }: MoneyProps) {
  const sign = signed && minor > 0 ? '+' : ''
  return (
    <span
      className={`font-mono tabular-nums font-semibold whitespace-nowrap ${SIZE[size]} ${TONE[tone]}`}
      // Pembaca layar membaca nominal sebagai kalimat utuh, bukan "R-p titik"
      aria-label={`${sign}${formatIdr(minor)}`}
    >
      {sign}{formatIdr(minor)}
    </span>
  )
}
```

> **Verifikasi font.** Geist Mono sudah terpasang di [app/layout.tsx](../posgodinov-fe/app/layout.tsx) sebagai `--font-geist-mono` dan mendukung `tabular-nums`. Bila tim menginginkan **nol bergaris** (`0` vs `O`) — berguna pada struk dan nomor transaksi — periksa dulu ketersediaan *feature tag* pada versi Geist Mono yang terpasang sebelum menambahkan `font-feature-settings`. Jangan menyalin tag OpenType dari font lain; bila tidak tersedia, opsi ini dilewati tanpa konsekuensi fungsional.

### 2.5 Integer sen → Rupiah: aturan tampilan

State klien menyimpan **integer sen** ([05 ADR-05](05-frontend-architecture-design.md)). Seluruh lapisan tampilan menerima sen dan mengonversinya di satu tempat: `formatIdr()` ([05 §1.8.1](05-frontend-architecture-design.md)).

```ts
// lib/money/index.ts — sudah didefinisikan di doc 05, dikutip di sini sebagai kontrak UI
export const formatIdr = (minor: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(minor / 100)
```

**Tabel konversi tampilan** — inilah yang harus dilihat kasir:

| Nilai state (sen) | `toMajor()` | `formatIdr()` | Tampil di UI | Catatan |
|---:|---:|---|---|---|
| `2_200_000` | `22000` | `"Rp 22.000"` | `Rp 22.000` | Harga produk standar |
| `0` | `0` | `"Rp 0"` | `Rp 0` | **Bukan** `"-"`, bukan string kosong |
| `4_700_000` | `47000` | `"Rp 47.000"` | `Rp 47.000` | Total keranjang |
| `300_000` | `3000` | `"Rp 3.000"` | `Rp 3.000` | Kembalian |
| `-1_500_000` | `-15000` | `"-Rp 15.000"` | `−Rp 15.000` | Selisih shift kurang → `tone="danger"` |
| `1_500_000` | `15000` | `"Rp 15.000"` | `+Rp 15.000` | Selisih shift lebih → `signed`, `tone="success"` |
| `123_456_789_00` | `123456789` | `"Rp 123.456.789"` | `Rp 123.456.789` | Ringkasan Dashboard |

**Enam aturan tampilan nominal:**

1. **Tanpa desimal.** `maximumFractionDigits: 0`. Sen tidak pernah ditampilkan — ia adalah detail representasi internal, bukan realitas Rupiah.
2. **Pemisah ribuan adalah titik.** Dijamin oleh locale `id-ID`. Jangan pernah memformat manual dengan `replace`.
3. **Nol ditampilkan sebagai `Rp 0`.** Placeholder `-` menciptakan ambiguitas antara "nol" dan "tidak diketahui".
4. **Nilai negatif memakai minus tipografis `−` (U+2212)**, bukan tanda hubung, dan selalu berpasangan dengan `tone="danger"`. `Intl` menghasilkan `-Rp`; komponen `Money` menormalkannya.
5. **Tidak ada singkatan pada layar kasir.** `Rp 1,2jt` dilarang di POS. Singkatan hanya boleh pada **sumbu grafik** Dashboard, tidak pernah pada kartu statistik atau tabel.
6. **Konversi hanya di tiga titik** ([05 §1.8.1](05-frontend-architecture-design.md)): batas API masuk, batas API keluar, dan `formatIdr()`. Komponen UI **tidak pernah** melakukan aritmetika uang — ia menerima hasil dari `cart-math.ts` / `shift-math.ts`.

### 2.6 Angka non-uang

| Jenis | Format | Font | Contoh |
|---|---|---|---|
| Kuantitas keranjang | Bilangan bulat, tanpa pemisah | mono | `3` |
| Kuantitas bahan baku | Hingga 4 desimal, *trailing zero* dibuang | mono | `1,5` · `0,0625` |
| Persentase margin | 1 desimal + `%` | mono | `62,5%` |
| Waktu transaksi | `HH:mm` (24 jam) | mono | `14:32` |
| Tanggal | `dd MMM yyyy` (`date-fns` locale `id`) | sans | `10 Agu 2026` |
| Nomor transaksi (UUID) | 8 karakter pertama, huruf besar | mono | `A3F91C2D` |
| Antrean sinkronisasi | Bilangan bulat; `99+` bila > 99 | mono | `12` · `99+` |

---

## 3. Layout Architecture & ASCII Wireframes

### 3.1 Target perangkat & *breakpoint*

| Target | Resolusi acuan | Orientasi | Prioritas | Tata letak |
|---|---|---|---|---|
| **Tablet 10"** | 1280 × 800 | *Landscape* **wajib** | **P0 — target utama POS** | Split-screen 62 / 38 |
| **Desktop kasir** | 1920 × 1080 | — | P1 | Rail ikon + split-screen 65 / 35 (keranjang dikunci 420 px) |
| **Laptop Admin** | 1440 × 900 | — | P0 untuk `/admin` | Sidebar + konten |
| **Tablet 8"** | 1024 × 768 | *Landscape* | P2 | Split-screen 60 / 40, grid 3 kolom |
| **Portrait / ponsel** | < 900 px lebar | — | P3 — *degraded* | Keranjang menjadi *bottom sheet* (§3.7) |

```css
/* Breakpoint kustom — didaftarkan di @theme agar tersedia sebagai varian */
--breakpoint-pos-sm: 1024px;   /* tablet 8"  */
--breakpoint-pos-md: 1280px;   /* tablet 10" — acuan utama */
--breakpoint-pos-lg: 1600px;   /* desktop kasir */
```

> **Orientasi.** POS dirancang **landscape-only**. Pada portrait, tampilkan overlay "Putar perangkat ke posisi mendatar" alih-alih memaksakan tata letak yang tidak pernah diuji. Kunci orientasi lewat `orientation: "landscape"` di [app/manifest.ts](../posgodinov-fe/app/manifest.ts) — efektif saat POS dipasang sebagai PWA *standalone*.

### 3.2 Sistem grid POS

| Properti | Tablet 10" (1280) | Desktop (1920) | Tablet 8" (1024) |
|---|---|---|---|
| Rail ikon kiri | — (menu di StatusBar) | 72 px | — |
| Panel produk | 62 % ≈ 790 px | *fluid*, sisa lebar | 60 % ≈ 614 px |
| Panel keranjang | 38 % ≈ 490 px | **dikunci 420 px** | 40 % ≈ 410 px |
| Kolom grid produk | **4** | **6** | **3** |
| Ukuran tile | ~176 × 150 px | ~180 × 150 px | ~186 × 150 px |
| *Gutter* grid | 12 px | 12 px | 10 px |
| *Padding* panel | 16 px | 20 px | 12 px |

**Mengapa keranjang dikunci 420 px di desktop:** panel keranjang tidak menjadi lebih berguna saat melebar — ia hanya menambah jarak pandang antara nama item dan nominalnya. Lebar berlebih dialokasikan ke grid produk, yang benar-benar mendapat manfaat dari kolom tambahan.

### 3.3 Wireframe — Web POS Client, Tablet 10" (1280 × 800)

Layar **P-05 Kasir Utama** ([04 §A.1](04-frontend-mobile-web-requirements.md)) — tampilan default sepanjang shift.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ StatusBar                                                              h-14 (56px) · bg-brand  │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [=] GODINOV   Outlet Sudirman  |  (o) Online  (^)3 antre  |  Siti A.  |  Shift 08:02  10:47│ │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┬─────────────────────────────────────┤
│  PANEL PRODUK                              62% (790px)   │  PANEL KERANJANG      38% (490px)   │
│                                                          │                                     │
│  ┌────────────────────────────────────────────┐ ┌──────┐ │  ┌───────────────────────────────┐  │
│  │ (Q)  Cari produk atau pindai barcode  [F2] │ │ (::) │ │  │ KERANJANG        3 item  [Bsh]│  │
│  └────────────────────────────────────────────┘ └──────┘ │  └───────────────────────────────┘  │
│   h-14 · rounded-lg · border-border · bg-surface   56px  │   h-12 · border-b border-border     │
│                                                          │                                     │
│  ┌──────┐┌────────┐┌────────┐┌────────┐┌──────┐┌──────┐  │  ┌───────────────────────────────┐  │
│  │ SMUA ││ Kopi   ││ Non-   ││ Makanan││Snack ││ >    │  │  │ Kopi Susu Gula Aren           │  │
│  │ 128  ││  42    ││ Kopi 31││   38   ││  17  ││      │  │  │ Rp 22.000 x 2                 │  │
│  └──────┘└────────┘└────────┘└────────┘└──────┘└──────┘  │  │  [-]  2  [+]        Rp 44.000 │  │
│   tab aktif: bg-accent-subtle · text-accent · h-12       │  │  + Catatan: less sugar        │  │
│                                                          │  └───────────────────────────────┘  │
│  ┌────────────┐┌────────────┐┌────────────┐┌───────────┐ │  ┌───────────────────────────────┐  │
│  │            ││            ││            ││           │ │  │ Croissant Butter              │  │
│  │  Kopi Susu ││  Americano ││  Latte     ││ Cappuccino│ │  │ Rp 18.000 x 1                 │  │
│  │  Gula Aren ││            ││  Hazelnut  ││           │ │  │  [-]  1  [+]        Rp 18.000 │  │
│  │            ││            ││            ││           │ │  │  + Tambah catatan             │  │
│  │  Rp 22.000 ││  Rp 18.000 ││  Rp 26.000 ││ Rp 24.000 │ │  └───────────────────────────────┘  │
│  └────────────┘└────────────┘└────────────┘└───────────┘ │  ┌───────────────────────────────┐  │
│   176x150 · rounded-xl · bg-surface · shadow-card        │  │ Es Teh Manis                  │  │
│                                                          │  │ Rp 8.000 x 1                  │  │
│  ┌────────────┐┌────────────┐┌────────────┐┌───────────┐ │  │  [-]  1  [+]         Rp 8.000 │  │
│  │            ││            ││            ││           │ │  └───────────────────────────────┘  │
│  │  Es Teh    ││  Croissant ││  Roti Bakar││ Kentang   │ │                                     │
│  │  Manis     ││  Butter    ││  Coklat    ││ Goreng    │ │   (area gulir · flex-1)             │
│  │            ││            ││            ││           │ │                                     │
│  │  Rp  8.000 ││  Rp 18.000 ││  Rp 15.000 ││ Rp 20.000 │ │                                     │
│  └────────────┘└────────────┘└────────────┘└───────────┘ │                                     │
│                                                          ├─────────────────────────────────────┤
│  ┌────────────┐┌────────────┐┌────────────┐┌───────────┐ │  RINGKASAN            bg-bg-muted   │
│  │            ││            ││            ││           │ │  Subtotal (4 item)      Rp 70.000   │
│  │  Nasi Ayam ││  Mie Goreng││  Pisang    ││ Air       │ │  ─────────────────────────────────  │
│  │  Geprek    ││  Spesial   ││  Goreng    ││ Mineral   │ │  TOTAL                  Rp 70.000   │
│  │            ││            ││            ││           │ │                       28px mono/700 │
│  │  Rp 28.000 ││  Rp 25.000 ││  Rp 12.000 ││ Rp  5.000 │ │                                     │
│  └────────────┘└────────────┘└────────────┘└───────────┘ │  ┌─────────────┐ ┌───────────────┐  │
│                                                          │  │   TAHAN     │ │  Pesanan      │  │
│         (gulir vertikal · scroll-snap opsional)          │  │   [F4]      │ │  Ditahan (2)  │  │
│                                                          │  └─────────────┘ └───────────────┘  │
│                                                          │        h-14 · outline · netral      │
│                                                          │  ┌───────────────────────────────┐  │
│                                                          │  │                               │  │
│                                                          │  │      BAYAR  ·  Rp 70.000      │  │
│                                                          │  │           [Space]             │  │
│                                                          │  └───────────────────────────────┘  │
│                                                          │   h-16 (64px) · bg-accent · 22px    │
└──────────────────────────────────────────────────────────┴─────────────────────────────────────┘
   Legenda:  (o) status koneksi   (^) antrean sync   (Q) ikon cari   (::) menu   [Bsh] Kosongkan
```

**Keputusan tata letak yang perlu dipahami tim:**

| Keputusan | Alasan |
|---|---|
| Pencarian **di atas** tab kategori | Pencarian adalah jalur tercepat untuk kasir berpengalaman; tab kategori adalah jalur untuk kasir baru. Yang tercepat diletakkan paling mudah dijangkau |
| Tab kategori dapat digulir horizontal dengan tombol `>` | Jumlah kategori tidak dibatasi backend; tab tidak boleh membungkus ke baris kedua karena akan menggeser grid |
| Total memakai `bg-bg-muted`, bukan putih | Memisahkan zona "angka final" dari zona "daftar item" secara visual tanpa garis tebal |
| `TAHAN` dan `BAYAR` beda baris | §2.2 — pemisahan aksi. `TAHAN` netral *outline*; `BAYAR` emerald/aksen solid |
| Nominal `Rp 70.000` diulang **di dalam** tombol Bayar | Konfirmasi terakhir sebelum modal terbuka; menghilangkan satu gerakan mata |
| Tidak ada indikator stok di tile | [03 §sync master-data](03-api-specifications.md) — master data POS tidak memuat stok |

### 3.4 Wireframe — Web POS Client, Desktop (1920 × 1080)

Perbedaan dari tablet: **rail ikon kiri 72 px** menggantikan menu *hamburger*, grid menjadi **6 kolom**, keranjang **dikunci 420 px**.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [=] GODINOV  Outlet Sudirman  |  (o) Online  (^) 3 antre menunggu  |  Kasir: Siti A.  |  Shift 08:02  10:47  │
├──────┬──────────────────────────────────────────────────────────────────────┬────────────────────────────────┤
│RAIL  │  ┌──────────────────────────────────────────────┐  ┌─────────┐       │ KERANJANG   3 item  [Kosongkan]│
│72px  │  │ (Q)  Cari produk atau pindai barcode    [F2] │  │ Filter  │       ├────────────────────────────────┤
│      │  └──────────────────────────────────────────────┘  └─────────┘       │ ┌────────────────────────────┐ │
│ [#]  │ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌───┐│ │ Kopi Susu Gula Aren        │ │
│Kasir │ │SEMUA ││ Kopi ││N-Kopi││Makann││Snack ││Desert││Paket ││Rokok ││ > ││ │ Rp 22.000 x 2              │ │
│      │ │ 128  ││  42  ││  31  ││  38  ││  17  ││   9  ││   6  ││   4  ││   ││ │  [-]  2  [+]     Rp 44.000 │ │
│ [H]  │ └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└───┘│ │  + less sugar              │ │
│Tahan │                                                                      │ └────────────────────────────┘ │
│ (2)  │                                                                      │ ┌────────────────────────────┐ │
│ [R]  │  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐        │ │ Croissant Butter           │ │
│Riwyt │  │Kopi    ││Ameri-  ││Latte   ││Cappu-  ││Es Teh  ││Croiss- │        │ │ Rp 18.000 x 1              │ │
│      │  │Susu    ││cano    ││Hazel-  ││ccino   ││Manis   ││ant     │        │ │  [-]  1  [+]     Rp 18.000 │ │
│ [W]  │  │Aren    ││        ││nut     ││        ││        ││Butter  │        │ └────────────────────────────┘ │
│Waste │  │Rp22.000││Rp18.000││Rp26.000││Rp24.000││Rp 8.000││Rp18.000│        │ ┌────────────────────────────┐ │
│      │  └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘        │ │ Es Teh Manis               │ │
│ [S]  │  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐        │ │ Rp 8.000 x 1               │ │
│Sync  │  │Roti    ││Kentang ││Nasi    ││Mie     ││Pisang  ││Air     │        │ │  [-]  1  [+]      Rp 8.000 │ │
│ (3)  │  │Bakar   ││Goreng  ││Ayam    ││Goreng  ││Goreng  ││Mineral │        │ └────────────────────────────┘ │
│ [*]  │  │Coklat  ││        ││Geprek  ││Spesial ││        ││        │        │                                │
│Set   │  │Rp15.000││Rp20.000││Rp28.000││Rp25.000││Rp12.000││Rp 5.000│        │        (area gulir)            │
│      │  └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘        │                                │
├──────┤                                                                      ├────────────────────────────────┤
│ [X]  │  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐        │ Subtotal (4 item)   Rp 70.000  │
│Tutup │  │Teh     ││Matcha  ││Red     ││Lemon   ││Soda    ││Coklat  │        │ ─────────────────────────────  │
│Shift │  │Tarik   ││Latte   ││Velvet  ││Tea     ││Gembira ││Panas   │        │ TOTAL               Rp 70.000  │
│      │  │        ││        ││        ││        ││        ││        │        │                                │
│      │  │Rp16.000││Rp27.000││Rp30.000││Rp14.000││Rp13.000││Rp17.000│        │ ┌─────────┐  ┌───────────────┐ │
│      │  └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘        │ │  TAHAN  │  │  Ditahan (2)  │ │
│      │                                                                      │ └─────────┘  └───────────────┘ │
│      │            (gulir vertikal)                                          │ ┌────────────────────────────┐ │
│      │                                                                      │ │   BAYAR  ·  Rp 70.000      │ │
│      │                                                                      │ │        [Space]             │ │
│      │                                                                      │ └────────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────────────────────┴────────────────────────────────┘
  Rail (72px): [#] Kasir · [H] Pesanan Ditahan · [R] Riwayat · [W] Lapor Waste · [S] Sinkronisasi
               [*] Pengaturan · [X] Tutup Shift.  Ikon 24px di dalam target 72x72.
  Aktif = bg-accent-subtle + garis kiri 3px accent.  Badge (2)/(3) = bg-warning text-fg (§1.5).
  Nama produk dipotong di sini hanya demi ASCII; UI asli memakai line-clamp-2 (§2.3).
```

### 3.5 Wireframe — PaymentModal (P-06)

Overlay di atas P-05. **Keranjang tetap terlihat** di belakang *scrim* — kasir dapat memverifikasi tanpa menutup modal.

```text
        ┌──────────────────────────────────────────────────────────────────────┐
        │  PEMBAYARAN                                                     [X]  │  h-16
        │  3 item · Kopi Susu Gula Aren, Croissant Butter, Es Teh Manis        │  text-sm muted
        ├──────────────────────────────────────────────────────────────────────┤
        │                                                                      │
        │   TOTAL TAGIHAN                                                      │
        │   ┌────────────────────────────────────────────────────────────────┐ │
        │   │                                                  Rp 70.000     │ │  40px mono/700
        │   └────────────────────────────────────────────────────────────────┘ │
        │                                                                      │
        │   METODE PEMBAYARAN                                                  │
        │   ┌──────────────┐┌──────────────┐┌──────────────┐┌────────────────┐ │
        │   │    TUNAI     ││    QRIS      ││ KARTU DEBIT  ││ TRANSFER BANK  │ │  h-14 (56px)
        │   │    CASH      ││              ││              ││                │ │  4 kolom
        │   └──────────────┘└──────────────┘└──────────────┘└────────────────┘ │
        │    ^ terpilih: border-accent 2px · bg-accent-subtle · text-accent    │
        │                                                                      │
        │  ┌─────────────────────────────────────┬──────────────────────────┐  │
        │  │  UANG DITERIMA                      │   NUMPAD                 │  │
        │  │  ┌───────────────────────────────┐  │  ┌──────┐┌──────┐┌─────┐ │  │
        │  │  │                   Rp 100.000  │  │  │  1   ││  2   ││  3  │ │  │  56x56
        │  │  └───────────────────────────────┘  │  └──────┘└──────┘└─────┘ │  │
        │  │   h-16 · mono 40px · text-right     │  ┌──────┐┌──────┐┌─────┐ │  │
        │  │                                     │  │  4   ││  5   ││  6  │ │  │
        │  │  ┌───────────────────────────────┐  │  └──────┘└──────┘└─────┘ │  │
        │  │  │      UANG PAS  ·  Rp 70.000   │  │  ┌──────┐┌──────┐┌─────┐ │  │
        │  │  └───────────────────────────────┘  │  │  7   ││  8   ││  9  │ │  │
        │  │   h-18 (72px) · border-accent       │  └──────┘└──────┘└─────┘ │  │
        │  │                                     │  ┌──────┐┌──────┐┌─────┐ │  │
        │  │  ┌─────────┐┌─────────┐┌──────────┐ │  │ 000  ││  0   ││ <-  │ │  │
        │  │  │ Rp 75rb ││ Rp 80rb ││ Rp 100rb │ │  └──────┘└──────┘└─────┘ │  │
        │  │  └─────────┘└─────────┘└──────────┘ │   <- = hapus 1 digit     │  │
        │  │   pembulatan cerdas · h-18 (72px)   │                          │  │
        │  │                                     │  ┌─────────────────────┐ │  │
        │  │  ┌─────────┐┌─────────┐┌──────────┐ │  │       C  Hapus      │ │  │
        │  │  │ Rp 20rb ││ Rp 50rb ││ Rp 100rb │ │  └─────────────────────┘ │  │
        │  │  └─────────┘└─────────┘└──────────┘ │   h-14 · text-danger     │  │
        │  │   pecahan tetap (nonaktif jika      │                          │  │
        │  │   nilai < total)                    │                          │  │
        │  └─────────────────────────────────────┴──────────────────────────┘  │
        │                                                                      │
        │   ┌────────────────────────────────────────────────────────────────┐ │
        │   │  KEMBALIAN                                        Rp 30.000    │ │  bg-success-subtle
        │   └────────────────────────────────────────────────────────────────┘ │  40px mono · emerald-700
        │                                                                      │
        ├──────────────────────────────────────────────────────────────────────┤
        │  ┌──────────────────┐        ┌──────────────────────────────────────┐│
        │  │   BATAL  [Esc]   │        │   SELESAIKAN & CETAK STRUK  [Enter]  ││  h-16 (64px)
        │  └──────────────────┘        └──────────────────────────────────────┘│  bg-success
        └──────────────────────────────────────────────────────────────────────┘
             ^ netral outline               ^ emerald solid · label 22px bold (§1.5)

  Lebar modal 920px · rounded-2xl · shadow-overlay · scrim rgb(15 23 42 / 0.45)
  Untuk QRIS/DEBIT/TRANSFER: blok "UANG DITERIMA + Numpad + Fast-Cash" DIGANTI oleh
  blok "Nominal dibayar = Total (terkunci)" + input opsional nomor referensi.
```

### 3.6 Wireframe — Login Kasir (P-03)

100 % offline, verifikasi bcrypt di Web Worker ([05 ADR-08](05-frontend-architecture-design.md)).

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [=] GODINOV   Outlet Sudirman        (o) Online   (^) 0 antre        10:47       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                    ┌──────────────────────────────────────────┐                  │
│                    │            MASUK SEBAGAI KASIR           │                  │
│                    ├──────────────────────────────────────────┤                  │
│                    │  ID / Username Staff                     │                  │
│                    │  ┌────────────────────────────────────┐  │                  │
│                    │  │ siti.a                             │  │  h-14            │
│                    │  └────────────────────────────────────┘  │                  │
│                    │                                          │                  │
│                    │  PIN  (4–6 digit)                        │                  │
│                    │  ┌────────────────────────────────────┐  │                  │
│                    │  │      *    *    *    *    _    _    │  │  slot 4–6        │
│                    │  └────────────────────────────────────┘  │                  │
│                    │                                          │                  │
│                    │      ┌──────┐  ┌──────┐  ┌──────┐        │                  │
│                    │      │  1   │  │  2   │  │  3   │        │  56x56           │
│                    │      └──────┘  └──────┘  └──────┘        │                  │
│                    │      ┌──────┐  ┌──────┐  ┌──────┐        │                  │
│                    │      │  4   │  │  5   │  │  6   │        │                  │
│                    │      └──────┘  └──────┘  └──────┘        │                  │
│                    │      ┌──────┐  ┌──────┐  ┌──────┐        │                  │
│                    │      │  7   │  │  8   │  │  9   │        │                  │
│                    │      └──────┘  └──────┘  └──────┘        │                  │
│                    │      ┌──────┐  ┌──────┐  ┌──────┐        │                  │
│                    │      │  C   │  │  0   │  │  <-  │        │                  │
│                    │      └──────┘  └──────┘  └──────┘        │                  │
│                    │                                          │                  │
│                    │  ┌────────────────────────────────────┐  │                  │
│                    │  │              MASUK                 │  │  h-16 · accent   │
│                    │  └────────────────────────────────────┘  │                  │
│                    │                                          │                  │
│                    │  Lupa PIN? Hubungi pemilik untuk         │  text-sm muted   │
│                    │  membuat ulang akun staff.               │  (tak ada reset) │
│                    └──────────────────────────────────────────┘                  │
│                       lebar 420px · bg-surface · shadow-elevated                 │
└──────────────────────────────────────────────────────────────────────────────────┘
  Catatan: verifikasi bcrypt berjalan di Web Worker; tombol MASUK menampilkan
  spinner inline 100–300 ms dan DINONAKTIFKAN selama proses (ADR-08).
  Tidak ada tautan "Reset PIN" — endpointnya tidak ada ([05 §3.5]).
```

### 3.7 Fallback portrait / layar sempit (< 900 px)

```text
┌──────────────────────────────┐        Keranjang menjadi bottom sheet:
│ StatusBar (ringkas)          │        • Tersembunyi → hanya bar ringkasan 72px
├──────────────────────────────┤          yang menempel di bawah
│ (Q) Cari produk         [F2] │        • Ketuk bar → sheet naik menutupi 85% layar
├──────────────────────────────┤        • Prinsip #2 (keranjang tidak pernah hilang)
│ [SEMUA][Kopi][Makanan] >     │          dipertahankan lewat bar ringkasan permanen
├──────────────────────────────┤
│ ┌────────┐┌────────┐         │        ┌──────────────────────────────┐
│ │        ││        │         │        │  ^  3 item        Rp 70.000  │  ← bar 72px
│ │Kopi    ││Americano│        │        │ ┌──────────────────────────┐ │
│ │Susu    ││        │         │        │ │   BAYAR  ·  Rp 70.000    │ │
│ │Rp22.000││Rp18.000│         │        │ └──────────────────────────┘ │
│ └────────┘└────────┘         │        └──────────────────────────────┘
│ ┌────────┐┌────────┐         │
│ │Latte   ││Es Teh  │         │        Ini adalah mode DEGRADED. Overlay
│ │Hazelnut││Manis   │         │        "putar perangkat" tetap muncul lebih
│ │Rp26.000││Rp 8.000│         │        dulu pada tablet; fallback ini hanya
│ └────────┘└────────┘         │        untuk ponsel yang benar-benar sempit.
│      (gulir)                 │
├──────────────────────────────┤
│  ^  3 item        Rp 70.000  │  ← bar ringkasan permanen
│ ┌──────────────────────────┐ │
│ │   BAYAR  ·  Rp 70.000    │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 3.8 Wireframe — Admin Dashboard (D-03)

Sidebar dapat diciutkan + header + **Global Outlet Switcher** + area konten.

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                    h-16 · bg-surface       │
│ ┌───────────────────┬─────────────────────────────────────────────────────────────────────────┐   │
│ │ [<] GODINOV       │  ┌──────────────────────────┐          (?)  (!)3   ┌──────────────────┐ │   │
│ │                   │  │ OUTLET: Sudirman     [v] │                      │ Budi S.   [v]    │ │   │
│ │                   │  └──────────────────────────┘                      └──────────────────┘ │   │
│ └───────────────────┴─────────────────────────────────────────────────────────────────────────┘   │
├───────────────────┬───────────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR   264px   │  KONTEN                                                        bg-bg          │
│ (ciut → 72px)     │                                                                               │
│                   │  Dashboard                                    ┌──────────────────────────┐    │
│ ┌───────────────┐ │  Ringkasan penjualan Outlet Sudirman          │ 7 Hari Terakhir      [v] │    │
│ │ [#] Dashboard │ │                                               └──────────────────────────┘    │
│ └───────────────┘ │                                                (preset maks. 7 hari)          │
│   ^ aktif:        │                                                                               │
│   bg-accent-      │  ┌─────────────────────────────────────────────────────────────────────────┐  │
│   subtle +        │  │ (!) Laporan dikelompokkan berdasarkan waktu data DITERIMA SERVER, bukan │  │
│   garis kiri 3px  │  │     waktu transaksi terjadi di kasir. Transaksi offline yang baru       │  │
│                   │  │     tersinkronisasi akan muncul pada tanggal sinkronisasi.              │  │
│ [O] Outlet        │  └─────────────────────────────────────────────────────────────────────────┘  │
│ [P] Staff         │   bg-warning-subtle · border-l-4 border-warning · text-fg (§1.5)              │
│                   │                                                                               │
│ PRODUK            │  ┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐             │
│ [C] Kategori      │  │ TOTAL PENJUAL││ TRANSAKSI    ││ RATA-RATA    ││ ITEM TERJUAL │             │
│ [B] Produk        │  │              ││              ││              ││              │             │
│ [I] Impor Massal  │  │ Rp 42.850.000││        1.284 ││   Rp 33.372  ││        3.912 │             │
│                   │  │ 32px mono    ││  32px mono   ││  32px mono   ││  32px mono   │             │
│ INVENTARIS        │  │ (+) 12,4%    ││ (+) 8,1%     ││ (+) 4,0%     ││ (+) 9,7%     │             │
│ [R] Bahan Baku (!)│  └──────────────┘└──────────────┘└──────────────┘└──────────────┘             │
│ [+] Restock       │   bg-surface · border-border · rounded-xl · shadow-card                       │
│ [-] Waste         │   delta: emerald-700 naik / red-600 turun + ikon panah (§1.5)                 │
│ [=] Opname        │                                                                               │
│                   │  ┌───────────────────────────────────────────┐┌────────────────────────────┐  │
│ LAPORAN           │  │ TREN PENJUALAN                            ││ 5 PRODUK TERLARIS          │  │
│ [T] Transaksi     │  │                                           ││                            │  │
│ [1] Restock       │  │      .-''-.                               ││ 1 Kopi Susu Aren      412  │  │
│ [2] Waste         │  │   .-'      '-.        .-'                 ││ 2 Croissant Butter    287  │  │
│ [3] Opname        │  │ -'            '-.  .-'                    ││ 3 Es Teh Manis        265  │  │
│                   │  │                  ''                       ││ 4 Nasi Ayam Geprek    198  │  │
│ ───────────────── │  │ Sen Sel Rab Kam Jum Sab Min               ││ 5 Americano           176  │  │
│ [?] Bantuan       │  │  garis: accent · area: accent 8% alpha    ││    angka: mono tabular     │  │
│ [<] Ciutkan       │  └───────────────────────────────────────────┘└────────────────────────────┘  │
└───────────────────┴───────────────────────────────────────────────────────────────────────────────┘
  Sidebar: bg-surface-inverse · teks fg-inverse · pemisah border-inverse
  (!) pada "Bahan Baku" = titik amber, menandai ada stok minus (§1.5 aturan penanda kedua)
  Outlet Switcher bersifat GLOBAL: mengubahnya me-reset seluruh query ber-scope outlet ([05 §1.2])
```

**Sidebar ciut (72 px)** — hanya ikon; label muncul sebagai *tooltip* setelah 400 ms:

```text
┌──────┐
│ [<]  │   Aturan:
│──────│   • Keadaan ciut disimpan di localStorage per pengguna
│ [#]  │   • Ikon tetap 24px di dalam target 48x48 (§2.1)
│ [O]  │   • Judul grup (PRODUK, INVENTARIS) menjadi garis pemisah 1px
│ [P]  │   • Badge peringatan (titik amber) TETAP terlihat saat ciut —
│──────│     ia adalah penanda status, bukan dekorasi
│ [C]  │   • Otomatis ciut di bawah 1280px
│ [B]  │
│ [I]  │
└──────┘
```

### 3.9 Wireframe — Form Builder BOM (D-11)

Layar tersulit di seluruh sistem ([04 §B.3](04-frontend-mobile-web-requirements.md)). Tata letak dua kolom: form produk di kiri, penyusun resep di kanan, **ringkasan HPP menempel** di bawah.

```text
┌───────────────────┬───────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR           │  Produk  >  Tambah Produk                                                     │
│                   │  ┌─────────────────────────────────────────────────────────────────────────┐  │
│ [#] Dashboard     │  │ INFORMASI PRODUK                                                        │  │
│ [O] Outlet        │  │ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐ │  │
│ [P] Staff         │  │ │ Nama Produk *                   │ │ Kategori                        │ │  │
│                   │  │ │ Kopi Susu Gula Aren             │ │ Kopi                       [v]  │ │  │
│ PRODUK            │  │ └─────────────────────────────────┘ └─────────────────────────────────┘ │  │
│ [C] Kategori      │  │ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐ │  │
│ [B] Produk  <     │  │ │ Harga Jual *                    │ │ URL Gambar (opsional)           │ │  │
│ [I] Impor Massal  │  │ │ Rp             22.000           │ │ https://cdn.../kopi.jpg         │ │  │
│                   │  │ │ mono · text-right · h-12        │ │ (!) tidak ada unggah file       │ │  │
│ INVENTARIS        │  │ └─────────────────────────────────┘ └─────────────────────────────────┘ │  │
│ [R] Bahan Baku (!)│  └─────────────────────────────────────────────────────────────────────────┘  │
│ [+] Restock       │                                                                               │
│ [-] Waste         │  ┌─────────────────────────────────────────────────────────────────────────┐  │
│ [=] Opname        │  │ PENYUSUN RESEP (BOM)                              [+ Tambah Bahan]      │  │
│                   │  ├─────────────────────────────────────────────────────────────────────────┤  │
│ LAPORAN           │  │  BAHAN BAKU              JUMLAH      SATUAN    HPP/SATUAN     SUBTOTAL  │  │
│ [T] Transaksi     │  ├─────────────────────────────────────────────────────────────────────────┤  │
│ [1] Restock       │  │ ┌──────────────────┐ ┌──────────┐   gram      Rp    180    Rp 3.240  [x]│  │
│ [2] Waste         │  │ │ Biji Kopi Arabika│ │    18    │                                       │  │
│ [3] Opname        │  │ └──────────────────┘ └──────────┘                                       │  │
│                   │  │  ^ combobox cari    ^ mono · text-right · h-12                          │  │
│                   │  │ ┌──────────────────┐ ┌──────────┐   ml        Rp     14    Rp 1.680  [x]│  │
│                   │  │ │ Susu UHT Full    │ │   120    │                                       │  │
│                   │  │ └──────────────────┘ └──────────┘                                       │  │
│                   │  │ ┌──────────────────┐ ┌──────────┐   ml        Rp     32    Rp   960  [x]│  │
│                   │  │ │ Gula Aren Cair   │ │    30    │                                       │  │
│                   │  │ └──────────────────┘ └──────────┘                                       │  │
│                   │  │ ┌──────────────────┐ ┌──────────┐   pcs       Rp    450    Rp   450  [x]│  │
│                   │  │ │ Cup Plastik 16oz │ │     1    │                                       │  │
│                   │  │ └──────────────────┘ └──────────┘                                       │  │
│                   │  │                                                                         │  │
│                   │  │  [+ Tambah Bahan]        baris baru fokus otomatis ke combobox          │  │
│                   │  └─────────────────────────────────────────────────────────────────────────┘  │
│                   │                                                                               │
│                   │  ┌─────────────────────────────────────────────────────────────────────────┐  │
│                   │  │ RINGKASAN HPP & MARGIN                          (menempel di bawah)     │  │
│                   │  ├──────────────────┬──────────────────┬──────────────────┬────────────────┤  │
│                   │  │ TOTAL HPP        │ HARGA JUAL       │ MARGIN KOTOR     │ PERSEN MARGIN  │  │
│                   │  │ Rp 6.330         │ Rp 22.000        │ Rp 15.670        │ 71,2%          │  │
│                   │  │ 24px mono        │ 24px mono        │ 24px mono        │ 24px mono      │  │
│                   │  │                  │                  │ emerald-700      │ emerald-700    │  │
│                   │  └──────────────────┴──────────────────┴──────────────────┴────────────────┘  │
│                   │   bg-bg-muted · border-t border-border · sticky bottom-0                      │
│                   │   Margin < 0  →  seluruh blok jadi bg-danger-subtle + teks danger             │
│                   │                                                                               │
│                   │  ┌──────────────┐                          ┌──────────────────────────────┐   │
│                   │  │    BATAL     │                          │      SIMPAN PRODUK           │   │
│                   │  └──────────────┘                          └──────────────────────────────┘   │
└───────────────────┴───────────────────────────────────────────────────────────────────────────────┘
  Aturan BOM Builder:
  • HPP dihitung ulang pada setiap perubahan (debounce 200ms), memakai calculateHpp()
    dari [05 §1.8.1] — akumulasi dulu, bulatkan SEKALI di akhir.
  • Kolom SATUAN dan HPP/SATUAN bersifat READ-ONLY — berasal dari raw_material terpilih.
  • Baris dengan bahan baku berstok negatif diberi titik amber + tooltip, TIDAK diblokir.
  • Combobox bahan baku memfilter yang sudah dipakai di baris lain (tidak boleh duplikat).
  • Persen margin negatif = bg-danger-subtle; ini peringatan, bukan blokir penyimpanan.
```

---

## 4. Interactive Component Specifications

Lokasi berkas mengikuti peta direktori [05 §1.1.2](05-frontend-architecture-design.md): primitif bersama di `components/ui/`, komponen POS di `features/pos/components/`.

### 4.1 Sistem tombol — fondasi seluruh komponen lain

```ts
// components/ui/Button.tsx — varian dengan class-variance-authority
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold ' +
  'transition-[background-color,box-shadow,transform] duration-150 ease-out-pos ' +
  'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      variant: {
        primary:   'bg-accent text-fg-inverse hover:bg-accent-hover shadow-card',
        cash:      'bg-success text-fg-inverse hover:brightness-95 shadow-raised',
        danger:    'bg-danger text-fg-inverse hover:bg-danger-hover shadow-card',
        neutral:   'bg-surface text-fg border border-border-strong hover:bg-bg-muted',
        ghost:     'bg-transparent text-fg-muted hover:bg-bg-muted',
        keypad:    'bg-surface text-fg border border-border text-pos-lg font-mono ' +
                   'hover:bg-bg-muted shadow-card',
      },
      size: {
        sm:  'h-10 px-3 text-pos-sm',                    // Admin desktop saja
        md:  'h-12 px-4 text-pos-base min-w-touch',      // 48px — batas bawah POS
        lg:  'h-14 px-6 text-pos-lg min-w-touch-md',     // 56px — numpad, aksi sering
        xl:  'h-16 px-8 text-pos-lg min-w-touch-lg',     // 64px — aksi utama POS
        cash:'h-18 px-6 text-pos-lg min-w-touch-xl',     // 72px — Fast-Cash
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
)
```

| Varian | Kapan dipakai | Kapan **dilarang** |
|---|---|---|
| `primary` (accent) | Bayar, Simpan, Submit, Masuk | Aksi yang bisa merusak data |
| `cash` (emerald) | **Hanya** `SELESAIKAN & CETAK`, `BAYAR TUNAI` | Aksi non-final; label < 22 px (§1.5) |
| `danger` (crimson) | Void, Hapus, Kosongkan, Batalkan Shift | Tombol "Batal" pada modal — itu netral, bukan destruktif |
| `neutral` | Batal, Tahan, filter, aksi sekunder | Aksi utama |
| `ghost` | Ikon toolbar, tutup modal | Apa pun yang harus ditemukan cepat |
| `keypad` | Numpad, keypad PIN | Di luar konteks input numerik |

> **Perbedaan halus yang sering salah:** tombol **Batal** pada modal memakai `neutral`, bukan `danger`. Merah dicadangkan untuk aksi yang **menghancurkan data yang sudah ada**. Menutup modal tidak menghancurkan apa pun.

### 4.2 `ProductTile`

**Berkas:** `features/pos/components/ProductTile.tsx`

#### 4.2.1 Anatomi

```text
┌────────────────────────┐  ← rounded-xl · bg-surface · border border-border
│ ┌────────────────────┐ │     shadow-card · overflow-hidden · w-full · h-[150px]
│ │                    │ │  ← Zona gambar/inisial: h-[72px] · bg-bg-muted
│ │        KS          │ │     Bila image_url ada  → <img> object-cover
│ │                    │ │     Bila NULL           → inisial 2 huruf, 24px semibold,
│ └────────────────────┘ │                            warna latar deterministik dari nama
│                        │
│  Kopi Susu Gula Aren   │  ← 16px/500 · line-clamp-2 · text-fg · px-3
│                        │
│  Rp 22.000             │  ← 18px mono/600 · text-fg · px-3 pb-3
└────────────────────────┘
```

#### 4.2.2 Props & keadaan

```ts
type ProductTileProps = {
  product: LocalProduct          // { id, name, price_minor, image_url, category_id }
  onAdd: (productId: string) => void
  /** Kuantitas produk ini yang sudah ada di keranjang; 0 = tidak ditampilkan. */
  cartQty?: number
  /** Prefiks kuantitas dari papan tombol angka — "3" lalu ketuk tile = tambah 3 (§5.2). */
  qtyMultiplier?: number
}
```

| Keadaan | Perlakuan visual | Durasi |
|---|---|---|
| `default` | `bg-surface` · `border-border` · `shadow-card` | — |
| `hover` (tetikus saja) | `border-border-strong` · `shadow-raised` | 150 ms |
| **`active` (ditekan)** | `scale-[0.97]` · `bg-accent-subtle` · `border-accent` | **instan (0 ms) → lepas 120 ms** |
| `focus-visible` | Cincin `outline-accent` 2 px, *offset* 2 px | — |
| `in-cart` (`cartQty > 0`) | Badge pojok kanan atas: `bg-accent text-fg-inverse` bulat, angka mono, min 24 px | — |
| `just-added` | Kilatan `bg-success-subtle` lalu memudar | 320 ms |
| `disabled` | **Tidak ada.** Master data POS tidak memuat stok — tile tidak pernah dinonaktifkan | — |

> **"Indikator visual subtle saat ditekan" — spesifikasi presisnya:** perubahan skala `0.97` **tanpa transisi masuk** (umpan balik harus terasa seketika di bawah jari; transisi masuk 150 ms terasa "lengket" pada layar sentuh) dan transisi keluar 120 ms. Tidak ada perubahan bayangan saat ditekan — bayangan yang berubah pada sentuhan membaca sebagai "melayang", bukan "tertekan". Ini menggantikan sepenuhnya efek *offset shadow* ala brutalism yang dilarang di §0.3.

#### 4.2.3 Fallback gambar — wajib, bukan opsional

Tidak ada endpoint unggah gambar ([03 §14](03-api-specifications.md)), sehingga `image_url` akan `NULL` pada mayoritas produk. *Fallback* harus terlihat disengaja:

```ts
/** Warna latar deterministik dari nama produk — konsisten lintas perangkat & sesi. */
const TILE_TINTS = [
  'bg-accent-subtle text-accent',       // biru
  'bg-success-subtle text-success-text',// hijau
  'bg-warning-subtle text-warning-text',// amber
  'bg-bg-muted text-fg-muted',          // netral
] as const

export function tileTint(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return TILE_TINTS[Math.abs(h) % TILE_TINTS.length]
}

/** "Kopi Susu Gula Aren" → "KS" · "Latte" → "LA" */
export const tileInitials = (name: string) => {
  const words = name.trim().split(/\s+/)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
```

`<img>` yang gagal dimuat (URL mati — sangat mungkin karena hosting di luar kendali sistem) **wajib** jatuh ke inisial via `onError`, bukan menampilkan ikon rusak peramban.

### 4.3 `CategoryTabs`

**Berkas:** `features/pos/components/CategoryTabs.tsx`

```text
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌────┐
│  SEMUA   ││   Kopi   ││ Non-Kopi ││ Makanan  ││ >  │   h-12 (48px) · gap-2
│   128    ││    42    ││    31    ││    38    ││    │   rounded-md
└──────────┘└──────────┘└──────────┘└──────────┘└────┘
   aktif       normal      normal      normal    gulir
```

| Aspek | Spesifikasi |
|---|---|
| Tinggi | 48 px (`--spacing-touch`) |
| Tab aktif | `bg-accent-subtle` · `text-accent` · `border border-accent` · `font-semibold` |
| Tab normal | `bg-surface` · `text-fg-muted` · `border border-border` |
| Hitungan produk | 12 px mono di bawah nama; membantu kasir menduga kepadatan grid |
| Tab "SEMUA" | Selalu pertama, tidak pernah tergulir keluar (`sticky left-0` + gradien penutup) |
| Luapan | Gulir horizontal + tombol `<` `>` 48 × 48 px. **Tidak pernah membungkus ke baris kedua** — pembungkusan menggeser grid dan memindahkan produk di bawah jari kasir |
| Menu konteks | **Tidak ada.** Tidak ada `PUT`/`DELETE` kategori ([05 §3.5](05-frontend-architecture-design.md)) |
| Kategori `null` | Produk tanpa `category_id` masuk ke tab "Lainnya", ditempatkan **terakhir** |

### 4.4 `CartPanel`

**Berkas:** `features/pos/components/CartPanel.tsx` · state di `features/pos/cart/cart-store.ts`

#### 4.4.1 Struktur

```text
┌─────────────────────────────────────────┐
│ KERANJANG          3 item  [Kosongkan]  │ ← header h-12 · border-b · bg-surface
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Kopi Susu Gula Aren            [x]│  │ ← CartLineItem (§4.5)
│  │ Rp 22.000 x 2                     │  │
│  │  [-]  2  [+]           Rp 44.000  │  │
│  │  + less sugar                     │  │
│  └───────────────────────────────────┘  │ ← flex-1 · overflow-y-auto
│  ┌───────────────────────────────────┐  │   scroll otomatis ke item terbaru
│  │ Croissant Butter               [x]│  │
│  │ ...                               │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│ Subtotal (4 item)           Rp 70.000   │ ← bg-bg-muted · px-4 py-3
│ ─────────────────────────────────────── │
│ TOTAL                       Rp 70.000   │ ← 28px mono/700
├─────────────────────────────────────────┤
│ ┌─────────────┐  ┌────────────────────┐ │
│ │   TAHAN     │  │  Pesanan Ditahan(2)│ │ ← h-14 · neutral · gap-3
│ └─────────────┘  └────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │      BAYAR  ·  Rp 70.000            │ │ ← h-16 · primary · 22px
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### 4.4.2 Keadaan kosong

Bukan sekadar teks — ia adalah petunjuk kerja:

```text
┌─────────────────────────────────────────┐
│ KERANJANG                    0 item     │
├─────────────────────────────────────────┤
│                                         │
│              ┌─────────┐                │
│              │   [ ]   │                │  ikon keranjang 48px · text-fg-subtle
│              └─────────┘                │
│                                         │
│         Keranjang masih kosong          │  16px · text-fg-muted
│                                         │
│    Ketuk produk atau pindai barcode     │  14px · text-fg-subtle
│         untuk mulai transaksi           │
│                                         │
│      ┌───────────────────────────┐      │
│      │  Buka Pesanan Ditahan (2) │      │  hanya bila ada pesanan ditahan
│      └───────────────────────────┘      │
├─────────────────────────────────────────┤
│ TOTAL                          Rp 0     │  ← tetap "Rp 0", bukan "-" (§2.5 #3)
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │             BAYAR                   │ │  ← disabled: opacity-45
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### 4.4.3 Perilaku daftar

| Perilaku | Spesifikasi |
|---|---|
| Urutan item | **Terbaru di atas.** Kasir memverifikasi item yang baru saja dipindai tanpa menggulir |
| Item duplikat | Digabung ke baris yang sama, `quantity` bertambah — **kecuali** bila catatan per-item berbeda; catatan berbeda = baris terpisah |
| Gulir otomatis | Saat item ditambahkan, panel bergulir ke posisi baris tersebut (`behavior: 'smooth'`, dilewati bila `prefers-reduced-motion`) |
| Kilatan penambahan | Baris berkedip `bg-success-subtle` selama 320 ms |
| Persistensi | Keranjang aktif **wajib** ditulis ke Dexie pada setiap perubahan (debounce 300 ms). Muat ulang halaman, *crash* peramban, atau *pull-to-refresh* yang lolos tidak boleh menghilangkan keranjang |

#### 4.4.4 Aksi panel

| Aksi | Varian tombol | Konfirmasi | Catatan |
|---|---|---|---|
| **BAYAR** | `primary` · `xl` (64 px) | Tidak | Nonaktif saat keranjang kosong. Membuka `PaymentModal` |
| **TAHAN** | `neutral` · `lg` (56 px) | Tidak | Warna netral **disengaja**: hold order tidak pernah dikirim ke server ([04 §A.4](04-frontend-mobile-web-requirements.md)) — ia bukan aksi yang mengamankan data, dan tidak boleh terlihat seperti aksi utama |
| **Pesanan Ditahan (n)** | `neutral` · `lg` | Tidak | Badge `n`; membuka P-08 |
| **Kosongkan** | `ghost` · ikon + teks 14 px di header | **Ya**, bila ≥ 1 item | Dialog `danger`; Toast dengan **Undo 5 detik** setelah dijalankan |

### 4.5 `CartLineItem` — kontrol kuantitas & catatan

**Berkas:** `features/pos/components/CartLineItem.tsx`

```text
┌───────────────────────────────────────────────────┐
│ Kopi Susu Gula Aren                           [x] │ ← nama 16px/500 line-clamp-2
│ Rp 22.000 x 2                                     │ ← 14px mono · text-fg-muted
│                                                   │
│  ┌──────┐   ┌──────┐   ┌──────┐        Rp 44.000  │ ← stepper 48x48 · total 18px mono/600
│  │  -   │   │  2   │   │  +   │                   │
│  └──────┘   └──────┘   └──────┘                   │
│   danger-    mono 20px   accent-                  │
│   subtle     text-center subtle                   │
│                                                   │
│  + Catatan: less sugar, extra ice            [/]  │ ← 14px · text-fg-muted · italic
└───────────────────────────────────────────────────┘
   px-3 py-3 · border-b border-border · bg-surface
```

| Kontrol | Spesifikasi |
|---|---|
| `−` | 48 × 48 px · `bg-danger-subtle text-danger`. Pada `quantity === 1`, ikonnya berubah menjadi tempat sampah dan aksinya menghapus baris (dengan Undo) |
| Angka kuantitas | 20 px mono/600, **dapat diketuk** → membuka *popover* numpad mini untuk input langsung (mengetuk `+` 12 kali tidak dapat diterima) |
| `+` | 48 × 48 px · `bg-accent-subtle text-accent`. Batas atas 999 |
| Total baris | 18 px mono/600, sejajar kanan, `tabular-nums` |
| `[x]` hapus baris | 44 × 44 px `ghost` di pojok kanan atas; **hanya muncul saat baris terpilih atau di-*hover*** agar tidak bersaing dengan stepper |
| **Catatan per item** | Ketuk `+ Tambah catatan` → *inline textarea* (maks. 120 karakter). Sudah terisi → ditampilkan sebagai teks miring + ikon pensil |
| Tekan lama (500 ms) | Membuka menu: *Ubah kuantitas · Ubah catatan · Hapus item* |
| Geser kiri (*swipe*) | Menampilkan aksi hapus merah. **Bukan** hapus langsung — geser hanya mengungkap tombol |

> **Catatan per item tidak dikirim ke server.** `transaction_items` tidak memiliki kolom catatan ([02 §2.13](02-database-schema.md)). Catatan hidup di IndexedDB dan **hanya** dipakai untuk (a) tampilan kasir dan (b) pencetakan struk dapur. Jangan menjanjikan ke pengguna bahwa catatan muncul di laporan Admin — ia tidak akan muncul. `[NEEDS DISCUSSION]` — bila catatan per item dibutuhkan di laporan, backend harus menambahkan kolom.

### 4.6 `PaymentModal`

**Berkas:** `features/pos/components/PaymentModal.tsx` · layar P-06

#### 4.6.1 Aturan struktural

| Aturan | Alasan |
|---|---|
| Modal, **bukan** halaman | Prinsip #2 — keranjang tetap terlihat di belakang *scrim* |
| Lebar 920 px, tinggi maks. 90 vh | Muat di tablet 10" *landscape* tanpa gulir vertikal |
| `Esc` menutup, klik *scrim* **tidak** | Klik *scrim* tidak sengaja saat memegang tablet akan membatalkan transaksi |
| Fokus terperangkap di dalam modal | §5.6 |
| `TOTAL` dan `KEMBALIAN` selalu terlihat | Tidak pernah tergulir keluar pandangan |

#### 4.6.2 Pemilih metode pembayaran

Dirender **hanya** dari `PAYMENT_METHODS` ([05 §3.3](05-frontend-architecture-design.md)) — tanpa input teks bebas, tanpa opsi "Lainnya":

```tsx
{PAYMENT_METHODS.map((m) => (
  <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
    className={cn(
      'h-14 flex-1 rounded-lg border font-semibold transition-colors',
      method === m
        ? 'border-accent border-2 bg-accent-subtle text-accent'
        : 'border-border bg-surface text-fg-muted hover:bg-bg-muted',
    )}>
    <span className="text-pos-base">{PAYMENT_METHOD_LABELS[m]}</span>
    <span className="block text-pos-xs font-mono opacity-70">{m}</span>
  </button>
))}
```

| Metode | Blok input yang ditampilkan | Kembalian |
|---|---|---|
| `CASH` | Uang diterima + Fast-Cash + Numpad | Dihitung & ditampilkan |
| `QRIS` · `DEBIT` · `TRANSFER` | "Nominal dibayar = Total" (terkunci) + input opsional nomor referensi | `Rp 0`, blok kembalian disembunyikan |

> Menampilkan nilai teknis (`CASH`, `QRIS`) di bawah label bahasa Indonesia adalah disengaja: saat terjadi sengketa laporan, kasir dan pemilik merujuk string yang sama persis dengan yang tersimpan di kolom `payment_method`.

#### 4.6.3 Fast-Cash preset

Tiga lapis, dari yang paling sering ke paling jarang:

```text
Lapis 1 — UANG PAS              lebar penuh · 72px · border-accent 2px · font-mono
Lapis 2 — pembulatan cerdas     3 tombol · 72px · dihitung dari total
Lapis 3 — pecahan tetap         Rp 20rb · Rp 50rb · Rp 100rb · 72px
                                (dinonaktifkan bila nilainya < total)
```

```ts
// features/pos/components/fast-cash.ts
const SEN = 100

/** Pembulatan ke atas ke kelipatan lazim; seluruh nilai dalam INTEGER SEN. */
export function smartRoundUps(totalMinor: number): number[] {
  const steps = [5_000, 10_000, 50_000, 100_000].map((s) => s * SEN)
  return steps
    .map((step) => Math.ceil(totalMinor / step) * step)
    .filter((v) => v > totalMinor)          // "uang pas" sudah jadi Lapis 1
}

/** Pecahan fisik yang benar-benar dibawa pelanggan Indonesia. */
export const FIXED_DENOMS = [20_000, 50_000, 100_000].map((d) => d * SEN)

/** Tiga preset Lapis 2, deduplikasi terhadap pecahan tetap agar tidak tampil ganda. */
export function fastCashPresets(totalMinor: number): number[] {
  const fixed = new Set(FIXED_DENOMS)
  return [...new Set(smartRoundUps(totalMinor))]
    .filter((v) => !fixed.has(v))
    .sort((a, b) => a - b)
    .slice(0, 3)
}
```

**Contoh untuk total `Rp 47.000`:**

| Lapis | Tombol | Kembalian |
|---|---|---|
| 1 | `UANG PAS · Rp 47.000` | `Rp 0` |
| 2 | `Rp 50.000` · `Rp 100.000` | `Rp 3.000` · `Rp 53.000` |
| 3 | `Rp 50rb` (nonaktif — duplikat) · `Rp 100rb` (nonaktif — duplikat) · `Rp 20rb` (nonaktif — kurang dari total) | — |

> Untuk total `Rp 47.000`, Lapis 2 dan Lapis 3 hampir sepenuhnya tumpang tindih. Itu **normal dan benar** — pada total kecil, jumlah pilihan yang masuk akal memang sedikit. Menampilkan tombol nonaktif (bukan menyembunyikannya) menjaga posisi tombol tetap stabil antar-transaksi, sehingga kasir membangun memori otot.

Mengetuk preset **langsung mengisi** `uang diterima` dan memperbarui kembalian secara instan. Ia **tidak** menyelesaikan transaksi — kasir tetap harus menekan `SELESAIKAN & CETAK`. Menggabungkan keduanya menghemat satu ketukan tetapi menghilangkan satu-satunya kesempatan mengoreksi salah tekan.

#### 4.6.4 Numpad virtual

| Aspek | Spesifikasi |
|---|---|
| Tombol | 56 × 56 px minimum, grid 3 × 4, *gutter* 8 px |
| Tata letak | `1 2 3` / `4 5 6` / `7 8 9` / `000 0 ⌫` — **tata letak telepon**, bukan kalkulator. Ini konvensi POS dan mesin EDC |
| `000` | Tombol khusus Rupiah — mempercepat input nominal ribuan secara dramatis |
| `⌫` | Menghapus satu digit · `text-danger` |
| `C` | Mengosongkan input · tombol lebar di bawah numpad · `text-danger` |
| Input | `inputMode="none"` pada field agar **keyboard OS tidak muncul** dan menutupi layar |
| Sisipan | Digit disisipkan dari kanan (seperti kalkulator kasir): `5` → `Rp 5`, lalu `0` → `Rp 50`, lalu `000` → `Rp 50.000` |
| Batas | Maksimum 9 digit (`Rp 999.999.999`) |
| Keyboard fisik | `0`–`9`, `Backspace`, `Delete` dipetakan langsung; `Enter` menyelesaikan bila kembalian ≥ 0 |
| Umpan balik | *Scale* `0.96` seketika + `navigator.vibrate?.(8)` bila tersedia (§6.3) |

#### 4.6.5 Blok kembalian

| Keadaan | Tampilan |
|---|---|
| `uang diterima > total` | `bg-success-subtle` · label "KEMBALIAN" · nominal 40 px mono `text-success-text` |
| `uang diterima === total` | `bg-success-subtle` · "KEMBALIAN `Rp 0`" · teks tambahan "Uang pas" |
| `uang diterima < total` | `bg-danger-subtle` · label **"KURANG"** · nominal `text-danger` · tombol `SELESAIKAN` **nonaktif** |
| `uang diterima` kosong | `bg-bg-muted` · "KEMBALIAN `Rp 0`" · `text-fg-subtle` · tombol nonaktif |

Perubahan nilai kembalian dianimasikan dengan transisi warna 150 ms, **tanpa** animasi angka bergulir — angka yang bergerak tidak dapat dibaca oleh kasir yang sedang menghitung uang fisik.

### 4.7 `StatusBar`

**Berkas:** `features/pos/components/StatusBar.tsx` · selalu terpasang di `PosApp`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [=]  GODINOV  Outlet Sudirman │ (o) Online  (^) 3 antre │ Siti A. │ Shift 08:02 │ 10:47  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  h-14 (56px) · bg-surface-inverse · text-fg-inverse · px-4 · pemisah: border-inverse
```

| Slot | Isi | Sumber state | Perilaku ketuk |
|---|---|---|---|
| **1. Menu** | Ikon `[=]` (tablet) / rail (desktop) | — | Membuka laci navigasi |
| **2. Identitas** | `GODINOV` + nama outlet | `db.meta` | Tidak dapat diketuk |
| **3. Koneksi** | Titik + label | `navigator.onLine` + *heartbeat* | Membuka P-13 |
| **4. Antrean sync** | Ikon + jumlah belum tersinkron | `useLiveQuery` pada `_synced = 0` | Membuka P-13 |
| **5. Kasir aktif** | Nama pendek (`Siti A.`) | `useSessionStore` | Menu: Ganti Kasir · Kunci Layar |
| **6. Shift** | `Shift HH:mm` (waktu buka) | `useShiftStore` | Membuka P-12 Tutup Shift |
| **7. Jam** | `HH:mm`, mono, perbarui tiap 30 dtk | Jam perangkat | — |

#### 4.7.1 Matriks status koneksi & sinkronisasi

| Kondisi | Titik | Label | Warna | Penanda kedua |
|---|---|---|---|---|
| Online, antrean 0 | ● | `Online` | `success` | Ikon centang |
| Online, sedang menyinkron | ◐ berputar | `Menyinkron…` | `info` | Ikon berputar |
| Online, antrean > 0 | ● | `Online · n antre` | `warning` | Ikon jam + angka |
| Offline, antrean 0 | ○ | `Offline` | `fg-subtle` di atas gelap | Ikon awan tercoret |
| Offline, antrean > 0 | ○ | `Offline · n antre` | `warning` | Ikon awan tercoret + angka |
| Ada `_syncError` | ▲ | `n gagal sinkron` | `danger` | Ikon segitiga seru — **selalu menang** atas status lain |
| Jam melenceng > 5 mnt | ▲ | `Jam perangkat melenceng` | `warning` | Baris kedua penuh di bawah StatusBar |

> **Prioritas tampilan bila beberapa kondisi bersamaan:** `_syncError` › jam melenceng › offline › antrean › normal. StatusBar hanya punya satu slot; yang paling merugikan bila diabaikan tampil lebih dulu.

#### 4.7.2 Banner jam melenceng

Bukan Toast — Toast menghilang, dan masalah ini tidak. Banner permanen setinggi 40 px muncul **di bawah** StatusBar hingga jam diperbaiki ([05 §1.8.2](05-frontend-architecture-design.md)):

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ (!) Jam perangkat melenceng 14 menit dari server. Waktu transaksi dan laporan akan       │
│     tidak akurat. Perbaiki jam perangkat.                                    [Detail]    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  bg-warning · text-fg (navy di atas amber — §1.5) · h-10 · border-b border-warning-text
```

Sistem **tidak** mengoreksi jam secara otomatis; ia hanya memperingatkan ([05 §1.8.2](05-frontend-architecture-design.md)).

### 4.8 Umpan balik — Toast, Dialog, dan error `400`

Hampir seluruh error backend berupa `400` dengan pesan bahasa Indonesia yang layak ditampilkan langsung ([05 §3.2](05-frontend-architecture-design.md)).

| Pola | Kapan | Spesifikasi |
|---|---|---|
| **Toast** | Error `400`, berhasil menyimpan, item terhapus (+ Undo) | Pojok kanan atas (POS: **kanan bawah**, di atas panel keranjang, agar tidak menutupi StatusBar). Lebar 380 px · `shadow-elevated` · durasi 4 dtk (error 6 dtk) · maks. 3 bertumpuk |
| **Dialog konfirmasi** | Kosongkan keranjang, Void, Tutup shift, Hapus staff | Lebar 460 px · ikon 40 px berlatar `danger-subtle` · tombol destruktif **di kanan** · tombol batal `neutral` |
| **Banner inline** | Peringatan permanen (jam melenceng, catatan laporan, stok minus) | Lebar penuh kontainer · `border-l-4` · tidak dapat ditutup bila kondisinya permanen |
| **Sisipan field** | Kegagalan validasi Zod | 14 px `text-danger` di bawah field + `aria-invalid` + `border-danger` |

**Warna Toast:** sukses `border-l-4 border-success`; error `border-l-4 border-danger`; peringatan `border-l-4 border-warning`. Latar selalu `bg-surface` — Toast berlatar penuh warna sulit dibaca dan menabrak aturan kontras §1.5.

### 4.9 Keadaan memuat & kerangka (*skeleton*)

| Konteks | Pola |
|---|---|
| Grid produk (sinkronisasi awal, P-02) | 12 kartu kerangka `bg-bg-muted` beranimasi denyut · **tanpa** spinner |
| Panel keranjang | Tidak pernah memuat — sumbernya IndexedDB lokal, sinkron |
| Tabel Admin | 8 baris kerangka setinggi baris asli, kolom selebar aslinya |
| Kartu statistik Dashboard | Blok kerangka seukuran nominal akhir agar tata letak tidak melompat |
| Tombol saat mengirim | Spinner 16 px **di dalam** tombol, label berubah (`Menyimpan…`), lebar **dikunci** agar tidak menyusut |
| Verifikasi PIN (P-03) | Spinner inline + tombol nonaktif 100–300 ms ([05 ADR-08](05-frontend-architecture-design.md)) |

---

## 5. Hardware & Keyboard Support

### 5.1 Peta pintasan keyboard

Target: kasir berpengalaman pada desktop dengan keyboard fisik dapat menyelesaikan transaksi **tanpa menyentuh tetikus maupun layar**.

| Tombol | Aksi | Konteks aktif | Catatan konflik peramban |
|---|---|---|---|
| **`F2`** | **Fokus ke kolom pencarian** | P-05 | Aman — tidak dipakai peramban |
| **`Space`** | **Buka `PaymentModal`** | P-05, fokus **tidak** di kolom teks | Lihat §5.2 — perlu penanganan khusus |
| **`Esc`** | **Batal / tutup modal / kosongkan pencarian** | Global | Aman |
| `Enter` | Tambahkan hasil pencarian pertama; di modal = konfirmasi | P-05, modal | Aman |
| `F1` | Overlay bantuan pintasan | Global | Firefox membuka bantuan — wajib `preventDefault()` |
| `F4` | Tahan pesanan aktif | P-05 | Aman |
| `F8` | Void transaksi (P-10) | Global POS | Aman |
| `F9` | Sinkronisasi manual | Global POS | Aman |
| `↑` `↓` | Navigasi hasil pencarian | Pencarian aktif | Aman |
| `←` `→` | Pindah tab kategori | Fokus di tab kategori | Aman |
| `+` / `−` | Ubah kuantitas baris terpilih | Baris keranjang terpilih | Aman |
| `Delete` | Hapus baris terpilih | Baris keranjang terpilih | Aman |
| `1`–`9` | Prefiks pengali kuantitas (`3` lalu ketuk produk = tambah 3) | P-05, fokus di grid | Terhapus otomatis setelah 2 dtk |
| `0`–`9`, `Backspace` | Numpad | `PaymentModal` terbuka | Aman |

**Tombol yang sengaja tidak dipakai** — peramban merebutnya lebih dulu dan `preventDefault()` tidak selalu berhasil: `F3` (cari di halaman), `F5` (muat ulang — **berbahaya**, dapat menghilangkan keranjang), `F6` (fokus bilah alamat), `F7` (*caret browsing* Firefox), `F11` (layar penuh), `F12` (alat pengembang), `Ctrl+W`, `Ctrl+R`.

> **Rekomendasi pemasangan.** Jalankan POS sebagai **PWA `standalone`** atau di mode kiosk peramban. Pada tab peramban biasa, `F5` dan `Ctrl+R` tetap dapat memuat ulang halaman dan menghilangkan keranjang di memori — itulah alasan §4.4.3 mewajibkan persistensi keranjang ke Dexie. Persistensi adalah jaring pengaman; kiosk adalah pencegahan.

### 5.2 Menyelesaikan konflik `Space`

`Space` adalah tombol paling ambigu di web: ia mengetik spasi di kolom teks, dan mengaktifkan elemen `<button>` yang sedang difokuskan. Memasang `Space` sebagai pintasan checkout global **akan** menyebabkan transaksi terbuka secara tidak sengaja bila tidak dijaga.

```ts
// features/pos/hooks/usePosShortcuts.ts
const isTypingTarget = (el: EventTarget | null): boolean => {
  const n = el as HTMLElement | null
  if (!n) return false
  const tag = n.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable
}

/** Space hanya boleh memicu checkout bila TIDAK ada elemen interaktif yang difokuskan. */
const isSpaceSafe = (e: KeyboardEvent): boolean => {
  if (isTypingTarget(e.target)) return false                      // sedang mengetik
  const active = document.activeElement
  if (active && active !== document.body) {
    // Fokus ada pada tombol/tautan — biarkan Space mengaktifkannya (perilaku bawaan)
    if (active.matches('button, a, [role="button"], [tabindex]:not([tabindex="-1"])')) return false
  }
  return true
}

useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (barcodeBuffer.isCapturing()) return                       // §5.4 — pemindai menang

    switch (e.key) {
      case 'F2':
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        break

      case ' ':
        if (!isSpaceSafe(e)) return                               // ← penjaga kritis
        if (cart.items.length === 0) return                       // tidak ada yang dibayar
        if (isAnyModalOpen()) return
        e.preventDefault()
        openPaymentModal()
        break

      case 'Escape':
        // Escape ditangani oleh modal terluar; di P-05 ia mengosongkan pencarian
        if (isAnyModalOpen()) return                              // biarkan modal menanganinya
        if (searchQuery) { e.preventDefault(); clearSearch() }
        break
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [cart.items.length, searchQuery])
```

**Aturan `Esc` berlapis** — dari yang terdalam ke terluar, hanya satu lapis yang bereaksi per penekanan:

```text
1. Popover / dropdown terbuka   → tutup popover
2. Modal terbuka                → tutup modal (PaymentModal: batalkan pembayaran, keranjang UTUH)
3. Kolom pencarian berisi teks  → kosongkan pencarian, pertahankan fokus
4. Baris keranjang terpilih     → batalkan pemilihan
5. Tidak ada di atas            → tidak melakukan apa pun (JANGAN mengosongkan keranjang)
```

> `Esc` **tidak pernah** mengosongkan keranjang. Aksi destruktif tidak boleh terikat pada tombol yang ditekan secara refleks.

### 5.3 Overlay bantuan pintasan (`F1`)

Kasir tidak akan membaca manual. Sediakan lembar pintasan yang dapat dipanggil kapan saja:

```text
┌───────────────────────────────────────────────────────────┐
│  PINTASAN KEYBOARD                                   [X]  │
├──────────────────────────┬────────────────────────────────┤
│  [F2]   Cari produk      │  [+] [-]  Ubah kuantitas       │
│  [Space] Bayar           │  [Del]    Hapus item terpilih  │
│  [Esc]  Batal / tutup    │  [F4]     Tahan pesanan        │
│  [Enter] Konfirmasi      │  [F8]     Void transaksi       │
│  [^] [v] Pilih hasil     │  [F9]     Sinkronisasi manual  │
├──────────────────────────┴────────────────────────────────┤
│  Pemindai barcode aktif otomatis — tidak perlu klik dulu. │
└───────────────────────────────────────────────────────────┘
```

### 5.4 Dukungan pemindai barcode

#### 5.4.1 Kendala backend yang harus dihadapi lebih dulu

Tabel `products` **tidak memiliki kolom `barcode` maupun `sku`** — hanya `id`, `name`, `price`, `image_url`, `category_id` ([02 §2.6](02-database-schema.md), [03 §sync master-data](03-api-specifications.md)). Konsekuensinya tidak bisa disiasati di lapisan UI:

| Jalur | Kelayakan | Penjelasan |
|---|---|---|
| Cocokkan hasil pindaian ke `products.barcode` | ❌ **Mustahil** | Kolomnya tidak ada |
| Cocokkan ke `products.name` | ⚠️ Terbatas | Berfungsi hanya bila pemilik menuliskan barcode sebagai nama produk — praktik buruk yang tidak boleh dianjurkan |
| **Tabel pemetaan lokal per-perangkat** | ✅ **Rekomendasi v1** | `db.barcodes: { code, product_id, created_at }` di IndexedDB. Kasir memindai produk yang belum dikenal → sistem menawarkan "Kaitkan barcode ini ke produk…" → pemetaan disimpan di perangkat |
| Tambah kolom `barcode` di backend | ✅ **Solusi sebenarnya** | `[NEEDS DISCUSSION]` — memerlukan migrasi + perluasan payload master-data |

**Batasan pemetaan lokal yang harus dinyatakan ke pemilik bisnis:** pemetaan tersimpan **per-perangkat** dan **tidak tersinkronisasi**. Tablet kedua di outlet yang sama harus dilatih ulang, dan pemetaan hilang bila data situs dibersihkan. Ini konsekuensi langsung dari kesenjangan backend, bukan pilihan desain. Sediakan Ekspor/Impor JSON di P-14 Pengaturan sebagai penawar sementara.

#### 5.4.2 Deteksi pemindai — *auto-focus listener* tanpa mengganggu kasir

Pemindai barcode USB/Bluetooth berperilaku sebagai *keyboard HID*: ia "mengetik" karakter sangat cepat lalu mengirim `Enter`. Ciri pembeda dari manusia adalah **jeda antar-ketukan**.

```ts
// features/pos/hooks/useBarcodeScanner.ts
const MAX_INTER_KEY_MS = 35   // manusia jarang < 50ms; pemindai biasanya 5–20ms
const MIN_LENGTH       = 6    // EAN-8 terpendek yang masuk akal
const BUFFER_TIMEOUT_MS = 120 // buang buffer yang menggantung

export function useBarcodeScanner(onScan: (code: string) => void) {
  useEffect(() => {
    let buffer = ''
    let lastKeyAt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const reset = () => { buffer = ''; clearTimeout(timer) }

    const onKeyDown = (e: KeyboardEvent) => {
      // Modal numpad terbuka → pemindai TIDAK boleh menyisipkan produk (§5.4.3)
      if (isPaymentModalOpen()) return

      const now = performance.now()
      const delta = now - lastKeyAt
      lastKeyAt = now

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_LENGTH) {
          e.preventDefault()          // jangan submit form apa pun
          e.stopPropagation()
          onScan(buffer)
        }
        reset()
        return
      }

      if (e.key.length !== 1) return  // abaikan Shift, Tab, panah, dsb.

      // Jeda terlalu lama → ini manusia mengetik, bukan pemindai
      if (delta > MAX_INTER_KEY_MS) buffer = ''
      buffer += e.key

      clearTimeout(timer)
      timer = setTimeout(reset, BUFFER_TIMEOUT_MS)
    }

    // Fase CAPTURE: menangkap sebelum React, sehingga berfungsi walau fokus
    // sedang berada di kolom pencarian, di tombol, atau di mana pun.
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [onScan])
}
```

**Mengapa pendekatan ini "tidak mengganggu navigasi kasir":**

- **Tidak ada elemen tersembunyi yang mencuri fokus.** Pola lama — `<input>` tak terlihat yang direbut fokusnya setiap 100 ms — merusak dropdown, modal, dan input catatan. Pendekatan ini tidak pernah memindahkan fokus.
- **Pengetikan manusia lolos utuh.** Jeda > 35 ms mengosongkan buffer, sehingga kasir yang mengetik "kopi" di kolom pencarian tidak pernah memicu jalur pindaian.
- **Berfungsi di mana pun fokus berada** karena mendengarkan pada fase *capture* di `window`.
- **Nonaktif otomatis di `PaymentModal`** — lihat §5.4.3.

#### 5.4.3 Alur setelah pindaian berhasil

```text
Pindaian diterima
      │
      ├─ Ada di db.barcodes ?
      │     ├─ Ya  → tambahkan produk ke keranjang (qty +1)
      │     │        → kilatan hijau di baris keranjang + bip pendek
      │     │        → kolom pencarian TIDAK berubah, fokus TIDAK berpindah
      │     │
      │     └─ Tidak → Toast: "Barcode 8991002101234 belum dikenal"
      │                [Kaitkan ke produk…]  → membuka pemilih produk
      │                                       → simpan ke db.barcodes
      │
      └─ PaymentModal sedang terbuka → pindaian DIABAIKAN
         (mencegah digit barcode masuk ke field "uang diterima" —
          ini akan menghasilkan nominal Rp 8.991.002.101.234)
```

Aturan terakhir itu penting: pemindai yang aktif selama modal pembayaran adalah cara tercepat merusak sebuah transaksi.

### 5.5 Perangkat keras lain

| Perangkat | Dukungan | Umpan balik UI |
|---|---|---|
| **Printer struk** | Empat adapter: Web Bluetooth · LAN ePOS · RawBT · cetak peramban ([05 §1.7](05-frontend-architecture-design.md)) | P-07 menampilkan status: `Mencetak…` → `Tercetak` / `Gagal — Cetak Ulang`. Kegagalan cetak **tidak pernah** membatalkan transaksi yang sudah tersimpan |
| **Laci uang (cash drawer)** | Terbuka lewat *kick pulse* ESC/POS melalui printer | Terpicu otomatis hanya untuk `payment_method === 'CASH'` · tombol manual "Buka Laci" di P-14 (dicatat ke log lokal) |
| **Layar pelanggan** | Di luar lingkup v1 | — |
| **Timbangan** | Tidak didukung — `quantity` bertipe `INT` di backend ([02 §2.13](02-database-schema.md)) | Produk per-berat harus dimodelkan sebagai varian tetap |

### 5.6 Manajemen fokus & aksesibilitas

| Aturan | Implementasi |
|---|---|
| Cincin fokus tunggal | `:focus-visible` global (§1.4) — `outline-accent` 2 px, *offset* 2 px. **Jangan pernah** `outline: none` tanpa pengganti |
| Perangkap fokus modal | Fokus berpindah ke elemen pertama yang dapat difokuskan saat modal terbuka; `Tab` berputar di dalamnya; saat ditutup fokus **kembali ke elemen pemicu** |
| Urutan `Tab` di P-05 | Pencarian → tab kategori → grid produk → keranjang → Tahan → Bayar |
| Pengumuman langsung | `aria-live="polite"` pada total keranjang & antrean sync; `aria-live="assertive"` pada error sinkronisasi |
| Grid produk | `role="grid"`, tile `role="gridcell"`; navigasi panah dua dimensi |
| Kuantitas | `role="spinbutton"` dengan `aria-valuenow` / `aria-valuemin` / `aria-valuemax` |
| Nominal | `aria-label` berisi kalimat utuh (§2.4) — mencegah pembaca layar mengeja "R-p titik" |
| Target sentuh | Memenuhi WCAG 2.2 SC 2.5.8 (24 px) dengan margin sangat besar — minimum kita 48 px (§2.1) |

### 5.7 Pengerasan permukaan sentuh

| Masalah | Penanganan | Berkas |
|---|---|---|
| *Pull-to-refresh* menghapus keranjang | `overscroll-behavior: none` pada `.pos-root` + persistensi keranjang ke Dexie | globals.css · cart-store |
| Zoom ketuk-ganda | `touch-action: manipulation` pada seluruh tombol POS | globals.css |
| Sorotan ketukan biru | `-webkit-tap-highlight-color: transparent` | globals.css |
| Teks tersorot saat tekan lama | `user-select: none` pada tombol (**tidak** pada nominal — kasir kadang perlu menyalinnya) | globals.css |
| *Notch* / sudut membulat iPad | `env(safe-area-inset-*)` pada `.pos-root` | globals.css |
| Muat ulang tak sengaja | PWA `standalone` + `display: "standalone"`, `orientation: "landscape"` | app/manifest.ts |
| Layar padam saat antre panjang | `navigator.wakeLock.request('screen')` selama shift terbuka; dilepas saat shift ditutup | features/pos/hooks |

---

## 6. Motion, Elevation & Feedback

### 6.1 Gerak

| Interaksi | Durasi | *Easing* | Properti |
|---|---|---|---|
| Tekan tombol / tile | **0 ms masuk**, 120 ms keluar | `ease-out-pos` | `transform: scale` |
| *Hover* | 150 ms | `ease-out-pos` | `background-color`, `box-shadow` |
| Modal masuk | 200 ms | `ease-out-pos` | `opacity` 0→1, `scale` 0.97→1 |
| Modal keluar | 140 ms | `ease-in-pos` | Kebalikannya |
| *Scrim* | 180 ms | linear | `opacity` |
| Toast masuk | 220 ms | `ease-out-pos` | `translateY(12px)` + `opacity` |
| Baris keranjang ditambahkan | 320 ms | `ease-out-pos` | Kilatan `background-color` |
| Perubahan angka total | **0 ms** | — | Nilai langsung berubah — **tidak ada angka bergulir** |
| Kerangka *skeleton* | 1400 ms berulang | `ease-in-out` | `opacity` 0.6↔1 |

**Batas keras: tidak ada transisi > 320 ms di POS.** Antarmuka kasir harus terasa seketika. `prefers-reduced-motion` mematikan seluruhnya (§1.4).

### 6.2 Elevasi — pengganti bayangan brutalism

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `shadow-card` | `0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)` | Tile produk, kartu, baris keranjang |
| `shadow-raised` | `0 2px 4px -1px …/0.06, 0 4px 8px -2px …/0.08` | *Hover* tile, tombol tunai, dropdown |
| `shadow-elevated` | `0 8px 16px -4px …/0.10, 0 16px 32px -8px …/0.12` | *Popover*, panel melayang |
| `shadow-overlay` | `0 24px 48px -12px …/0.22` | Modal |

Seluruh bayangan berbasis `rgb(15 23 42 / α)` — **navy brand yang diencerkan, bukan hitam murni**. Bayangan hitam pada latar `slate-50` tampak keruh; bayangan bernuansa navy tampak menyatu dengan palet.

**Dilarang:** bayangan *offset* keras (`6px 6px 0 0 #000`), bayangan berwarna jenuh, dan bayangan berganda dengan *spread* positif besar. Kedalaman diperoleh dari **elevasi berlapis dan border halus**, bukan dari kontras keras.

### 6.3 Umpan balik nonvisual

| Peristiwa | Getaran | Suara |
|---|---|---|
| Produk ditambahkan | `vibrate(8)` | Klik pendek (opsional, dapat dimatikan) |
| Barcode terbaca | `vibrate(12)` | Bip naik |
| Barcode tidak dikenal | `vibrate([30,40,30])` | Bip turun |
| Pembayaran selesai | `vibrate([12,60,12])` | Nada sukses |
| Error / gagal sinkron | `vibrate([40,60,40])` | Nada gagal |

`navigator.vibrate` tidak tersedia di iOS Safari — perlakukan sebagai peningkatan progresif (`navigator.vibrate?.(…)`). Suara **mati secara bawaan**; diaktifkan per-perangkat di P-14 Pengaturan (banyak kafe memutar musik; sebagian lain menuntut keheningan).

---

## 7. Checklist Implementasi & Butir Terbuka

### 7.1 Urutan pengerjaan

| # | Langkah | Keluaran |
|---|---|---|
| 1 | Ganti [app/globals.css](../posgodinov-fe/app/globals.css) dengan §1.4 · hapus blok `prefers-color-scheme: dark` · hapus `font-family: Arial` | Token siap |
| 2 | Perbaiki [app/layout.tsx](../posgodinov-fe/app/layout.tsx): `lang="id"`, `metadata` Godinov (masih "Create Next App"), `font-sans` di `body` | Kerangka benar |
| 3 | `components/ui/`: `Button`, `Money`, `Badge`, `Toast`, `Dialog`, `Skeleton` | Primitif |
| 4 | `features/pos/components/`: `StatusBar`, `ProductTile`, `CategoryTabs`, `CartPanel`, `CartLineItem` | P-05 utuh |
| 5 | `Numpad`, `FastCashRow`, `PaymentModal` | P-06 utuh |
| 6 | `usePosShortcuts`, `useBarcodeScanner` | Dukungan perangkat keras |
| 7 | `AdminShell`: sidebar, header, `OutletSwitcher` | D-03 utuh |
| 8 | `BomBuilder` + `HppSummary` | D-11 — layar tersulit |

### 7.2 Checklist tinjauan kode

- [ ] Tidak ada `bg-[#…]`, `text-[#…]`, atau nama warna Tailwind mentah (`bg-blue-600`) di dalam komponen — hanya token semantik
- [ ] Tidak ada `border-2`/`border-4` hitam · tidak ada `shadow-[…px_…px_0…]` · tidak ada `rounded-none` pada permukaan
- [ ] Setiap nominal dirender lewat `<Money minor={…} />`, tidak pernah `formatIdr()` inline di JSX
- [ ] Setiap komponen penampil uang menerima **sen**, dan namanya berakhiran `_minor` / `Minor`
- [ ] Tidak ada target sentuh POS di bawah 48 px (uji dengan overlay *devtools*)
- [ ] Aksi destruktif berjarak ≥ 24 px dari aksi utama
- [ ] Tidak ada teks putih di atas `--color-warning` (§1.5)
- [ ] Tidak ada teks ≤ 18 px berwarna putih di atas `--color-success` (§1.5)
- [ ] Setiap status warna memiliki penanda kedua (ikon/teks)
- [ ] Setiap `outline: none` disertai pengganti `:focus-visible`
- [ ] Modal memerangkap fokus dan mengembalikannya saat ditutup
- [ ] `ProductTile` tidak menampilkan stok apa pun
- [ ] Tab kategori tidak menampilkan aksi edit/hapus
- [ ] `PaymentModal` merender metode **hanya** dari `PAYMENT_METHODS`
- [ ] Keranjang bertahan setelah muat ulang halaman

### 7.3 Butir terbuka yang memerlukan keputusan

| # | Butir | Dampak bila tidak diputuskan |
|---|---|---|
| **U-01** | **`products` tidak punya kolom `barcode`/`sku`** (§5.4.1) | Dukungan pemindai berjalan di atas pemetaan per-perangkat yang tidak tersinkronisasi. Setiap tablet baru harus dilatih ulang. **Perbaikan backend paling berdampak untuk UX kasir** |
| **U-02** | **Tidak ada endpoint unggah gambar** ([03 §14](03-api-specifications.md)) | Grid produk akan hampir seluruhnya berbasis inisial. Perlu keputusan: sediakan hosting gambar (S3/Cloudinary) atau terima grid teks-dulu sebagai desain final |
| **U-03** | **`transaction_items` tanpa kolom catatan** (§4.5) | Catatan per item tidak pernah sampai ke laporan Admin. Perlu dikomunikasikan ke pemilik bisnis, atau backend menambah kolom |
| **U-04** | Nol bergaris pada Geist Mono (§2.4) | Kosmetik. Verifikasi ketersediaan *feature tag* sebelum diaktifkan |
| **U-05** | Suara umpan balik aktif secara bawaan? (§6.3) | Saat ini **mati**. Perlu masukan dari pilot outlet |
| **U-06** | Mode gelap Admin Dashboard (§1.6) | Di luar lingkup v1; arsitektur token sudah menyiapkan jalannya |
| **U-07** | Utility `p-touch` dari `--spacing-*` bernama pada Tailwind v4 (§1.4) | Verifikasi setelah `npm install` terhadap dokumentasi terbundel, sejalan dengan [05 §0.5](05-frontend-architecture-design.md) |

---

## Ringkasan

| Keputusan | Nilai |
|---|---|
| Gaya visual | Clean Modern Enterprise SaaS / Professional Retail UI — **bukan** Neo-Brutalism |
| Brand | Deep Navy `#0F172A` / `#1E293B` |
| Aksi utama | Electric Blue `#2563EB` (5.17:1 dengan teks putih) |
| Tunai / lunas | Emerald `#059669` — teks putih **hanya** ≥ 22 px; `#047857` untuk teks kecil |
| Peringatan | Amber `#D97706` — **selalu** berteks navy, tidak pernah putih |
| Destruktif | Crimson `#DC2626` (4.83:1) |
| Kanvas | `#F8FAFC` / `#F1F5F9`; permukaan kartu putih ber-`border-slate-200` |
| Touch target | 48 px minimum · 56 px numpad · 64 px aksi utama · 72 px Fast-Cash |
| Font uang | Monospace + `tabular-nums`, minimum 16 px, selalu dari integer sen |
| Tata letak POS | Split-screen persisten 62/38 (tablet) · 65/35 dengan keranjang terkunci 420 px (desktop) |
| Tata letak Admin | Sidebar dapat diciutkan + header + Global Outlet Switcher |
| Pintasan | `F2` cari · `Space` bayar (berpenjaga) · `Esc` batal berlapis |
| Pemindai barcode | Deteksi berbasis jeda ketukan pada fase *capture* — tanpa mencuri fokus |
| Mode gelap | Dikunci mati di POS |
