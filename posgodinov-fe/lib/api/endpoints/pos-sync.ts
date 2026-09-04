/**
 * Endpoint POS — docs/03 §2. Seluruhnya memakai **device token**.
 */

import { posRequest, posRequestList } from '@/lib/api/pos-client'
import {
  POS_CONTRACT_VERSION_HEADER,
  POS_CONTRACT_VERSION_V2,
  type MasterDataResponse,
  type PosTransaction,
  type SyncUpRequest,
  type SyncUpRequestV2,
  type SyncUpResponse,
  type SyncUpResponseV2,
} from '@/lib/types/api'

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
 * Kontrak v2 — dipakai mesin sync sejak Fase M12 ([11 §4.1]).
 *
 * Header `X-POS-Contract-Version: 2` adalah satu-satunya hal yang memberi tahu
 * server bahwa koleksi baru pada payload boleh diproses. Tanpa header itu,
 * server memperlakukan permintaan sebagai v1 dan **mengabaikan** `returns`,
 * `void_logs`, serta `security_events` secara diam-diam — kegagalan paling
 * senyap yang mungkin terjadi, karena `200` tetap kembali dan hitungannya tetap
 * masuk akal.
 */
export const syncUpV2 = (payload: SyncUpRequestV2): Promise<SyncUpResponseV2> =>
  posRequest<SyncUpResponseV2>('/v1/pos/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { [POS_CONTRACT_VERSION_HEADER]: POS_CONTRACT_VERSION_V2 },
  })

/**
 * ⚠️ Paginasi tidak berfungsi: handler menetapkan `limit = 50`, `offset = 0`
 * secara hard-coded. Endpoint ini hanya akan mengembalikan **50 transaksi
 * terbaru — selamanya** ([03 §2.4]).
 */
export const fetchServerTransactions = (): Promise<PosTransaction[]> =>
  posRequestList<PosTransaction>('/v1/pos/transactions')

/**
 * Mencari SATU transaksi lampau lewat kode struk — butir 16 ([11 §M17.3]).
 *
 * ⚠️ Mengembalikan satu transaksi, bukan daftar. Endpoint yang mengembalikan
 * daftar adalah penelusuran massal dengan nama lain, dan itu persis keadaan
 * yang butir 16 tutup.
 *
 * `outlet_id` **tidak** dikirim: server mengambilnya dari device token. Kasir
 * yang mengetik kode milik cabang lain menerima `404` yang sama dengan kode
 * yang tidak ada sama sekali.
 */
export const lookupTransaction = (code: string): Promise<PosTransaction> =>
  posRequest<PosTransaction>(`/v1/pos/transactions/lookup?code=${encodeURIComponent(code)}`)
