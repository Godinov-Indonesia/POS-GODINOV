import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://posgodinov.com"),
  title: {
    default: "Godinov POS V2 — Sistem Kasir Offline-First & Integritas Kas",
    template: "%s · Godinov POS V2",
  },
  description:
    "Godinov POS V2 terus melayani transaksi walau internet mati total, lalu mengunci celah kebocoran kas lewat Blind Closing, Void Guard, dan Kiosk Mode.",
  keywords: [
    "POS",
    "Aplikasi Kasir",
    "Offline-First",
    "Blind Closing",
    "Void Guard",
    "Multi-Outlet",
    "F&B",
    "Retail",
  ],
  authors: [{ name: "Godinov POS" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://posgodinov.com",
    siteName: "Godinov POS V2",
    title: "Godinov POS V2 — Kasir tetap jalan. Uang tidak ikut jalan-jalan.",
    description:
      "Sistem kasir offline-first dengan perlindungan anti-kebocoran kas untuk bisnis multi-outlet retail dan F&B.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Godinov POS V2 — Kasir tetap jalan. Uang tidak ikut jalan-jalan.",
    description:
      "Sistem kasir offline-first dengan perlindungan anti-kebocoran kas untuk bisnis multi-outlet retail dan F&B.",
  },
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B061A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}
    >
      <body className="min-h-screen bg-ink-950 text-paper-50 flex flex-col font-display selection:bg-brand-500/30 selection:text-paper-50">
        <a href="#main" className="sr-only">
          Lewati ke konten utama
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
