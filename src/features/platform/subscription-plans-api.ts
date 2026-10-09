/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   listSubscriptionPlans  → GET /api/subscription/plans
 *   createSubscriptionPlan → POST /api/subscription/plans
 *   updateSubscriptionPlan → PUT /api/subscription/plans/{id}
 *   deleteSubscriptionPlan → DELETE /api/subscription/plans/{id}
 *   chưa có ở BE: setSubscriptionPlanActive (BE bật / tắt bán bằng PUT cùng cờ `active`), countPlanCompanies
 */

import { getMockDb, type PlanInput, type PlanPatch, type SubscriptionPlan } from '@/lib/mock-db'

/** Một dòng của danh mục: gói kèm số công ty đang gắn với nó. */
export type PlanRow = { readonly plan: SubscriptionPlan; readonly companies: number }

/** Danh mục gói theo thứ tự hạng, mỗi gói kèm số công ty dùng. */
// GET /api/subscription/plans (số công ty dùng: chưa có ở BE)
export async function listSubscriptionPlans(): Promise<PlanRow[]> {
  const db = getMockDb()
  const [plans, companies] = await Promise.all([db.listSubscriptionPlans(), db.countPlanCompanies()])
  return plans.map((plan) => ({ plan, companies: companies[plan.id] ?? 0 }))
}

/** Gói mới đang bán trừ khi `active: false`. Hạng đã có gói đang bán: `PLAN_TIER_TAKEN`; sai dữ liệu: `PLAN_INVALID` kèm tên trường. */
// POST /api/subscription/plans
export function createSubscriptionPlan(input: PlanInput): Promise<SubscriptionPlan> {
  return getMockDb().createSubscriptionPlan(input)
}

/** Giá và credit mới áp dụng từ kỳ gia hạn kế tiếp của từng công ty; sửa xong gói hết nhãn "giá trị tạm". */
// PUT /api/subscription/plans/{id}
export function updateSubscriptionPlan(planId: string, patch: PlanPatch): Promise<SubscriptionPlan> {
  return getMockDb().updateSubscriptionPlan(planId, patch)
}

/** Bật / tắt bán. Bật khi hạng đã có gói khác đang bán: `PLAN_TIER_TAKEN`. */
// chưa có ở BE (BE: PUT /api/subscription/plans/{id} với cờ `active`)
export function setSubscriptionPlanActive(planId: string, active: boolean): Promise<SubscriptionPlan> {
  return getMockDb().setSubscriptionPlanActive(planId, active)
}

/** Còn công ty gắn với gói: `PLAN_IN_USE`. */
// DELETE /api/subscription/plans/{id}
export function deleteSubscriptionPlan(planId: string): Promise<void> {
  return getMockDb().deleteSubscriptionPlan(planId)
}
