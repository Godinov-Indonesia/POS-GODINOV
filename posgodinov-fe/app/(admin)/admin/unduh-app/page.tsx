import type { Metadata } from 'next'
import { AppDownloadPage } from '@/features/admin/app-download/AppDownloadPage'

export const metadata: Metadata = { title: 'Unduh Aplikasi' }

export default function Page() {
  return <AppDownloadPage />
}
