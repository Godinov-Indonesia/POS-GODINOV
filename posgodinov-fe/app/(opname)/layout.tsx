import type { Metadata, Viewport } from 'next'

import { OPNAME_THEME_COLOR } from '@/lib/constants/brand'

export const metadata: Metadata = {
  title: 'Opname Gudang',
  // Modul gudang tidak boleh muncul di hasil pencarian maupun dipratinjau.
  robots: { index: false, follow: false },
  manifest: '/opname/manifest.webmanifest',
}

export const viewport: Viewport = {
  // Warna tema SENGAJA berbeda dari kasir.
  //
  // Perangkat gudang kadang berupa ponsel pribadi yang juga dipakai membuka
  // aplikasi lain; bilah status berwarna lain adalah isyarat pertama bahwa
  // petugas sedang berada di modul yang berbeda. Isyarat visual bukan
  // pengganti isolasi teknis — ia melengkapinya.
  themeColor: OPNAME_THEME_COLOR,
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

/**
 * Route group `(opname)` — **butir 4** ([11 §M16.1]).
 *
 * ⛔ Lapisan ini **dilarang** mengimpor apa pun dari `@/features/pos/**`.
 * Ditegakkan `no-restricted-imports` di `eslint.config.mjs`, dua arah.
 *
 * Tidak ada chrome Admin dan tidak ada StatusBar kasir di sini: petugas gudang
 * tidak boleh mendapat jalan menuju layar Void, Riwayat, maupun Tutup Shift —
 * persis pemisahan tugas yang butir 4 tegakkan.
 */
export default function OpnameLayout({ children }: LayoutProps<'/'>) {
  return children
}
