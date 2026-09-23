/**
 * Status jaringan sebagai **STATE**, bukan sebagai navigasi — butir 1 & 2
 * ([11 §M12.1]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ATURAN R7 — BERKAS INI TIDAK BOLEH MENYENTUH NAVIGASI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tidak ada `location.href`, tidak ada `router.push`, tidak ada `history` di
 * sini, dan tidak boleh ditambahkan. Perpindahan status jaringan terjadi
 * puluhan kali per jam di outlet dengan Wi-Fi buruk; setiap navigasi yang
 * terikat padanya adalah keranjang yang hilang di depan pelanggan.
 *
 * Yang boleh dilakukan perubahan status: mengubah warna indikator, mengaktifkan
 * tombol, dan memicu satu putaran sinkronisasi. Tidak lebih.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIGA STATUS, BUKAN DUA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * | Status     | Arti                                                          |
 * |------------|---------------------------------------------------------------|
 * | `online`   | Permintaan terakhir berhasil, atau belum ada bukti sebaliknya |
 * | `degraded` | `navigator.onLine` berkata ada jaringan, tetapi permintaan gagal |
 * | `offline`  | Sistem operasi menyatakan tidak ada antarmuka jaringan         |
 *
 * `degraded` ada karena `navigator.onLine` **berbohong** pada dua kasus yang
 * justru paling sering di lapangan: captive portal Wi-Fi mal/ruko yang belum
 * di-login, dan router menyala tanpa uplink. Keduanya melaporkan `true`.
 * Memperlakukannya sebagai `online` membuat kasir melihat ikon hijau sambil
 * antreannya diam-diam menumpuk; memperlakukannya sebagai `offline` membuat
 * tombol sinkronisasi manual mati padahal jaringan bisa saja pulih detik itu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEFAULT ONLINE (butir 2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Status awal adalah `online`, bukan hasil pembacaan `navigator.onLine`.
 * Perangkat dinyatakan bermasalah hanya setelah ada **bukti**: sebuah
 * permintaan yang benar-benar gagal, atau peristiwa `offline` dari sistem
 * operasi. Menebak "mungkin offline" saat aplikasi baru dibuka hanya menunda
 * putaran sinkronisasi pertama tanpa alasan.
 *
 * Berkas ini sengaja **bebas kerangka kerja** (tanpa zustand, tanpa React) agar
 * tetap sah menghuni `lib/` ([05 §1.1.1 butir 4]). Bentuk `subscribe` +
 * `getSnapshot` cocok langsung dengan `useSyncExternalStore`.
 */

export type ConnectivityStatus = 'online' | 'degraded' | 'offline'

export type ConnectivityState = {
  status: ConnectivityStatus
  /** Kegagalan jaringan beruntun sejak keberhasilan terakhir. */
  consecutiveFailures: number
  /** ISO-8601 keberhasilan jaringan terakhir; `null` bila belum pernah. */
  lastOkAt: string | null
}

/**
 * Berapa kegagalan beruntun sebelum status turun ke `degraded`.
 *
 * Satu kegagalan bukan bukti: permintaan tunggal dapat gagal karena timeout
 * sesaat, dan menurunkan status karenanya membuat indikator berkedip-kedip
 * sepanjang jam sibuk.
 */
const DEGRADED_THRESHOLD = 2

let state: ConnectivityState = {
  status: 'online',
  consecutiveFailures: 0,
  lastOkAt: null,
}

const listeners = new Set<() => void>()

function emit(next: ConnectivityState): void {
  // Perbandingan per-field: `useSyncExternalStore` membandingkan snapshot
  // dengan kesamaan REFERENSI, sehingga mengembalikan objek baru pada setiap
  // pembacaan menghasilkan render tak berujung.
  if (
    next.status === state.status &&
    next.consecutiveFailures === state.consecutiveFailures &&
    next.lastOkAt === state.lastOkAt
  ) {
    return
  }
  state = next
  for (const listener of listeners) listener()
}

