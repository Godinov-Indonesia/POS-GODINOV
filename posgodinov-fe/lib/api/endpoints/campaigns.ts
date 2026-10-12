import { adminRequest, adminRequestList } from '@/lib/api/admin-client'
import type { SaaSCampaign } from '@/lib/types/api'

export function getCampaigns(placement?: string): Promise<SaaSCampaign[]> {
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : ''
  return adminRequestList<SaaSCampaign>(`/v1/business/campaigns${qs}`)
}

export function recordCampaignClick(id: string): Promise<void> {
  return adminRequest<void>(`/v1/business/campaigns/${id}/click`, {
    method: 'POST',
  })
}
