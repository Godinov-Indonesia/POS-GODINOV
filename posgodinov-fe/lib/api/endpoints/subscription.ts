import { adminRequest } from '@/lib/api/admin-client'
import type {
  SubscriptionInfo,
  CheckoutSubscriptionRequest,
  CheckoutSubscriptionResponse,
} from '@/lib/types/api'

export function getSubscription(): Promise<SubscriptionInfo> {
  return adminRequest<SubscriptionInfo>('/v1/business/subscription')
}

export function checkoutSubscription(
  body: CheckoutSubscriptionRequest,
): Promise<CheckoutSubscriptionResponse> {
  return adminRequest<CheckoutSubscriptionResponse>('/v1/business/subscription/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
