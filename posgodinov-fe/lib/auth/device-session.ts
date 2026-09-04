/**
 * Sesi perangkat POS — docs/05 §1.4.2 & §1.4.5.
 *
 * POS memiliki **dua lapis identitas yang tidak boleh tercampur**:
 *
 * | Lapis     | Identitas                        | Umur       | Disimpan di        |
 * |-----------|----------------------------------|------------|--------------------|
 * | Perangkat | `device_token` (outlet + bisnis) | ~10 tahun  | Dexie `meta`       |
 * | Kasir     | `staff_id` hasil verifikasi PIN  | sesi shift | Memori (posAuth)   |
 *
 * ⚠️ `device_token` **tidak boleh** berada di `localStorage` — ditegaskan di
 * [04 §A.2]. Token ini tidak dapat dicabut: tidak ada endpoint unbind, tidak
 * ada daftar perangkat, tidak ada pencabutan. Perangkat yang hilang
 * mempertahankan akses sinkronisasi selamanya ([03 §2.1]).
 */

import { registerTokenResolver } from '@/lib/api/http'
import { getMeta, setMeta } from '@/lib/db/repositories/meta.repo'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'

export const getDeviceToken = (): Promise<string | undefined> => getMeta<string>('device.token')

export async function isDeviceBound(): Promise<boolean> {
  return !!(await getDeviceToken())
}

export async function saveDeviceBinding(params: {
  token: string
  outletLabel: string
}): Promise<void> {
  await setMeta('device.token', params.token)
  await setMeta('device.boundAt', nowIso())
  await setMeta('device.outletLabel', params.outletLabel)
  await ensureDeviceId()
}

/**
 * Identitas instalasi yang stabil — dasar butir 12 ([11 §M15.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DIBUAT SEKALI, TIDAK PERNAH BERUBAH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Indeks `uq_shift_open_per_device` mengunci satu shift `OPEN` per perangkat.
 * Kunci itu hanya bermakna bila identitas perangkatnya menetap: `device_id`
 * yang lahir baru setiap kali aplikasi dibuka membuat setiap sesi tampak
 * seperti perangkat berbeda, dan kasir dapat membuka shift kedua hanya dengan
 * menyegarkan tab.
 *
 * Karena itu ia **tidak boleh** diturunkan dari fingerprint browser, dan tidak
 * boleh tinggal di `localStorage` yang ikut terhapus bersama cache. Ia lahir
 * sekali saat binding, di dalam `meta` Dexie yang sama dengan device token, dan
 * hidup selama pemasangannya.
 *
 * Mengembalikan id yang berlaku, baik yang baru dibuat maupun yang sudah ada.
 */
export async function ensureDeviceId(): Promise<string> {
  const existing = await getMeta<string>('device.id')
  // ⚠️ Pengembalian lebih awal ini adalah inti fungsinya. Menghapusnya —
  // bahkan "sekadar untuk memuat ulang" — akan menerbitkan identitas baru pada
  // perangkat yang sedang memegang shift terbuka, dan penguncian butir 12
  // hilang tanpa satu pun galat.
  if (existing) return existing

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : newUuid()

  await setMeta('device.id', id)
  return id
}

/**
 * `device.id` yang berlaku, atau `'legacy'` bila perangkat belum pernah
 * mendapatkannya.
 *
 * `'legacy'` bukan nilai cadangan yang sembarang: server memakainya sebagai
 * pembebasan `ck_shift_master_version`, sehingga perangkat pra-v2 tetap dapat
 * mengirim shift lamanya. Perangkat yang sudah dibinding pada v2 tidak akan
 * pernah melihatnya.
 */
export const getDeviceId = async (): Promise<string> =>
  (await getMeta<string>('device.id')) ?? 'legacy'

export const getBoundOutletLabel = (): Promise<string | undefined> =>
  getMeta<string>('device.outletLabel')

export const getBoundAt = (): Promise<string | undefined> => getMeta<string>('device.boundAt')

/**
 * Menghubungkan `lib/api/http.ts` ke device token. Dipanggil sekali dari
 * `PosProviders`; Admin tidak pernah memanggilnya, sehingga bundle Admin tetap
 * bebas dari Dexie ([05 §1.1.4]).
 */
export function installDeviceTokenResolver(): void {
  registerTokenResolver('device', async () => (await getDeviceToken()) ?? null)
}
