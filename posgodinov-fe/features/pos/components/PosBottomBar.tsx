'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  ClipboardList,
  Clock,
  Download,
  MoreHorizontal,
  Pause,
  Settings,
  ShoppingCart,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { Sheet } from '@/components/ui/sheet'
import { Num } from '@/components/ui/money'
import { usePosScreen, posNavigate } from '@/features/pos/router/usePosRouter'
import type { PosScreen } from '@/features/pos/router/screens'
import { countHeldCarts } from '@/lib/db/repositories/held-cart.repo'
import { cn } from '@/lib/utils/cn'

/**
 * `PosBottomBar` — **butir 18** ([11 §M17.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA AKSI PINDAH KE BAWAH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Zona jempol pada handheld POS 6" yang dipegang satu tangan mencakup sekitar
 * sepertiga bawah layar. Setiap ikon di header memaksa penyesuaian genggaman —
 * puluhan kali per jam pada jam sibuk. Ini bukan preferensi estetika melainkan
 * **biaya waktu per transaksi**, dan biaya itu dibayar kasir, bukan perancang.
 *
 * Konsekuensinya mengikat header: `StatusBar` menjadi KONTEKS murni — nama
 * kasir, jam shift, indikator jaringan, lonceng struk. Nol aksi yang dapat
 * diketuk selain lonceng. Audit `grep` atas `IconButton`/`onClick` di header
 * adalah bagian dari DoD fase ini.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LIMA SLOT, DAN YANG KELIMA SELALU "LAINNYA"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Empat aksi utama muat di zona jempol pada layar 6"; slot kelima membuka
 * *bottom sheet*, bukan menu di atas. Menu yang terbuka ke ATAS mengembalikan
 * persis masalah yang bar ini selesaikan.
 *
 * Batas lima bukan angka bulat yang dipilih sembarangan: pada lebar 360 dp,
 * enam slot menghasilkan target 60 dp yang lebih sempit dari lebar jempol
 * dewasa (±45–57 dp), dan ketukan mulai mendarat di tetangganya.
 */

/** Satu slot pada bar. */
type Slot = {
  screen: PosScreen
  icon: LucideIcon
  label: string
}

/**
 * Empat aksi utama.
 *
 * Urutannya mengikuti frekuensi pakai, dari kiri: Kasir dibuka ratusan kali per
 * shift, Waste beberapa kali. Slot paling kanan berada di jangkauan jempol
 * paling nyaman untuk tangan kanan — dan itu diberikan kepada aksi yang paling
 * jarang, bukan yang paling sering, karena aksi yang sering ditemukan otomatis
 * sedangkan yang jarang perlu dicari.
 */
const PRIMARY_SLOTS: readonly Slot[] = [
  { screen: 'register', icon: ShoppingCart, label: 'Kasir' },
  { screen: 'held-carts', icon: Pause, label: 'Tahan' },
  { screen: 'history', icon: Clock, label: 'Riwayat' },
  { screen: 'product-waste', icon: Trash2, label: 'Waste' },
]

/** Isi *bottom sheet* "Lainnya". */
const SECONDARY_SLOTS: readonly Slot[] = [
  { screen: 'close-shift', icon: Wallet, label: 'Tutup Shift' },
  { screen: 'sync-status', icon: Download, label: 'Status Sinkronisasi' },
  { screen: 'void', icon: ClipboardList, label: 'Batalkan Transaksi' },
  { screen: 'settings', icon: Settings, label: 'Pengaturan' },
]

/**
 * Layar yang **tidak** menampilkan bar.
 *
 * Alur pembayaran dan struk adalah alur linear: kasir sedang menyelesaikan satu
 * hal, dan bar navigasi di bawahnya hanya menawarkan cara meninggalkannya di
 * tengah — dengan uang sudah di tangan tetapi transaksi belum tersimpan.
 *
 * Layar sebelum shift dibuka juga dikecualikan: tidak ada apa pun untuk
 * dinavigasi sebelum kasir masuk.
 */
const HIDDEN_ON: ReadonlySet<PosScreen> = new Set<PosScreen>([
  'sync-master',
  'login',
  'open-shift',
  'payment',
  'payment-cash',
  'payment-card',
  'payment-split',
  'receipt',
])

