import { assertRunAlgorithm, RUNNABLE_ALGORITHMS } from './algorithm-model'
import { billingCore } from './billing-core'
import type { DbContext } from './db-context'
import type { OptimizationAlgorithm } from './source-types'

/**
 * Kho tự kiểm thuật toán của một lần chạy, không tin giao diện: gói của công ty sở hữu chuyến phải cho phép nó
 * (`ALGORITHM_NOT_ALLOWED`) và kho mẫu phải chạy được nó (`ALGORITHM_UNAVAILABLE`). Gọi trước khi giữ hay trừ credit và trước khi ghi gì.
 * Chỉ đọc gói, không chạy việc tới hạn (`settle`): hạng của gói không đổi theo đồng hồ, gói hết hạn do lượt giữ credit chặn. Công ty chưa
 * có gói tính như Basic.
 */
export function checkRunAlgorithm(ctx: DbContext, companyId: string, algorithm: OptimizationAlgorithm): void {
  const tier = billingCore(ctx).currentOf(companyId)?.plan.algorithmTier ?? null
  assertRunAlgorithm(algorithm, tier, RUNNABLE_ALGORITHMS.mock)
}
