/**
 * Struk tutup shift untuk kasir — **butir 9** ([11 §M15.3]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HANYA ANGKA DEKLARASI. TIDAK ADA YANG LAIN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Kertas ini memuat **hanya apa yang dikatakan kasir**, bukan apa yang
 * diketahui sistem:
 *
 *   ⛔ tidak ada `expected_*`      ⛔ tidak ada `*_variance` / selisih
 *   ⛔ tidak ada total penjualan   ⛔ tidak ada jumlah transaksi
 *
 * Menyembunyikan ekspektasi di layar lalu mencetaknya di kertas hanya
 * memindahkan kebocorannya ke media yang lebih sulit ditarik kembali: struk
 * yang sudah keluar tidak dapat disunting, dan kasir yang membacanya sebelum
 * shift berikutnya sudah tahu persis angka apa yang harus ia deklarasikan
 * besok.
 *
 * Fungsinya karena itu **tidak menerima** angka selain ketiga deklarasi. Tidak
 * ada parameter opsional yang dapat diisi seseorang di kemudian hari.
 *
 * Perannya adalah tanda terima: kasir memegang bukti bahwa ia menyerahkan laci
 * dengan angka yang ini, pada jam yang ini. Rekonsiliasinya terjadi di kantor.
 */

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

const money = (minor: number): string => formatIdr(minor).replace(/ /g, ' ')

export type ShiftReport = {
  outletName: string
  shiftId: string
  cashierName: string
  openedAt: string
  closedAt: string

  /** Tiga angka yang berasal dari kasir. Tidak ada yang keempat. */
  declaredCashMinor: number
  declaredEdcMinor: number
  declaredQrisMinor: number

  /**
   * `false` menandai shift yang ditutup PAKSA oleh supervisor — angkanya bukan
   * hasil hitungan siapa pun, dan kertasnya harus mengatakan itu.
   */
  blindClose: boolean
  /** Nama supervisor pada Force Close. */
  closedByName?: string
}

export function renderShiftReport(
  report: ShiftReport,
  options: { columns?: PrinterColumns } = {},
): Uint8Array {
  const columns = options.columns ?? 32
  const parts: Uint8Array[] = [ESCPOS.INIT]

  parts.push(
    ESCPOS.ALIGN_CENTER,
    ESCPOS.BOLD_ON,
    ESCPOS.DOUBLE_HEIGHT,
    encodeText('LAPORAN TUTUP SHIFT\n'),
    ESCPOS.NORMAL_SIZE,
    encodeText(`${truncate(report.outletName, columns)}\n`),
    ESCPOS.BOLD_OFF,
    ESCPOS.ALIGN_LEFT,
    encodeText(divider(columns)),
  )

  parts.push(
    encodeText(twoColumns('Kasir', truncate(report.cashierName, columns - 8), columns) + '\n'),
    encodeText(twoColumns('Mulai', formatDateTimeId(report.openedAt), columns) + '\n'),
    encodeText(twoColumns('Tutup', formatDateTimeId(report.closedAt), columns) + '\n'),
    encodeText(
      twoColumns('Shift', report.shiftId.replace(/-/g, '').slice(0, 8).toUpperCase(), columns) +
        '\n',
    ),
    encodeText(divider(columns)),
  )

  // ── Deklarasi ─────────────────────────────────────────────────────────────
  parts.push(
    ESCPOS.BOLD_ON,
    encodeText('DEKLARASI KASIR\n'),
    ESCPOS.BOLD_OFF,
    encodeText(twoColumns('Uang Fisik Laci', money(report.declaredCashMinor), columns) + '\n'),
    encodeText(twoColumns('Settle EDC', money(report.declaredEdcMinor), columns) + '\n'),
    encodeText(twoColumns('Settle QRIS', money(report.declaredQrisMinor), columns) + '\n'),
    encodeText(divider(columns)),
  )

  if (!report.blindClose) {
    // Penanda Force Close. Dicetak MENCOLOK karena kertas ini akan tersimpan
    // bersama laporan shift lain yang angkanya benar-benar dihitung seseorang,
    // dan keduanya tidak boleh terlihat setara saat ditumpuk.
    parts.push(
      ESCPOS.BOLD_ON,
      encodeText('** DITUTUP PAKSA SUPERVISOR **\n'),
      ESCPOS.BOLD_OFF,
      encodeText('Laci TIDAK dihitung. Angka di atas\nbukan hasil hitungan kasir.\n'),
    )
    if (report.closedByName) {
      parts.push(
        encodeText(
          twoColumns('Ditutup oleh', truncate(report.closedByName, columns - 14), columns) + '\n',
        ),
      )
    }
    parts.push(encodeText(divider(columns)))
  }

  // ── Tanda tangan ──────────────────────────────────────────────────────────
  //
  // Kertas ini adalah tanda terima penyerahan laci. Tanpa dua tanda tangan, ia
  // hanya cetakan angka yang dapat diklaim siapa pun.
  parts.push(
    encodeText('\n\n'),
    encodeText(`Kasir           Penerima\n`),
    encodeText(`${'.'.repeat(14)}  ${'.'.repeat(columns - 16)}\n`),
  )

  parts.push(
    ESCPOS.ALIGN_CENTER,
    encodeText('\nSimpan struk ini bersama setoran laci.\n'),
    // Angka selisih SENGAJA tidak ada di sini — lihat catatan kepala berkas.
    encodeText('Rekonsiliasi dilakukan di kantor.\n'),
    ESCPOS.ALIGN_LEFT,
    ESCPOS.FEED(3),
    ESCPOS.CUT,
  )

  return concatBytes(parts)
}
