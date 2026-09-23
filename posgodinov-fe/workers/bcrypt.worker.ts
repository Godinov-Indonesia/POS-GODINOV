/**
 * Verifikasi PIN kasir di luar main thread — ADR-08, docs/04 §A.3.
 *
 * `bcryptjs` murni JavaScript dan lambat: satu perbandingan pada cost 10
 * memerlukan ±100–300 ms di tablet kelas menengah. Menjalankannya di main
 * thread membekukan UI persis pada momen kasir menekan "MASUK".
 *
 * ⚠️ **Jangan menurunkan cost.** Nilainya ditentukan backend saat membuat hash;
 * klien hanya membandingkan.
 */

import bcrypt from 'bcryptjs'

export type BcryptRequest = {
  id: number
  pin: string
  hash: string
}

export type BcryptResponse = {
  id: number
  ok: boolean
  error?: string
}

self.onmessage = (event: MessageEvent<BcryptRequest>) => {
  const { id, pin, hash } = event.data

  try {
    const ok = bcrypt.compareSync(pin, hash)
    ;(self as unknown as Worker).postMessage({ id, ok } satisfies BcryptResponse)
  } catch (error) {
    // Hash rusak atau format tak dikenal → perlakukan sebagai gagal cocok,
    // bukan sebagai crash. Kasir tetap mendapat pesan yang sama.
    ;(self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'bcrypt gagal',
    } satisfies BcryptResponse)
  }
}
