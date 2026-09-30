import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Selector null-safety — mencegah kambuhnya kesalahan `null` → `.map()`
 * ([05 §3.1]).
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
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // `lib/` adalah infrastruktur murni lapisan bawah.
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

  // Mencegah kambuhnya kesalahan `null` → `.map()` di produksi ([05 §3.1]).
  {
    files: ["lib/**", "features/**", "app/**", "components/**"],
    rules: {
      "no-restricted-syntax": ["error", ...NULL_SAFETY_SELECTORS],
    },
  },
]);

export default eslintConfig;
