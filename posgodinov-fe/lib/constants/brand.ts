/**
 * Warna untuk **chrome peramban & sistem operasi**, bukan untuk CSS.
 *
 * `theme_color` manifest dan `viewport.themeColor` dibaca oleh OS (bilah status
 * Android, bilah judul PWA) **sebelum** CSS mana pun dievaluasi, sehingga
 * keduanya tidak dapat merujuk `var(--brand)`. Ini satu-satunya pengecualian
 * sah terhadap aturan "komponen tidak pernah merujuk Lapis 1" ([06 §1.1]) —
 * dan disentralisasi di sini supaya rebranding tetap menjadi perubahan
 * beberapa berkas, bukan perburuan nilai heksadesimal.
 *
 * Nilainya wajib identik dengan Lapis 1 di `app/globals.css`:
 * - `--godinov-navy-950` → bilah status POS menyatu dengan `StatusBar`
 * - `--godinov-slate-50` → layar splash menyatu dengan kanvas aplikasi
 */
export const BRAND_THEME_COLOR = '#0F172A'
export const BRAND_BACKGROUND_COLOR = '#F8FAFC'
