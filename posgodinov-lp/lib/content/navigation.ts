import type { NavItem, FooterColumn } from "./types";
import { brandContent } from "./brand";

export const headerContent = {
  navItems: [
    { label: "Fitur", href: "#fitur" },
    { label: "Offline-First", href: "#offline" },
    { label: "Keamanan", href: "#keamanan" },
    { label: "Harga", href: "#harga" },
    { label: "FAQ", href: "#faq" },
  ] satisfies NavItem[],
  loginText: "Masuk",
  loginHref: brandContent.appUrl,
  ctaText: "Coba Sekarang! Gratis!!",
  ctaHref: brandContent.appUrl,
  offlineBadge: "Mode Offline Aktif",
} as const;

export const footerContent = {
  description: "Sistem pengamanan uang tunai dan operasional kasir multi-outlet dengan ketahanan offline sejati.",
  columns: [
    {
      title: "Produk",
      links: [
        { label: "Fitur Utama", href: "#fitur" },
        { label: "Offline-First PWA", href: "#offline" },
        { label: "Blind Closing", href: "#keamanan" },
        { label: "Paket Harga", href: "#harga" },
      ],
    },
    {
      title: "Perusahaan",
      links: [
        { label: "Website Godinov", href: "https://godinov.id" },
        { label: "WhatsApp CS", href: brandContent.contacts.whatsappUrl },
        { label: "Instagram", href: brandContent.contacts.socials.instagram },
        { label: "LinkedIn", href: brandContent.contacts.socials.linkedin },
      ],
    },
    {
      title: "Sumber Daya",
      links: [
        { label: "Dashboard POS", href: brandContent.appUrl },
        { label: "Panduan Setup", href: "#" },
        { label: "Status Sistem", href: "#" },
      ],
    },
    {
      title: "Legal & Privasi",
      links: [
        { label: "Ketentuan Layanan", href: "#" },
        { label: "Kebijakan Privasi", href: "#" },
        { label: "Keamanan Data", href: "#" },
      ],
    },
  ] satisfies FooterColumn[],
  copyright: "© 2026 Godinov POS. Hak cipta dilindungi undang-undang.",
} as const;
