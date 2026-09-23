'use client'

import * as React from 'react'

import { posNavigate, usePosRouterStore } from '@/features/pos/router/usePosRouter'
import { runManualSync } from '@/features/pos/sync/useSyncEngine'

/**
 * Pintasan keyboard POS — docs/06 §5.1.
 *
 * Target: kasir berpengalaman pada desktop dengan keyboard fisik dapat
 * menyelesaikan transaksi tanpa menyentuh tetikus maupun layar.
 *
 * **Tombol yang sengaja tidak dipakai** — peramban merebutnya lebih dulu dan
 * `preventDefault()` tidak selalu berhasil: `F3`, `F5` (berbahaya — dapat
 * menghilangkan keranjang), `F6`, `F7`, `F11`, `F12`, `Ctrl+W`, `Ctrl+R`.
 */
export type ShortcutHandlers = {
  onFocusSearch?: () => void
  onPay?: () => void
  onHold?: () => void
  onEscape?: () => void
  onToggleHelp?: () => void
}

/**
 * `Space` adalah tombol paling ambigu di web: ia mengetik spasi di kolom teks
 * dan mengaktifkan `<button>` yang sedang difokuskan. Tanpa penjaga ini,
 * memasangnya sebagai pintasan checkout **akan** membuka pembayaran secara
 * tidak sengaja ([06 §5.2]).
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    // `Space` juga mengaktifkan tombol yang difokuskan — biarkan itu yang jalan.
    tag === 'BUTTON'
  )
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  // Pola "latest ref" — lihat catatan yang sama di `useBarcodeScanner`.
  const ref = React.useRef(handlers)
  React.useEffect(() => {
    ref.current = handlers
  })

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const screen = usePosRouterStore.getState().screen
      const typing = isTypingTarget(event.target)

      switch (event.key) {
        case 'F1':
          // Firefox membuka bantuan bawaan — preventDefault wajib.
          event.preventDefault()
          ref.current.onToggleHelp?.()
          return

        case 'F2':
          if (screen !== 'register') return
          event.preventDefault()
          ref.current.onFocusSearch?.()
          return

        case 'F4':
          if (screen !== 'register') return
          event.preventDefault()
          ref.current.onHold?.()
          return

        case 'F8':
          event.preventDefault()
          posNavigate('void')
          return

        case 'F9':
          event.preventDefault()
          void runManualSync()
          return

        case 'Escape':
          ref.current.onEscape?.()
          return

        case ' ':
          if (typing || screen !== 'register') return
          event.preventDefault()
          ref.current.onPay?.()
          return

        default:
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
