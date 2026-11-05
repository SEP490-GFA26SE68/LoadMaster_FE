/**
 * Hàm → endpoint backend (FE-0-09). Thoả thuận dịch vụ của công ty dùng thử chỉ có ở backend: nhóm `billing` tắt (kho mẫu) thì không có
 * thoả thuận nào và không gọi mạng.
 *   fetchMyAgreement       → GET /api/agreements/my-agreement
 *   signAgreement          → POST /api/agreements/sign
 *   fetchCompanyAgreement  → GET /api/agreements/company/{companyId}
 */

import { api, ApiError, isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'

const ON_BACKEND = usesBackend('billing')

export type AgreementStatus = 'PENDING' | 'SIGNED' | 'EXPIRED'

export type CompanyAgreement = {
  readonly id: string
  readonly companyId: string
  readonly companyName: string
  readonly agreementCode: string
  readonly title: string
  readonly content: string
  readonly status: AgreementStatus
  readonly deadlineAt: string | null
  readonly signedAt: string | null
  readonly signerName: string | null
  readonly signerPhone: string | null
  readonly ipAddress: string | null
  readonly isExpired: boolean
  readonly hoursRemaining: number
}

export type SignAgreementRequest = {
  readonly confirmTerms: boolean
  readonly signerName: string
  readonly signerPhone: string
}

/** `CompanyAgreementResponse`; mốc giờ là `LocalDateTime` giờ Việt Nam. */
type CompanyAgreementDto = {
  readonly id: number
  readonly companyId: number | null
  readonly companyName: string | null
  readonly agreementCode: string | null
  readonly title: string | null
  readonly content: string | null
  readonly status: AgreementStatus | null
  readonly deadlineAt: string | null
  readonly signedAt: string | null
  readonly signerName: string | null
  readonly signerPhone: string | null
  readonly ipAddress: string | null
  readonly isExpired: boolean | null
  readonly hoursRemaining: number | null
}

function timeOf(value: string | null): string | null {
  if (value === null) return null
  try {
    return isoFromBackend(value)
  } catch {
    return null
  }
}

function agreementOf(dto: CompanyAgreementDto): CompanyAgreement {
  return {
    id: String(dto.id),
    companyId: dto.companyId === null ? '' : String(dto.companyId),
    companyName: dto.companyName ?? '',
    agreementCode: dto.agreementCode ?? String(dto.id),
    title: dto.title ?? '',
    content: dto.content ?? '',
    status: dto.status ?? 'PENDING',
    deadlineAt: timeOf(dto.deadlineAt),
    signedAt: timeOf(dto.signedAt),
    signerName: dto.signerName,
    signerPhone: dto.signerPhone,
    ipAddress: dto.ipAddress,
    isExpired: dto.isExpired === true,
    hoursRemaining: Math.max(0, Math.floor(dto.hoursRemaining ?? 0)),
  }
}

/** Không có thoả thuận (404, hay phong bì không có dữ liệu) là `null`. */
async function agreementOrNull(request: Promise<CompanyAgreementDto | null>): Promise<CompanyAgreement | null> {
  try {
    const dto = await request
    return dto === null ? null : agreementOf(dto)
  } catch (error) {
    if (isApiError(error) && error.code === 'NOT_FOUND') return null
    throw error
  }
}

/** Thoả thuận của công ty người đăng nhập (quản trị công ty). */
// GET /api/agreements/my-agreement
export async function fetchMyAgreement(): Promise<CompanyAgreement | null> {
  if (!ON_BACKEND) return null
  return agreementOrNull(api().get<CompanyAgreementDto | null>('/api/agreements/my-agreement'))
}

/** Ký thoả thuận; phải xác nhận đồng ý điều khoản. */
// POST /api/agreements/sign
export async function signAgreement(request: SignAgreementRequest): Promise<CompanyAgreement> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return agreementOf(await api().post<CompanyAgreementDto>('/api/agreements/sign', { body: request }))
}

/** Thoả thuận của một công ty — màn của nền tảng. */
// GET /api/agreements/company/{companyId}
export async function fetchCompanyAgreement(companyId: string): Promise<CompanyAgreement | null> {
  if (!ON_BACKEND) return null
  return agreementOrNull(api().get<CompanyAgreementDto | null>(`/api/agreements/company/${encodeURIComponent(companyId)}`))
}
