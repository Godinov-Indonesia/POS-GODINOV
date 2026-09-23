import type { Metadata, Viewport } from 'next'

import { BRAND_THEME_COLOR } from '@/lib/constants/brand'

export const metadata: Metadata = {
  title: 'Kasir',
  // POS tidak boleh muncul di hasil pencarian maupun dipratinjau.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: BRAND_THEME_COLOR,
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

/**
 * Route group `(pos)` bersifat client-only dan statis ([05 §1.1.1]).
 * Tidak ada chrome Admin di sini — StatusBar POS menggantikannya.
 */
export default function PosLayout({ children }: LayoutProps<'/'>) {
  return children
}
