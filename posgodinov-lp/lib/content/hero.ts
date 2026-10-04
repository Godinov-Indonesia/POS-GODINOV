import { brandContent } from "./brand";

export const heroContent = {
  eyebrow: "Offline-First PWA · Dirancang untuk outlet dengan sinyal 1 bar",
  headline: "Kasir tetap jalan. Uang tidak ikut jalan-jalan.",
  subheadline:
    "Godinov POS V2 terus melayani transaksi walau internet mati total, lalu mengunci celah kebocoran kas lewat Blind Closing, Void Guard, dan Kiosk Mode. Setiap rupiah punya jejak.",
  ctaPrimary: {
    text: "Coba Sekarang! Gratis!!",
    href: brandContent.appUrl,
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
} as const;

export const finalCtaContent = {
  heading: "Hari ini juga, selisih laci berhenti jadi tebakan.",
  subheading:
    "Pasang di satu outlet dulu. Bandingkan laporan minggu pertama dengan sistem lama Anda.",
  ctaPrimary: {
    text: "Coba Sekarang! Gratis!!",
    href: brandContent.appUrl,
  },
  ctaSecondary: {
    text: "Hubungi WhatsApp CS",
    href: brandContent.contacts.whatsappUrl,
  },
} as const;
