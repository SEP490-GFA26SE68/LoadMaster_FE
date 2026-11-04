/**
 * Thẻ Credit của Thiết lập tối ưu khi nối backend (nhóm `billing`): gói và số dư của công ty đọc từ backend.
 *   fetchBackendOptimizationCredit → GET /api/subscription/current · GET /api/credits/balance
 * Giữ / trừ / hoàn credit của một lần chạy vẫn theo nguồn của nhóm tối ưu (`runOptimization`).
 */

import { creditBalanceOf, getCreditBalanceDto, getCurrentSubscriptionDto, subscriptionStatusOf } from '@/lib/billing-backend-api'
import { BILLING_CONSTANTS, type CreditBlock } from '@/lib/mock-db'
import type { OptimizationCredit } from './optimization-api'

/**
 * Cùng luật với `creditBlock` của kho mẫu: chưa có gói hoặc gói đã hết hạn chặn trước, rồi gói không giới hạn chạy được, rồi số dư dưới
 * giá một lần chạy. Gói đã huỷ (không tự gia hạn) vẫn chạy được tới hết kỳ. Gói đã hết hạn thì backend chỉ trả trạng thái và số dư —
 * không tên gói, không hạng thuật toán — nên thẻ nói số dư kèm lý do chặn (`lapsed`), không nói "chưa có gói".
 */
// GET /api/subscription/current · GET /api/credits/balance
export async function fetchBackendOptimizationCredit(): Promise<OptimizationCredit> {
  const [current, balanceDto] = await Promise.all([getCurrentSubscriptionDto(), getCreditBalanceDto()])
  const { balance, unlimited } = creditBalanceOf(balanceDto)
  const status = subscriptionStatusOf(current, new Date().toISOString())
  const planName = status === null ? null : current.planName
  const lapsed = status === 'EXPIRED' && planName === null
  const usable = (status === 'ACTIVE' || status === 'CANCELLED') && planName !== null
  const cost = BILLING_CONSTANTS.optimizationCost
  const block: CreditBlock | null = !usable ? 'SUBSCRIPTION_EXPIRED' : unlimited || balance >= cost ? null : 'INSUFFICIENT_CREDITS'
  return {
    planName,
    algorithmTier: planName === null ? null : current.algorithmTier,
    cost: unlimited || (planName === null && !lapsed) ? 0 : cost,
    balance,
    unlimited,
    block,
    lapsed,
  }
}
