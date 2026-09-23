/**
 * Jembatan ke `workers/bcrypt.worker.ts` — ADR-08.
 *
 * Worker dibuat malas (saat verifikasi pertama) dan dipakai ulang: membuat
 * Worker baru per percobaan PIN membuang ±50 ms untuk memuat ulang bcryptjs.
 */

import type { BcryptRequest, BcryptResponse } from '@/workers/bcrypt.worker'

let worker: Worker | null = null
let nextRequestId = 1

const pending = new Map<number, (ok: boolean) => void>()

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  worker = new Worker(new URL('../../../workers/bcrypt.worker.ts', import.meta.url), {
    type: 'module',
  })

  worker.onmessage = (event: MessageEvent<BcryptResponse>) => {
    const resolve = pending.get(event.data.id)
    if (!resolve) return
    pending.delete(event.data.id)
    resolve(event.data.ok)
  }

  worker.onerror = () => {
    // Worker mati → tolak seluruh permintaan tertunda sebagai "tidak cocok".
    // Membiarkannya menggantung akan membekukan tombol MASUK selamanya.
    for (const resolve of pending.values()) resolve(false)
    pending.clear()
    worker?.terminate()
    worker = null
  }

  return worker
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  const active = ensureWorker()

  if (!active) {
    // Lingkungan tanpa Worker (SSR, peramban sangat lama). Tidak melakukan
    // fallback sinkron: itu akan membekukan UI 300 ms tanpa peringatan.
    return Promise.resolve(false)
  }

  const id = nextRequestId++
  return new Promise<boolean>((resolve) => {
    pending.set(id, resolve)
    active.postMessage({ id, pin, hash } satisfies BcryptRequest)
  })
}
