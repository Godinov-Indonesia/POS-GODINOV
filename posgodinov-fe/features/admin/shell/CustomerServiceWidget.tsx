'use client'

import { Headphones, MessageSquare, X } from 'lucide-react'
import * as React from 'react'

import { useActiveOutlet } from '@/features/admin/outlets/hooks/useOutlets'
import { useSessionStore } from '@/lib/auth/session-store'

const CS_MESSAGES = [
  'Butuh bantuan? 👋',
  'Ada kendala teknis? Kami siap bantu!',
  'Keluhan atau saran? Hubungi tim dev kami 💬',
  'Klik di sini untuk bantuan langsung 🚀',
]

function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown Browser'
  const ua = navigator.userAgent
  if (ua.includes('Firefox/')) {
    return `Firefox ${ua.split('Firefox/')[1]?.split(' ')[0] ?? ''}`
  }
  if (ua.includes('Edg/')) {
    return `Microsoft Edge ${ua.split('Edg/')[1]?.split(' ')[0] ?? ''}`
  }
  if (ua.includes('Chrome/')) {
    return `Google Chrome ${ua.split('Chrome/')[1]?.split(' ')[0] ?? ''}`
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    return `Safari ${ua.split('Version/')[1]?.split(' ')[0] ?? ''}`
  }
  if (ua.includes('Opera') || ua.includes('OPR/')) {
    return 'Opera'
  }
  return ua
}

export function CustomerServiceWidget() {
  const [msgIndex, setMsgIndex] = React.useState(0)
  const [isBubbleDismissed, setIsBubbleDismissed] = React.useState(false)
  const business = useSessionStore((s) => s.business)
  const activeOutlet = useActiveOutlet()

  // Ganti pesan bubble setiap 4.5 detik
  React.useEffect(() => {
    if (isBubbleDismissed) return
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % CS_MESSAGES.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [isBubbleDismissed])

  const handleClick = () => {
    const browser = getBrowserInfo()
    const now = new Date()
    const timeFormatted = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(now)

    const screenRes =
      typeof window !== 'undefined'
        ? `${window.screen.width}x${window.screen.height} (Viewport: ${window.innerWidth}x${window.innerHeight})`
        : 'N/A'

    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'N/A'
    const platform = typeof navigator !== 'undefined' ? navigator.platform || 'N/A' : 'N/A'
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'

    const bodyTemplate = [
      'Halo Tim Developer POS Godinov,',
      '',
      'Deskripsi Kendala:',
      '[Tuliskan keluhan atau kendala Anda secara rinci di sini...]',
      '',
      '',
      '─────────────────────────────────────────',
      'METADATA SISTEM (Mohon jangan dihapus)',
      '─────────────────────────────────────────',
      `• Waktu Pelaporan : ${timeFormatted}`,
      `• Halaman URL     : ${currentUrl}`,
      `• Browser         : ${browser}`,
      `• Platform / OS   : ${platform}`,
      `• Resolusi Layar  : ${screenRes}`,
      `• Bisnis / Owner  : ${business?.owner_name ?? '—'} (${business?.serial_business ?? '—'})`,
      `• Outlet Aktif    : ${activeOutlet?.name ?? '—'} (${activeOutlet?.id ?? '—'})`,
      `• User Agent      : ${userAgent}`,
      '─────────────────────────────────────────',
    ].join('\n')

    const subject = 'Keluhan POS Godinov'
    const mailtoUrl = `mailto:dev@godinov.id?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyTemplate)}`

    window.location.href = mailtoUrl
  }

  return (
    <aside
      aria-label="Customer Service & Bantuan"
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 pointer-events-none select-none"
    >
      {/* Speech bubble mengambang dengan pesan berotasi */}
      {!isBubbleDismissed && (
        <div className="pointer-events-auto relative flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3.5 py-2 text-pos-xs font-medium text-fg shadow-card animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={handleClick}
            className="cursor-pointer text-left hover:text-accent transition-colors"
          >
            <span key={msgIndex} className="animate-in fade-in duration-300">
              {CS_MESSAGES[msgIndex]}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsBubbleDismissed(true)
            }}
            className="ml-1 -mr-1 p-0.5 rounded-full text-fg-subtle hover:bg-bg-muted hover:text-fg transition-colors cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="size-3" />
          </button>

          {/* Ekor balon chat */}
          <div
            className="absolute -bottom-1.5 right-5 size-3 rotate-45 border-b border-r border-border bg-surface"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Tombol Utama Mengambang */}
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto group relative flex size-12 sm:size-13 items-center justify-center rounded-full bg-accent text-fg-inverse shadow-raised transition-all duration-200 ease-out-pos hover:scale-108 hover:bg-accent-hover hover:shadow-overlay active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
        aria-label="Hubungi Customer Service via Email"
        title="Hubungi Customer Service (dev@godinov.id)"
      >
        <Headphones className="size-5 sm:size-5.5 transition-transform group-hover:scale-110" />

        {/* Indikator Online (Pulsing Green Dot) */}
        <span
          className="absolute top-0 right-0 flex size-3.5 items-center justify-center"
          aria-hidden="true"
        >
          <span className="absolute size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative size-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      </button>
    </aside>
  )
}
