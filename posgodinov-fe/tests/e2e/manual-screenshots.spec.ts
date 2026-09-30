import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

/**
 * Pemanen tangkapan layar — **Manual Book Web Pemilik**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BERKAS INI BUKAN SUITE UAT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tidak satu pun aturan bisnis dibuktikan di sini. Tugasnya hanya membawa UI ke
 * keadaan yang layak dipotret untuk `docs/manuals/owner-manual-web.md`.
 *
 * Dipisahkan dari `M15-blind-closing.spec.ts` dengan sengaja: suite itu
 * menjaga butir 9, dan asersinya harus tetap tajam. Menumpangkan pemotretan di
 * sana berarti orang yang merapikan gambar dapat melonggarkan asersi tanpa
 * menyadarinya — dan kegagalan seperti itu berbentuk tes yang lulus.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA RESPONS SERVER DIPALSUKAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Manual harus dapat dibangun ulang tahun depan dan menghasilkan gambar yang
 * sama. Menggantungkannya pada isi basis data berarti gambarnya berubah setiap
 * kali seseorang menjalankan seeder — dan angka pada manual tidak lagi cocok
 * dengan kalimat di sekitarnya.
 *
 * `page.route()` memutus ketergantungan itu: angka pada gambar ditulis di sini,
 * berdampingan dengan kalimat yang menjelaskannya.
 *
 * ⚠️ Yang dipalsukan hanyalah **muatan jaringan**. Komponen, tata letak, format
 * rupiah, dan aturan penandaannya tetap kode produksi apa adanya — gambar yang
 * dihasilkan tetap gambar aplikasi yang sesungguhnya.
 *
 * Modul Opname tidak memakai `page.route()` sama sekali: ia bersifat lokal
 * lebih dulu, jadi keadaannya disemai langsung ke basis data perangkat.
 */

/* ── Sasaran berkas ──────────────────────────────────────────────────────────
 *
 * Nama-nama ini WAJIB sama persis dengan tag `![…](./assets/…)` pada
 * `docs/manuals/owner-manual-web.md`. Ditulis sebagai satu tetapan supaya
 * ketidakcocokan terlihat di satu tempat, bukan tersebar di lima pemanggilan.
 *
 * Path diturunkan dari `project.testDir` (absolut), BUKAN `process.cwd()` —
 * runner memanggil Playwright dari direktori yang berbeda-beda. */
const ASSET_FILES = {
  reconciliation: 'web-02-rekonsiliasi-shift.png',
  kioskAccess: 'web-05-hak-akses-kiosk.png',
  transactions: 'web-06-laporan-transaksi.png',
} as const

function assetPath(fileName: string): string {
  return path.resolve(test.info().project.testDir, '../../../docs/manuals/assets', fileName)
}

async function shoot(page: Page, fileName: string): Promise<void> {
  const target = assetPath(fileName)
  await page.screenshot({ path: target, fullPage: false })
  await test.info().attach(fileName, { path: target, contentType: 'image/png' })
}

/* ── Data tiruan ─────────────────────────────────────────────────────────── */

const OUTLET_ID = 'OUT001'
const BUSINESS_ID = 'GODINOV1'

const OUTLET = {
  id: OUTLET_ID,
  business_id: BUSINESS_ID,
  serial_tenant: 'POSGO180726001',
  name: 'Godinov Pusat Jakarta',
  address: 'Jl. Jenderal Sudirman Kav. 52, Jakarta Selatan',
  created_at: '2026-07-18T09:00:00Z',
}

const BUSINESS = {
  id: BUSINESS_ID,
  serial_business: 'POSGO180726',
  email: 'owner@posgodinov.com',
  name: 'Godinov Digital',
  owner_name: 'Muhamad Rifki Firdaus',
  created_at: '2026-07-18T09:00:00Z',
}

/**
 * Tiga shift dengan tiga nasib berbeda, dan itu disengaja:
 * pas, kurang di atas ambang, dan **lebih** di atas ambang.
 *
 * Manual menegaskan bahwa penanda "Perlu ditinjau" menyala untuk selisih ke DUA
 * arah. Gambar yang hanya memuat kekurangan akan membuat kalimat itu tidak
 * terbukti oleh gambarnya sendiri.
 */
