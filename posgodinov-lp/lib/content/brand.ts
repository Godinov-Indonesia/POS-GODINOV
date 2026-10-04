import type { ContactInfo } from "./types";

export const brandContent = {
  name: "Godinov POS",
  version: "V2",
  tagline: "Bergerak Menuju Hasil Profesional · Sistem Pengamanan Kas & Operasional",
  appUrl: "https://dashboard-pos.godinov.id",
  contacts: {
    phone: "+62-8829-4799-116",
    whatsapp: "+62 882-9479-9116",
    whatsappUrl: "https://wa.me/6288294799116?text=Halo%20Godinov,%20saya%20ingin%20tanya%20tentang%20Godinov%20POS%20V2",
    email: "contact@godinov.id",
    address: {
      street: "Jl. KH Mursan",
      locality: "Kelurahan Belendung",
      district: "Kecamatan Benda",
      city: "Tangerang",
      province: "Banten",
      postalCode: "15123",
      country: "Indonesia",
    },
    socials: {
      instagram: "https://www.instagram.com/godinov.id",
      linkedin: "https://www.linkedin.com/company/godinov-indonesia/",
      tiktok: "https://www.tiktok.com/@godinovid",
    },
  } satisfies ContactInfo,
} as const;
