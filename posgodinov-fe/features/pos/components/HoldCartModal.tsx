'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export type HoldCartModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: (label: string) => void
}

const PRESET_CHIPS = ['Meja 1', 'Meja 2', 'Takeaway', 'Drive Thru']

export function HoldCartModal({ open, onClose, onConfirm }: HoldCartModalProps) {
  const [label, setLabel] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Mengatur nilai default Pesanan #HH:mm dan melakukan fokus input saat modal terbuka
  React.useEffect(() => {
    if (open) {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      setLabel(`Pesanan #${hh}:${mm}`)
      
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    onConfirm(label.trim())
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tahan Pesanan Active"
      description="Berikan label/catatan untuk pesanan ini (misal: Meja 4, Nama Pelanggan, atau Order #02) agar mudah diambil kembali."
      footer={
        <div className="flex items-center gap-6">
          <Button variant="neutral" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => handleSubmit()} disabled={!label.trim()}>
            Tahan Pesanan
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <Input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Catatan / nomor meja..."
          className="text-pos-md font-medium"
        />

        <div className="flex flex-wrap gap-2">
          {PRESET_CHIPS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setLabel(preset)
                inputRef.current?.focus()
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg-muted px-4 text-pos-sm font-semibold text-fg transition-colors hover:bg-surface active:scale-[0.98]"
            >
              {preset}
            </button>
          ))}
        </div>
      </form>
    </Dialog>
  )
}
