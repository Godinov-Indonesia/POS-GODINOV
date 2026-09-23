import { redirect } from 'next/navigation'

/**
 * Akar tidak punya UI sendiri. Admin dan POS berada di ruang URL terpisah
 * dengan prefiks eksplisit ([05 §1.1.1 butir 2]) supaya service worker dapat
 * menyaring berdasarkan prefiks: `/pos/*` di-precache, `/admin/*` tidak pernah.
 */
export default function RootPage() {
  redirect('/admin')
}
