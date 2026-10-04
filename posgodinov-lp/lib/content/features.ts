import type { BentoItem } from "./types";

export const featureBentoContent = {
  heading: "Satu Aplikasi Kasir. Nol Titik Kebocoran.",
  subheading:
    "Semua alat penting yang dibutuhkan pemilik usaha cabang untuk mengamankan uang kas dan bahan baku.",
  items: [
    {
      slug: "blind-closing",
      title: "Hitung Laci Tertutup",
      description: "Kasir menghitung uang fisik tanpa melihat angka di sistem. Selisih laci hanya Anda yang bisa melihat.",
      spanDesktop: 7,
      tone: "default",
      badge: "Cegah Selisih",
    },
    {
      slug: "offline-first",
      title: "Jalan Penuh Tanpa Internet",
      description: "Transaksi dan cetak struk tetap lancar saat sinyal mati. Data tersimpan rapi dan terkirim otomatis saat online.",
      spanDesktop: 5,
      tone: "brand",
      badge: "Bebas Gangguan",
    },
    {
      slug: "void-guard",
      title: "Persetujuan Pembatalan",
      description: "Kasir tidak bisa membatalkan pesanan sembarangan. Setiap pembatalan wajib ada izin manajer dan alasan jelas.",
      spanDesktop: 6,
      tone: "default",
    },
    {
      slug: "kiosk-mode",
      title: "Kunci Aplikasi Kasir",
      description: "Perangkat terkunci khusus kasir. Karyawan tidak bisa keluar aplikasi, membuka medsos, atau berganti akun.",
      spanDesktop: 6,
      tone: "default",
    },
    {
      slug: "stock-opname",
      title: "Cek Stok & Bahan Terbuang",
      description: "Selisih barang dan bahan baku terbuang tercatat per staf dan per cabang setiap pergantian shift.",
      spanDesktop: 4,
      tone: "default",
    },
    {
      slug: "multi-outlet",
      title: "Kelola Banyak Cabang",
      description: "Pantau omzet semua cabang dari satu layar HP. Tambah menu atau ubah harga serempak dari rumah.",
      spanDesktop: 4,
      tone: "default",
    },
    {
      slug: "audit-trail",
      title: "Catatan Riwayat Kas",
      description: "Ketahui siapa yang mengubah data, kapan, dan di cabang mana. Catatan riwayat permanen dan tidak bisa dihapus.",
      spanDesktop: 4,
      tone: "default",
    },
  ] satisfies BentoItem[],
} as const;
