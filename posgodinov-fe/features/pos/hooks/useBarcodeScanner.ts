'use client'

import * as React from 'react'

/**
 * Deteksi pemindai barcode — docs/06 §5.4.2.
 *
 * Pemindai USB/Bluetooth berperilaku sebagai **keyboard HID**: ia "mengetik"
 * karakter sangat cepat lalu mengirim `Enter`. Ciri pembeda dari manusia adalah
 * **jeda antar-ketukan**, bukan isi karakternya.
 *
 * ⚠️ **Kendala backend.** Tabel `products` tidak punya kolom `barcode` maupun
 * `sku` ([02 §2.6]), sehingga hasil pindaian tidak dapat dicocokkan ke katalog
 * server. Pemetaan lokal per-perangkat adalah jalan keluar v1 ([06 §5.4.1]) —
 * hook ini hanya menyediakan **deteksinya**; pemetaan kode ke produk adalah
 * tanggung jawab pemanggil.
 */
const MAX_INTER_KEY_MS = 35 // manusia jarang < 50ms; pemindai biasanya 5–20ms
const MIN_LENGTH = 6 // EAN-8 terpendek yang masuk akal
const BUFFER_TIMEOUT_MS = 120

export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: { enabled?: boolean } = {},
): void {
  const enabled = options.enabled ?? true

  // Pola "latest ref": listener dipasang sekali, tetapi selalu memanggil
  // callback terbaru. Menugaskan ref saat render melanggar aturan React —
  // pembaruan harus terjadi setelah render selesai.
  const handler = React.useRef(onScan)
  React.useEffect(() => {
    handler.current = onScan
  })

  React.useEffect(() => {
    if (!enabled) return

    let buffer = ''
    let lastKeyAt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const reset = () => {
      buffer = ''
      clearTimeout(timer)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const now = performance.now()
      const delta = now - lastKeyAt
      lastKeyAt = now

      if (event.key === 'Enter') {
        if (buffer.length >= MIN_LENGTH) {
          event.preventDefault() // jangan submit form apa pun
          handler.current(buffer)
        }
        reset()
        return
      }

      // Hanya karakter tunggal yang dapat dipindai; tombol kontrol diabaikan.
      if (event.key.length !== 1) return

      // Jeda terlalu panjang → ini manusia mengetik, bukan pemindai. Buffer
      // dimulai ulang agar ketikan biasa tidak pernah terbaca sebagai barcode.
      buffer = delta > MAX_INTER_KEY_MS ? event.key : buffer + event.key

      clearTimeout(timer)
      timer = setTimeout(reset, BUFFER_TIMEOUT_MS)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      clearTimeout(timer)
    }
  }, [enabled])
}
