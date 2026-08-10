/**
 * Session Manager — docs/05 §1.4.3.
 *
 * PASETO v4 `local` terenkripsi simetris ([01 §4.1]): frontend **tidak dapat**
 * membaca `exp`, `sub`, maupun apa pun dari token. Seluruh metadata sesi
 * berasal dari body response login dan dari jam klien sendiri (ADR-04).
 *
 * EMPAT MEKANISME YANG HARUS ADA BERSAMAAN. Menghilangkan salah satunya
 * menghasilkan kelas bug tersendiri:
 *
 * 1. **Timer proaktif** — dijadwalkan tepat pada `expiry − 1 jam`, bukan polling.
 * 2. **Pemeriksaan sebelum setiap request** — timer tidak berjalan saat tab
 *    di-suspend; tab yang bangun setelah 10 jam tetap refresh lebih dulu.
 * 3. **Pemulihan reaktif `401`** — backend dapat menolak token lebih awal dari
 *    perkiraan klien (mis. jam klien mundur). Satu kali percobaan ulang.
 * 4. **Sinkronisasi lintas tab** — tanpa ini, dua tab saling menimpa token.
 */

import { registerTokenResolver, request } from '@/lib/api/http'
import { SessionExpiredError } from '@/lib/api/errors'
import {
  ACCESS_TTL_MS,
  useSessionStore,
  type ClearReason,
} from '@/lib/auth/session-store'
import { clearSessionStorage } from '@/lib/auth/token-storage'
import { queryClient } from '@/lib/query/query-client'
import type { RefreshResponse } from '@/lib/types/api'

/** Ambang refresh proaktif — [04 §B.2]: refresh saat sisa masa berlaku < 1 jam. */
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000

/** Bantalan terhadap jam klien yang melenceng dan latensi jaringan. */
const CLOCK_SKEW_GUARD_MS = 60 * 1000

type AuthMessage =
  | { type: 'token-refreshed'; accessToken: string; expiry: number }
  | { type: 'logout'; reason: ClearReason }

const authChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('posgodinov.auth') : null

/** Single-flight: mencegah 6 request paralel memicu 6 refresh bersamaan. */
let inFlightRefresh: Promise<string> | null = null

let refreshTimer: ReturnType<typeof setTimeout> | null = null

function needsRefresh(expiry: number | null): boolean {
  if (expiry === null) return false
  return expiry - Date.now() < REFRESH_THRESHOLD_MS + CLOCK_SKEW_GUARD_MS
}

/* ── Mekanisme 1 — Timer proaktif ─────────────────────────────────────────── */

export function scheduleProactiveRefresh(expiry: number): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  // setTimeout meluap di atas ~24,8 hari; 24 jam aman. Minimum 0 agar tidak negatif.
  const delay = Math.max(0, expiry - REFRESH_THRESHOLD_MS - Date.now())
  refreshTimer = setTimeout(() => {
    void refreshAccessToken().catch(() => {})
  }, delay)
}

/* ── Mekanisme 2 — Pemeriksaan sebelum setiap request ─────────────────────── */

export async function getValidAccessToken(): Promise<string> {
  const s = useSessionStore.getState()

  if (!s.accessToken || !s.refreshToken) throw new SessionExpiredError('no-session')

  // Refresh token sudah mati → tidak ada jalan keluar selain login ulang.
  if (s.refreshTokenExpiry !== null && Date.now() >= s.refreshTokenExpiry) {
    hardLogout('expired')
    throw new SessionExpiredError('refresh-token-expired')
  }

  if (!needsRefresh(s.accessTokenExpiry)) return s.accessToken
  return refreshAccessToken()
}

export function refreshAccessToken(): Promise<string> {
  if (inFlightRefresh) return inFlightRefresh // ← single-flight

  inFlightRefresh = (async () => {
    const { refreshToken } = useSessionStore.getState()
    if (!refreshToken) throw new SessionExpiredError('no-refresh-token')

    useSessionStore.getState().setStatus('refreshing')
    try {
      // Bentuk B — tanpa amplop, tanpa header Authorization.
      const { access_token } = await request<RefreshResponse>('/v1/auth/business/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        raw: true,
        auth: 'none',
      })

      // Refresh token TIDAK dirotasi ([03 §1.3]) — `refreshTokenExpiry` sengaja
      // tidak diperpanjang. Sesi berakhir keras pada hari ke-7 sejak login.
      const expiry = Date.now() + ACCESS_TTL_MS
      useSessionStore.getState().setAccessToken(access_token, expiry)
      authChannel?.postMessage({
        type: 'token-refreshed',
        accessToken: access_token,
        expiry,
      } satisfies AuthMessage)
      scheduleProactiveRefresh(expiry)
      return access_token
    } catch (e) {
      // 401 di sini berarti refresh token ditolak → tidak ada pemulihan.
      hardLogout('refresh-failed')
      throw e
    } finally {
      inFlightRefresh = null
    }
  })()

  return inFlightRefresh
}

/* ── Mekanisme 4 — Sinkronisasi lintas tab ────────────────────────────────── */

if (authChannel) {
  authChannel.onmessage = (ev: MessageEvent<AuthMessage>) => {
    if (ev.data.type === 'token-refreshed') {
      useSessionStore.getState().setAccessToken(ev.data.accessToken, ev.data.expiry)
      scheduleProactiveRefresh(ev.data.expiry)
    }
    if (ev.data.type === 'logout') {
      useSessionStore.getState().clear(ev.data.reason)
      clearSessionStorage()
      queryClient.clear()
    }
  }
}

export function hardLogout(reason: ClearReason): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  useSessionStore.getState().clear(reason)
  clearSessionStorage()
  queryClient.clear() // buang seluruh data tenant dari memori
  authChannel?.postMessage({ type: 'logout', reason } satisfies AuthMessage)

  if (typeof window !== 'undefined') {
    window.location.assign(reason === 'logout' ? '/login' : '/login?reason=expired')
  }
}

/**
 * Menghubungkan `lib/api/http.ts` ke sumber access token. Dipanggil sekali dari
 * `RootProviders`; inversi ini yang menjaga `lib/api` bebas dari `lib/auth`
 * (lihat catatan di `http.ts`).
 */
export function installAccessTokenResolver(): void {
  registerTokenResolver('access', getValidAccessToken)
}
