import type { SyncPhaseItem } from "./types";

export const syncEducationContent = {
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
} as const;

export const cashIntegrityContent = {
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
} as const;

export const testimonialContent = {
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
} as const;
