/**
 * Gerbang Master Data sebelum Buka Shift — **butir 10** ([11 §M15.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA INI GERBANG, BUKAN PERINGATAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Membuka shift dengan katalog kemarin berarti berjualan seharian pada harga
 * yang sudah tidak berlaku. Kerugiannya tidak dapat dikoreksi: pelanggan sudah
 * membayar, sudah menerima struk, dan sudah pulang. Tidak ada laporan yang
 * dapat memperbaikinya setelah itu.
 *
 * Karena itu tidak ada tombol "Lewati" di mana pun pada alur ini, dan
 * ketiadaannya adalah keputusan produk — bukan sesuatu yang belum sempat
 * ditambahkan. Tombol semacam itu akan ditekan setiap pagi oleh kasir yang
 * sedang terburu-buru, dan gerbangnya berhenti menjadi gerbang.
 */

import { getMeta } from '@/lib/db/repositories/meta.repo'
import { getLastMasterSyncAt } from '@/lib/sync/master-sync'
import { readPosConfig } from '@/lib/pos/config'

/** Mengapa gerbang menolak. `ok` berarti Buka Shift boleh dibuka. */
export type MasterGateReason =
  | 'ok'
  /** Belum pernah menarik master data sama sekali. */
  | 'never-pulled'
  /** Umur master melewati `config.master_data_max_age_minutes`. */
  | 'stale'
  /** Server melaporkan versi yang lebih baru daripada yang dipegang perangkat. */
  | 'outdated'

export type MasterGateVerdict = {
  ok: boolean
  reason: MasterGateReason
  /** Versi yang benar-benar dipegang perangkat. */
  version: number | null
  /** Versi terkini menurut respons sync terakhir. */
  serverVersion: number | null
  /** Umur master data dalam menit, `null` bila belum pernah ditarik. */
  ageMinutes: number | null
  maxAgeMinutes: number
}

/**
 * Menilai apakah perangkat boleh membuka shift.
 *
 * ⚠️ **Murni lokal — tidak menyentuh jaringan.** Gerbang yang memerlukan
 * permintaan HTTP setiap kali dievaluasi akan memblokir perangkat offline yang
 * master datanya justru masih segar, dan itu membalik maksudnya: yang ingin
 * dicegah adalah katalog basi, bukan ketiadaan sinyal.
 *
 * Perbandingan versi memakai `master.serverVersion` yang ditulis respons sync
 * terakhir. Nilainya bisa saja basi pada perangkat yang lama offline — dan itu
 * benar: satu-satunya bukti bahwa ada versi lebih baru adalah kabar dari
 * server, dan perangkat yang belum mendengarnya tidak boleh diblokir atas
 * dugaan.
 */
export async function evaluateMasterGate(): Promise<MasterGateVerdict> {
  const config = await readPosConfig()
  const maxAgeMinutes = config.masterDataMaxAgeMinutes

  const [lastSyncAt, version, serverVersion] = await Promise.all([
    getLastMasterSyncAt(),
    getMeta<number>('master.version'),
    getMeta<number>('master.serverVersion'),
  ])

  const base = {
    version: version ?? null,
    serverVersion: serverVersion ?? null,
    maxAgeMinutes,
  }

  if (!lastSyncAt) {
    return { ok: false, reason: 'never-pulled', ageMinutes: null, ...base }
  }

  const ageMinutes = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 60_000)

  if (ageMinutes > maxAgeMinutes) {
    return { ok: false, reason: 'stale', ageMinutes, ...base }
  }

  // Versi server yang lebih tinggi berarti pemilik mengubah katalog sejak
  // penarikan terakhir. Umur yang masih muda tidak menolongnya: master berumur
  // dua menit pun salah bila harganya baru saja naik.
  //
  // Diperiksa hanya bila KEDUA angka diketahui. Server pra-v2 tidak mengirim
  // versi sama sekali, dan membandingkan `null` akan memblokir seluruh outlet
  // yang backend-nya belum naik.
  if (
    typeof version === 'number' &&
    typeof serverVersion === 'number' &&
    serverVersion > version
  ) {
    return { ok: false, reason: 'outdated', ageMinutes, ...base }
  }

  return { ok: true, reason: 'ok', ageMinutes, ...base }
}

/** Pesan yang dibaca kasir. Tanpa jargon, dan selalu menyebut tindakannya. */
export const MASTER_GATE_MESSAGE: Record<Exclude<MasterGateReason, 'ok'>, string> = {
  'never-pulled':
    'Perangkat ini belum pernah mengunduh data produk. Shift tidak dapat dibuka sebelum unduhan pertama berhasil.',
  stale:
    'Data produk di perangkat ini sudah kedaluwarsa. Harga yang dipakai bisa jadi bukan harga hari ini.',
  outdated:
    'Pemilik sudah memperbarui data produk. Unduh versi terbaru sebelum membuka shift.',
}
