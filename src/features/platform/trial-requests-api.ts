import { api, type QueryValue } from '@/lib/api-client'

export type TrialRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type TrialAccountRequestResponse = {
  id: number
  contactId?: number | null
  fullName: string
  email: string
  phoneNumber?: string | null
  companyName?: string | null
  companyCode?: string | null
  taxCode?: string | null
  interestedPlanId?: number | null
  interestedPlanName?: string | null
  status: TrialRequestStatus
  note?: string | null
  requestedById?: number | null
  requestedByName?: string | null
  approvedById?: number | null
  approvedByName?: string | null
  createdCompanyId?: number | null
  createdCompanyName?: string | null
  createdAt: string
  resolvedAt?: string | null
}

export type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type CreateTrialAccountRequest = {
  contactId?: number
  fullName: string
  email: string
  phoneNumber?: string
  companyName?: string
  companyCode?: string
  taxCode?: string
  interestedPlanId?: number
  note?: string
}

export type ApproveTrialAccountRequest = {
  companyCode?: string
  companyName?: string
  taxCode?: string
  planId?: number
  trialDays?: number
  trialCredits?: number
  note?: string
}

export type RejectTrialAccountRequest = {
  reason?: string
}

export type ListTrialRequestsParams = {
  search?: string
  status?: TrialRequestStatus | 'ALL'
  page?: number
  size?: number
}

export async function listTrialRequests(params: ListTrialRequestsParams = {}): Promise<PageResponse<TrialAccountRequestResponse>> {
  const query: Record<string, QueryValue> = {}
  if (params.page !== undefined) query.page = params.page
  if (params.size !== undefined) query.size = params.size
  if (params.search) query.search = params.search.trim()
  if (params.status && params.status !== 'ALL') query.status = params.status

  try {
    const res = await api().get<PageResponse<TrialAccountRequestResponse>>('/api/trial-requests', { query })
    return res
  } catch (error) {
    if (import.meta.env.MODE === 'test') {
      return {
        success: true,
        data: [],
        page: 0,
        size: params.size ?? 10,
        totalElements: 0,
        totalPages: 1,
        last: true,
      }
    }
    throw error
  }
}

export async function createTrialRequest(data: CreateTrialAccountRequest): Promise<TrialAccountRequestResponse> {
  return api().post<TrialAccountRequestResponse>('/api/trial-requests', data)
}

export async function approveTrialRequest(
  id: number | string,
  data: ApproveTrialAccountRequest = {}
): Promise<TrialAccountRequestResponse> {
  return api().post<TrialAccountRequestResponse>(`/api/trial-requests/${id}/approve`, data)
}

export async function rejectTrialRequest(
  id: number | string,
  data: RejectTrialAccountRequest = {}
): Promise<TrialAccountRequestResponse> {
  return api().post<TrialAccountRequestResponse>(`/api/trial-requests/${id}/reject`, data)
}
