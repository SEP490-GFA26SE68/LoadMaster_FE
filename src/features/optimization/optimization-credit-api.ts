/**
 * Thẻ Credit của Thiết lập tối ưu khi nối backend (nhóm `billing`): gói và số dư của công ty đọc từ backend.
 *   fetchBackendOptimizationCredit → GET /api/subscription/current · GET /api/credits/balance · GET /api/credits/pricing
 * Giữ / trừ / hoàn credit của một lần chạy vẫn theo nguồn của nhóm tối ưu (`runOptimization`).
 */

import { creditBalanceOf, getCreditBalanceDto, getCreditPricing, getCurrentSubscriptionDto, subscriptionStatusOf } from '@/lib/billing-backend-api'
import type { CreditBlock } from '@/lib/mock-db'
import { TIER_ALGORITHM } from '@/lib/mock-db/billing-model'
import type { OptimizationCredit } from './optimization-api'

/**
 * Cùng luật với `creditBlock` của kho mẫu: chưa có gói thì chặn; gói không giới hạn chạy được; còn lại chặn khi số dư dưới giá một lần
 * chạy — giá đọc từ bảng giá của máy chủ (`optimizationCost`), không giữ ở app. Gói đã huỷ (không tự gia hạn) vẫn chạy được tới hết kỳ.
 * Gói đã hết hạn (`EXPIRED`, hoặc đã huỷ mà quá kỳ) **không chặn**: công ty giữ số dư và chạy tiếp bằng nó, chỉ ở hạng Cơ bản
 * (`EP_DBLF`), mỗi lần trừ đúng giá một lần chạy — không còn "không giới hạn". Backend có thể không trả tên gói lúc đó (`lapsed`).
 */
// GET /api/subscription/current · GET /api/credits/balance · GET /api/credits/pricing
export async function fetchBackendOptimizationCredit(): Promise<OptimizationCredit> {
  const [current, balanceDto, pricing] = await Promise.all([getCurrentSubscriptionDto(), getCreditBalanceDto(), getCreditPricing()])
  const credit = creditBalanceOf(balanceDto)
  const status = subscriptionStatusOf(current, new Date().toISOString())
  const expired = status === 'EXPIRED'
  const planName = status === null ? null : current.planName
  const hasPlan = expired || planName !== null
  const unlimited = !expired && credit.unlimited
  const cost = pricing.optimizationCost
  const block: CreditBlock | null = !hasPlan ? 'SUBSCRIPTION_EXPIRED' : unlimited || credit.balance >= cost ? null : 'INSUFFICIENT_CREDITS'
  return {
    planName,
    algorithmTier: expired ? TIER_ALGORITHM.BASIC : planName === null ? null : current.algorithmTier,
    cost: !hasPlan || unlimited ? 0 : cost,
    balance: credit.balance,
    unlimited,
    block,
    lapsed: expired && planName === null,
    basicOnly: expired,
  }
}
