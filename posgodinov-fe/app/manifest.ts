import type { MetadataRoute } from 'next'

import { BRAND_BACKGROUND_COLOR, BRAND_THEME_COLOR } from '@/lib/constants/brand'

/**
 * Web App Manifest — docs/05 §1.5.2.
 *
 * `start_url` menunjuk `/pos`, bukan akar: perangkat kasir yang dipasang di
 * layar utama harus membuka aplikasi kasir langsung, bukan Dashboard Admin.
 *
 * `orientation: landscape` mengikuti target perangkat utama — tablet 10" yang
 * dipegang mendatar ([06 §3.1]).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'POS Godinov — Kasir',
    short_name: 'Godinov POS',
    description: 'Aplikasi kasir offline-first untuk outlet ritel.',
    start_url: '/pos',
    scope: '/pos',
    display: 'standalone',
    orientation: 'landscape',
    background_color: BRAND_BACKGROUND_COLOR,
    theme_color: BRAND_THEME_COLOR,
    lang: 'id',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
