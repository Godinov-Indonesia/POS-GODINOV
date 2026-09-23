/**
 * Session store — docs/05 §1.2.3 & §1.4.2.
 *
 * Store terpisah dari `cartStore`: `cartStore` berubah puluhan kali per menit
 * sementara store ini nyaris tidak pernah berubah; menggabungkannya memaksa
 * render ulang yang tidak perlu.
 *
 * KEBIJAKAN PENYIMPANAN ([05 §1.4.2]) — ditegakkan oleh `splitStorage` di bawah:
 * | Nilai             | Lokasi           | Alasan                                     |
 * |-------------------|------------------|--------------------------------------------|
 * | `accessToken`     | `sessionStorage` | Umur 24 jam, per-tab; reload tak perlu login |
 * | `refreshToken`    | `localStorage`   | Harus bertahan 7 hari lintas penutupan tab   |
 * | `activeOutletId`  | `localStorage`   | Preferensi perangkat, bukan sesi             |
 *
 * `device_token` POS **tidak** ada di sini — nilainya tinggal di Dexie tabel
 * `meta` dan tidak boleh menyentuh `localStorage` ([04 §A.2]).
 *
 * ⚠️ PASETO v4 `local` terenkripsi simetris: frontend tidak dapat membaca `exp`
 * dari token. Seluruh masa berlaku dilacak manual dari waktu login (ADR-04).
 */

import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

import {
  ACTIVE_OUTLET_KEY,
  REFRESH_TOKEN_KEY,
  SESSION_STORAGE_KEY,
} from '@/lib/auth/token-storage'
import type { AuthResponse, Business, OutletId } from '@/lib/types/api'

/** Access token berumur 24 jam ([05 §1.4.1]). */
export const ACCESS_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Refresh token berumur 7 hari dan **tidak dirotasi** saat refresh. Sesi
 * berakhir keras pada hari ke-7 sejak login, berapa kali pun refresh dilakukan.
 */
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type SessionStatus = 'unauthenticated' | 'authenticated' | 'refreshing' | 'expired'

export type ClearReason = 'logout' | 'expired' | 'refresh-failed'

export type SessionState = {
  accessToken: string | null
  refreshToken: string | null
  /** Epoch ms — ADR-04, wajib dihitung manual: `Date.now() + ACCESS_TTL_MS`. */
  accessTokenExpiry: number | null
  /** Epoch ms. Tidak diperpanjang oleh refresh. */
  refreshTokenExpiry: number | null
  business: Business | null
  /** Outlet yang sedang dipilih pada outlet switcher Admin. */
  activeOutletId: OutletId | null
  status: SessionStatus
}

export type SessionActions = {
  setSession(payload: AuthResponse): void
  setAccessToken(token: string, expiry: number): void
  setStatus(status: SessionStatus): void
  setActiveOutlet(outletId: OutletId | null): void
  clear(reason: ClearReason): void
}

const INITIAL_STATE: SessionState = {
  accessToken: null,
  refreshToken: null,
  accessTokenExpiry: null,
  refreshTokenExpiry: null,
  business: null,
  activeOutletId: null,
  status: 'unauthenticated',
}

/* ─────────────────────────── Storage terbelah ─────────────────────────── */

/** Render server tidak punya Web Storage — no-op agar hidrasi tidak melempar. */
const memoryFallback = new Map<string, string>()

const hasWindow = () => typeof window !== 'undefined'

type PersistedShape = {
  state: Partial<SessionState>
  version?: number
}

/**
 * Satu store, dua storage. Zustand `persist` hanya menerima satu backend,
 * sehingga `refreshToken` dan `activeOutletId` dipisahkan di lapisan ini:
 * keduanya ditulis ke `localStorage` dengan kunci sendiri, sisanya ke
 * `sessionStorage`. Membelahnya di sini — bukan lewat side-effect di dalam
 * action — membuat penulisan dan pembacaan simetris dan tidak mungkin lupa.
 */
