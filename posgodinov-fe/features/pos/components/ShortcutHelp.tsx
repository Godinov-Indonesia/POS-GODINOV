'use client'

import * as React from 'react'

import { Dialog } from '@/components/ui/dialog'

/** Overlay bantuan pintasan (`F1`) — docs/06 §5.3. */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'F1', action: 'Tampilkan / sembunyikan bantuan ini' },
  { keys: 'F2', action: 'Fokus ke kolom pencarian produk' },
  { keys: 'Space', action: 'Buka pembayaran (bila fokus tidak di kolom teks)' },
  { keys: 'F4', action: 'Tahan pesanan aktif' },
  { keys: 'F8', action: 'Batalkan transaksi (void)' },
  { keys: 'F9', action: 'Sinkronisasi manual' },
  { keys: 'Esc', action: 'Batal / tutup dialog / kosongkan pencarian' },
]

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pintasan Keyboard"
      description="F5 dan Ctrl+R sengaja tidak dipakai — keduanya memuat ulang halaman dan dapat menghilangkan keranjang yang belum dibayar."
    >
      <dl className="mt-2 flex flex-col gap-1.5">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center gap-3">
            <dt className="w-16 shrink-0">
              <kbd className="rounded-sm border border-border-strong bg-bg-muted px-2 py-0.5 font-mono text-pos-xs">
                {shortcut.keys}
              </kbd>
            </dt>
            <dd className="text-pos-sm text-fg-muted">{shortcut.action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
