/**
 * Struk audit — **butir 6 & 7** ([11 §M14.2–M14.4]).
 *
 * Tiga dokumen yang tidak pernah dipegang pelanggan, melainkan disimpan
 * bersama laporan shift:
 *
 * | Dokumen            | Dipicu oleh                          | Butir |
 * |--------------------|--------------------------------------|-------|
 * | Struk Pembatalan   | Void (`CART_LINE`/`HELD_ORDER`/`TRANSACTION`) | 6 |
 * | Struk Pembuangan   | Waste produk                          | 7     |
 * | Struk Retur        | Retur penjualan                       | 15    |
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA KERTAS, BUKAN SEKADAR BARIS BASIS DATA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Baris `void_logs` baru terlihat pemilik setelah sinkronisasi, dan pada outlet
 * dengan jaringan buruk itu bisa berjam-jam kemudian. Kertas terlihat SEKETIKA
 * oleh siapa pun yang berdiri di konter — termasuk supervisor yang kebetulan
 * lewat. Itulah nilai sesungguhnya struk pembatalan: ia mengubah pembatalan dari
 * peristiwa yang hanya diketahui pelakunya menjadi peristiwa yang meninggalkan
 * benda fisik di laci.
 *
 * Seluruh fungsi di sini **murni**: model → byte. Tidak menyentuh Dexie,
 * jaringan, maupun DOM, sehingga dapat diuji tanpa printer sama sekali.
 */

import {
  RETURN_REASON_LABELS,
  VOID_REASON_LABELS,
  WASTE_REASON_LABELS,
  type ReturnReasonCode,
  type VoidReasonCode,
  type WasteReasonCode,
} from '@/lib/constants/cancellation'
import { formatIdr } from '@/lib/money'
import {
  concatBytes,
  divider,
  encodeText,
  ESCPOS,
  truncate,
  twoColumns,
} from '@/lib/printer/escpos'
import type { PrinterColumns } from '@/lib/printer/types'
import { formatDateTimeId } from '@/lib/time'

/** `formatIdr` menghasilkan `Rp 22.000`; NBSP tidak ada di CP437. */
const money = (minor: number): string => formatIdr(minor).replace(/ /g, ' ')

const shortId = (uuid: string): string => uuid.replace(/-/g, '').slice(0, 8).toUpperCase()

/* ── Blok bersama ─────────────────────────────────────────────────────────── */

/**
 * Judul dokumen dengan tinggi ganda.
 *
 * Tinggi ganda bukan hiasan: struk audit yang terlihat sama dengan struk
 * penjualan biasa akan tercampur di laci dan tidak pernah ditemukan saat
 * rekonsiliasi. Judulnya harus dapat dikenali dari tumpukan, bukan setelah
 * dibaca.
 */
function documentTitle(title: string, columns: number): Uint8Array[] {
  return [
    ESCPOS.ALIGN_CENTER,
    ESCPOS.BOLD_ON,
    ESCPOS.DOUBLE_HEIGHT,
    encodeText(`${truncate(title, Math.floor(columns / 2))}\n`),
    ESCPOS.NORMAL_SIZE,
    ESCPOS.BOLD_OFF,
  ]
}

/**
 * Garis tanda tangan.
 *
 * Ruang kosong di atas garis sengaja tiga baris: tanda tangan yang tidak muat
 * akan ditulis melintang di atas teks lain, dan struk yang tidak terbaca sama
 * saja dengan struk yang tidak pernah dicetak.
 */
function signatureLine(label: string, columns: number): Uint8Array[] {
  return [
    ESCPOS.FEED(3),
    ESCPOS.ALIGN_LEFT,
    encodeText(`${'.'.repeat(Math.min(columns, 24))}\n`),
    encodeText(`${truncate(label, columns)}\n`),
  ]
}

/** Baris alasan: kode kontrak DAN labelnya. */
function reasonRow(code: string, label: string, columns: number): Uint8Array {
  // Kode ikut dicetak, bukan hanya labelnya. Saat pemilik menelusuri laporan,
  // yang ia cari adalah string yang sama persis dengan isi kolom `reason_code` —
  // label Bahasa Indonesia dapat berubah kapan saja tanpa memberi tahu siapa pun.
  return encodeText(twoColumns('Alasan', truncate(`${label} (${code})`, columns - 8), columns))
}

/** Catatan bebas, dibungkus ke beberapa baris. */
function notesBlock(notes: string, columns: number): Uint8Array[] {
  if (!notes.trim()) return []

  const parts: Uint8Array[] = [encodeText('Catatan:\n')]
  for (const line of wrap(notes.trim(), columns)) {
    parts.push(encodeText(`${line}\n`))
  }
  return parts
}