const RECONCILIATION_ROWS = [
  {
    shift_id: 'a1000000-0000-4000-8000-000000000001',
    staff_id: 's1',
    staff_name: 'Bagus Prakoso',
    device_id: 'TAB-JKT-01',
    status: 'CLOSED',
    opening_balance: 500_000,
    declared_cash: 1_284_000,
    declared_edc_total: 420_000,
    declared_qris_total: 318_000,
    blind_close: true,
    expected_cash: 1_284_000,
    expected_edc_total: 420_000,
    expected_qris_total: 318_000,
    cash_variance: 0,
    edc_variance: 0,
    qris_variance: 0,
    flagged: false,
    variance_threshold: 5_000,
    client_opened_at: '2026-08-28T01:00:00Z',
    client_closed_at: '2026-08-28T10:05:00Z',
    reconciled_at: '2026-08-28T10:06:00Z',
  },
  {
    shift_id: 'a1000000-0000-4000-8000-000000000002',
    staff_id: 's2',
    staff_name: 'Siti Nurhaliza',
    device_id: 'TAB-JKT-02',
    status: 'CLOSED',
    opening_balance: 500_000,
    declared_cash: 963_500,
    declared_edc_total: 275_000,
    declared_qris_total: 190_000,
    blind_close: true,
    expected_cash: 1_001_000,
    expected_edc_total: 275_000,
    expected_qris_total: 190_000,
    cash_variance: -37_500,
    edc_variance: 0,
    qris_variance: 0,
    flagged: true,
    variance_threshold: 5_000,
    client_opened_at: '2026-08-28T10:10:00Z',
    client_closed_at: '2026-08-28T17:02:00Z',
    reconciled_at: '2026-08-28T17:03:00Z',
  },
  {
    shift_id: 'a1000000-0000-4000-8000-000000000003',
    staff_id: 's3',
    staff_name: 'Andi Saputra',
    device_id: 'TAB-JKT-01',
    status: 'CLOSED',
    opening_balance: 500_000,
    declared_cash: 1_147_000,
    declared_edc_total: 380_000,
    declared_qris_total: 244_000,
    blind_close: true,
    expected_cash: 1_129_000,
    expected_edc_total: 380_000,
    expected_qris_total: 244_000,
    cash_variance: 18_000,
    edc_variance: 0,
    qris_variance: 0,
    flagged: true,
    variance_threshold: 5_000,
    client_opened_at: '2026-08-29T01:00:00Z',
    client_closed_at: '2026-08-29T09:58:00Z',
    reconciled_at: '2026-08-29T09:59:00Z',
  },
]

/** Daftar staf beserta izinnya — sumber gambar "hak akses Kiosk". */
const STAFF_ROWS = [
  {
    id: 'st-1',
    outlet_id: OUTLET_ID,
    staff_identifier: 'manager01',
    email: null,
    name: 'Rangga Wijaya',
    role: 'MANAGER',
    permissions: ['VOID_APPROVE', 'RETURN_APPROVE', 'KIOSK_EXIT', 'OPNAME_COUNT', 'FORCE_CLOSE_SHIFT'],
    is_active: true,
    created_at: '2026-07-18T09:00:00Z',
  },
  {
    id: 'st-2',
    outlet_id: OUTLET_ID,
    staff_identifier: 'spv01',
    email: null,
    name: 'Dewi Lestari',
    role: 'SUPERVISOR',
    permissions: ['VOID_APPROVE', 'RETURN_APPROVE', 'KIOSK_EXIT'],
    is_active: true,
    created_at: '2026-07-18T09:00:00Z',
  },
  {
    id: 'st-3',
    outlet_id: OUTLET_ID,
    staff_identifier: 'kasir01',
    email: null,
    name: 'Bagus Prakoso',
    role: 'CASHIER',
    permissions: [],
    is_active: true,
    created_at: '2026-07-18T09:00:00Z',
  },
  {
    id: 'st-4',
    outlet_id: OUTLET_ID,
    staff_identifier: 'kasir02',
    email: null,
    name: 'Siti Nurhaliza',
    role: 'CASHIER',
    permissions: [],
    is_active: true,
    created_at: '2026-07-18T09:00:00Z',
  },
  {
    id: 'st-5',
    outlet_id: OUTLET_ID,
    staff_identifier: 'stok01',
    email: null,
    name: 'Yuni Rahmawati',
    role: 'STOCK_KEEPER',
    permissions: ['OPNAME_COUNT'],
    is_active: true,
    created_at: '2026-07-18T09:00:00Z',
  },
]

/**
 * Riwayat transaksi, memuat satu baris **dibatalkan** beserta catatannya.
 *
 * Baris itulah alasan gambar ini ada di manual: bagian "membaca daftar
 * pembatalan" menjelaskan cara membacanya, dan gambar tanpa satu pun
 * pembatalan tidak menjelaskan apa pun.
 */
