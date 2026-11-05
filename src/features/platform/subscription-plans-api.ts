/**
 * Hàm → endpoint backend (FE-0-09). Có `usesBackend('billing')` thì đọc ghi backend, không thì kho mẫu.
 *   listSubscriptionPlans     → GET /api/subscription/plans (backend chỉ trả gói đang bán)
 *   createSubscriptionPlan    → POST /api/subscription/plans
 *   updateSubscriptionPlan    → GET rồi PUT /api/subscription/plans/{id}
 *   setSubscriptionPlanActive → GET rồi PUT /api/subscription/plans/{id} (cờ `active`)
 *   deleteSubscriptionPlan    → DELETE /api/subscription/plans/{id}
 */

import { usesBackend } from '@/lib/backend-config'
import { api } from '@/lib/api-client'
import { getPlanDto, listPlanDtos, planFromDto, PLANS_PATH, UNLIMITED_TIER, withBusinessCode, type PlanDto } from '@/lib/billing-backend-api'
import { getMockDb, type PlanInput, type PlanPatch, type PlanTier, type SubscriptionPlan } from '@/lib/mock-db'
import { TIER_ALGORITHM, TIER_FEATURES } from '@/lib/mock-db/billing-model'

const ON_BACKEND = usesBackend('billing')

/** Một dòng của danh mục: gói, số công ty đang dùng và mã hiện dưới tên (kho mẫu: mã gói; backend: `planCode`). */
export type PlanRow = { readonly plan: SubscriptionPlan; readonly companies: number; readonly code: string }

/**
 * Việc danh mục làm được theo nguồn dữ liệu. Backend chỉ liệt kê gói đang bán nên không có công tắc bán (tắt là gói biến mất khỏi danh
 * mục, không bật lại được) và mọi gói tạo ra đều đang bán — mỗi hạng một gói; hạng Ultimate luôn không giới hạn credit.
 */
export const PLAN_CATALOG_CAPABILITIES = {
  saleToggle: !ON_BACKEND,
  unlimitedByTier: ON_BACKEND,
  createInTakenTier: !ON_BACKEND,
} as const

/** Body của `SubscriptionPlanRequest`. Backend ghi đè `features` bằng giá trị gửi lên nên PUT luôn gửi lại đủ. */
type PlanRequestDto = Omit<PlanDto, 'id' | 'activeCompanyCount'>

function requestOf(dto: PlanDto, changes: Partial<PlanRequestDto>): PlanRequestDto {
  return {
    planCode: dto.planCode,
    name: dto.name,
    priceVnd: dto.priceVnd,
    tier: dto.tier,
    monthlyCredits: dto.monthlyCredits,
    algorithmTier: dto.algorithmTier,
    features: dto.features,
    billingCycle: dto.billingCycle,
    maxVehicles: dto.maxVehicles,
    maxMonthlyJobs: dto.maxMonthlyJobs,
    active: dto.active,
    ...changes,
  }
}

/** Mã gói mới (duy nhất kể cả với gói đã ngừng bán mà backend không liệt kê): hạng kèm mốc thời gian. */
function newPlanCode(tier: PlanTier): string {
  return `${tier}-${Date.now().toString(36).toUpperCase()}`
}

/** Danh mục gói theo thứ tự hạng, mỗi gói kèm số công ty dùng. */
// GET /api/subscription/plans
export async function listSubscriptionPlans(): Promise<PlanRow[]> {
  if (ON_BACKEND) {
    return (await listPlanDtos()).map((dto) => ({ plan: planFromDto(dto), companies: dto.activeCompanyCount, code: dto.planCode }))
  }
  const db = getMockDb()
  const [plans, companies] = await Promise.all([db.listSubscriptionPlans(), db.countPlanCompanies()])
  return plans.map((plan) => ({ plan, companies: companies[plan.id] ?? 0, code: plan.id }))
}

/** Gói mới đang bán trừ khi `active: false`. Hạng đã có gói đang bán: `PLAN_TIER_TAKEN`; sai dữ liệu: `PLAN_INVALID` kèm tên trường. */
// POST /api/subscription/plans
export async function createSubscriptionPlan(input: PlanInput): Promise<SubscriptionPlan> {
  if (!ON_BACKEND) return getMockDb().createSubscriptionPlan(input)
  const body: PlanRequestDto = {
    planCode: newPlanCode(input.tier),
    name: input.name,
    priceVnd: input.priceVnd,
    tier: input.tier,
    monthlyCredits: input.tier === UNLIMITED_TIER ? null : input.monthlyCredits,
    algorithmTier: TIER_ALGORITHM[input.tier],
    features: JSON.stringify(TIER_FEATURES[input.tier]),
    billingCycle: 'MONTHLY',
    maxVehicles: null,
    maxMonthlyJobs: null,
    active: true,
  }
  return planFromDto(await withBusinessCode(api().post<PlanDto>(PLANS_PATH, { body }), { CONFLICT: 'SUBSCRIPTION_TIER_ALREADY_EXISTS' }))
}

/** Đọc gói hiện có rồi gửi lại đủ trường kèm phần đổi (PUT của backend thay cả gói). */
async function putPlan(planId: string, changes: (dto: PlanDto) => Partial<PlanRequestDto>): Promise<SubscriptionPlan> {
  const dto = await getPlanDto(planId)
  const body = requestOf(dto, changes(dto))
  const saved = await withBusinessCode(api().put<PlanDto>(`${PLANS_PATH}/${encodeURIComponent(planId)}`, { body }), { CONFLICT: 'SUBSCRIPTION_TIER_ALREADY_EXISTS' })
  return planFromDto(saved)
}

/** Giá và credit mới áp dụng từ kỳ gia hạn kế tiếp của từng công ty; sửa xong gói hết nhãn "giá trị tạm". */
// PUT /api/subscription/plans/{id}
export function updateSubscriptionPlan(planId: string, patch: PlanPatch): Promise<SubscriptionPlan> {
  if (!ON_BACKEND) return getMockDb().updateSubscriptionPlan(planId, patch)
  return putPlan(planId, (dto) => ({
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.priceVnd === undefined ? {} : { priceVnd: patch.priceVnd }),
    ...(patch.monthlyCredits === undefined || dto.tier === UNLIMITED_TIER ? {} : { monthlyCredits: patch.monthlyCredits }),
    ...(patch.features === undefined ? {} : { features: JSON.stringify(patch.features) }),
  }))
}

/** Bật / tắt bán. Bật khi hạng đã có gói khác đang bán: `PLAN_TIER_TAKEN`. Màn backend không có công tắc này (`PLAN_CATALOG_CAPABILITIES`). */
// PUT /api/subscription/plans/{id}
export function setSubscriptionPlanActive(planId: string, active: boolean): Promise<SubscriptionPlan> {
  if (!ON_BACKEND) return getMockDb().setSubscriptionPlanActive(planId, active)
  return putPlan(planId, () => ({ active }))
}

/** Còn công ty gắn với gói: `PLAN_IN_USE` (backend: 409 — gói còn công ty dùng, hoặc công ty từng dùng vẫn trỏ tới gói). */
// DELETE /api/subscription/plans/{id}
export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  if (!ON_BACKEND) return getMockDb().deleteSubscriptionPlan(planId)
  await withBusinessCode(api().delete<null>(`${PLANS_PATH}/${encodeURIComponent(planId)}`), { CONFLICT: 'PLAN_IN_USE' })
}
