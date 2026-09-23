import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Penegakan batas modul — docs/05 §1.1.4.
 *
 * "Tanpa penegakan otomatis, pemisahan bundle akan bocor dalam hitungan
 * minggu." Aturan di bawah adalah satu-satunya hal yang menjaga ADR-02 (POS
 * dapat dipindah ke Vite tanpa penulisan ulang) tetap benar seiring waktu.
 */
/**
 * Selector null-safety — mencegah kambuhnya kesalahan `null` → `.map()`
 * ([05 §3.1]).
 *
 * Diangkat menjadi konstanta karena `no-restricted-syntax` **tidak digabung**
 * antar-blok pada flat config: blok yang cocok belakangan MENGGANTI konfigurasi
 * rule yang sama, bukan menambahinya. Aturan R7 di bawah pernah tidak berbunyi
 * sama sekali karena hal ini — dan aturan yang diam adalah aturan yang tidak ada.
 */
const NULL_SAFETY_SELECTORS = [
  {
    selector:
      "CallExpression[callee.name='request'][typeArguments.params.0.type='TSArrayType']",
    message:
      "Gunakan requestList<T>() untuk endpoint koleksi — response bisa null (§3.1).",
  },
  {
    selector:
      "CallExpression[callee.name='adminRequest'][typeArguments.params.0.type='TSArrayType']",
    message:
      "Gunakan adminRequestList<T>() untuk endpoint koleksi — response bisa null (§3.1).",
  },
  {
    selector:
      "CallExpression[callee.name='posRequest'][typeArguments.params.0.type='TSArrayType']",
    message:
      "Gunakan posRequestList<T>() untuk endpoint koleksi — response bisa null (§3.1).",
  },
]

/**
 * ATURAN R7 ([11 §1]) — perpindahan state jaringan tidak boleh memicu navigasi
 * DOKUMEN.
 *
 * Setiap navigasi dokumen di dalam SPA kasir membuang keranjang yang sedang
 * diisi, layar aktif, dan sesi kasir — persis gejala "aplikasi keluar sendiri"
 * yang butir 1 dibangun untuk menutupnya. Sebelumnya aturan ini hanya berupa
 * perintah `grep` di dokumen rencana; perintah `grep` tidak pernah gagal di CI.
 */
