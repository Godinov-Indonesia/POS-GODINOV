import type { FaqItem } from "./types";

export const faqContent = {
  heading: "Pertanyaan yang Sering Diajukan",
  subheading: "Jawaban praktis dan transparan seputar penggunaan kasir untuk usaha Anda.",
  items: [
    {
      id: "faq-1",
      question: "Bagaimana cara mulai menggunakan Godinov POS?",
      answer:
        "Cukup daftar akun gratis, masukkan daftar menu atau produk Anda, dan aplikasi kasir langsung siap dipakai bertransaksi dalam 15 menit.",
    },
    {
      id: "faq-2",
      question: "Apakah saya wajib membeli alat kasir khusus atau hardware mahal?",
      answer:
        "Tidak wajib. Anda bisa menggunakan perangkat yang sudah ada seperti tablet Android, iPad, HP Android/iPhone, hingga laptop, serta printer thermal bluetooth biasa.",
    },
    {
      id: "faq-3",
      question: "Bagaimana jika saya ingin mencoba dulu sebelum berlangganan?",
      answer:
        "Anda bisa langsung memakai Paket Gratis tanpa biaya. Ketika cabang Anda bertambah atau butuh fitur pengaman lebih lanjut, Anda bisa upgrade kapan saja.",
    },
    {
      id: "faq-4",
      question: "Apakah ada kontrak mengikat atau biaya tersembunyi?",
      answer:
        "Sama sekali tidak ada ikatan kontrak dan tidak ada biaya tersembunyi. Anda bebas berlangganan bulanan atau berhenti kapan saja sesuai kebutuhan usaha Anda.",
    },
    {
      id: "faq-5",
      question: "Bagaimana jika kasir saya bingung atau mengalami kendala?",
      answer:
        "Tim Customer Care Godinov siap mendampingi Anda via WhatsApp setiap hari, lengkap dengan panduan penggunaan yang mudah dipahami staf baru.",
    },
    {
      id: "faq-6",
      question: "Apakah laporan dan data keuangan toko saya aman?",
      answer:
        "Sangat aman. Data penjualan toko Anda tersimpan dengan perlindungan berlapis, milik Anda 100%, dan bisa Anda unduh ke Excel kapan saja.",
    },
  ] satisfies FaqItem[],
} as const;
