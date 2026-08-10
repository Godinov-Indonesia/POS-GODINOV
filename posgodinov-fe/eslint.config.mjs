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

  // Mencegah kambuhnya kesalahan `null` → `.map()` di produksi ([05 §3.1]).
  {
    files: ["lib/**", "features/**", "app/**", "components/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
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
      ],
    },
  },
]);

export default eslintConfig;
