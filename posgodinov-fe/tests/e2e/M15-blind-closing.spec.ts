import { expect, test, type Page } from '@playwright/test'

import { goOffline, loginCashierWithOpenShift, UAT_SHIFT } from './support/pos-bootstrap'

/**
 * M15 butir 9 — **Blind Closing** (P-12).
 *
 * Otomasi `UAT-V2-01` ([08 §MODUL I]) dan gerbang `Definition of Done — M15`
 * butir 2 ([11 §M15]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENGAPA "CARI KATA `selisih`" ADALAH ASERSI YANG SALAH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Godaan pertama siapa pun yang menulis tes ini adalah:
 *
 *     await expect(page.getByText(/selisih/i)).not.toBeVisible()   // ⛔ SALAH
 *
 * Asersi itu **gagal pada build yang benar**. Layar Tutup Shift memang memuat
 * kata "selisih" — di dalam banner yang justru menjelaskan mengapa angkanya
 * tidak ada: *"selisih dihitung dan ditinjau di kantor, bukan di layar ini."*
 * Hal yang sama berlaku untuk "modal awal", yang muncul pada petunjuk isian
 * laci: *"Hitung seluruh isi laci, termasuk modal awal."*
 *
 * Keduanya adalah **prosa penjelas**, dan keduanya adalah bagian dari fitur.
 * Tes yang memerahkannya akan "diperbaiki" dengan menghapus kalimatnya — dan
 * kasir kehilangan satu-satunya penjelasan mengapa ia diminta menghitung buta.
 *
 * Karena itu `UAT-V2-01` tidak berbunyi "kata itu tidak ada", melainkan:
 *
 *   > Pencarian DOM ketiga kata kunci tidak menemukan satu pun **elemen nilai**.
 *
 * Yang dilarang adalah **angkanya**, bukan namanya.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIGA LAPIS, DAN LAPIS PERTAMA YANG PALING BERHARGA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Lapis 1 — NILAI   : nominal apa pun di luar tiga isian deklarasi
 *   Lapis 2 — ISTILAH : kata yang tidak punya alasan sah untuk muncul
 *   Lapis 3 — PROSA   : "selisih"/"modal awal" boleh ada, asalkan tanpa angka
 *
 * Lapis 1 menangkap kebocoran yang **diberi label baru**. Angka ekspektasi yang
 * muncul kembali berjudul "Ringkasan Laci" lolos dari daftar kata mana pun,
 * tetapi tidak lolos dari hitungan nominal. Daftar kata selalu tertinggal satu
 * langkah di belakang orang yang menamai ulang variabelnya; hitungan nominal
 * tidak.
 */

/* ════════════════════════════════════════════════════════════════════════════
 * Kontrak layar
 * ════════════════════════════════════════════════════════════════════════════ */

/** Label ketiga isian deklarasi — `CloseShiftScreen.tsx`. */
const DECLARATION_LABELS = ['Uang Fisik di Laci', 'Total Settle EDC', 'Total Settle QRIS'] as const

/**
 * Istilah yang **tidak punya alasan sah** untuk muncul di layar kasir.
 *
 * Sengaja dipisah dari "selisih"/"modal awal": kata-kata di bawah ini tidak
 * pernah menjadi prosa penjelas pada layar ini, sehingga kemunculannya — dengan
 * atau tanpa angka — sudah merupakan kebocoran.
 *
 * `expected` dan `discrepancy` mencerminkan `grep` DoD M15 butir 2 pada tingkat
 * DOM: gerbang itu memeriksa berkas sumber, lapis ini memeriksa yang
 * benar-benar sampai ke mata kasir setelah dirender.
 */
const FORBIDDEN_TERMS = [
  'expected',
  'discrepancy',
  'variance',
  'ekspektasi',
  'diharapkan',
  'seharusnya',
  'total penjualan',
  'jumlah transaksi',
  'penjualan tunai',
  'saldo',
] as const

/**
 * Istilah yang boleh muncul **hanya sebagai prosa**, tidak pernah berdampingan
 * dengan angka. Lihat catatan panjang di kepala berkas.
 */
const PROSE_ONLY_TERMS = ['selisih', 'modal awal'] as const

/* ════════════════════════════════════════════════════════════════════════════
 * Detektor kebocoran
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Memeriksa ketiga lapis sekaligus dan mengembalikan daftar pelanggaran.
 *
 * Dikembalikan sebagai daftar, bukan dilempar sebagai kegagalan, karena
 * fungsinya dipakai dua arah: skenario utama menuntutnya kosong, dan
 * "detektor benar-benar dapat memerah" menuntutnya TIDAK kosong. Detektor yang
 * hanya pernah dijalankan pada layar bersih tidak pernah terbukti bekerja.
 */