const TRANSACTION_ROWS = [
  {
    id: 'tx-1001',
    customer_name: 'Meja 4',
    total_amount: 108_000,
    payment_method: 'CASH',
    status: 'COMPLETED',
    cancel_notes: '',
    client_created_at: '2026-08-29T02:14:00Z',
    created_at: '2026-08-29T02:14:03Z',
    items: [{ id: 'i1', product_id: 'p1', quantity: 6, unit_price: 18_000 }],
  },
  {
    id: 'tx-1002',
    customer_name: '',
    total_amount: 54_000,
    payment_method: 'QRIS',
    status: 'COMPLETED',
    cancel_notes: '',
    client_created_at: '2026-08-29T03:02:00Z',
    created_at: '2026-08-29T03:02:02Z',
    items: [{ id: 'i2', product_id: 'p2', quantity: 2, unit_price: 27_000 }],
  },
  {
    id: 'tx-1003',
    customer_name: 'Meja 7',
    total_amount: 96_000,
    payment_method: 'CASH',
    status: 'CANCELLED',
    cancel_notes: 'Jumlah salah — pelanggan mengurangi pesanan sebelum dibayar',
    client_created_at: '2026-08-29T04:41:00Z',
    created_at: '2026-08-29T04:41:05Z',
    items: [{ id: 'i3', product_id: 'p3', quantity: 3, unit_price: 32_000 }],
  },
  {
    id: 'tx-1004',
    customer_name: '',
    total_amount: 30_000,
    payment_method: 'CARD',
    status: 'COMPLETED',
    cancel_notes: '',
    client_created_at: '2026-08-29T05:20:00Z',
    created_at: '2026-08-29T05:20:04Z',
    items: [{ id: 'i4', product_id: 'p4', quantity: 1, unit_price: 30_000 }],
  },
]

/* ── Bootstrap sesi pemilik ──────────────────────────────────────────────────
 *
 * Sesi disuntik, BUKAN diketik lewat form login. Login pemilik bukan subjek
 * pemotretan ini, dan menjalankannya sungguhan berarti manual hanya dapat
 * dibangun ketika backend hidup — persis ketergantungan yang ingin dihindari.
 *
 * Bentuk penyimpanannya mengikuti `lib/auth/session-store.ts`, yang membelah
 * sesi ke dua tempat: token akses di `sessionStorage`, token segar dan outlet
 * aktif di `localStorage`. */
async function bootstrapOwnerSession(page: Page): Promise<void> {
  const dayMs = 24 * 60 * 60 * 1000
  await page.addInitScript(
    ({ business, outletId, expiry }) => {
      window.sessionStorage.setItem(
        'posgodinov.session',
        JSON.stringify({
          state: {
            accessToken: 'manual-book.access-token',
            accessTokenExpiry: expiry,
            refreshTokenExpiry: expiry,
            business,
            status: 'authenticated',
          },
          version: 0,
        }),
      )
      window.localStorage.setItem('posgodinov.refresh', 'manual-book.refresh-token')
      window.localStorage.setItem('posgodinov.active-outlet', outletId)
    },
    { business: BUSINESS, outletId: OUTLET_ID, expiry: Date.now() + 7 * dayMs },
  )
}

/** Membalas seluruh panggilan `/v1/**` dengan muatan tiruan di atas. */
async function mockOwnerApi(page: Page): Promise<void> {
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname

    const json = (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      })

    if (p.endsWith('/reports/shift-reconciliation')) return json(RECONCILIATION_ROWS)
    if (p.endsWith('/reports/transactions')) return json(TRANSACTION_ROWS)
    if (p.endsWith('/business/staff') || p.endsWith('/staff')) return json(STAFF_ROWS)
    if (p.endsWith('/business/outlets')) return json([OUTLET])
    if (p.includes('/reports/dashboard')) return json({ stats: null, top_products: [] })

    // Apa pun yang belum dikenali dijawab koleksi kosong, bukan 404: layar yang
    // memanggil endpoint sampingan tetap merender kerangkanya alih-alih jatuh
    // ke layar galat dan merusak gambar.
    return json([])
  })
}

/* ══════════════════════════════════════════════════════════════════════════ */

test.describe('Manual Book · tangkapan layar Web Pemilik', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapOwnerSession(page)
    await mockOwnerApi(page)
  })

  test('Rekonsiliasi Shift', async ({ page }) => {
    await page.goto('/admin/reports/shift-reconciliation')
    await expect(page.getByText('Bagus Prakoso').first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    await shoot(page, ASSET_FILES.reconciliation)
  })

  test('Laporan Transaksi — daftar pembatalan', async ({ page }) => {
    await page.goto('/admin/reports/transactions')
    await expect(page.getByText('Meja 4').first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    await shoot(page, ASSET_FILES.transactions)
  })

  test('Staff — izin keluar Kiosk', async ({ page }) => {
    await page.goto('/admin/staff')
    await expect(page.getByText('Rangga Wijaya').first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    await shoot(page, ASSET_FILES.kioskAccess)
  })
})
