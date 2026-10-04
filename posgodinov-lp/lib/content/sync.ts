import type { SyncPhaseItem } from "./types";

export const syncEducationContent = {
  heading: "Apa yang terjadi saat internet toko mati jam 7 malam?",
  subheading: "Tiga langkah berikut berjalan otomatis. Kasir tidak perlu menekan tombol apa pun.",
  phases: [
    {
      phase: 1,
      label: "Langkah 1",
      title: "Saat Normal",
      description:
        "Setiap penjualan tersimpan di tablet kasir dan langsung terhubung dengan laporan di HP Anda.",
    },
    {
      phase: 2,
      label: "Langkah 2",
      title: "Internet Putus",
      description:
        "Sinyal hilang total. Kasir tetap bisa input pesanan dan cetak struk tanpa gangguan. Semua nota tersimpan aman di tablet.",
    },
    {
      phase: 3,
      label: "Langkah 3",
      title: "Sinyal Kembali",
      description:
        "Semua transaksi otomatis terkirim tanpa risiko data dobel. Jam penjualan tetap sesuai saat pembeli membayar.",
    },
  ] satisfies SyncPhaseItem[],
  technicalNote:
    "Otomatis tersimpan di memori kasir · Jam transaksi akurat sesuai waktu bayar · Nol risiko data dobel",
  summaryBadge: "12 transaksi · 1 shift · 3 sisa bahan · tersinkron rapi",
} as const;

export const cashIntegrityContent = {
  heading: "Hitung Laci Tertutup: Uji Kejujuran Tanpa Curiga",
  subheading:
    "Saat tutup shift, kasir memasukkan jumlah uang fisik yang dihitung di tangan. Mereka tidak pernah diberi tahu target oleh sistem.",
  expectedAmount: 4850000,
  voidGuard: {
    title: "Izin Pembatalan Transaksi",
    description: "Setiap pembatalan pesanan atau struk wajib meminta PIN manajer dan mencantumkan alasan yang jelas.",
  },
  kioskMode: {
    title: "Kunci Layar Tablet Kasir",
    description: "Aplikasi terkunci di tablet kasir, mencegah staf membuka YouTube, game, atau medsos saat jam kerja.",
  },
} as const;

export const testimonialContent = {
  heading: "Diuji Langsung di Jam Ramai Outlet",
  subheading: "Ketenangan operasional yang dirasakan langsung oleh pengelola cabang dan pemilik usaha.",
  // TODO: Ganti dengan testimoni klien asli saat peluncuran publik
  items: [
    {
      quote: "Saat jaringan mall down serempak weekend lalu, cuma kasir kami yang tetap melayani antrean tanpa jeda.",
      author: "Pemilik Kafe",
      role: "Jaringan Kafe 4 Cabang",
      outletCount: "4 Cabang",
    },
    {
      quote: "Hitung laci tertutup langsung menghentikan kebiasaan mencocok-cocokkan uang laci. Laporan harian jadi 100% jujur.",
      author: "Manajer Operasional",
      role: "Restoran 7 Cabang",
      outletCount: "7 Cabang",
    },
    {
      quote: "Izin pembatalan membuat kasir tidak bisa sembarangan membatalkan pesanan setelah pelanggan bayar.",
      author: "Bagian Keuangan",
      role: "Jaringan Bakery 12 Cabang",
      outletCount: "12 Cabang",
    },
  ],
} as const;
