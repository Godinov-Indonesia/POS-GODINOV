'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

/**
 * *Bottom sheet* — **butir 18** ([11 §M17.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA DIALOG TENGAH LAYAR DIGANTI SHEET BAWAH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dialog `<dialog>` yang berpusat di tengah menempatkan tombol konfirmasinya di
 * separuh ATAS layar pada handheld 6" — di luar zona jempol. Kasir harus
 * menyesuaikan genggaman untuk setiap konfirmasi, dan konfirmasi adalah hal
 * yang paling sering ia lakukan setelah menekan produk.
 *
 * Sheet ini muncul dari bawah dan menempatkan aksinya di **paling bawah**,
 * tepat di tempat jempol sudah berada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TETAP MEMAKAI `<dialog>`, BUKAN `<div>` BER-`position: fixed`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `showModal()` memberikan tiga hal gratis yang mahal ditiru dengan benar:
 * perangkap fokus, penutupan lewat `Esc`, dan lapisan atas (`::backdrop`) yang
 * berada di atas SELURUH konten tanpa perang `z-index`. Yang berubah hanya
 * posisi dan animasinya.
 */
export type SheetProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  /** Aksi utama di paling bawah — tempat jempol sudah berada. */
  footer?: React.ReactNode
  tone?: 'default' | 'danger'
  className?: string
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = 'default',
  className,
}: SheetProps) {
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
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className={cn(
        // `mt-auto mb-0` menempelkannya ke bawah; `max-w-none w-full` membuatnya
        // selebar layar pada handheld.
        'mb-0 mt-auto w-full max-w-none rounded-b-none rounded-t-2xl border border-b-0 border-border p-0 text-fg shadow-overlay',
        'backdrop:bg-brand/40',
        // Tablet: sheet tidak perlu selebar 1280 px. Dibatasi lalu diratakan ke
        // kanan, mengikuti alasan yang sama dengan bottom bar — sisi genggaman.
        'lg:mr-4 lg:w-[32rem] lg:rounded-b-2xl lg:mb-4',
        tone === 'danger' ? 'bg-danger-subtle' : 'bg-surface',
        className,
      )}
      aria-labelledby="sheet-title"
    >
      {/* Pegangan seret. Murni visual — ia memberi tahu bahwa panel ini datang
          dari bawah, sebuah isyarat yang sudah dikenali pengguna Android/iOS. */}
      <div className="flex justify-center pt-2" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-border-strong" />
      </div>

      <div className="flex flex-col gap-2 p-5">
        <h2 id="sheet-title" className="text-pos-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-pos-sm text-fg-muted">{description}</p> : null}
        {children}
      </div>

      {footer ? (
        <div
          className={cn(
            'flex flex-col gap-2 border-t border-border p-4',
            // Area aman iOS DI BAWAH tombol, bukan memakannya.
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
          )}
        >
          {footer}
        </div>
      ) : null}
    </dialog>
  )
}

/**
 * Konfirmasi destruktif dalam bentuk sheet — pengganti `ConfirmDialog`
 * pada jalur kasir ([11 §M17.1]).
 *
 * ⚠️ Tombol utama berada di **atas** tombol Batal, bukan di sebelahnya.
 *
 * Susunan berdampingan menempatkan keduanya pada jarak jempol yang sama, dan
 * jarak 24 px yang cukup di layar 10" menjadi 24 px yang tidak cukup di layar
 * 6". Susunan vertikal membuat aksi destruktif menuntut jangkauan yang berbeda
 * dari aksi batal — perbedaan yang tidak dapat hilang karena ukuran layar.
 */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  pending = false,
  tone = 'danger',
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  pending?: boolean
  tone?: 'default' | 'danger'
  children?: React.ReactNode
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      footer={
        <>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="xl"
            block
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Memproses…' : confirmLabel}
          </Button>
          {/* `neutral`, bukan `ghost`: tombol batal harus terlihat sebagai
              tombol. Teks telanjang di bawah tombol besar sering tidak dikenali
              sebagai sesuatu yang dapat diketuk. */}
          <Button variant="neutral" size="lg" block onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
        </>
      }
    >
      {children}
    </Sheet>
  )
}
