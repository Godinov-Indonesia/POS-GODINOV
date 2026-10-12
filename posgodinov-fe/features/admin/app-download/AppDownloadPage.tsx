'use client'

import { useQuery } from '@tanstack/react-query'
import { Download, MonitorSmartphone, Smartphone } from 'lucide-react'
import { BASE_URL } from '@/lib/api/http'
import { PageHeader } from '@/features/admin/shell/PageHeader'

type PublicLandingData = {
  settings?: {
    apk_pos_url?: string
    apk_so_url?: string
  }
}

async function fetchPublicLanding(): Promise<PublicLandingData> {
  const res = await fetch(`${BASE_URL}/v1/public/landing-page`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Gagal memuat data')
  const json = await res.json()
  // BE wraps in { data: ... }
  return (json.data ?? json) as PublicLandingData
}

export function AppDownloadPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-landing-apk'],
    queryFn: fetchPublicLanding,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const posUrl = data?.settings?.apk_pos_url ?? ''
  const soUrl = data?.settings?.apk_so_url ?? ''

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Unduh Aplikasi Android"
        description="Download aplikasi Android POS Godinov untuk kasir dan tim sales order."
      />

      {/* Info banner */}
      <div className="rounded-xl bg-sky-950/40 border border-sky-800/50 px-4 py-3 text-xs text-sky-200 leading-relaxed">
        <strong className="text-sky-100">Catatan:</strong> Aplikasi masih dalam format APK (belum di Google Play Store).
        Pastikan perangkat Android sudah mengaktifkan izin <em>&quot;Instal aplikasi dari sumber tidak dikenal&quot;</em> sebelum menginstal.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* POS Kasir App */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
              <MonitorSmartphone className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">App Kasir (POS)</div>
              <div className="text-xs text-zinc-400 mt-0.5">Untuk petugas kasir &amp; frontline counter</div>
            </div>
          </div>

          <ul className="text-xs text-zinc-400 space-y-1 pl-1">
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />Manajemen transaksi penjualan</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />Print struk otomatis</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />Mode offline</li>
          </ul>

          {isLoading ? (
            <div className="h-9 w-full rounded-lg bg-zinc-800 animate-pulse" />
          ) : posUrl ? (
            <a
              href={posUrl}
              download
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download APK Kasir
            </a>
          ) : (
            <div className="text-xs text-zinc-500 italic">Link download belum tersedia.</div>
          )}
        </div>

        {/* SO App */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">App Sales Order (SO)</div>
              <div className="text-xs text-zinc-400 mt-0.5">Untuk tim sales &amp; sales order lapangan</div>
            </div>
          </div>

          <ul className="text-xs text-zinc-400 space-y-1 pl-1">
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />Buat &amp; kelola order pelanggan</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />Monitoring stok real-time</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-500 shrink-0" />Histori order per salesman</li>
          </ul>

          {isLoading ? (
            <div className="h-9 w-full rounded-lg bg-zinc-800 animate-pulse" />
          ) : soUrl ? (
            <a
              href={soUrl}
              download
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download APK Sales Order
            </a>
          ) : (
            <div className="text-xs text-zinc-500 italic">Link download belum tersedia.</div>
          )}
        </div>
      </div>

      {/* Panduan instalasi */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-3">
        <div className="text-sm font-semibold text-zinc-100">Panduan Instalasi APK</div>
        <ol className="text-xs text-zinc-400 space-y-2 list-decimal pl-4">
          <li>Download file APK ke perangkat Android.</li>
          <li>Buka <strong className="text-zinc-300">Pengaturan → Keamanan</strong> dan aktifkan <em>&quot;Sumber Tidak Dikenal&quot;</em> (atau <em>&quot;Instal Aplikasi Tidak Dikenal&quot;</em> di Android 8+).</li>
          <li>Buka file APK yang sudah diunduh dari folder <strong className="text-zinc-300">Downloads</strong>.</li>
          <li>Ikuti proses instalasi hingga selesai.</li>
          <li>Login menggunakan PIN staff yang sudah didaftarkan di dashboard.</li>
        </ol>
      </div>
    </div>
  )
}
