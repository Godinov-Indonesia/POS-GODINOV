import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Bootstrap perangkat POS untuk pengujian E2E.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * APA YANG DISUNTIK, DAN APA YANG TETAP DIKLIK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Yang disuntik ke IndexedDB hanyalah **prasyarat yang lahir dari jaringan**:
 * binding perangkat (token dari server), data master staff, dan shift yang
 * sudah berjalan. Ketiganya bukan subjek pengujian ini — `UAT-V2-01` menguji
 * apa yang tampak di layar Tutup Shift, bukan apakah binding bekerja. Menaruh
 * ketiganya di dalam tes berarti kegagalan jaringan pada langkah pertama
 * dilaporkan sebagai "Blind Closing bocor", dan penguji mengejar bug yang tidak
 * ada.
 *
 * Yang TIDAK disuntik adalah **sesi kasir**. Login tetap diketik lewat UI
 * sungguhan, dan itu keputusan yang disengaja:
 *
 *   1. `usePosAuthStore` hidup hanya di memori (zustand tanpa `persist`).
 *      Tidak ada penyimpanan yang dapat disuntik — memalsukannya menuntut
 *      perubahan kode produksi, persis yang dilarang.
 *   2. `usePosHistorySync` menjaga `popstate`: setiap layar non-publik yang
 *      dicapai tanpa `staffId` dilempar balik ke Login (butir 17). Deep link
 *      `/pos#register` pada perangkat tanpa sesi **memang** mendarat di Login —
 *      dan itu perilaku yang benar, bukan penghalang yang perlu diakali.
 *   3. Layar Tutup Shift menampilkan nama kasir di kepalanya. Sesi tiruan
 *      membuatnya jatuh ke "—", sehingga yang diuji bukan lagi layar yang
 *      dilihat kasir sungguhan.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA `indexedDB` MENTAH, BUKAN MEMANGGIL Dexie
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aplikasi tidak mengekspos instance `db` ke `window`, dan menambahkannya hanya
 * demi pengujian berarti mengubah kode produksi.
 *
 * Karena itu urutannya: buka `/pos` lebih dulu supaya **aplikasi sendiri** yang
 * membuat skema (seluruh object store beserta indeksnya), baru tulis baris
 * lewat koneksi mentah tanpa nomor versi. Tanpa nomor versi, `indexedDB.open`
 * menempel pada versi yang sudah ada dan tidak pernah memicu `upgradeneeded` —
 * sehingga tes tidak perlu tahu satu pun string indeks Dexie, dan tidak ikut
 * membusuk saat skema v5 lahir.
 */

/** Nama database Dexie POS — `lib/db/dexie.ts` (`super('posgodinov')`). */
const DB_NAME = 'posgodinov'

/**
 * Basis URL backend yang dipakai FE (`.env` → `NEXT_PUBLIC_API_BASE_URL`).
 * Dipakai untuk memaksa modus Offline yang diminta `UAT-V2-01`.
 */
const API_ORIGIN = process.env.PW_API_ORIGIN ?? 'http://localhost:8080'

const DEVICE_ID = '00000000-1111-4222-8333-444444444444'

/** Kasir yang dipakai seluruh skenario. */
export const UAT_CASHIER = {
  id: '99999999-8888-4777-8666-555555555555',
  identifier: 'kasir.uat',
  name: 'Andi',
  pin: '1234',
  /**
   * bcrypt cost 10 atas PIN `1234`, dibuat sekali dengan `bcryptjs` yang sama
   * dengan yang dipakai aplikasi.
   *
   * Sengaja ditulis sebagai tetapan alih-alih dihitung saat tes berjalan:
   * membuat hash bcrypt memakan ratusan milidetik, dan biaya itu akan dibayar
   * ulang oleh setiap tes yang memakai bootstrap ini.
   */
  pinHash: '$2b$10$cfFFTlv67/q5KILudp4g/eAZta8ZvGFrREvoRrfnGM.oS0xeFDeD2',
} as const

export type SeededShift = {
  id: string
  staffId: string
  /** Modal awal laci dalam **sen** (ADR-05). */
  openingBalanceMinor: number
  clientOpenedAt: string
}

