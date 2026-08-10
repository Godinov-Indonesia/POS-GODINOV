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
}

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
