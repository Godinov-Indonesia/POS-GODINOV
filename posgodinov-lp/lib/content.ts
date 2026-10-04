export interface NavItem {
  label: string;
  href: string;
}

export interface PillarItem {
  id: number;
  title: string;
  headline: string;
  body: string;
}

export interface ProblemCard {
  id: number;
  title: string;
  body: string;
  impact: string;
}

export interface BentoItem {
  slug: string;
  title: string;
  description: string;
  spanDesktop: number;
  tone: "default" | "brand" | "signal";
  badge?: string;
}

export interface SyncPhaseItem {
  phase: 1 | 2 | 3;
  label: string;
  title: string;
  description: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPricePerMonth: number;
  highlighted?: boolean;
  outletLimit: string;
  deviceLimit: string;
  features: { name: string; included: boolean }[];
  ctaText: string;
  ctaHref: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export const siteContent = {
  brand: {
    name: "Godinov POS",
    version: "V2",
    tagline: "Sistem Pengamanan Kas & Operasional Retail/F&B",
  },
  header: {
    navItems: [
      { label: "Fitur", href: "#fitur" },
      { label: "Offline-First", href: "#offline" },
      { label: "Keamanan", href: "#keamanan" },
      { label: "Harga", href: "#harga" },
      { label: "FAQ", href: "#faq" },
    ] satisfies NavItem[],
    loginText: "Masuk",
    loginHref: "#masuk",
    ctaText: "Coba Sekarang! Gratis!!",
    ctaHref: "#daftar",
    offlineBadge: "Mode Offline Aktif",
  },
  hero: {
    eyebrow: "Offline-First PWA · Dirancang untuk outlet dengan sinyal 1 bar",
    headline: "Kasir tetap jalan. Uang tidak ikut jalan-jalan.",
    subheadline:
      "Godinov POS V2 terus melayani transaksi walau internet mati total, lalu mengunci celah kebocoran kas lewat Blind Closing, Void Guard, dan Kiosk Mode. Setiap rupiah punya jejak.",
    ctaPrimary: {
      text: "Coba Sekarang! Gratis!!",
      href: "#daftar",
    },
    ctaSecondary: {
      text: "Lihat Demo Interaktif",
      href: "#offline",
    },
    microProof: [
      "Tanpa kartu kredit",
      "Setup 15 menit",
      "Data tetap milik Anda",
    ],
  },
  trustBar: {
    metrics: [
      { value: "1.2jt+", label: "transaksi diproses" },
      { value: "99.9%", label: "sync success rate" },
      { value: "0", label: "data transaksi hilang" },
    ],
    // TODO: Ganti dengan daftar logo klien asli saat peluncuran publik
    clientsPlaceholder: [
      { name: "Klien Retail A", id: "client-a" },
      { name: "Klien Kafe B", id: "client-b" },
      { name: "Klien Resto C", id: "client-c" },
      { name: "Klien Bakery D", id: "client-d" },
      { name: "Klien Bistro E", id: "client-e" },
    ],
  },
  problem: {
    heading: "Uang Anda tidak hilang sekaligus. Ia menetes.",
    subheading:
      "Tiga titik ini menyumbang mayoritas kerugian operasional di outlet retail dan F&B.",
    cards: [
      {
        id: 1,
        title: "Selisih laci yang selalu \"salah hitung\"",
        body: "Saat kasir tahu angka yang seharusnya, selisih akan selalu pas — termasuk ketika seharusnya tidak pas.",
        impact: "Rata-rata rugi Rp 1,5 - 4jt / bulan / outlet",
      },
      {
        id: 2,
        title: "Void setelah struk tercetak",
        body: "Transaksi dibatalkan setelah pelanggan pergi. Barang keluar, uang tidak masuk, laporan tetap terlihat rapi.",
        impact: "Celah manipulasi shift tanpa audit",
      },
      {
        id: 3,
        title: "Sinyal hilang, catatan pindah ke kertas",
        body: "Satu jam offline berarti puluhan transaksi yang direkonstruksi dari ingatan di akhir hari.",
        impact: "Potensi salah hitung stok & kebocoran kas",
      },
    ] satisfies ProblemCard[],
  },
  pillars: [
    {
      id: 1,
      title: "1. Ketahanan",
      headline: "Tidak bergantung pada sinyal",
      body: "Transaksi tersimpan di perangkat, antre otomatis, dan terkirim sendiri saat koneksi pulih. Nol transaksi hilang.",
    },
    {
      id: 2,
      title: "2. Integritas Kas",
      headline: "Kasir tidak pernah lihat angka targetnya",
      body: "Blind Closing memaksa hitungan fisik dilakukan jujur. Sistem yang membuka selisihnya, bukan kasir.",
    },
    {
      id: 3,
      title: "3. Kontrol",
      headline: "Setiap pembatalan meninggalkan jejak",
      body: "Void wajib alasan dan otorisasi supervisor. Riwayatnya tercatat permanen di audit trail.",
    },
    {
      id: 4,
      title: "4. Kejelasan",
      headline: "Laporan yang bisa ditindak, bukan ditebak",
      body: "Selisih shift, waste, dan stock opname masuk satu laporan lintas outlet.",
    },
  ] satisfies PillarItem[],
  featureBento: {
    heading: "Satu Sistem Operasional. Nol Titik Buta.",
    subheading: "Semua instrumen yang dibutuhkan owner multi-outlet untuk mengunci arus kas dan inventaris.",
    items: [
      {
        slug: "blind-closing",
        title: "Blind Closing",
        description: "Kasir memasukkan hitungan fisik tanpa melihat angka sistem. Selisih muncul hanya di layar Anda.",
        spanDesktop: 7,
        tone: "default",
        badge: "Anti-Fraud",
      },
      {
        slug: "offline-first",
        title: "Offline-First PWA",
        description: "Transaksi jalan penuh tanpa internet. Antrian tersimpan lokal dan sinkron sendiri saat koneksi kembali.",
        spanDesktop: 5,
        tone: "brand",
        badge: "High Resilience",
      },
      {
        slug: "void-guard",
        title: "Void Guard",
        description: "Pembatalan wajib alasan dan otorisasi supervisor. Tercatat permanen di audit trail.",
        spanDesktop: 6,
        tone: "default",
      },
      {
        slug: "kiosk-mode",
        title: "Kiosk Mode",
        description: "Perangkat terikat serial outlet. Kasir tidak bisa keluar aplikasi atau berpindah akun.",
        spanDesktop: 6,
        tone: "default",
      },
      {
        slug: "stock-opname",
        title: "Stock Opname & Waste",
        description: "Selisih stok dan pembuangan bahan tercatat per staf, per outlet, per tanggal.",
        spanDesktop: 4,
        tone: "default",
      },
      {
        slug: "multi-outlet",
        title: "Multi-Outlet",
        description: "Satu dasbor untuk semua cabang. Master data didorong dari pusat ke tiap perangkat.",
        spanDesktop: 4,
        tone: "default",
      },
      {
        slug: "audit-trail",
        title: "Audit Trail",
        description: "Siapa, kapan, dari perangkat mana. Riwayat bersifat append-only.",
        spanDesktop: 4,
        tone: "default",
      },
    ] satisfies BentoItem[],
  },
  syncEducation: {
    heading: "Apa yang terjadi saat internet Anda mati jam 7 malam?",
    subheading: "Tiga fase berikut berjalan otomatis. Kasir tidak perlu menekan apa pun.",
    phases: [
      {
        phase: 1,
        label: "Fase 1",
        title: "Normal",
        description:
          "Setiap transaksi tercatat di perangkat lebih dulu, baru dikirim ke server. Perangkat adalah sumber kebenaran pertama.",
      },
      {
        phase: 2,
        label: "Fase 2",
        title: "Terputus",
        description:
          "Koneksi hilang. Transaksi tetap diproses penuh dan masuk antrian lokal. Struk tetap tercetak.",
      },
      {
        phase: 3,
        label: "Fase 3",
        title: "Pulih",
        description:
          "Antrian dikirim berurutan dengan kunci idempoten. Waktu asli transaksi dipertahankan, bukan waktu kirim.",
      },
    ] satisfies SyncPhaseItem[],
    technicalNote:
      "IndexedDB · Service Worker · Idempotency Key · client_created_at dipertahankan · Konflik diselesaikan server-side",
    summaryBadge: "12 transaksi · 1 shift · 3 waste — tersinkron",
  },
  cashIntegrity: {
    heading: "Blind Closing: Uji Kejujuran Tanpa Curiga",
    subheading:
      "Saat tutup shift, kasir memasukkan uang fisik yang dihitung di tangan. Mereka tidak pernah diberi tahu angka target oleh sistem.",
    expectedAmount: 4850000,
    voidGuard: {
      title: "Void Guard Otorisasi Berlapis",
      description: "Setiap void item atau transaksi mewajibkan input PIN supervisor serta alasan terstandarisasi.",
    },
    kioskMode: {
      title: "Kiosk Mode Terkunci Hardware",
      description: "Aplikasi terkunci di layar kasir, terikat kode aktivasi outlet dan serial perangkat resmi.",
    },
  },
  testimonials: {
    heading: "Diuji Langsung di Jam Ramai Outlet",
    subheading: "Ketenangan operasional yang dirasakan langsung oleh pengelola cabang dan owner.",
    // TODO: Ganti dengan testimoni klien asli saat peluncuran publik
    items: [
      {
        quote: "Saat jaringan mall down serempak weekend lalu, cuma kasir kami yang tetap melayani antrian tanpa jeda.",
        author: "Owner Kafe",
        role: "Jaringan Kafe 4 Outlet",
        outletCount: "4 Cabang",
      },
      {
        quote: "Blind Closing langsung menghentikan kebiasaan kasir mencocok-cocokkan uang laci. Laporan harian jadi 100% jujur.",
        author: "Manajer Operasional",
        role: "Restoran Multi-Branch",
        outletCount: "7 Cabang",
      },
      {
        quote: "Void Guard membuat kasir berpikir dua kali sebelum batalkan pesanan. Celah kecurangan hilang total.",
        author: "Finance Lead",
        role: "Retail & Bakery Group",
        outletCount: "12 Cabang",
      },
    ],
  },
  pricing: {
    heading: "Investasi Terukur untuk Mengamankan Omzet",
    subheading: "Pilih paket yang sesuai dengan skala dan jumlah cabang bisnis Anda.",
    yearlyDiscountNote: "Hemat 2 bulan dengan tagihan tahunan",
    plans: [
      {
        id: "warung",
        name: "Warung",
        description: "Cocok untuk 1 outlet rintisan yang membutuhkan keandalan kasir offline dan blind closing.",
        monthlyPrice: 99000,
        yearlyPricePerMonth: 79000,
        outletLimit: "1 Outlet",
        deviceLimit: "Maks. 2 Perangkat",
        ctaText: "Mulai Paket Warung",
        ctaHref: "#daftar",
        features: [
          { name: "Full Offline-First PWA", included: true },
          { name: "Blind Closing Shift", included: true },
          { name: "Struk & Laporan Kasir", included: true },
          { name: "Void Guard Dasar", included: true },
          { name: "Multi-Outlet Dasbor", included: false },
          { name: "Kiosk Device Binding", included: false },
        ],
      },
      {
        id: "bisnis",
        name: "Bisnis",
        description: "Paket paling populer untuk owner dengan 2-10 cabang yang ingin pengawasan sentral.",
        monthlyPrice: 249000,
        yearlyPricePerMonth: 199000,
        highlighted: true,
        outletLimit: "Hingga 5 Outlet",
        deviceLimit: "Perangkat Tak Terbatas",
        ctaText: "Pilih Paket Bisnis",
        ctaHref: "#daftar",
        features: [
          { name: "Full Offline-First PWA", included: true },
          { name: "Blind Closing Shift", included: true },
          { name: "Void Guard + PIN Supervisor", included: true },
          { name: "Kiosk Mode Terkunci", included: true },
          { name: "Stock Opname & Waste Log", included: true },
          { name: "Dasbor Konsolidasi Multi-Outlet", included: true },
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        description: "Untuk jaringan retail & resto besar (>10 cabang) dengan kebutuhan SLA dan integrasi khusus.",
        monthlyPrice: 599000,
        yearlyPricePerMonth: 499000,
        outletLimit: "Cabang Tak Terbatas",
        deviceLimit: "Perangkat Tak Terbatas",
        ctaText: "Hubungi Sales",
        ctaHref: "#sales",
        features: [
          { name: "Semua fitur Paket Bisnis", included: true },
          { name: "Audit Trail Append-Only Lengkap", included: true },
          { name: "Dedicated Sync Server & Priority SLA", included: true },
          { name: "Integrasi ERP / Accounting API", included: true },
          { name: "Account Manager & Onboarding Khusus", included: true },
          { name: "Custom Role & Permission Matrix", included: true },
        ],
      },
    ] satisfies PricingPlan[],
  },
  faq: {
    heading: "Pertanyaan yang Sering Diajukan",
    subheading: "Penjelasan langsung tentang mekanisme ketahanan dan keamanan data Godinov POS V2.",
    items: [
      {
        id: "faq-1",
        question: "Apakah benar bisa transaksi tanpa internet sama sekali?",
        answer:
          "Ya. Godinov POS V2 dirancang dengan arsitektur Offline-First PWA. Database lokal di perangkat (IndexedDB) menyimpan seluruh katalog produk, pelanggan, dan transaksi. Kasir dapat membuka shift, mencetak struk via printer Bluetooth/USB, dan melayani antrian tanpa koneksi internet sama sekali.",
      },
      {
        id: "faq-2",
        question: "Bagaimana kalau perangkat rusak sebelum data tersinkron?",
        answer:
          "Antrian transaksi disimpan persisten di IndexedDB perangkat dengan replikasi berkala ke service worker cache. Bila perangkat mati kehabisan baterai, data tetap utuh saat dinyalakan kembali. Untuk pencegahan kerusakan fisik fatal, sistem merekomendasikan sinkronisasi periodik (bisa via tethering hotspot seluler darurat).",
      },
      {
        id: "faq-3",
        question: "Apakah kasir bisa mengubah atau menghapus transaksi yang sudah terkirim?",
        answer:
          "Tidak bisa. Semua data mutasi bersifat append-only. Pembatalan hanya bisa dilakukan melalui prosedur Void resmi yang mewajibkan input alasan dan verifikasi PIN supervisor. Seluruh riwayat tetap tercatat permanen di audit trail.",
      },
      {
        id: "faq-4",
        question: "Berapa lama proses migrasi dari sistem kasir lama?",
        answer:
          "Rata-rata outlet dapat beroperasi dalam 15 menit. Anda cukup mengunggah data menu/produk via template Excel/CSV yang kami sediakan, lalu buka aplikasi di browser tablet atau smartphone kasir.",
      },
      {
        id: "faq-5",
        question: "Perangkat apa saja yang didukung?",
        answer:
          "Semua perangkat yang memiliki browser modern: tablet Android, iPad, laptop Windows/Mac, serta POS all-in-one terminal (seperti Sunmi, iMin, dsb.). Tidak memerlukan hardware proprietary khusus.",
      },
      {
        id: "faq-6",
        question: "Siapa yang memiliki data saya?",
        answer:
          "Data transaksi, pelanggan, dan laporan keuangan 100% milik Anda. Anda dapat mengekspor seluruh basis data mentah kapan saja tanpa batasan atau biaya penguncian (vendor lock-in).",
      },
    ] satisfies FaqItem[],
  },
  finalCta: {
    heading: "Hari ini juga, selisih laci berhenti jadi tebakan.",
    subheading: "Pasang di satu outlet dulu. Bandingkan laporan minggu pertama dengan sistem lama Anda.",
    ctaPrimary: {
      text: "Coba Sekarang! Gratis!!",
      href: "#daftar",
    },
    ctaSecondary: {
      text: "Jadwalkan Demo 20 Menit",
      href: "#demo",
    },
  },
  footer: {
    description: "Sistem pengamanan uang tunai dan operasional kasir multi-outlet dengan ketahanan offline sejati.",
    columns: [
      {
        title: "Produk",
        links: [
          { label: "Fitur Utama", href: "#fitur" },
          { label: "Offline-First PWA", href: "#offline" },
          { label: "Blind Closing", href: "#keamanan" },
          { label: "Paket Harga", href: "#harga" },
        ],
      },
      {
        title: "Perusahaan",
        links: [
          { label: "Tentang Godinov", href: "#" },
          { label: "Hubungi Kami", href: "#" },
          { label: "Mitra Hardware", href: "#" },
        ],
      },
      {
        title: "Sumber Daya",
        links: [
          { label: "Panduan Setup", href: "#" },
          { label: "Dokumentasi API", href: "#" },
          { label: "Status Sistem", href: "#" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Ketentuan Layanan", href: "#" },
          { label: "Kebijakan Privasi", href: "#" },
          { label: "Keamanan Data", href: "#" },
        ],
      },
    ] satisfies FooterColumn[],
    copyright: "© 2026 Godinov POS. Hak cipta dilindungi undang-undang.",
  },
} as const;
