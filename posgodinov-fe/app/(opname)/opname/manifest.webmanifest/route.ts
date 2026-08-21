import type { MetadataRoute } from 'next'

import { BRAND_BACKGROUND_COLOR, OPNAME_THEME_COLOR } from '@/lib/constants/brand'

/**
 * Manifest PWA **kedua** — modul Opname Gudang ([11 §M16.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA ROUTE HANDLER, BUKAN `manifest.ts`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Konvensi `manifest.ts` Next hanya berlaku di **akar** `app/`; berkas dengan
 * nama itu di dalam subrute tidak menghasilkan apa pun. Karena `app/manifest.ts`
 * sudah dipakai aplikasi kasir, manifest kedua harus berupa Route Handler yang
 * menyajikan dokumen yang sama secara eksplisit.
 *
 * `scope: '/opname'` adalah inti berkas ini. Ia memberitahu peramban bahwa PWA
 * ini adalah aplikasi TERSENDIRI: ikonnya terpisah, jendelanya terpisah, dan
 * navigasi ke `/pos` dari dalamnya keluar dari aplikasi — bukan berpindah layar.
 *
 * `orientation: portrait` — kebalikan dari kasir. Petugas gudang berjalan
 * sambil memegang perangkat satu tangan dan mengetik dengan tangan lain;
 * landscape menuntut dua tangan yang tidak ia punya saat memegang barang.
 */
function manifest(): MetadataRoute.Manifest {
  return {
    name: 'POS Godinov — Opname Gudang',
    short_name: 'Godinov Opname',
    description: 'Modul stok opname untuk petugas gudang. Terpisah dari aplikasi kasir.',
    start_url: '/opname',
    scope: '/opname',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND_BACKGROUND_COLOR,
    theme_color: OPNAME_THEME_COLOR,
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

/**
 * `force-static` — dokumen ini harus ada di hasil `next build` agar service
 * worker dapat mem-precache-nya. Manifest yang hanya lahir saat runtime tidak
 * dapat dipasang di perangkat yang sedang offline.
 */
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(manifest(), {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
