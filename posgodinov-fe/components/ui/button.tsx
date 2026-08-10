'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Sistem tombol — docs/06 §4.1. Fondasi seluruh komponen lain.
 *
 * Ukuran diturunkan dari **konsekuensi kesalahan**, bukan kepadatan visual
 * ([06 §2.1]): semakin sulit sebuah aksi dibatalkan, semakin besar targetnya.
 *
 * | Varian    | Dipakai untuk                              | Dilarang untuk                         |
 * |-----------|--------------------------------------------|----------------------------------------|
 * | `primary` | Bayar, Simpan, Submit, Masuk               | Aksi yang bisa merusak data            |
 * | `cash`    | HANYA `BAYAR TUNAI` / `SELESAIKAN & CETAK` | Aksi non-final; label < 22px ([06 §1.5]) |
 * | `danger`  | Void, Hapus, Kosongkan, Batalkan Shift     | Tombol "Batal" pada modal              |
 * | `neutral` | Batal, Tahan, filter, aksi sekunder        | Aksi utama                             |
 * | `ghost`   | Ikon toolbar, tutup modal                  | Apa pun yang harus ditemukan cepat     |
 * | `keypad`  | Numpad, keypad PIN                         | Di luar konteks input numerik          |
 *
 * ⚠️ Tombol **Batal** pada modal memakai `neutral`, bukan `danger`. Merah
 * dicadangkan untuk aksi yang menghancurkan data yang sudah ada; menutup modal
 * tidak menghancurkan apa pun.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold ' +
    'transition-[background-color,box-shadow,transform] duration-150 ease-out-pos ' +
    'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98] ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-fg-inverse hover:bg-accent-hover shadow-card',
        // emerald + putih hanya lulus AA-large → wajib label ≥ 22px bold ([06 §1.5]).
        cash: 'bg-success text-fg-inverse hover:brightness-95 shadow-raised',
        danger: 'bg-danger text-fg-inverse hover:bg-danger-hover shadow-card',
        neutral: 'bg-surface text-fg border border-border-strong hover:bg-bg-muted',
        ghost: 'bg-transparent text-fg-muted hover:bg-bg-muted',
        keypad:
          'bg-surface text-fg border border-border text-pos-lg font-mono ' +
          'hover:bg-bg-muted shadow-card',
      },
      size: {
        sm: 'h-10 px-3 text-pos-sm', // Admin desktop saja
        md: 'h-12 px-4 text-pos-base min-w-touch', // 48px — batas bawah POS
        lg: 'h-14 px-6 text-pos-lg min-w-touch-md', // 56px — numpad, aksi sering
        xl: 'h-16 px-8 text-pos-lg min-w-touch-lg', // 64px — aksi utama POS
        cash: 'h-18 px-6 text-pos-lg min-w-touch-xl', // 72px — Fast-Cash
        icon: 'h-12 w-12 p-0', // area sentuh 48px, ikon di dalamnya boleh 20px
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'neutral', size: 'md', block: false },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
})
