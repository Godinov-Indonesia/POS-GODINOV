import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { RootProviders } from "@/app/providers";
import { BRAND_THEME_COLOR } from "@/lib/constants/brand";
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
  title: {
    default: "POS Godinov",
    template: "%s · POS Godinov",
  },
  description: "Sistem Point of Sale dan manajemen inventori untuk bisnis ritel.",
  applicationName: "POS Godinov",
};

/**
 * `themeColor` memakai navy-950 agar bilah status perangkat menyatu dengan
 * StatusBar POS. Mode gelap dikunci mati ([06 §1.6]) — perangkat POS berada di
 * bawah pencahayaan toko yang terang, dan tema yang berubah mengikuti
 * preferensi sistem membuat kasir melihat antarmuka berbeda antar-perangkat.
 */
export const viewport: Viewport = {
  themeColor: BRAND_THEME_COLOR,
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Mencegah zoom tak sengaja saat kasir mengetuk cepat di tablet ([06 §5.7]).
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
