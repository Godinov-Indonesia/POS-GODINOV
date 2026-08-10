/**
 * Klasifikasi error backend — docs/05 §1.3, docs/03 §0.
 *
 * Backend **tidak** memakai kode status HTTP secara semantik. Outlet milik
 * tenant lain (seharusnya `403`) dan data tidak ditemukan (seharusnya `404`)
 * sama-sama dikembalikan sebagai `400`. Percabangan berdasarkan `403`/`404`
 * tidak akan pernah tereksekusi.
 *
 * Konsekuensinya, klasifikasi terpaksa berbasis pencocokan pesan — rapuh
 * terhadap perubahan kalimat backend, dan **sengaja diisolasi hanya di kelas
 * ini** supaya perbaikan backend kelak cukup mengubah satu berkas.
 */
export class PosApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly fieldErrors?: Record<string, string>,
    readonly path?: string,
  ) {
    super(message)
    this.name = 'PosApiError'
  }

  /** `"akses ditolak: outlet ini bukan milik bisnis Anda"` — datang sebagai `400`. */
  get isAccessDenied(): boolean {
    return this.message.includes('akses ditolak')
  }

  /** `"produk tidak ditemukan"`, `"outlet tidak ditemukan"` — datang sebagai `400`. */
  get isNotFound(): boolean {
    return this.message.includes('tidak ditemukan')
  }

  /** Token hilang / tidak valid / salah jenis — satu-satunya `401` dari middleware. */
  get isUnauthorized(): boolean {
    return this.statusCode === 401
  }

  /** Hanya endpoint register yang dibatasi: 10 request/menit per IP ([03 §1.1]). */
  get isRateLimited(): boolean {
    return this.statusCode === 429
  }

  /** `0` dipakai untuk kegagalan jaringan/offline — layak dicoba ulang. */
  get isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 0
  }
}

/**
 * Sesi tidak dapat dipulihkan tanpa login ulang — dilempar oleh session manager
 * ([05 §1.4.3]). Bukan turunan `PosApiError`: ini kondisi klien, bukan response.
 */
export class SessionExpiredError extends Error {
  constructor(readonly reason: 'no-session' | 'no-refresh-token' | 'refresh-token-expired') {
    super(`Sesi berakhir: ${reason}`)
    this.name = 'SessionExpiredError'
  }
}