export function PosBottomBar() {
  const screen = usePosScreen()
  const [moreOpen, setMoreOpen] = React.useState(false)

  const heldCount = useLiveQuery(() => countHeldCarts(), [], 0)

  if (HIDDEN_ON.has(screen)) return null

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className={cn(
          // 64 dp tinggi bar itu sendiri; `pb-safe` menambahkan area aman iOS
          // DI BAWAHNYA, bukan memakannya. Menghitung safe-area ke dalam 64 dp
          // akan menyusutkan target sentuh menjadi ±30 dp pada iPhone berponi.
          'flex h-touch-lg w-full shrink-0 items-stretch border-t border-border bg-surface',
          'pb-[env(safe-area-inset-bottom)]',
          // `w-full` di atas WAJIB berpasangan dengan `lg:mx-auto` di bawah.
          // Bar ini anak dari flex column (`PosApp`), dan pada flex item yang
          // punya margin `auto` di sumbu silang, `align-items: stretch` TIDAK
          // berlaku — kotak menyusut ke lebar kontennya dan margin auto
          // menyerap sisanya. Tanpa `w-full`, margin auto membuat bar mengkerut
          // ke ±170 px dengan label saling menempel, bukan melebar sampai
          // batas maksimumnya.
          //
          // Tablet 10" landscape: bar dibatasi lebarnya dan DITENGAHKAN. Bar
          // selebar 1280 px memaksa jangkauan lengan penuh untuk mencapai slot
          // terjauh; bar yang dirapatkan ke satu sisi membuat separuh layar
          // mati bagi kasir yang berdiri di sisi lain mesin. Tengah adalah
          // jarak terpendek terburuk untuk kedua tangan.
          'lg:mx-auto lg:h-[4.5rem] lg:max-w-[48rem] lg:rounded-t-2xl lg:border-x',
        )}
      >
        {PRIMARY_SLOTS.map((slot) => (
          <BarButton
            key={slot.screen}
            slot={slot}
            active={screen === slot.screen}
            badge={slot.screen === 'held-carts' ? heldCount : 0}
            onClick={() => posNavigate(slot.screen)}
          />
        ))}

        <BarButton
          slot={{ screen: 'settings', icon: MoreHorizontal, label: 'Lainnya' }}
          active={SECONDARY_SLOTS.some((s) => s.screen === screen)}
          badge={0}
          onClick={() => setMoreOpen(true)}
        />
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu Lainnya">
        <ul className="flex flex-col gap-2">
          {SECONDARY_SLOTS.map((slot) => (
            <li key={slot.screen}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  posNavigate(slot.screen)
                }}
                className="flex h-touch-md w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 text-left"
              >
                <slot.icon className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
                <span className="text-pos-base text-fg">{slot.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}

/**
 * Satu tombol pada bar.
 *
 * Label teks SELALU ditampilkan, tidak pernah hanya ikon. Ikon tanpa label
 * menuntut kasir menghafal, dan kasir baru pada shift pertamanya adalah orang
 * yang paling sering menekan tombol yang salah.
 */
function BarButton({
  slot,
  active,
  badge,
  onClick,
}: {
  slot: Slot
  active: boolean
  badge: number
  onClick: () => void
}) {
  const Icon = slot.icon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // `flex-1` membagi lebar rata; tinggi penuh membuat SELURUH kolom
        // menjadi target sentuh, bukan hanya ikonnya.
        // `min-w-0` menahan lebar minimum intrinsik teks: tanpa itu label
        // terpanjang ("Riwayat") memaksa kolom melebar dan mendorong tetangga
        // keluar bar pada lebar sempit.
        'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 lg:gap-1',
        'transition-colors',
        active ? 'text-accent' : 'text-fg-muted',
      )}
    >
      {/* Penanda aktif berupa GARIS, bukan warna saja ([06 §1.5]).
          8% pria mengalami defisiensi penglihatan merah-hijau. */}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-accent"
        />
      ) : null}

      <span className="relative">
        <Icon className="size-6 lg:size-7" aria-hidden="true" />
        {badge > 0 ? (
          <span className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-warning px-1 text-fg">
            <Num className="text-pos-xs font-semibold">{badge > 9 ? '9+' : badge}</Num>
          </span>
        ) : null}
      </span>

      <span
        className={cn('max-w-full truncate text-pos-xs lg:text-pos-sm', active && 'font-semibold')}
      >
        {slot.label}
      </span>
    </button>
  )
}
