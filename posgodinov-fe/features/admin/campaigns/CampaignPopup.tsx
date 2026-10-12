'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, ExternalLink, X } from 'lucide-react'
import { getCampaigns, recordCampaignClick } from '@/lib/api/endpoints/campaigns'
import { getSubscription } from '@/lib/api/endpoints/subscription'
import type { SaaSCampaign } from '@/lib/types/api'

const COOKIE_NAME = 'campaign_popup_seen_until'
const SESSION_KEY = 'campaign_popup_session_seen'
// Waktu cookie jika user tidak logout (refresh token aktif terus): 1 jam
const POPUP_INTERVAL_SECONDS = 3600

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'))
  return match ? decodeURIComponent(match[3]) : null
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

/**
 * Spotlight Popup iklan native — docs/06 §3.8.
 *
 * Diletakkan di tengah-tengah layar dengan latar gelap (spotlight overlay).
 * - Muncul sekali saat user login.
 * - Jika logout dan login lagi, muncul kembali.
 * - Jika tidak logout karena refresh token aktif, diatur batas waktu via cookie (1 jam)
 *   dan akan muncul kembali saat waktu cookie habis.
 * - Menghitung mundur waktu skip delay dan otomatis tertutup sendiri saat waktu habis.
 */
export function CampaignPopup() {
  const [visible, setVisible] = React.useState<SaaSCampaign | null>(null)
  const [countdown, setCountdown] = React.useState<number>(10)
  const [totalSeconds, setTotalSeconds] = React.useState<number>(10)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: subData } = useQuery({
    queryKey: ['subscription-info'],
    queryFn: getSubscription,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const noAds = subData?.effective_policy?.boolean_flags?.no_ads === true

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-popup'],
    queryFn: () => getCampaigns(),
    staleTime: 2 * 60 * 1000,
    retry: false,
    enabled: !noAds,
  })

  React.useEffect(() => {
    if (noAds || campaigns.length === 0) return

    const popups = campaigns.filter(
      (c) => c.format === 'POPUP_MODAL' && c.is_active
    )
    if (popups.length === 0) return

    // 1. Periksa cookie waktu untuk sesi yang tidak pernah logout (refresh token terus berjalan)
    const cookieVal = getCookie(COOKIE_NAME)
    const now = Date.now()
    if (cookieVal) {
      const expireTime = Number(cookieVal)
      if (!Number.isNaN(expireTime) && now < expireTime) {
        // Waktu cookie belum habis, jangan tampilkan
        return
      }
    }

    // 2. Periksa apakah sudah dilihat pada sesi aktif ini
    const sessionSeen = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(SESSION_KEY)
      : null

    // Jika pada sesi ini sudah dilihat dan cookie masih ada, tahan.
    // Tapi jika cookie sudah habis (atau baru login ulang tanpa sessionSeen), izinkan muncul.
    if (sessionSeen && cookieVal) {
      return
    }

    const toShow = popups[0]
    if (!toShow) return

    // Popup muncul setelah 1.5 detik agar halaman selesai dimuat terlebih dahulu
    timerRef.current = setTimeout(() => {
      setVisible(toShow)
      const duration = toShow.skip_delay_seconds && toShow.skip_delay_seconds > 0
        ? toShow.skip_delay_seconds
        : 10
      setTotalSeconds(duration)
      setCountdown(duration)
    }, 1500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [campaigns, noAds])

  const dismiss = React.useCallback(() => {
    if (visible) {
      // Tandai pada sessionStorage untuk sesi aktif
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, '1')
      }
      // Simpan waktu expiry pada cookie (mis. 1 jam) agar user yang tidak logout
      // akan mendapatkan popup lagi setelah batas waktu ini habis
      const expireTimestamp = Date.now() + POPUP_INTERVAL_SECONDS * 1000
      setCookie(COOKIE_NAME, String(expireTimestamp), POPUP_INTERVAL_SECONDS)
    }
    setVisible(null)
  }, [visible])

  // Countdown interval ketika popup aktif — otomatis tertutup saat waktu habis
  React.useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          dismiss()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Handler Esc untuk menutup modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [visible, dismiss])

  const handleAction = () => {
    if (!visible) return
    void recordCampaignClick(visible.id).catch(() => {})
    if (visible.action_type !== 'INFO_ONLY' && visible.action_url) {
      if (visible.action_type === 'EXTERNAL_URL') {
        window.open(visible.action_url, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = visible.action_url
      }
    }
    dismiss()
  }

  if (!visible) return null

  const progressPercent = Math.max(0, Math.min(100, (countdown / totalSeconds) * 100))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={visible.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={dismiss}
    >
      {/* Container Spotlight Popup di tengah layar */}
      <div
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-border text-fg shadow-overlay overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar countdown di bagian paling atas */}
        <div className="h-1 w-full bg-bg-muted overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Tombol Tutup & Countdown Badge */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white text-pos-xs font-medium backdrop-blur-xs transition-colors cursor-pointer"
            aria-label="Tutup popup"
            title="Tutup popup"
          >
            <span>Tutup ({countdown}s)</span>
            <X className="size-3.5" />
          </button>
        </div>

        {/* Gambar Campaign Banner (jika tersedia) */}
        {visible.image_url && (
          <div className="relative w-full h-52 sm:h-60 bg-slate-900 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={visible.image_url}
              alt={visible.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Konten Popup */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-pos-lg font-bold tracking-tight text-fg leading-snug">
              {visible.title}
            </h2>
            {visible.subtitle && (
              <p className="text-pos-sm text-fg-muted leading-relaxed">
                {visible.subtitle}
              </p>
            )}
          </div>

          {/* Footer Info Timer & Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-pos-xs text-fg-subtle">
              <Clock className="size-3.5" aria-hidden="true" />
              <span>
                Menutup otomatis dalam <strong className="text-fg font-mono">{countdown}s</strong>
              </span>
            </div>

            {visible.action_type !== 'INFO_ONLY' && visible.action_label && (
              <button
                type="button"
                onClick={handleAction}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-fg-inverse hover:bg-accent-hover font-semibold text-pos-sm shadow-card transition-all cursor-pointer"
              >
                <span>{visible.action_label}</span>
                <ExternalLink className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
