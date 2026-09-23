'use client'

/**
 * `closeShiftSaga` — **butir 17** ([11 §M15.4]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENAM LANGKAH, SATU TITIK TAK DAPAT DIBATALKAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. Validasi input deklarasi (≥ 0, bukan kosong)
 *   2. Tulis shift CLOSED ke Dexie            ← titik tak dapat dibatalkan
 *   3. Antre struk tutup shift ke print_jobs
 *   4. Picu sync ('shift-close'), TUNGGU maksimal 8 detik
 *      └─ gagal/timeout → lanjut; antrean menyusul, kasir tidak ditahan
 *   5. Bersihkan: cart-store, sesi kasir, params router
 *   6. posNavigate('login')  ← navigasi INTERNAL (R7)
 *
 * **Setelah langkah 2, saga tidak pernah berhenti di tengah.** Shift yang sudah
 * `CLOSED` di Dexie tetapi kasirnya masih tertahan di layar tutup shift adalah
 * keadaan yang tidak dapat dipulihkan dari layar itu: tombolnya akan menolak
 * karena shift-nya sudah tidak terbuka, dan kasir terjebak. Karena itu langkah
 * 3–5 seluruhnya menelan kegagalannya sendiri.
 *
 * Batas 8 detik pada langkah 4 bukan optimisme tentang jaringan. Ia justru
 * mengasumsikan jaringan buruk: menunggu tanpa batas berarti kasir yang berdiri
 * di outlet tanpa sinyal tidak pernah sampai ke layar Login, dan shift
 * berikutnya tidak dapat dibuka. Antrean sync sudah menjamin data itu sampai —
 * yang ditunggu di sini hanyalah kenyamanan melihatnya terkirim.
 */

import { useCartStore } from '@/features/pos/cart/cart-store'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posReplace } from '@/features/pos/router/usePosRouter'
import { runSync } from '@/features/pos/sync/useSyncEngine'
import { getBoundOutletLabel } from '@/lib/auth/device-session'
import { closeShift, getOpenShift } from '@/lib/db/repositories/shift.repo'
import { enqueueShiftReport } from '@/lib/printer/print-queue'
import { nowIso } from '@/lib/time'

/** Jeda maksimum menunggu sync sebelum kasir dilepas ke Login. */
export const SYNC_WAIT_MS = 8_000

export type CloseShiftDeclaration = {
  /** Uang fisik hasil hitung laci — sen. */
  declaredCashMinor: number
  /** Total settle EDC — sen. */
  declaredEdcMinor: number
  /** Total settle QRIS — sen. */
  declaredQrisMinor: number
}

export type CloseShiftOutcome =
  | { ok: true; shiftId: string; synced: boolean }
  | { ok: false; error: string }

