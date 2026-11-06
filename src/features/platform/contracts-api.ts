/**
 * Hàm → endpoint backend (FE-0-09). Nhóm `billing` nối backend thì đọc hợp đồng gói của mọi công ty; tắt thì dựng từ gói hiện tại của các
 * công ty trong kho mẫu (kho mẫu giữ một gói mỗi công ty, không có lịch sử kỳ trước).
 *   listContracts → GET /api/contracts
 */

import { api } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'
import { getMockDb, PLAN_TIERS, type PlanTier } from '@/lib/mock-db'

const ON_BACKEND = usesBackend('billing')

export const CONTRACT_STATUSES = ['ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export type SubscriptionContract = {
  readonly id: string
  readonly companyId: string
  readonly companyCode: string | null
  readonly companyName: string
  readonly planName: string
  readonly planCode: string | null
  readonly planTier: PlanTier | null
  readonly priceVnd: number | null
  readonly billingCycle: 'MONTHLY' | 'YEARLY' | null
  /** `null` khi máy chủ trả trạng thái FE chưa biết. */
  readonly status: ContractStatus | null
  readonly startedAt: string | null
  readonly expiresAt: string | null
  readonly autoRenew: boolean | null
  readonly adminName: string | null
  readonly adminEmail: string | null
  readonly adminPhone: string | null
  readonly creditsGranted: number | null
}

/** `ContractResponse`; mốc giờ là `LocalDateTime` giờ Việt Nam, giá là `BigDecimal`. */
type ContractDto = {
  readonly id: number
  readonly companyId: number | null
  readonly companyCode: string | null
  readonly companyName: string | null
  readonly planCode: string | null
  readonly planName: string | null
  readonly planTier: string | null
  readonly price: number | string | null
  readonly billingCycle: string | null
  readonly status: string | null
  readonly startedAt: string | null
  readonly expiresAt: string | null
  readonly autoRenew: boolean | null
  readonly adminName: string | null
  readonly adminEmail: string | null
  readonly adminPhone: string | null
  readonly creditsGranted: number | null
}

function timeOf(value: string | null): string | null {
  if (!value) return null
  try {
    return isoFromBackend(value)
  } catch {
    return null
  }
}

function contractOf(dto: ContractDto): SubscriptionContract {
  const price = dto.price === null ? null : Number(dto.price)
  return {
    id: String(dto.id),
    companyId: dto.companyId === null ? '' : String(dto.companyId),
    companyCode: dto.companyCode,
    companyName: dto.companyName ?? '',
    planName: dto.planName ?? '',
    planCode: dto.planCode,
    planTier: PLAN_TIERS.find((tier) => tier === dto.planTier) ?? null,
    priceVnd: price === null || Number.isNaN(price) ? null : price,
    billingCycle: dto.billingCycle === 'MONTHLY' || dto.billingCycle === 'YEARLY' ? dto.billingCycle : null,
    status: CONTRACT_STATUSES.find((status) => status === dto.status) ?? null,
    startedAt: timeOf(dto.startedAt),
    expiresAt: timeOf(dto.expiresAt),
    autoRenew: dto.autoRenew,
    adminName: dto.adminName,
    adminEmail: dto.adminEmail,
    adminPhone: dto.adminPhone,
    creditsGranted: dto.creditsGranted,
  }
}

/** Hợp đồng gói của mọi công ty, mới bắt đầu nhất trước. */
// GET /api/contracts
export async function listContracts(): Promise<SubscriptionContract[]> {
  const contracts = ON_BACKEND ? ((await api().get<ContractDto[] | null>('/api/contracts')) ?? []).map(contractOf) : await mockContracts()
  return contracts.toSorted((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
}

async function mockContracts(): Promise<SubscriptionContract[]> {
  const overview = await getMockDb().listCompanyOverview()
  return overview.flatMap(({ company, current, planStatus, adminUser }) => {
    if (current === null) return []
    const { subscription, plan } = current
    return [{
      id: subscription.id,
      companyId: company.id,
      companyCode: company.id,
      companyName: company.name,
      planName: plan.name,
      planCode: plan.id,
      planTier: plan.tier,
      priceVnd: plan.priceVnd,
      billingCycle: 'MONTHLY' as const,
      status: planStatus,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      autoRenew: subscription.autoRenew,
      adminName: adminUser?.fullName ?? null,
      adminEmail: adminUser?.email ?? null,
      adminPhone: adminUser?.phone ?? null,
      creditsGranted: plan.monthlyCredits,
    }]
  })
}
