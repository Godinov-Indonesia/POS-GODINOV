import { brandContent } from "./brand";

export const heroContent = {
  eyebrow: "Sistem Kasir Handal · Tetap jalan saat sinyal hilang",
  headline: "Kasir tetap jalan. Uang tidak ikut jalan-jalan.",
  subheadline:
    "Godinov POS terus melayani penjualan walau internet mati total, lalu menutup celah kebocoran kas lewat hitung laci tertutup dan izin pembatalan ketat. Setiap rupiah ada catatannya.",
  ctaPrimary: {
    text: "Coba Sekarang, Gratis!",
    href: brandContent.appUrl,
  },
  ctaSecondary: {
    text: "Pelajari Fitur",
    href: "#fitur",
  },
  microProof: [
    "Tanpa biaya tersembunyi",
    "Siap pakai 15 menit",
    "Data toko milik Anda 100%",
  ],
} as const;

export const finalCtaContent = {
  heading: "Hari ini juga, selisih laci berhenti jadi tebakan.",
  subheading:
    "Coba di satu cabang dulu. Bandingkan ketepatan laporan shift minggu pertama dengan kasir lama Anda.",
  ctaPrimary: {
    text: "Mulai Sekarang, Gratis!",
    href: brandContent.appUrl,
  },
  ctaSecondary: {
    text: "Konsultasi via WhatsApp",
    href: brandContent.contacts.whatsappUrl,
  },
} as const;
