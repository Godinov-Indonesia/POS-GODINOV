/**
 * Endpoint modul Stock Opname (SO) Form Terkelola untuk Admin Dashboard.
 */

import { adminRequest, adminRequestList } from '@/lib/api/admin-client'
import type { OutletId } from '@/lib/types/api'
import type {
  CreateSOFormInput,
  SOApproveResult,
  SOClosedResponse,
  SOFormResponse,
  SOStatus,
} from '@/lib/types/inventory'

export const listSOForms = (
  outletId: OutletId,
  status?: SOStatus,
): Promise<SOFormResponse[]> => {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return adminRequestList<SOFormResponse>(
    `/v1/business/outlets/${outletId}/so/forms${query}`,
  )
}

export const getSOFormDetail = (
  outletId: OutletId,
  formId: string,
): Promise<SOFormResponse | SOClosedResponse> =>
  adminRequest<SOFormResponse | SOClosedResponse>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}`,
  )

export const createSOForm = (
  outletId: OutletId,
  input: CreateSOFormInput,
): Promise<SOFormResponse> =>
  adminRequest<SOFormResponse>(`/v1/business/outlets/${outletId}/so/forms`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateSOFormItems = (
  outletId: OutletId,
  formId: string,
  rawMaterialIds: string[],
): Promise<SOFormResponse> =>
  adminRequest<SOFormResponse>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}/items`,
    {
      method: 'PUT',
      body: JSON.stringify({ raw_material_ids: rawMaterialIds }),
    },
  )

export const publishSOForm = (
  outletId: OutletId,
  formId: string,
): Promise<{ status: SOStatus }> =>
  adminRequest<{ status: SOStatus }>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}/publish`,
    { method: 'POST', body: '{}' },
  )

export const closeSOForm = (
  outletId: OutletId,
  formId: string,
): Promise<SOClosedResponse> =>
  adminRequest<SOClosedResponse>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}/close`,
    { method: 'POST', body: '{}' },
  )

export const approveSOForm = (
  outletId: OutletId,
  formId: string,
): Promise<SOApproveResult> =>
  adminRequest<SOApproveResult>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}/approve`,
    { method: 'POST', body: '{}' },
  )

export const rejectSOForm = (
  outletId: OutletId,
  formId: string,
): Promise<{ status: SOStatus }> =>
  adminRequest<{ status: SOStatus }>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}/reject`,
    { method: 'POST', body: '{}' },
  )

export const recountSOForm = (
  outletId: OutletId,
  formId: string,
): Promise<SOFormResponse> =>
  adminRequest<SOFormResponse>(
    `/v1/business/outlets/${outletId}/so/forms/${formId}/recount`,
    { method: 'POST', body: '{}' },
  )
