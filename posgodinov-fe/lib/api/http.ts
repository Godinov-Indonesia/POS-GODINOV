/**
 * Lapisan transport tunggal — docs/05 §1.3.
 *
 * Seluruh keanehan backend diserap di sini. Sisa aplikasi tidak boleh tahu
 * bahwa endpoint auth tidak beramplop, bahwa koleksi kosong bisa `null`, atau
 * bahwa `/bulk` mengirim array telanjang.
 *
 * Berkas ini bebas Next.js ([05 §1.1.1 butir 4]) dan bebas ketergantungan pada
 * `lib/auth` maupun `lib/db`: sumber token disuntikkan lewat
 * `registerTokenResolver()` saat aplikasi start. Tanpa inversi ini, `lib/api`
 * dan `lib/auth` akan saling mengimpor secara melingkar.
 */

import { PosApiError } from '@/lib/api/errors'
import type { ApiEnvelope, ApiErrorBody } from '@/lib/types/api'

export const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'

/** `/v1/business/*` memakai access token; `/v1/pos/*` memakai device token. */
export type AuthMode = 'access' | 'device' | 'none'

export type RequestOptions = Omit<RequestInit, 'headers'> & {
  /** Endpoint auth Business tidak memakai amplop ([03 §0], Bentuk B). */
  raw?: boolean
  /** Endpoint `/bulk` mengirim ARRAY TELANJANG, bukan objek berpembungkus. */
  bareArrayBody?: unknown[]
  /** Injeksi header Authorization. Default `'access'`. */
  auth?: AuthMode
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Internal — penanda percobaan ulang setelah refresh `401` ([05 §1.4.3]). */
  __retried?: boolean
}

/* ───────────────── Inversi dependensi: token & jam ───────────────── */

type TokenResolver = () => string | null | Promise<string | null>

const tokenResolvers: Partial<Record<'access' | 'device', TokenResolver>> = {}

/**
 * Didaftarkan sekali saat bootstrap:
 * - `'access'` → `getValidAccessToken()` dari `lib/auth/session-manager.ts`
 * - `'device'` → pembacaan `meta['device.token']` dari Dexie ([05 §1.4.2])
 */
export function registerTokenResolver(mode: 'access' | 'device', resolver: TokenResolver): void {
  tokenResolvers[mode] = resolver
}

type DateHeaderObserver = (serverDateHeader: string | null) => void

let dateHeaderObserver: DateHeaderObserver | null = null

/** Didaftarkan oleh `lib/time` dengan `detectClockSkew` ([05 §1.8.2]). */
export function registerDateHeaderObserver(observer: DateHeaderObserver): void {
  dateHeaderObserver = observer
}

async function authHeader(mode: AuthMode): Promise<Record<string, string>> {
  if (mode === 'none') return {}

  const resolver = tokenResolvers[mode]
  if (!resolver) {
    throw new Error(
      `Token resolver "${mode}" belum terdaftar. Panggil registerTokenResolver() saat bootstrap.`,
    )
  }

  const token = await resolver()
  if (!token) {
    throw new PosApiError(
      401,
      mode === 'device'
        ? 'Perangkat belum diikat ke outlet mana pun'
        : 'Sesi tidak tersedia — silakan login ulang',
    )
  }

  return { Authorization: `Bearer ${token}` }
}

/* ───────────────────────────── request ───────────────────────────── */

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { raw, bareArrayBody, auth = 'access', headers, __retried, ...init } = opts
  void __retried

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      body: bareArrayBody ? JSON.stringify(bareArrayBody) : init.body,
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeader(auth)),
        ...headers,
        // Sengaja TIDAK mengirim X-Tenant-ID — backend tidak membacanya ([03 §0]).
      },
    })
  } catch (cause) {
    // Gagal jaringan / offline. statusCode 0 → `isRetryable` bernilai true.
    if (cause instanceof PosApiError) throw cause
    throw new PosApiError(0, 'Tidak dapat terhubung ke server', undefined, path)
  }

  dateHeaderObserver?.(res.headers.get('Date'))

  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const err = body as ApiErrorBody | null
    throw new PosApiError(
      res.status,
      err?.message ?? 'Terjadi kesalahan jaringan',
      err?.errors,
      path,
    )
  }

  if (raw) return body as T // Bentuk B — tanpa amplop
  return ((body as ApiEnvelope<T> | null)?.data ?? null) as T
}

/**
 * Pembungkus WAJIB untuk setiap endpoint yang mengembalikan koleksi.
 *
 * Menutup batasan [04 §0 #8] / [05 §3.1]: sebagian koleksi kosong datang
 * sebagai `null`, dan perbedaan antar-endpoint tidak konsisten maupun dijamin.
 * Tidak ada endpoint koleksi yang boleh memanggil `request<T[]>()` langsung.
 */
export async function requestList<T>(path: string, opts: RequestOptions = {}): Promise<T[]> {
  return (await request<T[] | null>(path, opts)) ?? []
}
