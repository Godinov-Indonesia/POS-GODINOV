import { AdminShell } from '@/features/admin/shell/AdminShell'

/**
 * Route group `(admin)` menentukan runtime, bukan sekadar layout ([05 §1.1.1]):
 * area ini server-first, sedangkan `(pos)` client-only dan statis.
 */
export default function AdminLayout({ children }: LayoutProps<'/'>) {
  return <AdminShell>{children}</AdminShell>
}
