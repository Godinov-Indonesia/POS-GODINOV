/**
 * Endpoint auth Business — docs/03 §1.
 *
 * ⚠️ Ketiga endpoint ini memakai **Bentuk B: tanpa amplop** dan tanpa header
 * Authorization. Ini satu-satunya tempat `raw: true` dipakai di seluruh aplikasi.
 */

import { request } from '@/lib/api/http'
import type {
  AuthResponse,
  DeviceBindRequest,
  DeviceBindResponse,
  LoginRequest,
  RegisterRequest,
} from '@/lib/types/api'

/** `POST /v1/auth/business/register` — `201`. Rate limit 10 req/menit per IP. */
export const registerBusiness = (body: RegisterRequest): Promise<AuthResponse> =>
  request<AuthResponse>('/v1/auth/business/register', {
    method: 'POST',
    body: JSON.stringify(body),
    raw: true,
    auth: 'none',
  })

/** `POST /v1/auth/business/login` — `200`. Tidak ada rate limit di backend. */
export const loginBusiness = (body: LoginRequest): Promise<AuthResponse> =>
  request<AuthResponse>('/v1/auth/business/login', {
    method: 'POST',
    body: JSON.stringify(body),
    raw: true,
    auth: 'none',
  })

/**
 * `POST /v1/auth/device/bind` — `200` (bukan `201`), **beramplop**.
 *
 * Dijalankan satu kali saat pemasangan perangkat. `password` adalah password
 * Business Owner, dikirim teks polos tanpa rate limit — temuan keamanan paling
 * mendesak dari audit ([03 §2.1]).
 */
export const bindDevice = (body: DeviceBindRequest): Promise<DeviceBindResponse> =>
  request<DeviceBindResponse>('/v1/auth/device/bind', {
    method: 'POST',
    body: JSON.stringify(body),
    auth: 'none',
  })
