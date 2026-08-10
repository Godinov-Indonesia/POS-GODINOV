'use client'

import { Toaster as SonnerToaster, toast } from 'sonner'

import { PosApiError } from '@/lib/api/errors'

/**
 * Umpan balik error — docs/05 §3.2.
 *
 * `response.message` adalah pesan utama untuk pengguna. Seluruhnya sudah
 * berbahasa Indonesia dan layak tampil apa adanya
 * (`"akses ditolak: outlet ini bukan milik bisnis Anda"`). Jangan menerjemahkan
 * ulang, jangan menggantinya dengan pesan generik.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors={false}
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border border-border bg-surface text-fg shadow-elevated',
          title: 'text-pos-base font-semibold',
          description: 'text-pos-sm text-fg-muted',
          error: 'border-danger bg-danger-subtle text-danger',
          success: 'border-success-text/30 bg-success-subtle text-success-text',
          warning: 'border-warning bg-warning-subtle text-warning-text',
        },
      }}
    />
  )
}

/**
 * Satu-satunya jalur menampilkan kegagalan API.
 *
 * Backend tidak memakai kode status secara semantik ([03 §0]), sehingga
 * percabangan `403`/`404` tidak pernah tereksekusi — yang dipakai adalah
 * `message`. `fieldErrors` ditampilkan sebagai deskripsi tambahan bila ada.
 */
export function toastApiError(error: unknown, fallback = 'Terjadi kesalahan'): void {
  if (error instanceof PosApiError) {
    const details = error.fieldErrors ? Object.values(error.fieldErrors).join(' · ') : undefined
    toast.error(error.message, {
      description: details && details !== error.message ? details : undefined,
    })
    return
  }

  if (error instanceof Error) {
    toast.error(error.message || fallback)
    return
  }

  toast.error(fallback)
}

export { toast }
