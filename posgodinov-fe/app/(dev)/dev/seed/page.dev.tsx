import { SeederPanel } from '@/features/dev/components/SeederPanel'

export const metadata = { title: 'Data Seeder' }

/**
 * Route khusus pengembangan.
 *
 * Sufiks `.dev.tsx` membuat berkas ini dikenali sebagai halaman **hanya** saat
 * `NODE_ENV !== 'production'` — lihat `pageExtensions` di `next.config.ts`.
 * Penjagaan dilakukan di lapisan build, bukan runtime: `notFound()` di dalam
 * komponen tetap menyisakan seluruh fixture (termasuk PIN kasir) di dalam
 * bundle yang terkirim ke peramban.
 */
export default function DevSeedPage() {
  return <SeederPanel />
}
