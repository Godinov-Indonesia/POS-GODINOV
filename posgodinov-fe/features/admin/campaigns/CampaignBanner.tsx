'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Megaphone, Sparkles } from 'lucide-react'
import { getCampaigns, recordCampaignClick } from '@/lib/api/endpoints/campaigns'
import { getSubscription } from '@/lib/api/endpoints/subscription'
import type { SaaSCampaign } from '@/lib/types/api'

/**
 * Banner carousel lebar penuh, diletakkan di atas navbar — docs/06 §3.8.
 *
 * Mendukung auto-slide (5 detik), pause-on-hover, navigasi keyboard & tombol,
 * serta indikator slide modern.
 */
export function CampaignBanner() {
  const [index, setIndex] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: subData } = useQuery({
    queryKey: ['subscription-info'],
    queryFn: getSubscription,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const noAds = subData?.effective_policy?.boolean_flags?.no_ads === true

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-banner'],
    queryFn: () => getCampaigns(),
    staleTime: 2 * 60 * 1000,
    retry: false,
    enabled: !noAds,
  })

  const slides: SaaSCampaign[] = campaigns.filter(
    (c) => (c.format === 'CAROUSEL_SLIDE' || c.format === 'HEADER_BANNER') && c.is_active
  )

  const startInterval = React.useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (isPaused || slides.length <= 1) return

    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, 5000)
  }, [slides.length, isPaused])

  React.useEffect(() => {
    startInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startInterval])

  const handleClick = (slide: SaaSCampaign) => {
    void recordCampaignClick(slide.id).catch(() => {})
    if (slide.action_type !== 'INFO_ONLY' && slide.action_url) {
      if (slide.action_type === 'EXTERNAL_URL') {
        window.open(slide.action_url, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = slide.action_url
      }
    }
  }

  const prev = () => {
    setIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const next = () => {
    setIndex((prev) => (prev + 1) % slides.length)
  }

  if (noAds || slides.length === 0) return null

  const current = slides[index % slides.length]

  return (
    <aside
      aria-label="Pengumuman & Promo"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full min-h-[3.75rem] py-2 px-3 sm:px-6 overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-b border-border-inverse/40 text-white flex items-center justify-between shadow-xs select-none"
    >
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute -top-12 left-1/4 h-32 w-96 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />

      {/* Tombol Sebelumnya */}
      {slides.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            prev()
          }}
          className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
          aria-label="Slide sebelumnya"
        >
          <ChevronLeft className="size-4.5" />
        </button>
      ) : (
        <div className="w-8 shrink-0" aria-hidden="true" />
      )}

      {/* Konten Slide Utama */}
      <button
        key={current.id}
        type="button"
        onClick={() => handleClick(current)}
        className="relative z-10 mx-2 flex flex-1 items-center justify-center gap-3 text-center cursor-pointer group py-1 min-w-0"
      >
        {/* Gambar / Badge Icon */}
        {current.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.image_url}
            alt=""
            className="size-9 object-cover rounded-md border border-white/20 shrink-0"
          />
        ) : (
          <div className="hidden sm:flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/25 text-accent-subtle border border-accent/30">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
        )}

        {/* Teks Judul & Subtitle */}
        <div className="flex flex-col items-center sm:flex-row sm:items-baseline sm:gap-2 truncate max-w-3xl">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-white leading-tight truncate">
            {current.title}
          </span>
          {current.subtitle && (
            <span className="text-[11px] sm:text-xs text-indigo-200/90 leading-tight hidden md:inline truncate">
              • {current.subtitle}
            </span>
          )}
        </div>

        {/* Tombol Aksi / Call to Action */}
        {current.action_type !== 'INFO_ONLY' && current.action_label && (
          <span className="shrink-0 px-3 py-1 rounded-full bg-white text-slate-950 text-[11px] sm:text-xs font-semibold shadow-xs group-hover:bg-indigo-50 group-hover:scale-105 transition-all">
            {current.action_label}
          </span>
        )}
      </button>

      {/* Tombol Selanjutnya & Indikator */}
      {slides.length > 1 ? (
        <div className="relative z-10 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Slide berikutnya"
          >
            <ChevronRight className="size-4.5" />
          </button>
        </div>
      ) : (
        <div className="w-8 shrink-0" aria-hidden="true" />
      )}

      {/* Indikator Dots di Bawah */}
      {slides.length > 1 && (
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {slides.map((_, i) => {
            const isActive = i === index % slides.length
            return (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  isActive ? 'w-5 bg-white' : 'w-1.5 bg-white/35'
                }`}
                aria-hidden="true"
              />
            )
          })}
        </div>
      )}
    </aside>
  )
}
