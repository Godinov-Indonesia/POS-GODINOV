import type { BentoItem } from "./types";

export const featureBentoContent = {
  heading: "Satu Sistem Operasional. Nol Titik Buta.",
  subheading:
    "Semua instrumen yang dibutuhkan owner multi-outlet untuk mengunci arus kas dan inventaris.",
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
} as const;
