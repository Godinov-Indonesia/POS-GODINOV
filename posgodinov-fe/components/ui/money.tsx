import { formatIdr } from '@/lib/money'
import { cn } from '@/lib/utils/cn'

/**
 * Satu-satunya cara merender nominal — docs/06 §2.4 & §2.5.
 *
 * Monospace + `tabular-nums` bukan pilihan estetis:
 * 1. Digit berlebar sama membuat `Rp 22.000` vs `Rp 220.000` berbeda panjang
 *    secara proporsional — kasir mendeteksi kesalahan orde besaran tanpa membaca.
 * 2. Total yang berubah `Rp 99.000` → `Rp 100.000` tidak menggeser tata letak.
 * 3. Kolom nominal rata kanan hanya bekerja benar dengan lebar digit tetap.
 *
 * Komponen ini **tidak pernah** melakukan aritmetika uang — ia menerima hasil
 * dari `cart-math.ts` / `shift-math.ts` ([06 §2.5 aturan 6]).
 */
export type MoneyProps = {
  /** Nominal dalam INTEGER SEN (ADR-05). Bukan Rupiah desimal. */
  minor: number
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  tone?: 'default' | 'muted' | 'success' | 'danger' | 'inverse'
  /** Menampilkan tanda + / − eksplisit — untuk selisih shift & kembalian. */
  signed?: boolean
  className?: string
}

const SIZE = {
  sm: 'text-pos-sm',
  md: 'text-pos-md',
  lg: 'text-pos-lg',
  xl: 'text-pos-xl',
  '2xl': 'text-pos-2xl',
} as const

const TONE = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  success: 'text-success-text', // emerald-700 — lulus AA di latar terang ([06 §1.5])
  danger: 'text-danger',
  inverse: 'text-fg-inverse',
} as const

/**
 * `Intl` menghasilkan tanda hubung ASCII (`-Rp`). Aturan tampilan 4 mewajibkan
 * minus tipografis U+2212 agar tidak terbaca sebagai tanda hubung.
 */
function normalizeMinus(formatted: string): string {
  return formatted.replace(/^-/, '−')
}

export function Money({ minor, size = 'md', tone = 'default', signed, className }: MoneyProps) {
  const sign = signed && minor > 0 ? '+' : ''
  const text = `${sign}${normalizeMinus(formatIdr(minor))}`

  return (
    <span
      className={cn(
        'font-mono tabular-nums font-semibold whitespace-nowrap',
        SIZE[size],
        TONE[tone],
        className,
      )}
      // Pembaca layar membaca nominal sebagai kalimat utuh, bukan "R-p titik".
      aria-label={`${sign}${formatIdr(minor)}`}
    >
      {text}
    </span>
  )
}

/**
 * Angka non-uang yang tetap wajib monospace ([06 §2.6]): kuantitas, persentase,
 * jam, nomor transaksi, hitungan antrean.
 */
export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{children}</span>
}

/** Kuantitas bahan baku: hingga 4 desimal, trailing zero dibuang ([06 §2.6]). */
export const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(value)

/** Persentase margin: 1 desimal + `%`. */
export const formatPercent = (value: number): string =>
  `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`

/** Nomor transaksi: 8 karakter pertama UUID, huruf besar. */
export const shortId = (uuid: string): string => uuid.replace(/-/g, '').slice(0, 8).toUpperCase()
