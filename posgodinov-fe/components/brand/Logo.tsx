import Image from 'next/image'

import { cn } from '@/lib/utils/cn'

/**
 * Logo resmi Godinov POS — docs/brand-guideline-godinov-pos.md §4.
 *
 * Dua aset diadopsi dari brand guideline:
 * - `wordmark`: logo lengkap (ikon + teks "Godinov POS"), dipakai saat ada
 *   ruang horizontal cukup (header login, sidebar lebar).
 * - `icon`: versi persegi/icon-only, dipakai saat ruang sempit (rail ikon
 *   sidebar yang collapsed).
 *
 * Tidak ada varian warna terpisah untuk latar gelap/terang karena kedua aset
 * sumber sudah dirancang dengan latar transparan yang kontras di keduanya.
 */
export function Logo({
  variant = 'wordmark',
  className,
  priority,
}: {
  variant?: 'wordmark' | 'icon'
  className?: string
  priority?: boolean
}) {
  if (variant === 'icon') {
    return (
      <Image
        src="/images/godinov_pos_favicon_app_icon.png"
        alt="Godinov POS"
        width={240}
        height={240}
        priority={priority}
        className={cn('size-8 shrink-0 object-contain', className)}
      />
    )
  }

  return (
    <Image
      src="/images/godinov_pos_primary_logo.png"
      alt="Godinov POS"
      width={1520}
      height={480}
      priority={priority}
      className={cn('h-8 w-auto object-contain', className)}
    />
  )
}
