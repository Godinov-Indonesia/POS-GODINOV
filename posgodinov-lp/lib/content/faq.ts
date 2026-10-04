import type { FaqItem } from "./types";

export const faqContent = {
  heading: "Pertanyaan yang Sering Diajukan",
  subheading: "Jawaban langsung seputar penggunaan kasir dan keamanan uang toko Anda.",
  items: [
    {
      id: "faq-1",
      question: "Apakah benar kasir bisa melayani pembeli tanpa internet sama sekali?",
      answer:
        "Ya. Godinov POS menyimpan daftar menu dan nota langsung di dalam tablet atau HP kasir. Saat mati lampu atau internet padam, kasir tetap bisa cetak struk dan melayani antrean seperti biasa. Data otomatis terkirim saat internet menyala lagi.",
    },
    {
      id: "faq-2",
      question: "Bagaimana jika tablet kasir mati mendadak saat antrean ramai?",
      answer:
        "Tenang, semua transaksi sudah langsung tersimpan di memori perangkat seketika tombol bayar ditekan. Saat tablet dinyalakan kembali atau dipindahkan ke HP cadangan, semua nota penjualan tetap utuh dan aman.",
    },
    {
      id: "faq-3",
      question: "Apakah kasir bisa mengubah atau menghapus nota yang sudah dicetak?",
      answer:
        "Tidak bisa. Kasir tidak bisa mengutak-atik nota yang sudah selesai. Jika ada salah input, pembatalan wajib persetujuan manajer lewat PIN rahasia, dan riwayatnya tetap tercatat rapi untuk dipantau pemilik toko.",
    },
    {
      id: "faq-4",
      question: "Berapa lama waktu yang dibutuhkan untuk mulai memakai kasir ini?",
      answer:
        "Rata-rata cabang toko bisa langsung jualan dalam 15 menit. Anda cukup masukkan daftar menu via template Excel sederhana, lalu buka aplikasinya di tablet atau HP kasir.",
    },
    {
      id: "faq-5",
      question: "Perangkat apa saja yang bisa digunakan?",
      answer:
        "Bisa menggunakan perangkat apa pun yang sudah Anda miliki: tablet Android, iPad, HP Android/iPhone, hingga laptop. Tidak wajib beli mesin kasir mahal.",
    },
    {
      id: "faq-6",
      question: "Apakah data omzet dan pelanggan aman dan milik saya sepenuhnya?",
      answer:
        "100% milik Anda. Data laporan omzet, rekap kasir, dan pelanggan bisa Anda unduh ke Excel kapan saja secara bebas tanpa biaya tambahan.",
    },
  ] satisfies FaqItem[],
} as const;
