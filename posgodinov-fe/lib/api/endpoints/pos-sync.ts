/**
 * Endpoint POS — docs/03 §2. Seluruhnya memakai **device token**.
 */

import { posRequest, posRequestList } from '@/lib/api/pos-client'
import type { MasterDataResponse, PosTransaction, SyncUpRequest, SyncUpResponse } from '@/lib/types/api'

/** ⚠️ Setiap array di dalamnya bisa `null` — normalisasi dilakukan pemanggil. */
export const fetchMasterData = (): Promise<MasterDataResponse> =>
  posRequest<MasterDataResponse>('/v1/pos/sync/master-data')

/**
 * ⚠️ Mengembalikan `200` walau sebagian gagal. **Jangan memperlakukan `200`
 * sebagai "semua berhasil"** — periksa `failed_transactions` ([03 §2.3]).
 */
export const syncUp = (payload: SyncUpRequest): Promise<SyncUpResponse> =>
  posRequest<SyncUpResponse>('/v1/pos/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

/**
 * ⚠️ Paginasi tidak berfungsi: handler menetapkan `limit = 50`, `offset = 0`
 * secara hard-coded. Endpoint ini hanya akan mengembalikan **50 transaksi
 * terbaru — selamanya** ([03 §2.4]).
 */
export const fetchServerTransactions = (): Promise<PosTransaction[]> =>
  posRequestList<PosTransaction>('/v1/pos/transactions')
