import { PosApp } from '@/features/pos/PosApp'

/**
 * ★ SATU-SATUNYA route POS (ADR-02, [05 §1.1.3]).
 *
 * `force-static` wajib: `next build` harus menghasilkan HTML nyata agar dapat
 * di-precache service worker. Tanpa ini, membuka aplikasi dalam mode pesawat
 * akan gagal pada dokumen HTML-nya sendiri.
 */
export const dynamic = 'force-static'
export const revalidate = false

export default function PosPage() {
  return <PosApp />
}
