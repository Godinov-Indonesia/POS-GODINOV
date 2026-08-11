/**
 * Model IndexedDB kasir — docs/05 §1.5.1.
 *
 * Dexie **bukan** cache. Ia adalah basis data operasional POS (ADR-03): layar
 * kasir membaca dari `useLiveQuery`, tidak pernah dari TanStack Query, dan
 * jaringan tidak pernah menjadi prasyarat render.
 *
 * ATURAN PEMODELAN YANG MENGIKAT SELURUH SKEMA
 * --------------------------------------------
 * | Aturan                                        | Alasan                                                     |
 * |-----------------------------------------------|------------------------------------------------------------|
 * | `_synced` bertipe `0 | 1`, BUKAN `boolean`    | IndexedDB tidak dapat mengindeks boolean                    |
 * | Seluruh field lokal berprefiks `_`            | `stripLocalFields()` membuangnya dengan satu aturan         |
 * | Uang disimpan sebagai **integer sen** (ADR-05)| Konversi ke Rupiah hanya di batas API                       |
 * | `items` transaksi disimpan **bersarang**      | Payload sync memang bersarang ([03 §2.3])                   |
 * | Baris tidak pernah dihapus setelah tersinkron | Riwayat "Hari Ini" dibaca dari lokal ([04 §A.5])            |
 * | UUID dibuat sekali saat entitas lahir         | Dasar idempotensi; regenerasi = duplikasi data keuangan     |
 */

import type { PaymentMethod } from '@/lib/constants/payment'
import type { IsoDateTime, ShiftStatus, TransactionStatus } from '@/lib/types/api'

/** Metadata lokal yang WAJIB dibuang sebelum dikirim ke backend. */
export type LocalMeta = {
  _synced: 0 | 1
  /** Pesan kegagalan terakhir, untuk layar antrean sync (P-13). */
  _syncError?: string | null
  _syncAttempts: number
  _lastSyncAttemptAt?: string | null
}

/* ── Master data (sync-down; sumber: GET /v1/pos/sync/master-data) ────────── */

export type LocalStaff = {
  /** UUID dari server. */
  id: string
  staff_identifier: string
  name: string
  /** ⚠️ bcrypt — dibandingkan secara lokal di Web Worker ([05 §1.4.5]). */
  pin_hash: string
  _syncedAt: string
}

export type LocalCategory = {
  id: string
  name: string
  description: string | null
  _syncedAt: string
}

export type LocalProduct = {
  id: string
  name: string
  /** INTEGER SEN — server mengirim Rupiah desimal, dikonversi di `master-sync`. */
  price: number
  image_url: string | null
  category_id: string | null
  _syncedAt: string
  // CATATAN: TIDAK ADA `stock` dan TIDAK ADA `recipes`.
  // Master data POS memang tidak memuatnya ([03 §2.2]). UI kasir dilarang
  // menampilkan ketersediaan stok.
}

/* ── Data transaksional (sync-up; UUID dibuat klien) ──────────────────────── */

export type LocalShift = LocalMeta & {
  /** `crypto.randomUUID()` — dibuat sekali, tidak pernah diregenerasi. */
  id: string
  staff_id: string
  /** sen */
  opening_balance: number
  /** sen */
  closing_balance: number
  /** sen — dihitung klien ([04 §A.3]); server tidak menghitung ulang. */
  expected_balance: number
  /** sen — dihitung klien. */
  discrepancy: number
  status: ShiftStatus
  /** ISO-8601 dengan zona waktu. */
  client_opened_at: IsoDateTime
  client_closed_at: IsoDateTime | null
}

export type LocalTransactionItem = {
  /** UUID dibuat klien. */
  id: string
  transaction_id: string
  product_id: string
  /** INT — backend memakai INT, bukan desimal. */
  quantity: number
  /** sen, snapshot harga saat transaksi. */
  unit_price: number
  /** Hanya tampilan/struk — dibuang saat kirim. */
  _product_name: string
}

export type LocalTransaction = LocalMeta & {
  id: string
  shift_id: string
  /** String kosong bila tidak ada — kolom NOT NULL. */
  customer_name: string
  /** sen */
  total_amount: number
  /** Enum dikunci frontend ([05 §3.3]) — bertipe `PaymentMethod`, bukan `string`. */
  payment_method: PaymentMethod
  status: TransactionStatus
  cancel_notes: string
  client_created_at: IsoDateTime
  items: LocalTransactionItem[]
  /** sen — untuk cetak ulang struk, tidak dikirim. */
  _cash_received?: number
  /** sen — idem. */
  _change?: number
}

export type LocalWaste = LocalMeta & {
  id: string
  staff_id: string
  product_id: string
  /** INT */
  quantity: number
  reason: string
  client_created_at: IsoDateTime
  _product_name: string
}

/* ── Murni lokal, TIDAK PERNAH dikirim ke server ──────────────────────────── */

export type HeldCart = {
  id: string
  /** mis. "Meja 4" / nama pelanggan. */
  label: string
  items: LocalTransactionItem[]
  created_at: IsoDateTime
  _staff_id: string
}

/* ── Key-value internal ───────────────────────────────────────────────────── */

export type MetaRow = { key: MetaKey | string; value: unknown; updated_at: IsoDateTime }

/** Kunci `meta` yang dibakukan ([05 §1.5.1]). */
export type MetaKey =
  /** `device_token` PASETO — ditulis saat binding (P-01). JANGAN ke localStorage. */
  | 'device.token'
  | 'device.boundAt'
  /** Nama outlet untuk ditampilkan di P-14. */
  | 'device.outletLabel'
  | 'master.lastSyncAt'
  /** `{ kind, deviceId?, host? }` */
  | 'printer.preferred'
  | 'sync.lastSuccessAt'
  /** epoch ms */
  | 'sync.backoffUntil'
  /** angka, ditulis `detectClockSkew` */
  | 'clock.lastSkewMs'
  /** Penanda database telah terisi seeder lokal. */
  | 'seed.isSeeded'

export type SyncTrigger = 'online' | 'interval' | 'shift-close' | 'manual' | 'startup'

export type SyncLogRow = {
  /** auto-increment */
  id?: number
  at: IsoDateTime
  trigger: SyncTrigger
  ok: boolean
  shifts_sent: number
  shifts_synced: number
  transactions_sent: number
  transactions_synced: number
  wastes_sent: number
  wastes_synced: number
  failed_transaction_ids: string[]
  error?: string
  duration_ms: number
}