const splitStorage: StateStorage = {
  getItem: (name) => {
    if (!hasWindow()) return memoryFallback.get(name) ?? null

    const raw = window.sessionStorage.getItem(name)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as PersistedShape
      parsed.state = {
        ...parsed.state,
        refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
        activeOutletId: window.localStorage.getItem(ACTIVE_OUTLET_KEY),
      }
      return JSON.stringify(parsed)
    } catch {
      // Blob rusak — perlakukan sebagai tidak ada sesi, jangan menggagalkan boot.
      return null
    }
  },

  setItem: (name, value) => {
    if (!hasWindow()) {
      memoryFallback.set(name, value)
      return
    }

    let parsed: PersistedShape
    try {
      parsed = JSON.parse(value) as PersistedShape
    } catch {
      return
    }

    const { refreshToken, activeOutletId, ...sessionScoped } = parsed.state

    if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    else window.localStorage.removeItem(REFRESH_TOKEN_KEY)

    if (activeOutletId) window.localStorage.setItem(ACTIVE_OUTLET_KEY, activeOutletId)
    else window.localStorage.removeItem(ACTIVE_OUTLET_KEY)

    window.sessionStorage.setItem(name, JSON.stringify({ ...parsed, state: sessionScoped }))
  },

  removeItem: (name) => {
    if (!hasWindow()) {
      memoryFallback.delete(name)
      return
    }
    window.sessionStorage.removeItem(name)
    window.localStorage.removeItem(REFRESH_TOKEN_KEY)
    // activeOutletId sengaja DIPERTAHANKAN: logout tidak menghapus preferensi
    // outlet perangkat, sehingga kasir/admin kembali ke outlet yang sama.
  },
}

/* ───────────────────────────── Store ───────────────────────────── */

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setSession: (payload) =>
        set({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          // Backend tidak mengirim masa berlaku — dihitung dari jam klien sendiri.
          accessTokenExpiry: Date.now() + ACCESS_TTL_MS,
          refreshTokenExpiry: Date.now() + REFRESH_TTL_MS,
          business: payload.business,
          status: 'authenticated',
        }),

      // Hanya access token yang diperbarui: refresh token tidak dirotasi,
      // sehingga refreshTokenExpiry sengaja TIDAK ikut diperpanjang.
      setAccessToken: (token, expiry) =>
        set({ accessToken: token, accessTokenExpiry: expiry, status: 'authenticated' }),

      setStatus: (status) => set({ status }),

      setActiveOutlet: (outletId) => set({ activeOutletId: outletId }),

      clear: (reason) =>
        set((s) => ({
          ...INITIAL_STATE,
          // Preferensi outlet bertahan lintas logout — lihat catatan di removeItem.
          activeOutletId: s.activeOutletId,
          status: reason === 'logout' ? 'unauthenticated' : 'expired',
        })),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => splitStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        accessTokenExpiry: s.accessTokenExpiry,
        refreshToken: s.refreshToken,
        refreshTokenExpiry: s.refreshTokenExpiry,
        business: s.business,
        activeOutletId: s.activeOutletId,
        status: s.status,
      }),

      /**
       * Penjaga konsistensi saat hidrasi.
       *
       * `accessToken` dan `status` berada di `sessionStorage`, sedangkan
       * `refreshToken` di `localStorage` ([05 §1.4.2]). Keduanya **dapat
       * menyimpang**: pengguna membersihkan salah satu lewat DevTools,
       * peramban membuang localStorage karena kuota, atau tab lain melakukan
       * logout yang hanya sebagian tersimpan.
       *
       * Bila itu terjadi, `status` yang bertahan bernilai `'authenticated'`
       * padahal token tidak lengkap — shell Admin ikut merender penuh dan
       * setiap query langsung gagal. Menurunkannya di sini membuat keadaan
       * separuh itu **tidak pernah ada**, alih-alih ditambal di setiap
       * pemanggil.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const complete = !!state.accessToken && !!state.refreshToken
        if (complete || state.status === 'unauthenticated') return

        useSessionStore.setState({
          ...INITIAL_STATE,
          activeOutletId: state.activeOutletId,
          status: 'unauthenticated',
        })
      },
    },
  ),
)

/**
 * Store yang di-`persist` menghasilkan ketidakcocokan server/klien pada render
 * pertama. Konsumen wajib menunggu hidrasi selesai dan merender skeleton
 * sementara ([05 §1.2.3]).
 */
export const hasSessionHydrated = (): boolean => useSessionStore.persist.hasHydrated()
