'use client'

import * as React from 'react'

/**
 * Registrasi service worker POS.
 *
 * Dipasang hanya dari cabang POS: mendaftarkannya dari Admin akan memberi
 * scope yang lebih luas dari yang diinginkan, dan Admin memang tidak boleh
 * di-cache ([05 §1.5.2]).
 */
export function useServiceWorker(): void {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // SW hanya berjalan di secure context; pada dev http:// non-localhost ini
    // akan gagal, dan itu bukan kondisi yang perlu dilaporkan ke kasir.
    void navigator.serviceWorker.register('/sw.js', { scope: '/pos' }).catch(() => {})
  }, [])
}
