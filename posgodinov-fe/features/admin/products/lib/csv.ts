/**
 * Parser CSV untuk impor produk massal (D-12).
 *
 * Sengaja minimalis dan tanpa dependensi: format yang diterima hanya
 * `nama,harga,kategori,url_gambar` — cukup untuk menyalin dari spreadsheet,
 * dan tidak berpura-pura mendukung CSV bertingkat yang tidak akan dipakai.
 * Baris ber-tanda kutip ganda tetap ditangani karena nama produk sering memuat
 * koma ("Kopi Susu, Large").
 */

export type CsvProductRow = {
  /** Nomor baris di berkas asal — dipakai pesan galat agar dapat ditelusuri. */
  line: number
  name: string
  /** Rupiah desimal sebagaimana diketik pengguna; konversi ke sen di pemanggil. */
  price: number
  categoryName: string
  imageUrl: string
}

export type CsvParseResult = {
  rows: CsvProductRow[]
  errors: string[]
}

const HEADER_ALIASES = ['nama', 'name', 'produk', 'product']

function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      // `""` di dalam kutipan berarti satu tanda kutip literal.
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
      continue
    }

    current += char
  }

  fields.push(current)
  return fields.map((f) => f.trim())
}

export function parseProductCsv(raw: string): CsvParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((entry) => entry.text.trim().length > 0)

  if (lines.length === 0) return { rows: [], errors: [] }

  // Baris header opsional — dikenali dari kolom pertama, bukan dari posisi.
  const firstFields = splitCsvLine(lines[0].text)
  const hasHeader = HEADER_ALIASES.includes(firstFields[0]?.toLowerCase() ?? '')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows: CsvProductRow[] = []
  const errors: string[] = []

  for (const entry of dataLines) {
    const [name = '', priceRaw = '', categoryName = '', imageUrl = ''] = splitCsvLine(entry.text)

    if (!name) {
      errors.push(`Baris ${entry.line}: nama produk kosong.`)
      continue
    }

    // Terima "22.000", "22000", dan "22000,50" — kebiasaan penulisan Indonesia.
    const normalized = priceRaw.replace(/\./g, '').replace(',', '.')
    const price = Number(normalized)

    if (!priceRaw || !Number.isFinite(price)) {
      errors.push(`Baris ${entry.line}: harga "${priceRaw}" bukan angka yang sah.`)
      continue
    }
    if (price < 0) {
      errors.push(`Baris ${entry.line}: harga tidak boleh negatif.`)
      continue
    }

    rows.push({ line: entry.line, name, price, categoryName, imageUrl })
  }

  return { rows, errors }
}