export async function closeShiftSaga(
  declaration: CloseShiftDeclaration,
): Promise<CloseShiftOutcome> {
  // ── 1. Validasi ─────────────────────────────────────────────────────────
  //
  // Nol adalah nilai yang SAH: outlet yang tidak menerima QRIS sepanjang shift
  // memang mendeklarasikan nol. Yang ditolak adalah nilai negatif dan bukan
  // -angka — keduanya hanya bisa lahir dari bug, bukan dari laci mana pun.
  const invalid = Object.entries(declaration).find(
    ([, value]) => !Number.isFinite(value) || value < 0,
  )
  if (invalid) {
    return { ok: false, error: `Nilai deklarasi tidak sah pada ${invalid[0]}.` }
  }

  const shift = await getOpenShift()
  if (!shift) {
    return { ok: false, error: 'Tidak ada shift terbuka untuk ditutup.' }
  }

  // ── 2. Titik tak dapat dibatalkan ───────────────────────────────────────
  //
  // Kegagalan di sini BOLEH menghentikan saga: belum ada yang berubah, dan
  // kasir dapat mencoba lagi dari layar yang sama.
  try {
    await closeShift({
      shiftId: shift.id,
      declaredCashMinor: declaration.declaredCashMinor,
      declaredEdcMinor: declaration.declaredEdcMinor,
      declaredQrisMinor: declaration.declaredQrisMinor,
      blindClose: shift.blind_close ?? true,
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gagal menutup shift.',
    }
  }

  // ── 3. Struk tutup shift ────────────────────────────────────────────────
  //
  // Aturan R6: kegagalan cetak tidak pernah menggulung penulisan yang sudah
  // terjadi. Shift-nya sudah `CLOSED`, dan tidak ada kertas yang mampu
  // membatalkannya. `enqueueShiftReport` sendiri sudah berjanji tidak melempar;
  // `try` di sini menjaga janji itu tetap benar bila kelak berubah.
  try {
    await enqueueShiftReport(shift.id, {
      outletName: (await getBoundOutletLabel()) ?? 'POS Godinov',
      shiftId: shift.id,
      cashierName: usePosAuthStore.getState().staffName ?? '-',
      openedAt: shift.client_opened_at,
      closedAt: nowIso(),
      // Diambil dari argumen, BUKAN dibaca ulang dari Dexie. Kertas harus
      // memuat angka yang baru saja diketik kasir; pembacaan kedua dapat
      // mengambil baris yang sudah disentuh rekonsiliasi sync.
      declaredCashMinor: declaration.declaredCashMinor,
      declaredEdcMinor: declaration.declaredEdcMinor,
      declaredQrisMinor: declaration.declaredQrisMinor,
      blindClose: shift.blind_close ?? true,
    })
  } catch {
    // sengaja ditelan — lihat catatan di atas
  }

  // ── 4. Sync, dengan batas waktu ─────────────────────────────────────────
  const synced = await raceWithTimeout(runSync('shift-close'), SYNC_WAIT_MS)

  // ── 5. Bersihkan sesi ───────────────────────────────────────────────────
  //
  // Keranjang lebih dulu, sesi kasir belakangan. Urutan sebaliknya membuka
  // jendela di mana kasir sudah keluar tetapi keranjangnya masih berisi — dan
  // kasir berikutnya yang login akan mewarisi belanjaan orang sebelumnya.
  try {
    useCartStore.getState().clear()
  } catch {
    // Store yang gagal dibersihkan tidak boleh menahan kasir di layar ini.
  }
  usePosAuthStore.getState().clearSession()

  // ── 6. Navigasi INTERNAL, tanpa jejak ───────────────────────────────────
  //
  // `posReplace`, bukan router Next (aturan R7). Navigasi Next akan mengambil
  // payload RSC dan gagal di perangkat offline — tepat pada saat kasir paling
  // membutuhkannya berhasil.
  //
  // `replace`, bukan `navigate`: entri riwayat layar Tutup Shift dibuang,
  // sehingga *Back* tidak dapat kembali ke sana (butir 17). Sisa riwayat di
  // belakangnya dijaga terpisah oleh pemeriksaan sesi pada `popstate`
  // ([11 §M15.4]).
  //
  // `closed: '1'` adalah satu-satunya parameter yang diteruskan — sebuah
  // penanda, bukan angka. Layar Login menampilkan konfirmasi "Shift ditutup"
  // tanpa nominal apa pun.
  posReplace('login', { closed: '1' })

  return { ok: true, shiftId: shift.id, synced }
}

/**
 * Menunggu [promise], tetapi tidak lebih dari [ms].
 *
 * Mengembalikan `true` bila selesai tepat waktu. Promise yang kalah balapan
 * **tidak dibatalkan** — ia tetap berjalan sampai selesai di latar, dan itu
 * memang yang diinginkan: sync yang lambat tetap harus sampai, hanya kasirnya
 * yang tidak perlu menunggunya.
 *
 * `.catch` dipasang pada promise aslinya supaya kegagalan yang tiba SETELAH
 * balapan usai tidak mendarat sebagai unhandled rejection.
 */
async function raceWithTimeout(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const guarded = promise.then(
    () => true,
    () => false,
  )

  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms)
  })

  try {
    return await Promise.race([guarded, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
