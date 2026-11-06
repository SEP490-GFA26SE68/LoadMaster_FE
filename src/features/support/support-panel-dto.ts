import { fromBackendLocalDateTime } from '@/lib/billing-backend-api'
import {
  effectiveSubscriptionStatus,
  PLAN_TIERS,
  type CreditBalance,
  type CreditTransaction,
  type PlanTier,
  type SubscriptionStatus,
  type SupportCompanyPanel,
} from '@/lib/mock-db'

/**
 * Khung công ty của màn hỗ trợ và hợp đồng gói của công ty (`/api/contracts`). Kiểu DTO chỉ `support-api.ts` dùng; màn nhận
 * `SupportPanel` và `CompanyContract`. Số dư và giao dịch là hai lần đọc phụ: đọc hỏng thì là `null` (màn ghi "—"), không phải số 0.
 */
export type ContractDto = {
  readonly id: number
  readonly companyId: number | null
  readonly companyName: string | null
  readonly planId: number | null
  readonly planName: string | null
  readonly planTier: string | null
  readonly status: string | null
  readonly startedAt: string | null
  readonly expiresAt: string | null
  readonly autoRenew: boolean | null
}

export type SupportPanelPlan = { readonly id: string; readonly name: string; readonly tier: PlanTier }

export type SupportPanel = {
  readonly companyName: string
  readonly plan: SupportPanelPlan | null
  readonly planStatus: SubscriptionStatus | null
  readonly credit: CreditBalance | null
  readonly transactions: CreditTransaction[] | null
}

/** Hợp đồng gói hiện tại của một công ty. */
export type CompanyContract = {
  readonly companyId: string
  readonly companyName: string | null
  readonly plan: SupportPanelPlan | null
  readonly status: SubscriptionStatus | null
}

export function panelOfMock(panel: SupportCompanyPanel): SupportPanel {
  const plan = panel.current?.plan
  return {
    companyName: panel.company.name,
    plan: plan ? { id: plan.id, name: plan.name, tier: plan.tier } : null,
    planStatus: panel.planStatus,
    credit: panel.credit,
    transactions: panel.transactions,
  }
}

function tierOf(value: string | null): PlanTier | null {
  return PLAN_TIERS.find((tier) => tier === value) ?? null
}

/**
 * Như gói hiện tại của màn gói cước (`subscriptionStatusOf`): dùng thử là đang dùng; huỷ ở backend chỉ tắt tự gia hạn nên `ACTIVE` đã tắt
 * tự gia hạn là "Đã huỷ — còn hiệu lực"; hợp đồng đã kết thúc là "Đã hết hạn"; quá hạn mà backend chưa chuyển là "Đã hết hạn".
 */
function contractStatus(dto: ContractDto, nowIso: string): SubscriptionStatus | null {
  if (dto.status === 'EXPIRED' || dto.status === 'CANCELLED') return 'EXPIRED'
  if (dto.status !== 'ACTIVE' && dto.status !== 'TRIAL') return null
  const status: SubscriptionStatus = dto.autoRenew === false ? 'CANCELLED' : 'ACTIVE'
  const expiresAt = fromBackendLocalDateTime(dto.expiresAt)
  return expiresAt === null ? status : effectiveSubscriptionStatus({ status, expiresAt }, nowIso)
}

export function contractOf(dto: ContractDto, nowIso: string): CompanyContract {
  const tier = tierOf(dto.planTier)
  return {
    companyId: dto.companyId === null ? '' : String(dto.companyId),
    companyName: dto.companyName,
    plan: dto.planId !== null && tier !== null ? { id: String(dto.planId), name: dto.planName ?? '', tier } : null,
    status: contractStatus(dto, nowIso),
  }
}

/** Mỗi công ty một hợp đồng; có nhiều thì lấy bản bắt đầu muộn nhất. */
export function latestContracts(dtos: readonly ContractDto[]): ContractDto[] {
  const latest = new Map<number, ContractDto>()
  for (const dto of dtos) {
    if (dto.companyId === null) continue
    const current = latest.get(dto.companyId)
    if (current === undefined || (dto.startedAt ?? '') > (current.startedAt ?? '')) latest.set(dto.companyId, dto)
  }
  return [...latest.values()]
}