const R7_NO_DOCUMENT_NAVIGATION_SELECTORS = [
  {
    selector:
      "AssignmentExpression[left.property.name='href'][left.object.property.name='location']",
    message:
      "R7: navigasi dokumen membuang seluruh state POS. Pakai posNavigate() ([11 §1]).",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(assign|replace)$/][callee.object.property.name='location']",
    message:
      "R7: navigasi dokumen membuang seluruh state POS. Pakai posNavigate() ([11 §1]).",
  },
  {
    selector: "CallExpression[callee.object.callee.name='useRouter']",
    message:
      "R7: router Next membuat perpindahan layar bergantung jaringan (ADR-02). Pakai posNavigate().",
  },
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker berjalan di scope Worker, bukan DOM — aturan React/Next
    // di sini hanya menghasilkan derau. Lihat catatan di berkasnya.
    "public/sw.js",
  ]),

  // `lib/` adalah infrastruktur murni. Kebebasannya dari Next.js itulah yang
  // membuat ADR-02 dapat dibatalkan tanpa penulisan ulang.
  {
    files: ["lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message: "lib/ harus bebas Next.js ([05 §1.1.1 butir 4]).",
            },
            {
              group: ["@/features/*", "@/components/*", "@/app/*"],
              message: "lib/ adalah lapisan terbawah — tidak boleh mengimpor lapisan di atasnya.",
            },
          ],
        },
      ],
    },
  },

  // POS: client-only, bebas Next.js, dan tidak boleh menyeret dependensi Admin
  // yang memperberat bundle kasir.
  {
    files: ["features/pos/**", "workers/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message: "Modul POS harus bebas Next.js (ADR-02).",
            },
            {
              group: ["@/features/admin/*"],
              message: "POS tidak boleh mengimpor kode Admin.",
            },
            {
              group: ["recharts", "@tanstack/react-table"],
              message: "Dependensi khusus Admin — memperberat bundle POS.",
            },
          ],
        },
      ],
    },
  },

  // Admin tidak pernah menyentuh database lokal POS.
  {
    files: ["features/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/pos/*", "@/lib/db", "@/lib/db/*", "@/lib/sync/*", "dexie", "dexie/*", "dexie-react-hooks"],
              message: "Admin tidak boleh menyentuh database lokal POS ([05 §1.1.4]).",
            },
          ],
        },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BUTIR 4 — ISOLASI MODUL OPNAME ([11 §M16.1])
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Dua aturan, DUA ARAH. Satu arah saja tidak cukup: melarang opname mengimpor
  // kasir tetapi membiarkan kasir mengimpor opname akan menarik seluruh modul
  // gudang ke dalam bundle kasir lewat satu `import` yang tampak tidak berbahaya
  // — dan bundle yang menyatu berarti petugas gudang, cepat atau lambat,
  // mendapat jalan menuju layar Void dan Tutup Shift.
  //
  // Aturan ini adalah lapis KEDUA, bukan satu-satunya. Lapis pertama struktural:
  // `lib/db/opname-dexie.ts` memakai database IndexedDB yang berbeda, sehingga
  // sesi kasir dan sesi opname tidak dapat saling melihat bahkan bila lint ini
  // gagal menyala.
  //
  // Diverifikasi dengan berkas umpan yang sengaja melanggar (DoD M16 butir 3).
  {
    files: ["features/opname/**", "app/(opname)/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/features/pos",
                "@/features/pos/*",
                "@/features/pos/**",
                "@/features/admin",
                "@/features/admin/*",
                "@/features/admin/**",
                // Basis data kasir. Modul opname memakai `@/lib/db/opname-dexie`
                // dan `@/lib/db/opname-models`; menyentuh yang lain berarti
                // membuka database `posgodinov` dari dalam modul gudang.
                "@/lib/db/dexie",
                "@/lib/db/models",
                "@/lib/db/repositories/*",
                "@/lib/sync/*",
                "@/lib/printer/*",
              ],
              message:
                "Butir 4 ([11 §M16.1]): modul Opname dilarang menyentuh kasir maupun basis data kasir. " +
                "Pakai @/lib/db/opname-dexie dan @/lib/db/opname-models.",
            },
          ],
        },
      ],
    },
  },

  // Arah sebaliknya — kasir dilarang menyentuh modul gudang.
  {
    files: ["features/pos/**", "app/(pos)/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/features/opname",
                "@/features/opname/*",
                "@/features/opname/**",
                "@/lib/db/opname-dexie",
                "@/lib/db/opname-models",
              ],
              message:
                "Butir 4 ([11 §M16.1]): jalur kasir dilarang menyentuh modul Opname. " +
                "Keduanya adalah aplikasi terpisah yang kebetulan berbagi monorepo.",
            },
          ],
        },
      ],
    },
  },

  // Mencegah kambuhnya kesalahan `null` → `.map()` di produksi ([05 §3.1]).
  {
    files: ["lib/**", "features/**", "app/**", "components/**"],
    rules: {
      "no-restricted-syntax": ["error", ...NULL_SAFETY_SELECTORS],
    },
  },

  // R7 — HARUS berada SETELAH blok di atas, dan WAJIB mengulang selector
  // null-safety: konfigurasi rule yang sama tidak digabung, melainkan diganti.
  {
    files: ["features/pos/**", "lib/sync/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...NULL_SAFETY_SELECTORS,
        ...R7_NO_DOCUMENT_NAVIGATION_SELECTORS,
      ],
    },
  },

  // ⚠️ HARUS berada SETELAH blok R7 di atas, dengan alasan yang sama persis:
  // ESLint flat config MENGGANTI konfigurasi rule bernama sama, tidak
  // menggabungkannya. Blok ini pernah diletakkan lebih awal dan `no-restricted-
  // syntax`-nya tidak pernah menyala sama sekali — diverifikasi dengan berkas
  // umpan yang sengaja melanggar.
  // ══════════════════════════════════════════════════════════════════════════
  // BUTIR 9 — Blind Closing ([11 §M15.3])
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Layar Tutup Shift tidak boleh dapat menghitung ekspektasi kas, dan cara
  // paling andal memastikannya bukan ulasan kode melainkan memutus jalur
  // impornya. `shift-math` adalah satu-satunya tempat rumus itu hidup di klien;
  // tanpa aturan ini, seseorang akan "sekadar menampilkan totalnya untuk
  // membantu kasir" dan seluruh fase ini gugur dalam satu commit.
  //
  // DoD M15 butir 2 memverifikasi hal yang sama lewat `grep`. Aturan ini
  // menangkapnya lebih awal — saat diketik, bukan saat diaudit.
  {
    files: ["features/pos/screens/CloseShiftScreen.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/features/pos/shift/shift-math",
                "**/shift-math",
              ],
              message:
                "Blind Closing (butir 9): layar Tutup Shift dilarang menghitung ekspektasi kas. " +
                "Angka expected_* dan variance dihitung server ([11 §M15.3]).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...NULL_SAFETY_SELECTORS,
        ...R7_NO_DOCUMENT_NAVIGATION_SELECTORS,
        {
          // Menangkap jalur kedua: menghitung selisih sendiri tanpa mengimpor
          // apa pun. Identifier bernama `expected*` atau `discrepancy*` di layar
          // ini hampir pasti berarti rumus yang diketik ulang di tempat.
          selector:
            "Identifier[name=/^(expected|discrepancy|totalSales|cashSales|nonCashSales)/]",
          message:
            "Blind Closing (butir 9): layar Tutup Shift tidak boleh menyebut ekspektasi, " +
            "selisih, maupun agregat penjualan ([11 §M15.3]).",
        },
      ],
    },
  },

  // Satu-satunya pengecualian R7, dan alasannya struktural.
  //
  // `/pos/bind` adalah ROUTE NEXT TERPISAH dari `/pos` ([05 §1.1.3]) — keduanya
  // dokumen berbeda, sehingga perpindahan di antaranya MEMANG navigasi dokumen
  // dan tidak dapat dilakukan router internal. Ia juga bukan pemicu jaringan:
  // terjadi sekali seumur pemasangan, setelah teknisi menekan tombol, ketika
  // tidak ada keranjang yang bisa hilang.
  {
    files: ["features/pos/screens/DeviceBindScreen.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...NULL_SAFETY_SELECTORS],
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
]);

export default eslintConfig;
