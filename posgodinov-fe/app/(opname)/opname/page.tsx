import { OpnameApp } from '@/features/opname/OpnameApp'

/**
 * ★ SATU-SATUNYA route modul Opname ([11 §M16.1]).
 *
 * `force-static` wajib, dengan alasan yang persis sama seperti `/pos`:
 * `next build` harus menghasilkan HTML nyata agar dapat di-precache service
 * worker. Tanpa ini, membuka aplikasi di gudang tanpa sinyal akan gagal pada
 * dokumen HTML-nya sendiri.
 */
export const dynamic = 'force-static'
export const revalidate = false

export default function OpnamePage() {
  return <OpnameApp />
}
