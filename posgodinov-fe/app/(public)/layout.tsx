import { AuthShell } from '@/features/admin/auth/components/AuthShell'

/** Shell publik — tanpa sesi. Mengalihkan pengguna yang sudah login ke `/admin`. */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return <AuthShell>{children}</AuthShell>
}