/**
 * Membungkus teks pada batas kata.
 *
 * `truncate` memotong dan membuang; untuk catatan alasan itu tidak dapat
 * diterima — bagian yang terpotong justru sering memuat keterangan yang
 * membuat pembatalannya masuk akal.
 */
function wrap(text: string, columns: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current === '') {
      current = word
    } else if (current.length + 1 + word.length <= columns) {
      current = `${current} ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current !== '') lines.push(current)

  // Kata tunggal yang lebih panjang dari lebar kertas tetap harus dipotong;
  // membiarkannya membuat printer membungkusnya sendiri di tempat acak.
  return lines.flatMap((line) =>
    line.length <= columns ? [line] : (line.match(new RegExp(`.{1,${columns}}`, 'g')) ?? [line]),
  )
}

function auditFooter(columns: number): Uint8Array[] {
  return [
    encodeText(divider(columns)),
    ESCPOS.ALIGN_CENTER,
    encodeText('Simpan bersama laporan shift.\n'),
    encodeText('Bukan bukti pembayaran.\n'),
    ESCPOS.FEED(3),
    ESCPOS.CUT,
  ]
}

/* ── M14.2 · Struk Pembatalan ─────────────────────────────────────────────── */

export type CancelReceiptScope = 'CART_LINE' | 'HELD_ORDER' | 'TRANSACTION'

export type CancelReceiptItem = {
  name: string
  qty: number
  /** sen */
  unitPrice: number
}

export type CancelReceipt = {
  outletName: string
  /** ISO-8601 */
  createdAt: string
  scope: CancelReceiptScope
  /** Kode struk asal — hanya ada pada scope `TRANSACTION`. */
  originalCode?: string
  /** Label pesanan tertahan — hanya ada pada scope `HELD_ORDER`. */
  heldCartLabel?: string
  cashierName: string
  /** Nama pemberi otoritas; `undefined` bila kebijakan tidak mewajibkannya. */
  authorizedByName?: string
  reasonCode: VoidReasonCode | string
  reasonNotes?: string
  items: CancelReceiptItem[]
  /** sen — nilai yang dibatalkan. */
  totalCancelled: number
  isReprint?: boolean
}

const SCOPE_LABEL: Record<CancelReceiptScope, string> = {
  CART_LINE: 'Penurunan Kuantitas',
  HELD_ORDER: 'Pesanan Tertahan',
  TRANSACTION: 'Transaksi',
}

/**
 * Merender struk pembatalan — **butir 6**.
 *
 * Dipakai KETIGA cakupan void. Satu renderer untuk ketiganya bukan penghematan:
 * tiga tata letak berbeda akan menyimpang, dan yang menyimpang adalah yang
 * paling jarang diperiksa — pembatalan baris keranjang, yang justru paling
 * sering dipakai untuk kecurangan.
 */
export function renderCancelReceipt(
  receipt: CancelReceipt,
  opts: { columns: PrinterColumns } = { columns: 32 },
): Uint8Array {
  const { columns } = opts
  const parts: Uint8Array[] = [ESCPOS.INIT, ESCPOS.CODEPAGE_CP437]

  parts.push(...documentTitle('STRUK', columns))
  parts.push(...documentTitle('PEMBATALAN', columns))

  parts.push(ESCPOS.ALIGN_CENTER, encodeText(`${truncate(receipt.outletName, columns)}\n`))
  if (receipt.isReprint) parts.push(encodeText('--- CETAK ULANG ---\n'))

  parts.push(ESCPOS.ALIGN_LEFT, encodeText(divider(columns)))
  parts.push(encodeText(twoColumns('Jenis', SCOPE_LABEL[receipt.scope], columns)))
  parts.push(encodeText(twoColumns('Waktu', formatDateTimeId(receipt.createdAt), columns)))

  // Rujukan ke dokumen asal — kunci penelusuran saat audit. Tanpa ini, struk
  // pembatalan hanyalah selembar kertas yang tidak menunjuk apa pun.
  if (receipt.originalCode) {
    parts.push(encodeText(twoColumns('Struk Asal', truncate(receipt.originalCode, 18), columns)))
  }
  if (receipt.heldCartLabel) {
    parts.push(encodeText(twoColumns('Pesanan', truncate(receipt.heldCartLabel, 18), columns)))
  }

  parts.push(encodeText(twoColumns('Kasir', truncate(receipt.cashierName, 16), columns)))
  parts.push(
    encodeText(
      twoColumns(
        'Otoritas',
        // Dinyatakan APA ADANYA saat tidak ada. Kolom kosong akan dibaca
        // sebagai "belum sempat diisi", padahal artinya kebijakan outlet ini
        // memang tidak mewajibkannya — dan itu temuan audit tersendiri.
        receipt.authorizedByName ? truncate(receipt.authorizedByName, 16) : '(tanpa otoritas)',
        columns,
      ),
    ),
  )

  parts.push(encodeText(divider(columns)))
  parts.push(
    reasonRow(
      receipt.reasonCode,
      VOID_REASON_LABELS[receipt.reasonCode as VoidReasonCode] ?? receipt.reasonCode,
      columns,
    ),
  )
  parts.push(...notesBlock(receipt.reasonNotes ?? '', columns))

  parts.push(encodeText(divider(columns)))
  parts.push(ESCPOS.BOLD_ON, encodeText('ITEM YANG DIBATALKAN\n'), ESCPOS.BOLD_OFF)

  if (receipt.items.length === 0) {
    parts.push(encodeText('(tidak ada rincian item)\n'))
  }
  for (const item of receipt.items) {
    parts.push(encodeText(`${truncate(item.name, columns)}\n`))
    parts.push(
      encodeText(
        twoColumns(
          `  ${item.qty} x ${money(item.unitPrice)}`,
          money(item.unitPrice * item.qty),
          columns,
        ),
      ),
    )
  }

  parts.push(encodeText(divider(columns)))
  parts.push(
    ESCPOS.BOLD_ON,
    encodeText(twoColumns('TOTAL DIBATALKAN', money(receipt.totalCancelled), columns)),
    ESCPOS.BOLD_OFF,
  )

  parts.push(...signatureLine('Pemberi Otoritas', columns))
  parts.push(...auditFooter(columns))

  return concatBytes(parts)
}

/* ── M14.3 · Struk Pembuangan ─────────────────────────────────────────────── */

export type WasteReceipt = {
  outletName: string
  /** ISO-8601 */
  createdAt: string
  productName: string
  qty: number
  /** Satuan tampilan, mis. "pcs". */
  unit?: string
  reasonCode: WasteReasonCode | string
  reasonNotes?: string
  staffName: string
  isReprint?: boolean
}

/**
 * Merender struk pembuangan — **butir 7**.
 *
 * Ditandatangani **penyaksi**, bukan pelapor. Pembuangan yang hanya
 * ditandatangani orang yang melaporkannya tidak membuktikan apa pun: seluruh
 * nilai kontrolnya justru ada pada kehadiran orang kedua.
 */
export function renderWasteReceipt(
  receipt: WasteReceipt,
  opts: { columns: PrinterColumns } = { columns: 32 },
): Uint8Array {
  const { columns } = opts
  const parts: Uint8Array[] = [ESCPOS.INIT, ESCPOS.CODEPAGE_CP437]

  parts.push(...documentTitle('STRUK', columns))
  parts.push(...documentTitle('PEMBUANGAN', columns))
  parts.push(ESCPOS.ALIGN_CENTER, ESCPOS.BOLD_ON, encodeText('/ WASTE\n'), ESCPOS.BOLD_OFF)

  parts.push(encodeText(`${truncate(receipt.outletName, columns)}\n`))
  if (receipt.isReprint) parts.push(encodeText('--- CETAK ULANG ---\n'))

  parts.push(ESCPOS.ALIGN_LEFT, encodeText(divider(columns)))
  parts.push(encodeText(twoColumns('Waktu', formatDateTimeId(receipt.createdAt), columns)))
  parts.push(encodeText(twoColumns('Petugas', truncate(receipt.staffName, 16), columns)))
  parts.push(encodeText(divider(columns)))

  parts.push(ESCPOS.BOLD_ON, encodeText(`${truncate(receipt.productName, columns)}\n`), ESCPOS.BOLD_OFF)
  parts.push(
    encodeText(
      twoColumns('Jumlah', `${receipt.qty} ${receipt.unit ?? 'pcs'}`, columns),
    ),
  )

  parts.push(
    reasonRow(
      receipt.reasonCode,
      WASTE_REASON_LABELS[receipt.reasonCode as WasteReasonCode] ?? receipt.reasonCode,
      columns,
    ),
  )
  parts.push(...notesBlock(receipt.reasonNotes ?? '', columns))

  parts.push(encodeText(divider(columns)))
  parts.push(...signatureLine('Penyaksi', columns))
  parts.push(...auditFooter(columns))

  return concatBytes(parts)
}

/* ── M14.4 · Struk Retur ──────────────────────────────────────────────────── */

export type ReturnReceiptItem = {
  name: string
  qty: number
  /** sen — harga ASAL, bukan harga hari ini. */
  unitPrice: number
  /** `false` = barang tidak kembali ke stok. */
  restock: boolean
  wasteReasonCode?: string | null
}

export type ReturnReceipt = {
  outletName: string
  /** ISO-8601 */
  createdAt: string
  /** Kode retur ini. */
  returnCode: string
  /** Kode struk penjualan aslinya. */
  originalCode: string
  cashierName: string
  authorizedByName?: string
  reasonCode: ReturnReasonCode | string
  reasonNotes?: string
  refundMethodLabel: string
  /** sen */
  refundAmount: number
  items: ReturnReceiptItem[]
  isReprint?: boolean
}

/**
 * Merender struk retur.
 *
 * Dua tanda tangan, dan keduanya wajib: **pelanggan** membuktikan uang atau
 * barang benar-benar diserahkan kepadanya, **pemberi otoritas** membuktikan
 * toko menyetujuinya. Satu tanda tangan saja menyisakan salah satu dari dua
 * pertanyaan itu tanpa jawaban, dan keduanya muncul justru saat ada sengketa.
 */
export function renderReturnReceipt(
  receipt: ReturnReceipt,
  opts: { columns: PrinterColumns } = { columns: 32 },
): Uint8Array {
  const { columns } = opts
  const parts: Uint8Array[] = [ESCPOS.INIT, ESCPOS.CODEPAGE_CP437]

  parts.push(...documentTitle('STRUK RETUR', columns))
  parts.push(ESCPOS.ALIGN_CENTER, encodeText(`${truncate(receipt.outletName, columns)}\n`))
  if (receipt.isReprint) parts.push(encodeText('--- CETAK ULANG ---\n'))

  parts.push(ESCPOS.ALIGN_LEFT, encodeText(divider(columns)))
  parts.push(encodeText(twoColumns('No. Retur', truncate(receipt.returnCode, 18), columns)))
  parts.push(encodeText(twoColumns('Struk Asal', truncate(receipt.originalCode, 18), columns)))
  parts.push(encodeText(twoColumns('Waktu', formatDateTimeId(receipt.createdAt), columns)))
  parts.push(encodeText(twoColumns('Kasir', truncate(receipt.cashierName, 16), columns)))
  parts.push(
    encodeText(
      twoColumns(
        'Otoritas',
        receipt.authorizedByName ? truncate(receipt.authorizedByName, 16) : '(tanpa otoritas)',
        columns,
      ),
    ),
  )

  parts.push(encodeText(divider(columns)))
  parts.push(
    reasonRow(
      receipt.reasonCode,
      RETURN_REASON_LABELS[receipt.reasonCode as ReturnReasonCode] ?? receipt.reasonCode,
      columns,
    ),
  )
  parts.push(...notesBlock(receipt.reasonNotes ?? '', columns))

  parts.push(encodeText(divider(columns)))
  parts.push(ESCPOS.BOLD_ON, encodeText('ITEM YANG DIRETUR\n'), ESCPOS.BOLD_OFF)

  for (const item of receipt.items) {
    parts.push(encodeText(`${truncate(item.name, columns)}\n`))
    parts.push(
      encodeText(
        twoColumns(
          `  ${item.qty} x ${money(item.unitPrice)}`,
          money(item.unitPrice * item.qty),
          columns,
        ),
      ),
    )
    // Barang yang TIDAK kembali ke stok dinyatakan di kertas. Pelanggan berhak
    // tahu bahwa barangnya dinyatakan rusak, dan gudang berhak tahu mengapa
    // stoknya tidak bertambah.
    if (!item.restock) {
      parts.push(
        encodeText(
          `  ! tidak kembali ke stok${item.wasteReasonCode ? ` (${item.wasteReasonCode})` : ''}\n`,
        ),
      )
    }
  }

  parts.push(encodeText(divider(columns)))
  parts.push(encodeText(twoColumns('Metode', truncate(receipt.refundMethodLabel, 16), columns)))
  parts.push(
    ESCPOS.BOLD_ON,
    encodeText(twoColumns('TOTAL REFUND', money(receipt.refundAmount), columns)),
    ESCPOS.BOLD_OFF,
  )

  parts.push(...signatureLine('Pelanggan', columns))
  parts.push(...signatureLine('Pemberi Otoritas', columns))
  parts.push(...auditFooter(columns))

  return concatBytes(parts)
}

/** Dipakai `PrintQueueService` untuk memberi nama dokumen di P-13. */
export { shortId as receiptShortId }
