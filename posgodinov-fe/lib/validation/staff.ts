import { z } from 'zod'

import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/constants/limits'

/**
 * Validasi staff — docs/03 §4.1.
 *
 * Backend hanya memvalidasi **panjang** PIN (4-6), tidak mewajibkan angka:
 * `"abcd"` akan diterima. Frontend menegakkan digit saja karena keypad kasir
 * (P-03) hanya menampilkan angka — PIN huruf akan mustahil dimasukkan.
 */
export const createStaffSchema = z.object({
  outlet_id: z.string().min(1, 'Outlet wajib dipilih'),
  staff_identifier: z.string().min(1, 'ID/Username staff wajib diisi'),
  name: z.string().min(1, 'Nama wajib diisi'),
  pin: z
    .string()
    .min(PIN_MIN_LENGTH, `PIN minimal ${PIN_MIN_LENGTH} digit`)
    .max(PIN_MAX_LENGTH, `PIN maksimal ${PIN_MAX_LENGTH} digit`)
    .regex(/^\d+$/, 'PIN hanya boleh berisi angka — keypad kasir tidak punya huruf'),
  email: z.string().email('Format email tidak valid').or(z.literal('')).optional(),
})

export type CreateStaffForm = z.infer<typeof createStaffSchema>

/** ⚠️ Tidak ada field PIN: backend tidak menyediakan cara mengubahnya ([03 §4.4]). */
export const updateStaffSchema = z.object({
  staff_identifier: z.string().min(1, 'ID/Username staff wajib diisi'),
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Format email tidak valid').or(z.literal('')).optional(),
  is_active: z.boolean(),
})

export type UpdateStaffForm = z.infer<typeof updateStaffSchema>