async function findSystemNumberLeaks(page: Page): Promise<string[]> {
  const violations: string[] = []

  /**
   * ⚠️ `textContent`, BUKAN `innerText`.
   *
   * `innerText` hanya mengembalikan yang benar-benar terlihat, dan justru itu
   * yang membuatnya salah di sini. Pengantar MODUL I menyatakannya terang-
   * terangan:
   *
   *   > nilai dapat hadir di DOM tetapi tersembunyi CSS, dan itu tetap kebocoran
   *
   * Angka ekspektasi di balik `display:none` tetap terbaca siapa pun yang
   * membuka DevTools — dan kasir yang ingin mencocokkan lacinya adalah persis
   * orang yang punya alasan membukanya. `textContent` ikut membaca simpul
   * tersembunyi, sehingga kebocoran semacam itu tetap tertangkap.
   */
  const screen = await page.locator('.pos-root').evaluate((root) => root.textContent ?? '')

  /* ── Lapis 1 — NILAI ───────────────────────────────────────────────────
   *
   * Layar ini boleh memuat TEPAT tiga nominal: ketiga isian deklarasi.
   * Nominal keempat mana pun — apa pun judulnya — adalah angka yang tidak
   * diketik kasir.
   */
  const rupiahCount = (screen.match(/Rp/g) ?? []).length
  if (rupiahCount !== DECLARATION_LABELS.length) {
    violations.push(
      `Lapis 1 (nilai): ditemukan ${rupiahCount} nominal, seharusnya tepat ${DECLARATION_LABELS.length} (ketiga isian deklarasi).`,
    )
  }

  /* Modal awal shift ini `Rp 500.000` (`UAT_SHIFT`). Ia adalah suku pertama
   * rumus ekspektasi; kemunculan angkanya dalam bentuk apa pun berarti kasir
   * dapat menghitung sisa rumusnya di kepala. */
  const openingMajor = UAT_SHIFT.openingBalanceMinor / 100
  for (const rendering of [openingMajor.toLocaleString('id-ID'), String(openingMajor)]) {
    if (screen.includes(rendering)) {
      violations.push(`Lapis 1 (nilai): modal awal shift ("${rendering}") bocor ke layar kasir.`)
    }
  }

  /* ── Lapis 2 — ISTILAH ─────────────────────────────────────────────────── */
  const lower = screen.toLowerCase()
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) {
      violations.push(`Lapis 2 (istilah): istilah terlarang "${term}" muncul di layar kasir.`)
    }
  }

  /* ── Lapis 3 — PROSA ───────────────────────────────────────────────────
   *
   * Diperiksa per-elemen daun, bukan atas seluruh teks layar: memeriksa
   * halaman utuh akan selalu menemukan digit di suatu tempat (tombol keypad),
   * dan asersinya menjadi selalu-merah tanpa arti.
   */
  const proseWithNumbers = await page.locator('.pos-root').evaluate((root, terms) => {
    const found: string[] = []

    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      // Hanya elemen daun — teks induk memuat teks seluruh anaknya, dan
      // menghitungnya ganda akan menuduh elemen yang tidak bersalah.
      if (el.childElementCount > 0) continue

      const text = el.textContent ?? ''
      if (!terms.some((term) => text.toLowerCase().includes(term))) continue
      if (!/\d/.test(text)) continue

      found.push(text.trim())
    }

    return found
  }, [...PROSE_ONLY_TERMS])

  for (const text of proseWithNumbers) {
    violations.push(`Lapis 3 (prosa): "${text}" menyandingkan istilah penjelas dengan angka.`)
  }

  return violations
}

/* ════════════════════════════════════════════════════════════════════════════
 * Bantuan navigasi & isian
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Membuka Tutup Shift **lewat Bottom Bar → "Lainnya"**, persis langkah 2
 * `UAT-V2-01`.
 *
 * Bukan lewat deep link `#close-shift`, dan itu disengaja: bar bawah adalah
 * satu-satunya jalan yang benar-benar dipakai kasir (butir 18), sehingga tes
 * ini sekaligus membuktikan jalan itu masih ada.
 */
