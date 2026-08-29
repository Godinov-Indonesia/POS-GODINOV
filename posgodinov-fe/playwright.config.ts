import { defineConfig, devices } from '@playwright/test'

/**
 * Konfigurasi E2E Web PWA — otomasi UAT v2.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA HANYA CHROMIUM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Target POS adalah handheld/tablet Android di konter, dan seluruh armada
 * menjalankan mesin Blink. Menambah WebKit/Firefox di sini bukan cakupan
 * tambahan melainkan **kegagalan palsu**: perbedaan render di mesin yang tidak
 * pernah dipakai outlet akan memerahkan suite yang seharusnya menjaga aturan
 * bisnis, dan suite merah yang tidak berarti adalah suite yang dimatikan orang.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICE WORKER DIBLOKIR — INI YANG MEMBUAT SUITE DETERMINISTIK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `/pos` mendaftarkan `sw.js` dan mem-precache dokumennya sendiri
 * (`useServiceWorker.ts`). Di dalam pengujian, cache itu berarti proses ke-2
 * dapat memuat HTML dari proses ke-1 — bug yang muncul dan hilang tanpa pola.
 *
 * Registrasinya sendiri sudah `.catch(() => {})`, sehingga pemblokiran ini
 * tidak menghasilkan galat yang tidak tertangani. Perilaku offline-first tetap
 * teruji lewat Dexie, yang memang tempat data POS sesungguhnya hidup.
 */

/** Port `next dev` bawaan. Ditimpa lewat env agar runner QA dapat menggeser. */
const PORT = process.env.PW_PORT ?? '3000'
const BASE_URL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`

/**
 * Perintah menyalakan FE bila belum ada yang menyalakannya.
 *
 * `qa_runner_web.sh` menyalakan FE lebih dulu; `reuseExistingServer` membuat
 * Playwright memakai proses itu alih-alih menyalakan yang kedua di port yang
 * sama. Menjalankan `pnpm exec playwright test` sendirian tetap bekerja karena
 * blok ini yang menyalakannya.
 *
 * Bawaannya `pnpm dev`. Untuk uji yang benar-benar setara produksi, jalankan
 * `pnpm build` lebih dulu lalu setel `PW_WEB_SERVER_CMD="pnpm start"`.
 */
const WEB_SERVER_CMD = process.env.PW_WEB_SERVER_CMD ?? 'pnpm dev'

export default defineConfig({
  testDir: './tests/e2e',

  /**
   * Setiap spec memakai `browserContext` sendiri — IndexedDB, localStorage, dan
   * cookie tidak pernah bocor antar berkas. Itu prasyarat paralelisme di sini:
   * seluruh state POS tinggal di IndexedDB, dan dua tes yang berbagi database
   * akan saling menutup shift.
   */
  fullyParallel: true,

  /** `test.only` yang lolos ke CI menyembunyikan seluruh suite di belakangnya. */
  forbidOnly: !!process.env.CI,

  /**
   * Nol pengulangan secara lokal — DISENGAJA.
   *
   * Tes UAT yang lulus pada percobaan kedua adalah tes yang tidak dapat
   * dipercaya, dan `retries` menyembunyikannya persis sampai hari rilis. Di CI
   * satu pengulangan diizinkan semata untuk menyerap kehabisan sumber daya
   * runner, bukan untuk menutupi kerapuhan.
   */
  retries: process.env.CI ? 1 : 0,

  /** Mesin QA lokal ini bukan farm CI; batasi agar `next dev` tidak kehabisan napas. */
  workers: process.env.CI ? 2 : 1,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list'], ['html', { open: 'never' }]],

  /** Satu skenario UAT penuh (bootstrap + navigasi + asersi) muat nyaman di sini. */
  timeout: 60_000,

  expect: {
    /**
     * 10 detik, bukan 5 bawaan: kompilasi rute on-demand `next dev` membuat
     * render pertama `/pos` jauh lebih lambat dari render berikutnya.
     */
    timeout: 10_000,
  },

  use: {
    baseURL: BASE_URL,

    /** Blokir SW — lihat catatan di kepala berkas. */
    serviceWorkers: 'block',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /**
     * Batas eksplisit untuk aksi dan navigasi.
     *
     * Tanpa ini keduanya mewarisi `timeout` tes (60 dtk), sehingga locator yang
     * salah menggantung satu menit sebelum melapor — dan laporannya menunjuk ke
     * kehabisan waktu tes, bukan ke locator yang tidak pernah cocok.
     */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /**
         * Viewport tablet 10" landscape — kelas perangkat yang dipakai outlet.
         *
         * Bukan detail kosmetik: `PosBottomBar` dan `CloseShiftScreen` berganti
         * tata letak pada breakpoint `lg` (1024 px). Menguji pada 1280×800
         * berarti yang diperiksa adalah tata letak yang benar-benar dilihat
         * kasir.
         */
        viewport: { width: 1280, height: 800 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
      },
    },
  ],

  webServer: {
    command: WEB_SERVER_CMD,
    url: BASE_URL,
    /**
     * `qa_runner_web.sh` sudah menyalakan FE; Playwright memakainya kembali.
     * Tanpa ini, runner dan Playwright berebut port 3000 dan yang kedua mati.
     */
    reuseExistingServer: true,
    /** `next dev` pada start dingin dapat memakan lebih dari satu menit. */
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  outputDir: './test-results',
})
