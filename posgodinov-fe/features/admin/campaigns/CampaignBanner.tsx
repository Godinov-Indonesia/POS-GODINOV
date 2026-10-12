'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCampaigns, recordCampaignClick } from '@/lib/api/endpoints/campaigns'
import { getSubscription } from '@/lib/api/endpoints/subscription'
import type { SaaSCampaign } from '@/lib/types/api'

/**
 * Banner carousel lebar penuh, tinggi pendek, auto-rotate 3 detik.
 * Data diambil dari BE campaigns (format CAROUSEL_SLIDE / HEADER_BANNER).
 * Tidak ditampilkan jika plan merchant memiliki no_ads = true.
 */
export function CampaignBanner() {
  const [index, setIndex] = React.useState(0)
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
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, 3000)
  }, [slides.length])

  React.useEffect(() => {
    if (slides.length > 1) startInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [slides.length, startInterval])

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
    startInterval()
  }

  const next = () => {
    setIndex((prev) => (prev + 1) % slides.length)
    startInterval()
  }

  if (noAds || slides.length === 0) return null

  const current = slides[index % slides.length]

  return (
    <div className="relative w-full h-14 overflow-hidden bg-gradient-to-r from-indigo-900/80 via-indigo-800/70 to-purple-900/80 flex items-center">
      {/* Slide content */}
      <button
        key={current.id}
        onClick={() => handleClick(current)}
        className="flex-1 flex items-center justify-center gap-3 px-10 h-full text-center cursor-pointer group animate-in fade-in duration-300"
        style={{ background: 'transparent', border: 'none' }}
      >
        {current.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.image_url}
            alt=""
            className="h-8 w-8 object-cover rounded shrink-0"
          />
        )}
        <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-white leading-tight">{current.title}</span>
          {current.subtitle && (
            <span className="text-[11px] text-indigo-200 leading-tight hidden sm:inline">
              — {current.subtitle}
            </span>
          )}
        </div>
        {current.action_type !== 'INFO_ONLY' && current.action_label && (
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-medium group-hover:bg-white/30 transition-colors shrink-0">
            {current.action_label}
          </span>
        )}
      </button>

      {/* Navigation arrows (only if multiple slides) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); startInterval() }}
                className={`w-1 h-1 rounded-full transition-colors cursor-pointer ${
                  i === index % slides.length ? 'bg-white' : 'bg-white/40'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
