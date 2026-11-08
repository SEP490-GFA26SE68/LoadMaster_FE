/**
 * Hàm → endpoint backend (FE-0-09). Yêu cầu dùng thử chỉ có ở backend: nhóm `companies` tắt (kho mẫu) thì `TRIAL_REQUESTS_SOURCE.available`
 * tắt, danh sách rỗng và lệnh ghi bị từ chối `NOT_SUPPORTED` — tài khoản công ty của kho mẫu do quản trị hệ thống tạo ở màn Công ty.
 *   listTrialRequests   → GET /api/trial-requests (đọc đủ mọi trang)
 *   createTrialRequest  → POST /api/trial-requests
 *   managerApproveTrialRequest → POST /api/trial-requests/{id}/manager-approve
 *   managerRejectTrialRequest  → POST /api/trial-requests/{id}/manager-reject
 *   approveTrialRequest → POST /api/trial-requests/{id}/approve
 *   rejectTrialRequest  → POST /api/trial-requests/{id}/reject
 */

import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'

const ON_BACKEND = usesBackend('companies')

export const TRIAL_REQUESTS_SOURCE = { available: ON_BACKEND } as const

export const TRIAL_REQUEST_STATUSES = ['PENDING', 'PENDING_ADMIN_CREATION', 'APPROVED', 'REJECTED'] as const
export type TrialRequestStatus = (typeof TRIAL_REQUEST_STATUSES)[number]

export type TrialRequest = {
  readonly id: string
  readonly fullName: string
  readonly email: string
  readonly phoneNumber: string | null
  readonly companyName: string | null
  readonly companyCode: string | null
  readonly taxCode: string | null
  readonly companyAddress: string | null
  /** Mã số của gói khách quan tâm ở backend. */
  readonly interestedPlanId: string | null
  readonly interestedPlanName: string | null
  readonly status: TrialRequestStatus
  readonly aiPrecheckStatus: 'PASSED' | 'FAILED' | null
  readonly aiPrecheckReason: string | null
  readonly handledByName: string | null
  readonly rejectionReason: string | null
  /** Ghi chú lúc duyệt, hoặc lý do lúc từ chối. */
  readonly note: string | null
  readonly managerReviewedByName: string | null
  readonly approvedByName: string | null
  readonly createdCompanyName: string | null
  readonly createdAt: string
  readonly resolvedAt: string | null
}

/** `TrialAccountRequestResponse`; mốc giờ là `LocalDateTime` giờ Việt Nam. */
type TrialRequestDto = {
  readonly id: number
  readonly fullName: string
  readonly email: string
  readonly phoneNumber?: string | null
  readonly companyName?: string | null
  readonly companyCode?: string | null
  readonly taxCode?: string | null
  readonly companyAddress?: string | null
  readonly interestedPlanId?: number | null
  readonly interestedPlanName?: string | null
  readonly status: string
  readonly aiPrecheckStatus?: 'PASSED' | 'FAILED' | null
  readonly aiPrecheckReason?: string | null
  readonly handledByName?: string | null
  readonly rejectionReason?: string | null
  readonly note?: string | null
  readonly managerReviewedByName?: string | null
  readonly approvedByName?: string | null
  readonly createdCompanyName?: string | null
  readonly createdAt: string
  readonly resolvedAt?: string | null
}

/** `CreateTrialAccountRequest`: chuyển một yêu cầu liên hệ của khách thành yêu cầu dùng thử. */
export type NewTrialRequest = {
  readonly contactId?: number
  readonly fullName: string
  readonly email: string
  readonly phoneNumber?: string
  readonly companyName?: string
  readonly companyCode?: string
  readonly taxCode?: string
  readonly companyAddress?: string
  readonly interestedPlanId?: number
  readonly note?: string
}

/** `ApproveTrialAccountRequest`: để trống thì backend lấy theo yêu cầu (tên công ty, mã số thuế) hoặc mặc định của nó. */
export type TrialApproval = {
  readonly companyName: string
  readonly taxCode: string
  readonly planId?: number
  readonly trialDays: number
  readonly note?: string
}

function timeOf(value: string): string {
  try {
    return isoFromBackend(value)
  } catch {
    return value
  }
}

function requestOf(dto: TrialRequestDto): TrialRequest {
  return {
    id: String(dto.id),
    fullName: dto.fullName,
    email: dto.email,
    phoneNumber: dto.phoneNumber ?? null,
    companyName: dto.companyName ?? null,
    companyCode: dto.companyCode ?? null,
    taxCode: dto.taxCode ?? null,
    companyAddress: dto.companyAddress ?? null,
    interestedPlanId: dto.interestedPlanId == null ? null : String(dto.interestedPlanId),
    interestedPlanName: dto.interestedPlanName ?? null,
    status: TRIAL_REQUEST_STATUSES.find((status) => status === dto.status) ?? 'PENDING',
    aiPrecheckStatus: dto.aiPrecheckStatus ?? null,
    aiPrecheckReason: dto.aiPrecheckReason ?? null,
    handledByName: dto.handledByName ?? null,
    rejectionReason: dto.rejectionReason ?? null,
    note: dto.note ?? null,
    managerReviewedByName: dto.managerReviewedByName ?? null,
    approvedByName: dto.approvedByName ?? null,
    createdCompanyName: dto.createdCompanyName ?? null,
    createdAt: timeOf(dto.createdAt),
    resolvedAt: dto.resolvedAt ? timeOf(dto.resolvedAt) : null,
  }
}

// GET /api/trial-requests
export async function listTrialRequests(): Promise<TrialRequest[]> {
  if (!ON_BACKEND) return []
  return (await fetchAllPages<TrialRequestDto>('/api/trial-requests')).map(requestOf)
}

// POST /api/trial-requests
export async function createTrialRequest(request: NewTrialRequest): Promise<TrialRequest> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return requestOf(await api().post<TrialRequestDto>('/api/trial-requests', { body: request }))
}

// POST /api/trial-requests/{id}/manager-approve
export async function managerApproveTrialRequest(id: string): Promise<TrialRequest> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return requestOf(await api().post<TrialRequestDto>(`/api/trial-requests/${encodeURIComponent(id)}/manager-approve`))
}

// POST /api/trial-requests/{id}/manager-reject
export async function managerRejectTrialRequest(id: string, reason: string): Promise<TrialRequest> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return requestOf(await api().post<TrialRequestDto>(`/api/trial-requests/${encodeURIComponent(id)}/manager-reject`, { body: { reason } }))
}

// POST /api/trial-requests/{id}/approve
export async function approveTrialRequest(id: string, approval: TrialApproval): Promise<TrialRequest> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return requestOf(await api().post<TrialRequestDto>(`/api/trial-requests/${encodeURIComponent(id)}/approve`, { body: approval }))
}

// POST /api/trial-requests/{id}/reject
export async function rejectTrialRequest(id: string, reason: string): Promise<TrialRequest> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return requestOf(await api().post<TrialRequestDto>(`/api/trial-requests/${encodeURIComponent(id)}/reject`, { body: { reason } }))
}
