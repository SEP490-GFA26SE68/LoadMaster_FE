/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Trang công khai: gọi được khi chưa đăng nhập.
 *   listPublicPlans → GET /api/subscription/plans (nối khi bật nhóm `billing`; gọi không kèm token)
 */

import { createApiClient, type ApiClient } from '@/lib/api-client'
import { backendConfig, usesBackend } from '@/lib/backend-config'
import { listActivePlans } from '@/lib/billing-backend-api'
import { getMockDb, type SubscriptionPlan } from '@/lib/mock-db'

/**
 * Client không gắn token cho endpoint công khai: bảng giá không phụ thuộc phiên đăng nhập, nên token hết hạn hay phiên Keycloak đang mở
 * lại không làm hỏng trang của khách. Vẫn đi qua `createApiClient` (giới hạn thời gian, mã lỗi) như mọi lượt gọi backend.
 */
let publicClient: ApiClient | undefined
const publicApi = () => (publicClient ??= createApiClient({ baseUrl: backendConfig.apiUrl, accessToken: () => Promise.resolve(null) }))

/** Gói đang bán theo thứ tự hạng Basic, Pro, Ultimate — bảng giá công khai và ô "Gói quan tâm" của form liên hệ. */
// GET /api/subscription/plans
export async function listPublicPlans(): Promise<SubscriptionPlan[]> {
  if (usesBackend('billing')) return listActivePlans(publicApi())
  return (await getMockDb().listSubscriptionPlans()).filter((plan) => plan.active)
}
