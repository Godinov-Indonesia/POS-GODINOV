'use client'

import * as React from 'react'

/**
 * Mendaftarkan service worker modul Opname — **butir 4** ([11 §M16.1]).
 *
 * `scope: '/opname'` adalah inti hook ini. Peramban tidak akan pernah memberi
 * worker ini permintaan `/pos`, dan sebaliknya `sw.js` (scope `/pos`) tidak
 * pernah menerima permintaan `/opname`. Isolasi cache ditegakkan peramban,
 * bukan oleh kedisiplinan penulis kode.
 *
 * Berkas workernya pun terpisah — `sw-opname.js`, dengan prefiks cache
 * `posgodinov-opname-`. Perangkat yang memasang KEDUA PWA menjalankan dua
 * worker berdampingan tanpa saling menghapus cache.
 */
export function useOpnameServiceWorker(): void {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // SW hanya berjalan di secure context; pada dev http:// non-localhost ini
    // akan gagal, dan itu bukan kondisi yang perlu dilaporkan ke petugas.
    void navigator.serviceWorker.register('/sw-opname.js', { scope: '/opname' }).catch(() => {})
  }, [])
}
