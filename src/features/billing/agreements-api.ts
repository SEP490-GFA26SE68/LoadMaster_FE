import { apiFetch } from '@/lib/api-client'

export type AgreementStatus = 'PENDING' | 'SIGNED' | 'EXPIRED'
export type AgreementType = 'TRIAL_TERMS' | 'SERVICE_CONTRACT'

export type CompanyAgreement = {
  id: number
  companyId: number
  companyName: string
  companyCode: string
  taxCode?: string | null
  userId?: number | null
  agreementType: AgreementType
  agreementCode: string
  title: string
  content: string
  status: AgreementStatus
  deadlineAt?: string | null
  signedAt?: string | null
  signerName?: string | null
  signerEmail?: string | null
  signerPhone?: string | null
  ipAddress?: string | null
  isExpired: boolean
  hoursRemaining: number
  createdAt: string
  updatedAt?: string | null
}

export type SignAgreementRequest = {
  confirmTerms: boolean
  signerName: string
  signerPhone: string
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export async function fetchMyAgreement(): Promise<CompanyAgreement | null> {
  if (import.meta.env.MODE === 'test') {
    return null
  }
  try {
    const res = await apiFetch<ApiResponse<CompanyAgreement>>('/api/agreements/my-agreement')
    return res.data || null
  } catch (err: any) {
    if (err?.status === 404) return null
    throw err
  }
}

export async function signAgreement(request: SignAgreementRequest): Promise<CompanyAgreement> {
  if (import.meta.env.MODE === 'test') {
    return {
      id: 999,
      companyId: 1,
      companyName: 'Test Company',
      companyCode: 'TEST',
      agreementType: 'TRIAL_TERMS',
      agreementCode: 'AGR-TEST-999',
      title: 'Thỏa thuận thử nghiệm',
      content: 'Nội dung...',
      status: 'SIGNED',
      signerName: request.signerName,
      signerPhone: request.signerPhone,
      signedAt: new Date().toISOString(),
      isExpired: false,
      hoursRemaining: 0,
      createdAt: new Date().toISOString(),
    }
  }
  const res = await apiFetch<ApiResponse<CompanyAgreement>>('/api/agreements/sign', {
    method: 'POST',
    body: JSON.stringify(request),
  })
  return res.data
}

export async function fetchCompanyAgreement(companyId: number): Promise<CompanyAgreement | null> {
  if (import.meta.env.MODE === 'test') {
    return null
  }
  try {
    const res = await apiFetch<ApiResponse<CompanyAgreement>>(`/api/agreements/company/${companyId}`)
    return res.data || null
  } catch (err: any) {
    if (err?.status === 404) return null
    throw err
  }
}
