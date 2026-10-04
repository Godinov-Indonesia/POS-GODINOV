import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { siteContent } from "@/lib/content";
import { Mail, MessageCircle, MapPin } from "lucide-react";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>
    </svg>
  );
}

export function SiteFooter() {
  const { contacts } = siteContent.brand;

  return (
    <footer data-testid="site-footer" className="border-t border-ink-800/80 bg-ink-950 pt-16 pb-12 text-sm text-paper-50/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-ink-800/60">
          <div className="md:col-span-4 lg:col-span-5 space-y-4">
            <Link href="/" className="inline-block" aria-label="Godinov POS Beranda">
              <Image src="/images/logo-transparent.webp" alt="Godinov POS" width={140} height={40} className="h-8 w-auto object-contain" />
            </Link>
            <p className="text-xs sm:text-sm text-paper-50/60 max-w-sm leading-relaxed">
              Sistem kasir handal yang tetap melayani penjualan tanpa sinyal, menutup celah kebocoran kas, dan mengamankan omzet cabang Anda.
            </p>
            <div className="flex items-center gap-4 pt-1">
              <a href={contacts.socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-brand-500" aria-label="Instagram"><InstagramIcon className="h-4 w-4" /></a>
              <a href={contacts.socials.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-brand-500" aria-label="LinkedIn"><LinkedinIcon className="h-4 w-4" /></a>
              <a href={`mailto:${contacts.email}`} className="hover:text-brand-500" aria-label="Email"><Mail className="h-4 w-4" /></a>
            </div>
          </div>

          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <h4 className="font-semibold text-paper-50 text-xs font-mono uppercase tracking-wider">Navigasi</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="#fitur" className="hover:text-paper-50">Fitur Kasir</Link></li>
              <li><Link href="#masalah" className="hover:text-paper-50">Solusi Masalah</Link></li>
              <li><Link href={siteContent.brand.appUrl} className="hover:text-brand-500">Aplikasi Kasir</Link></li>
              <li><a href="https://godinov.id" target="_blank" rel="noopener noreferrer" className="hover:text-paper-50">Website Resmi Godinov</a></li>
            </ul>
          </div>

          <div className="md:col-span-4 lg:col-span-4 space-y-3">
            <h4 className="font-semibold text-paper-50 text-xs font-mono uppercase tracking-wider">Hubungi Kami</h4>
            <div className="space-y-2 text-xs text-paper-50/80">
              <a href={contacts.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-500">
                <MessageCircle className="h-4 w-4 text-brand-500 shrink-0" />
                <span>{contacts.whatsapp}</span>
              </a>
              <a href={`mailto:${contacts.email}`} className="flex items-center gap-2 hover:text-brand-500">
                <Mail className="h-4 w-4 text-brand-500 shrink-0" />
                <span>{contacts.email}</span>
              </a>
              <div className="flex items-start gap-2 text-paper-50/60">
                <MapPin className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
                <span>Tangerang, Banten, Indonesia</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-paper-50/50">
          <p>© 2026 Godinov. All rights reserved. · Proudly built in Indonesia.</p>
          <a href="https://godinov.id" target="_blank" rel="noopener noreferrer" className="hover:text-paper-50">Godinov Indonesia</a>
        </div>
      </div>
    </footer>
  );
}
