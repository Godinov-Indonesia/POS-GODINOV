import { z } from 'zod'

/**
 * Validasi form auth — docs/03 §1.1.
 *
 * ⚠️ Backend **tidak memvalidasi** kekuatan password maupun format email;
 * password `"a"` akan diterima ([03 §1.1] `[NEEDS DISCUSSION]`). Validasi di
 * sini adalah pengaman UX, **bukan** pengganti validasi backend — pengguna API
 * langsung tetap dapat melewatinya.
 */

export const loginSchema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export type LoginForm = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Nama bisnis wajib diisi'),
    owner_name: z.string().min(1, 'Nama pemilik wajib diisi'),
    email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmation_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((v) => v.password === v.confirmation_password, {
    message: 'Password dan konfirmasi password tidak cocok',
    path: ['confirmation_password'],
  })

export type RegisterForm = z.infer<typeof registerSchema>
