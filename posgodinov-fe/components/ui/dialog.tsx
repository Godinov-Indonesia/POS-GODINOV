'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

/**
 * Modal berbasis elemen `<dialog>` native — docs/06 §4.8 & §5.6.
 *
 * `showModal()` memberi manajemen fokus, `inert` pada latar, dan penutupan
 * `Esc` secara bawaan peramban; menulis ulang semua itu dengan `div` adalah
 * sumber bug aksesibilitas yang tidak perlu.
 */
export type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  /** Modal destruktif memakai latar `danger-subtle` ([06 §1.3]). */
  tone?: 'default' | 'danger'
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = 'default',
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // `Esc` memicu `cancel`; cegah default agar penutupan selalu lewat onClose.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className={cn(
        'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border p-0 text-fg shadow-overlay',
        'backdrop:bg-brand/40',
        tone === 'danger' ? 'bg-danger-subtle' : 'bg-surface',
        className,
      )}
      aria-labelledby="dialog-title"
    >
      <div className="flex flex-col gap-2 p-5">
        <h2 id="dialog-title" className="text-pos-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-pos-sm text-fg-muted">{description}</p> : null}
        {children}
      </div>
      {footer ? (
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">{footer}</div>
      ) : null}
    </dialog>
  )
}

/**
 * Dialog konfirmasi destruktif.
 *
 * ⚠️ Tombol "Batal" memakai varian `neutral`, bukan `danger` — merah
 * dicadangkan untuk aksi yang menghancurkan data ([06 §4.1]). Jarak antar
 * tombol ≥ 24px karena salah satunya destruktif ([06 §2.1]).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  pending?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone="danger"
      footer={
        <div className="flex items-center gap-6">
          <Button variant="neutral" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Memproses…' : confirmLabel}
          </Button>
        </div>
      }
    />
  )
}
