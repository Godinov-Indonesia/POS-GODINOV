'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getCampaigns, recordCampaignClick } from '@/lib/api/endpoints/campaigns'
import { getSubscription } from '@/lib/api/endpoints/subscription'
import type { SaaSCampaign } from '@/lib/types/api'

/**
 * Popup iklan native — dirender sebagai React component bukan external script,
 * sehingga tidak dapat diblokir adblocker. Seperti FreeCodeCamp.
 *
 * Muncul sekali per session per campaign. Ditampilkan setelah skip_delay_seconds.
 * Tidak muncul jika plan merchant memiliki no_ads = true.
 */
export function CampaignPopup() {
  const [visible, setVisible] = React.useState<SaaSCampaign | null>(null)
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

    // Pick first popup not dismissed in this session
    const toShow = popups.find((c) => {
      const dismissed = typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(`campaign_${c.id}_dismissed`)
        : null
      return !dismissed
    })

    if (!toShow) return

    const delay = (toShow.skip_delay_seconds ?? 15) * 1000
    timerRef.current = setTimeout(() => {
      setVisible(toShow)
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [campaigns, noAds])

  const dismiss = () => {
    if (visible) {
      sessionStorage.setItem(`campaign_${visible.id}_dismissed`, '1')
    }
    setVisible(null)
  }

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

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl shadow-2xl overflow-hidden border border-zinc-700 bg-zinc-900"
      role="dialog"
      aria-label={visible.title}
    >
      {/* Close button */}
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer z-10"
        aria-label="Tutup"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Image */}
      {visible.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={visible.image_url}
          alt={visible.title}
          className="w-full h-32 object-cover"
        />
      )}

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="text-sm font-semibold text-zinc-100 pr-5">{visible.title}</div>
        {visible.subtitle && (
          <div className="text-xs text-zinc-400">{visible.subtitle}</div>
        )}

        {visible.action_type !== 'INFO_ONLY' && visible.action_label && (
          <button
            onClick={handleAction}
            className="mt-1 w-full px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            {visible.action_label}
          </button>
        )}
      </div>
    </div>
  )
}
