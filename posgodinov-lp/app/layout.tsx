import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeColorSync } from "@/components/providers/ThemeColorSync";
import { PagePreloader } from "@/components/common/PagePreloader";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
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
    default: "Godinov POS | Sistem Kasir Handal dan Aman",
    template: "%s | Godinov POS",
  },
  description:
    "Godinov POS terus melayani transaksi walau internet mati total, menjaga uang kas tetap aman dari kebocoran dan manipulasi.",
  keywords: [
    "POS",
    "Aplikasi Kasir",
    "Kasir Toko",
    "Kasir Restoran",
    "Kasir Multi Outlet",
    "Anti Kebocoran Kas",
    "F&B",
    "Retail",
  ],
  authors: [{ name: "Godinov POS" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://posgodinov.com",
    siteName: "Godinov POS",
    title: "Godinov POS | Kasir Tetap Jalan, Uang Tetap Aman",
    description:
      "Sistem kasir handal dengan perlindungan anti-kebocoran kas untuk bisnis multi-outlet retail dan F&B.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Godinov POS | Kasir Tetap Jalan, Uang Tetap Aman",
    description:
      "Sistem kasir handal dengan perlindungan anti-kebocoran kas untuk bisnis multi-outlet retail dan F&B.",
  },
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B061A",
  colorScheme: "dark light",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-ink-950 text-paper-50 flex flex-col font-display selection:bg-brand-500/30 selection:text-paper-50">
        <ThemeProvider>
          <ThemeColorSync />
          <PagePreloader />
          <a href="#main" className="sr-only">
            Lewati ke konten utama
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
