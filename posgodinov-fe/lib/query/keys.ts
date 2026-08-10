import type { DateRange } from '@/lib/time'

/**
 * Factory query key — docs/05 §1.2.2.
 *
 * ⚠️ `activeOutletId` **wajib** menjadi bagian query key ([04 §B.2]).
 * Melanggar aturan ini menghasilkan bug paling berbahaya di aplikasi ini: data
 * outlet A ditampilkan setelah pengguna berpindah ke outlet B.
 *
 * Seluruh key ber-scope outlet berbagi prefiks `['outlet', outletId]` sehingga
 * satu `removeQueries()` membersihkan semuanya saat berpindah outlet.
 */
export const queryKeys = {
  outlets: () => ['outlets'] as const,

  outletScope: (outletId: string) => ['outlet', outletId] as const,

  staff: (o: string) => [...queryKeys.outletScope(o), 'staff'] as const,
  /** `GET /v1/business/staff` — lintas outlet, tidak ber-scope. */
  allStaff: () => ['staff', 'all'] as const,
  categories: (o: string) => [...queryKeys.outletScope(o), 'categories'] as const,
  products: (o: string) => [...queryKeys.outletScope(o), 'products'] as const,
  rawMaterials: (o: string) => [...queryKeys.outletScope(o), 'raw-materials'] as const,

  reportDashboard: (o: string, range: DateRange) =>
    [...queryKeys.outletScope(o), 'reports', 'dashboard', range.start, range.end] as const,
  reportTransactions: (o: string, range: DateRange) =>
    [...queryKeys.outletScope(o), 'reports', 'transactions', range.start, range.end] as const,
  reportRestock: (o: string) => [...queryKeys.outletScope(o), 'reports', 'restock'] as const,
  reportWaste: (o: string) => [...queryKeys.outletScope(o), 'reports', 'waste'] as const,
  reportOpnames: (o: string) => [...queryKeys.outletScope(o), 'reports', 'opnames'] as const,
} as const
