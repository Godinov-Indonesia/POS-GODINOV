import type { FaqItem } from "./types";

export const faqContent = {
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
} as const;