/**
 * Shift yang dipakai skenario `UAT-V2-01`: modal awal `Rp 500.000`.
 *
 * Nilainya sengaja BUKAN nol. Modal awal adalah suku pertama rumus ekspektasi,
 * dan justru itulah yang harus terbukti tidak pernah sampai ke layar kasir —
 * modal nol akan membuat asersi "modal awal tidak bocor" lulus tanpa menguji
 * apa pun.
 */
export const UAT_SHIFT: SeededShift = {
  id: '11111111-2222-4333-8444-555555555555',
  staffId: UAT_CASHIER.id,
  openingBalanceMinor: 500_000 * 100,
  clientOpenedAt: '2026-01-15T08:02:00.000+07:00',
}

/**
 * Memutus seluruh lalu lintas ke backend.
 *
 * `UAT-V2-01` bermodus **Offline** ([08 §MODUL I]). Memutusnya di lapisan rute
 * membuat skenario ini lulus atau gagal karena isi layarnya sendiri, bukan
 * karena ada tidaknya backend di mesin penguji — dan itulah yang membuat suite
 * ini dapat dijalankan siapa pun tanpa menyiapkan PostgreSQL lebih dulu.
 */
export async function goOffline(page: Page): Promise<void> {
  await page.route(`${API_ORIGIN}/**`, (route) => route.abort('internetdisconnected'))
}

/**
 * Menyiapkan perangkat lalu **masuk sebagai kasir lewat UI sungguhan**.
 *
 * Berakhir di layar Kasir (P-05) dengan satu shift `OPEN` berjalan — titik awal
 * yang diminta `UAT-V2-01` langkah 2.
 */
export async function loginCashierWithOpenShift(
  page: Page,
  shift: SeededShift = UAT_SHIFT,
): Promise<void> {
  await seedBoundDevice(page, shift)

  // Muat ulang DOKUMEN supaya `useLiveQuery` membaca baris yang baru ditulis.
  //
  // ⚠️ `page.goto('/pos#…')` TIDAK cukup dan tidak dapat menggantikan ini:
  // dari `/pos`, ia hanyalah navigasi satu dokumen — Playwright mengubah hash
  // tanpa memuat ulang apa pun, aplikasi tidak dipasang ulang, dan tulisan
  // `indexedDB` mentah tidak pernah terlihat karena ia tidak melewati pelacak
  // perubahan Dexie.
  await page.reload()

  // ── Login kasir, lewat formulir yang sama dengan yang dipakai di konter ──
  await expect(page.getByRole('heading', { name: 'MASUK SEBAGAI KASIR' })).toBeVisible()

  await page.getByLabel('ID / Username Staff').fill(UAT_CASHIER.identifier)
  for (const digit of UAT_CASHIER.pin) {
    await page.getByRole('button', { name: `Angka ${digit}`, exact: true }).click()
  }
  await page.getByRole('button', { name: 'MASUK', exact: true }).click()

  // `CashierLoginScreen` meneruskan shift `OPEN` yang ditinggalkan sesi
  // sebelumnya ke layar Kasir alih-alih membuka shift kedua. Bar bawah hanya
  // dirender di luar layar pra-shift, sehingga kemunculannya adalah bukti
  // deterministik bahwa login berhasil DAN shift seed benar-benar terbaca.
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
}

/**
 * Menulis prasyarat jaringan ke IndexedDB: perangkat terikat, staff, shift OPEN.
 *
 * Meninggalkan halaman pada `/pos` yang **belum** dimuat ulang — pemanggil yang
 * menentukan kapan aplikasi membacanya.
 */
