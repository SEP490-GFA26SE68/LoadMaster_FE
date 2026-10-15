/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Trang công khai: gọi được khi chưa đăng nhập.
 *   listPublicPlans → GET /api/subscription/plans
 */

import { getMockDb, type SubscriptionPlan } from '@/lib/mock-db'

/** Gói đang bán theo thứ tự hạng Basic, Pro, Ultimate — bảng giá công khai và ô "Gói quan tâm" của form liên hệ. */
// GET /api/subscription/plans
export async function listPublicPlans(): Promise<SubscriptionPlan[]> {
  return (await getMockDb().listSubscriptionPlans()).filter((plan) => plan.active)
}
