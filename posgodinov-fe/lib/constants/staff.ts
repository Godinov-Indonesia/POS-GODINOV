import type { StaffPermission, StaffRole } from '@/lib/types/api'

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export const STAFF_ROLES: readonly StaffRole[] = [
  'CASHIER',
  'SUPERVISOR',
  'MANAGER',
  'STOCK_KEEPER',
  'ADMIN',
] as const

export const STAFF_ROLE_LABELS: Record<StaffRole, { label: string; tone: BadgeTone; description: string }> = {
  CASHIER: {
    label: 'Kasir',
    tone: 'neutral',
    description: 'Akses operasional kasir harian dan penjualan.',
  },
  SUPERVISOR: {
    label: 'Supervisor',
    tone: 'info',
    description: 'Pengawasan shift, otorisasi void & retur transaksi kasir.',
  },
  MANAGER: {
    label: 'Manager',
    tone: 'success',
    description: 'Manajemen operasional outlet penuh dan laporan.',
  },
  STOCK_KEEPER: {
    label: 'Petugas Gudang',
    tone: 'warning',
    description: 'Akses stok bahan baku, restock, waste, dan audit opname.',
  },
  ADMIN: {
    label: 'Admin Outlet',
    tone: 'danger',
    description: 'Akses seluruh konfigurasi operasional dan staf di outlet.',
  },
}

export const STAFF_PERMISSIONS: readonly StaffPermission[] = [
  'VOID_APPROVE',
  'RETURN_APPROVE',
  'KIOSK_EXIT',
  'OPNAME_COUNT',
  'FORCE_CLOSE_SHIFT',
] as const

export const STAFF_PERMISSION_CONFIG: Record<
  StaffPermission,
  { label: string; description: string }
> = {
  VOID_APPROVE: {
    label: 'Otorisasi Void Transaksi',
    description: 'Mengizinkan pembatalan item atau struk transaksi kasir.',
  },
  RETURN_APPROVE: {
    label: 'Otorisasi Retur & Refund',
    description: 'Mengizinkan retur produk dan pengembalian uang konsumen.',
  },
  KIOSK_EXIT: {
    label: 'Keluar Mode Kiosk',
    description: 'Membuka kunci tampilan kasir mandiri (self-order kiosk).',
  },
  OPNAME_COUNT: {
    label: 'Hitung Stock Opname (SO Mobile)',
    description: 'Mengizinkan input hitung fisik bahan baku pada aplikasi SO.',
  },
  FORCE_CLOSE_SHIFT: {
    label: 'Tutup Paksa Shift (Force Close)',
    description: 'Menutup shift kasir lain yang masih terbuka dalam keadaan darurat.',
  },
}

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  CASHIER: ['OPNAME_COUNT'],
  SUPERVISOR: ['VOID_APPROVE', 'RETURN_APPROVE', 'KIOSK_EXIT', 'OPNAME_COUNT', 'FORCE_CLOSE_SHIFT'],
  MANAGER: ['VOID_APPROVE', 'RETURN_APPROVE', 'KIOSK_EXIT', 'OPNAME_COUNT', 'FORCE_CLOSE_SHIFT'],
  STOCK_KEEPER: ['OPNAME_COUNT'],
  ADMIN: ['VOID_APPROVE', 'RETURN_APPROVE', 'KIOSK_EXIT', 'OPNAME_COUNT', 'FORCE_CLOSE_SHIFT'],
}
