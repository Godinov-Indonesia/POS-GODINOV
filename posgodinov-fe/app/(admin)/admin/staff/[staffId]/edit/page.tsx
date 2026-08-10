import type { Metadata } from 'next'

import { StaffEditForm } from '@/features/admin/staff/components/StaffForm'

export const metadata: Metadata = { title: 'Ubah Staff' }

/** D-08 (ubah) — docs/04 §B.1. */
export default async function EditStaffPage(props: PageProps<'/admin/staff/[staffId]/edit'>) {
  const { staffId } = await props.params
  return <StaffEditForm staffId={staffId} />
}
