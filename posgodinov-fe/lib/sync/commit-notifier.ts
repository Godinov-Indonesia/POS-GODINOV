/**
 * Kanal pemberitahuan "sebuah baris baru saja di-commit" — butir 2
 * ([11 §M12.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA ADA LAPISAN PERANTARA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Repositori (`lib/db/repositories/*`) perlu memberi tahu mesin sinkronisasi
 * bahwa ada sesuatu untuk dikirim. Memanggil `syncUp()` langsung dari sana
 * akan:
 *
 *   1. mengikat lapisan penyimpanan pada lapisan jaringan — repositori menjadi
 *      mustahil diuji tanpa menyiapkan seluruh mesin sync;
 *   2. **melewati pembaruan store tampilan**, sehingga indikator "sedang
 *      menyinkronkan" di StatusBar tidak pernah menyala — persis kesalahan yang
 *      sudah dihindari `sync-triggers.ts` dengan menyuntikkan runner-nya.
 *
 * Karena itu repositori hanya MENGUMUMKAN; siapa yang mendengarkan dan apa yang
 * ia lakukan adalah urusan lapisan di atasnya.
 */

/** Entitas yang kelahirannya layak memicu pengiriman. */
export type CommitKind = 'transaction' | 'void' | 'return' | 'waste' | 'shift' | 'security-event'

export type CommitListener = (kind: CommitKind) => void

const listeners = new Set<CommitListener>()

/**
 * Mendaftarkan pendengar. Mengembalikan fungsi pembersih.
 *
 * Dipanggil `installSyncTriggers`; tidak ada tempat lain yang perlu
 * mendengarkan.
 */
export function onCommit(listener: CommitListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Diumumkan repositori **setelah** penulisan Dexie benar-benar berhasil.
 *
 * ⚠️ Urutannya mengikat: `await db.….add(row)` dulu, `notifyCommit()` kemudian.
 * Mengumumkan lebih awal berarti mesin sync dapat membaca antrean sebelum
 * barisnya ada, lalu menyimpulkan tidak ada yang perlu dikirim.
 *
 * Kegagalan pendengar ditelan di sini: pemberitahuan adalah efek samping
 * OPSIONAL. Transaksi yang sudah tersimpan tidak boleh gagal hanya karena
 * penjadwal sinkronisasi bermasalah — uangnya sudah diterima.
 */
export function notifyCommit(kind: CommitKind): void {
  for (const listener of listeners) {
    try {
      listener(kind)
    } catch {
      // sengaja diabaikan — lihat catatan di atas
    }
  }
}

/** Hanya untuk uji. */
export function __resetCommitListenersForTest(): void {
  listeners.clear()
}