export function subscribeConnectivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Snapshot stabil secara referensi — aman untuk `useSyncExternalStore`. */
export const getConnectivitySnapshot = (): ConnectivityState => state

/**
 * Snapshot sisi server.
 *
 * Selalu `online`: POS tidak pernah dirender di server ([05 §1.1.3]), dan
 * nilai ini hanya dipakai agar hidrasi tidak berbeda dari render pertama.
 */
export const getConnectivityServerSnapshot = (): ConnectivityState => SERVER_SNAPSHOT

const SERVER_SNAPSHOT: ConnectivityState = {
  status: 'online',
  consecutiveFailures: 0,
  lastOkAt: null,
}

/** Dipanggil mesin sync setiap kali sebuah permintaan benar-benar berhasil. */
export function reportNetworkSuccess(at: string): void {
  emit({ status: 'online', consecutiveFailures: 0, lastOkAt: at })
}

/**
 * Dipanggil mesin sync setiap kali sebuah permintaan gagal di lapisan transport.
 *
 * ⚠️ **Hanya untuk kegagalan TRANSPORT.** Response `4xx`/`5xx` yang benar-benar
 * tiba membuktikan jaringan hidup — memanggil fungsi ini untuk galat semacam
 * itu akan menandai perangkat `degraded` padahal masalahnya ada di server.
 */
export function reportNetworkFailure(): void {
  const failures = state.consecutiveFailures + 1
  emit({
    // Peristiwa `offline` dari sistem operasi lebih otoritatif daripada
    // tebakan kita; jangan menimpanya menjadi `degraded`.
    status: state.status === 'offline' ? 'offline' : failures >= DEGRADED_THRESHOLD ? 'degraded' : state.status,
    consecutiveFailures: failures,
    lastOkAt: state.lastOkAt,
  })
}

/**
 * Memasang penyimak peristiwa jaringan sistem operasi.
 *
 * Mengembalikan fungsi pembersih. Dipasang sekali dari `PosApp`.
 */
export function installConnectivityWatcher(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onOffline = () => {
    // Pernyataan sistem operasi bersifat pasti — tidak perlu ambang batas.
    emit({ ...state, status: 'offline' })
  }

  const onOnline = () => {
    // Antarmuka kembali TIDAK berarti server terjangkau: inilah momen captive
    // portal paling sering muncul. Status naik ke `degraded`, bukan langsung
    // `online`; putaran sinkronisasi berikutnya yang membuktikannya.
    emit({
      ...state,
      status: state.consecutiveFailures > 0 ? 'degraded' : 'online',
    })
  }

  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)

  // Hanya keadaan `offline` yang dipercaya saat pemasangan; `true` dibiarkan
  // apa adanya karena status awal memang sudah `online` (default online).
  if (!navigator.onLine) onOffline()

  return () => {
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
  }
}

/**
 * Apakah layak mencoba mengirim.
 *
 * `degraded` **tetap boleh mencoba** — itulah satu-satunya cara mengetahui
 * captive portal sudah dilewati. Hanya `offline` yang benar-benar menghentikan
 * percobaan, dan itu pun karena sistem operasi menyatakan tidak ada antarmuka
 * sama sekali.
 */
export const shouldAttemptNetwork = (status: ConnectivityStatus): boolean => status !== 'offline'

/** Label siap tampil. Dipakai StatusBar dan P-13 agar keduanya tidak menyimpang. */
export const CONNECTIVITY_LABEL: Record<ConnectivityStatus, string> = {
  online: 'Online',
  degraded: 'Jaringan bermasalah',
  offline: 'Offline',
}

/** Hanya untuk uji — mengembalikan modul ke keadaan awal. */
export function __resetConnectivityForTest(): void {
  state = { status: 'online', consecutiveFailures: 0, lastOkAt: null }
  listeners.clear()
}
