/**
 * Kebijakan penyimpanan token — docs/05 §1.4.2.
 *
 * | Token          | Lokasi           | Alasan                                            | Risiko yang diterima          |
 * |----------------|------------------|---------------------------------------------------|-------------------------------|
 * | `access_token` | `sessionStorage` | Umur 24 jam; reload tab tak memaksa login ulang    | Terbaca XSS, cakupan 24 jam   |
 * | `refresh_token`| `localStorage`   | Harus bertahan 7 hari lintas penutupan tab         | **Terbaca XSS selama 7 hari** |
 * | `device_token` | **Dexie** `meta` | Umur ~10 tahun, tidak dapat dicabut                | Lihat `device-session.ts`     |
 *
 * `[NEEDS DISCUSSION]` — `refresh_token` di `localStorage` adalah kompromi yang
 * disadari ([04 §C.5]). Perbaikan sesungguhnya adalah cookie `httpOnly` dari
 * backend; sampai itu ada, tidak ada penyimpanan browser yang lebih aman.
 *
 * ⚠️ `device_token` **tidak boleh** berada di `localStorage` — ditegaskan di
 * [04 §A.2] dan diulang di sini karena ini kesalahan yang paling mudah terjadi.
 */

export const SESSION_STORAGE_KEY = 'posgodinov.session'
export const REFRESH_TOKEN_KEY = 'posgodinov.refresh'
export const ACTIVE_OUTLET_KEY = 'posgodinov.active-outlet'

const hasWindow = (): boolean => typeof window !== 'undefined'

export const readRefreshToken = (): string | null =>
  hasWindow() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null

export function writeRefreshToken(token: string | null): void {
  if (!hasWindow()) return
  if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token)
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export const readActiveOutletId = (): string | null =>
  hasWindow() ? window.localStorage.getItem(ACTIVE_OUTLET_KEY) : null

export function writeActiveOutletId(outletId: string | null): void {
  if (!hasWindow()) return
  if (outletId) window.localStorage.setItem(ACTIVE_OUTLET_KEY, outletId)
  else window.localStorage.removeItem(ACTIVE_OUTLET_KEY)
}

export function clearSessionStorage(): void {
  if (!hasWindow()) return
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  writeRefreshToken(null)
  // `activeOutletId` sengaja DIPERTAHANKAN: logout tidak menghapus preferensi
  // outlet perangkat, sehingga admin kembali ke outlet yang sama saat login lagi.
}