async function openCloseShiftViaBottomBar(page: Page): Promise<void> {
  const bottomBar = page.getByRole('navigation', { name: 'Navigasi utama' })
  await bottomBar.getByRole('button', { name: 'Lainnya' }).click()

  // Sheet "Menu Lainnya" adalah `<dialog>` modal — menunggu judulnya terlihat
  // memastikan `showModal()` sudah selesai sebelum ketukan berikutnya.
  await expect(page.getByRole('heading', { name: 'Menu Lainnya' })).toBeVisible()
  await page.getByRole('button', { name: 'Tutup Shift', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Tutup Shift' })).toBeVisible()
}

/** Baris deklarasi berdasarkan labelnya. */
const declarationRow = (page: Page, label: string) =>
  page.getByRole('button').filter({ hasText: label })

/**
 * Mengetik nominal Rupiah lewat Keypad — satu-satunya cara mengisi layar ini.
 *
 * ⚠️ `page.fill()` TIDAK dapat dipakai. Ketiga isian bukan `<input>` melainkan
 * `<button aria-pressed>` yang menampilkan hasil `useDigitInput`, dan angkanya
 * masuk lewat papan tombol di sebelahnya. Itu bukan kebetulan implementasi:
 * perangkat POS di konter dipakai tanpa papan ketik fisik.
 *
 * [rupiah] adalah Rupiah utuh, bukan sen — sama seperti yang diketuk kasir.
 */
async function typeDeclaration(page: Page, label: string, rupiah: string): Promise<void> {
  await declarationRow(page, label).click()

  // Baris aktif menerima ketukan keypad. `aria-pressed` adalah penanda yang
  // dipakai komponennya sendiri, jadi menunggunya bukan tebakan.
  await expect(declarationRow(page, label)).toHaveAttribute('aria-pressed', 'true')

  for (const digit of rupiah) {
    await page.getByRole('button', { name: `Angka ${digit}`, exact: true }).click()
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 * Skenario
 * ════════════════════════════════════════════════════════════════════════════ */

test.describe('M15 · Blind Closing — layar Tutup Shift (P-12)', () => {
  test.beforeEach(async ({ page }) => {
    // `UAT-V2-01` bermodus Offline: layar ini tidak boleh bergantung pada
    // backend untuk membuktikan apa pun tentang dirinya.
    await goOffline(page)
    await loginCashierWithOpenShift(page)
    await openCloseShiftViaBottomBar(page)
  })

  test('UAT-V2-01 · tidak membocorkan satu pun angka sistem', async ({ page }) => {
    expect(await findSystemNumberLeaks(page)).toEqual([])

    // Ketiga isian masih kosong — tidak ada nilai yang disiapkan sistem.
    const screen = await page.locator('.pos-root').innerText()
    expect(screen.match(/Rp\s*—/g) ?? []).toHaveLength(DECLARATION_LABELS.length)

    // Struktur: tepat tiga baris bernominal, tidak ada baris keempat.
    await expect(page.locator('.pos-root').getByRole('button', { name: /Rp/ })).toHaveCount(
      DECLARATION_LABELS.length,
    )
  })

  test('UAT-V2-01 · memuat tepat tiga isian deklarasi yang dapat diisi', async ({ page }) => {
    // Kepala layar tetap menyebut siapa yang bertanggung jawab atas laci ini.
    await expect(page.getByText('Kasir: Andi')).toBeVisible()

    for (const label of DECLARATION_LABELS) {
      await expect(declarationRow(page, label)).toBeVisible()
      await expect(declarationRow(page, label)).toContainText('Rp')
      await expect(declarationRow(page, label)).toContainText('—')
    }

    /* Angka `UAT-V2-02`: Laci Rp 544.000, EDC Rp 0, QRIS Rp 8.000. */
    await typeDeclaration(page, 'Uang Fisik di Laci', '544000')
    await typeDeclaration(page, 'Total Settle EDC', '0')
    await typeDeclaration(page, 'Total Settle QRIS', '8000')

    /* Dicocokkan dengan regex kelompok ribuan, BUKAN string `"Rp 544.000"`
     * utuh. `Intl.NumberFormat('id-ID')` menyisipkan spasi setelah "Rp" pada
     * sebagian versi ICU dan tidak pada sebagian lain; menuliskannya harfiah
     * membuat suite ini pecah saat Chromium diperbarui, karena alasan yang
     * tidak ada hubungannya dengan Blind Closing. */
    await expect(declarationRow(page, 'Uang Fisik di Laci')).toContainText(/544\.000/)
    await expect(declarationRow(page, 'Total Settle EDC')).toContainText(/Rp\s*0/)
    await expect(declarationRow(page, 'Total Settle QRIS')).toContainText(/8\.000/)

    // Mengisi ketiganya tidak memunculkan nominal keempat — mis. total
    // deklarasi, yang sudah merupakan agregat.
    expect(await findSystemNumberLeaks(page)).toEqual([])
  })

  test('tombol TUTUP SHIFT terkunci sampai uang fisik laci diisi', async ({ page }) => {
    const submit = page.getByRole('button', { name: 'TUTUP SHIFT', exact: true })

    // Laci WAJIB diisi; EDC dan QRIS boleh kosong ([11 §M15.3]).
    await expect(submit).toBeDisabled()

    await typeDeclaration(page, 'Total Settle QRIS', '8000')
    await expect(submit, 'QRIS saja tidak boleh membuka tombol tutup shift.').toBeDisabled()

    await typeDeclaration(page, 'Uang Fisik di Laci', '544000')
    await expect(submit).toBeEnabled()
  })

  test('dialog konfirmasi tidak membisikkan angka sistem', async ({ page }) => {
    await typeDeclaration(page, 'Uang Fisik di Laci', '544000')
    await page.getByRole('button', { name: 'TUTUP SHIFT', exact: true }).click()

    // Dialog konfirmasi adalah kesempatan TERAKHIR sistem membisikkan angkanya
    // — mis. "selisih Rp 4.000, lanjutkan?". Dialog semacam itu memang pernah
    // ada di v1 (`UAT-MV2-01`: "Dialog 'Selisih kas terdeteksi' yang lama tidak
    // pernah muncul"), sehingga ketiadaannya layak diuji tersendiri.
    const dialog = page.getByRole('dialog').filter({ hasText: 'Tutup shift sekarang?' })
    await expect(dialog).toBeVisible()

    const dialogText = (await dialog.innerText()).toLowerCase()
    for (const term of [...FORBIDDEN_TERMS, ...PROSE_ONLY_TERMS]) {
      expect(dialogText, `Dialog konfirmasi memuat istilah terlarang "${term}".`).not.toContain(term)
    }
    expect(dialogText, 'Dialog konfirmasi tidak boleh memuat nominal apa pun.').not.toContain('rp')
  })

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * DETEKTORNYA SENDIRI DIUJI — DAN INI BUKAN TES BASA-BASI
   * ═════════════════════════════════════════════════════════════════════════
   *
   * Seluruh nilai berkas ini bergantung pada satu hal: `findSystemNumberLeaks`
   * benar-benar memerah ketika ada kebocoran. Detektor yang rusak — locator
   * `.pos-root` yang berganti nama, `innerText` yang mengembalikan string
   * kosong — akan meluluskan SETIAP skenario di atas, dan suite ini berubah
   * menjadi stempel hijau yang tidak memeriksa apa pun. Kegagalan seperti itu
   * tidak pernah terlihat, karena bentuknya adalah tes yang lulus.
   *
   * Kebocorannya disuntikkan ke **DOM saat tes berjalan**, bukan ke berkas
   * sumber: kode produksi tidak boleh disentuh oleh pengujian, bahkan sementara.
   *
   * Ketiga kasus di bawah menyerang tiga lapis yang berbeda, karena satu kasus
   * hanya membuktikan satu lapis hidup dan menyembunyikan dua yang mati.
   */
  const LEAKS = [
    {
      lapis: 'Lapis 1 — nominal berlabel baru',
      // Persis bentuk regresi yang paling mungkin terjadi: angka ekspektasi
      // kembali dengan judul yang tidak ada di daftar kata mana pun.
      html: '<div><span>Ringkasan Laci</span><span>Rp 500.000</span></div>',
    },
    {
      lapis: 'Lapis 2 — istilah terlarang',
      html: '<div><span>Expected Balance</span></div>',
    },
    {
      lapis: 'Lapis 3 — prosa bersanding dengan angka',
      html: '<div><span>Selisih kas terdeteksi: 4.000</span></div>',
    },
    {
      // Kasus yang paling mudah lolos, dan yang paling tegas dituntut
      // pengantar MODUL I: nilai yang ADA di DOM tetapi disembunyikan CSS.
      // `innerText` tidak melihatnya sama sekali; kasus ini yang menjaga agar
      // detektor tidak pernah diam-diam dikembalikan ke sana.
      lapis: 'Lapis 1 — nominal disembunyikan CSS',
      html: '<div style="display:none"><span>Expected Balance</span><span>Rp 500.000</span></div>',
    },
  ] as const

  for (const leak of LEAKS) {
    test(`detektor memerah pada kebocoran — ${leak.lapis}`, async ({ page }) => {
      // Bersih sebelum disuntik: kalau tidak, tes ini lulus karena kebocoran
      // yang sudah ada lebih dulu, bukan karena suntikannya terdeteksi.
      expect(await findSystemNumberLeaks(page)).toEqual([])

      await page.locator('.pos-root').evaluate((root, html) => {
        root.insertAdjacentHTML('beforeend', html)
      }, leak.html)

      expect(
        await findSystemNumberLeaks(page),
        'Kebocoran disuntikkan ke DOM tetapi detektor tetap hijau — detektornya rusak.',
      ).not.toEqual([])
    })
  }
})
