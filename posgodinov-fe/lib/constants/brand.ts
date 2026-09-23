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

/**
 * Warna chrome modul **Opname Gudang** ([11 §M16.1]).
 *
 * Sengaja BERBEDA dari [BRAND_THEME_COLOR]. Perangkat gudang kadang berupa
 * ponsel pribadi yang juga dipakai untuk hal lain; bilah status berwarna lain
 * adalah isyarat pertama bahwa petugas berada di modul yang berbeda — dan
 * bahwa ia TIDAK sedang memegang aplikasi kasir.
 *
 * Isyarat visual bukan pengganti isolasi teknis (database Dexie terpisah,
 * scope service worker terpisah, aturan lint dua arah); ia melengkapinya untuk
 * satu-satunya lapisan yang tidak dapat ditegakkan kode: mata pemakainya.
 *
 * `--godinov-amber-700` — nada gudang/inventori pada Lapis 1.
 */
export const OPNAME_THEME_COLOR = '#B45309'