async function seedBoundDevice(page: Page, shift: SeededShift): Promise<void> {
  // Biarkan APLIKASI yang membuat skema beserta seluruh object store-nya.
  await page.goto('/pos')

  // Perangkat memang belum terikat pada muatan pertama ini. Menunggu layar
  // tersebut muncul adalah cara deterministik memastikan Dexie SUDAH terbuka —
  // `isDeviceBound()` baru saja menyelesaikan pembacaannya untuk merendernya.
  await expect(page.getByRole('heading', { name: 'Perangkat belum terpasang' })).toBeVisible()

  const seeded = await page.evaluate(
    async ({ dbName, rows }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        // Tanpa nomor versi — menempel pada versi yang dibuat aplikasi.
        const request = indexedDB.open(dbName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error(`indexedDB.open("${dbName}") diblokir`))
      })

      const storeNames = Array.from(db.objectStoreNames)
      const required = Object.keys(rows)
      const missing = required.filter((name) => !storeNames.includes(name))
      if (missing.length > 0) {
        db.close()
        throw new Error(
          `Object store hilang: ${missing.join(', ')}. Ditemukan: ${storeNames.join(', ')}`,
        )
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(required, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error ?? new Error('transaksi seed dibatalkan'))

        for (const [storeName, storeRows] of Object.entries(rows)) {
          const store = tx.objectStore(storeName)
          for (const row of storeRows) store.put(row)
        }
      })

      db.close()
      return { storeNames }
    },
    {
      dbName: DB_NAME,
      rows: {
        meta: buildMetaRows(shift.clientOpenedAt),
        staffs: [buildStaffRow(shift.clientOpenedAt)],
        shifts: [buildShiftRow(shift)],
      } as Record<string, unknown[]>,
    },
  )

  // Gagal cepat dan jelas bila skema berpindah di bawah kaki tes ini.
  expect(seeded.storeNames).toEqual(expect.arrayContaining(['meta', 'staffs', 'shifts']))
}

/**
 * Baris `meta` yang membuat `isDeviceBound()` bernilai `true`.
 *
 * Kuncinya `device.token` — `isDeviceBound()` hanyalah `!!getMeta('device.token')`
 * (`lib/auth/device-session.ts`). `device.id` ikut ditulis karena butir 12
 * menjadikannya identitas pemilik shift, dan shift hasil seed harus tampak
 * seperti shift nyata milik perangkat ini.
 */
function buildMetaRows(boundAt: string) {
  const row = (key: string, value: unknown) => ({ key, value, updated_at: boundAt })

  return [
    // Nilai token tidak pernah divalidasi di sisi klien; ia hanya diteruskan
    // sebagai header oleh `registerTokenResolver`. Diberi nama yang jujur agar
    // siapa pun yang menemukannya di DevTools tahu ia berasal dari pengujian.
    row('device.token', 'e2e-uat-device-token'),
    row('device.id', DEVICE_ID),
    row('device.outletLabel', 'Outlet UAT'),
    row('device.boundAt', boundAt),
    // Gerbang master data (butir 10) menjaga Buka Shift, bukan Tutup Shift.
    // Diisi tetap supaya perangkat seed tidak tampak seperti perangkat yang
    // belum pernah menarik katalog.
    row('master.version', 1),
    row('master.lastSyncAt', boundAt),
  ]
}

/** Staff yang dicari `findStaffByIdentifier()` saat login. */
function buildStaffRow(syncedAt: string) {
  return {
    id: UAT_CASHIER.id,
    staff_identifier: UAT_CASHIER.identifier,
    name: UAT_CASHIER.name,
    pin_hash: UAT_CASHIER.pinHash,
    role: 'CASHIER',
    permissions: null,
    _syncedAt: syncedAt,
  }
}

/**
 * Baris `shifts` yang identik bentuknya dengan hasil `openShift()`
 * (`lib/db/repositories/shift.repo.ts`).
 *
 * ⚠️ `expected_balance` dan `discrepancy` DIISI NOL, bukan dihilangkan.
 * Keduanya kolom v1 yang masih ada pada tipe `LocalShift` dan tetap nol seumur
 * hidup baris v2 — `UAT-V2-02` memverifikasi tepat hal itu. Membiarkannya
 * `undefined` akan membuat baris seed berbeda dari baris produksi pada satu-
 * satunya kolom yang paling penting bagi fase ini.
 */
function buildShiftRow(shift: SeededShift) {
  return {
    id: shift.id,
    staff_id: shift.staffId,
    opening_balance: shift.openingBalanceMinor,
    closing_balance: 0,
    expected_balance: 0,
    discrepancy: 0,
    status: 'OPEN',
    client_opened_at: shift.clientOpenedAt,
    client_closed_at: null,

    declared_cash: 0,
    declared_edc_total: 0,
    declared_qris_total: 0,
    blind_close: true,
    master_data_version: 1,
    device_id: DEVICE_ID,
    closed_by: null,

    _synced: 0,
    _syncAttempts: 0,
    _syncError: null,
  }
}
