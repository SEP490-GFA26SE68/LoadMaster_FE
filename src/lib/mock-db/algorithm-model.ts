/**
 * Chọn thuật toán xếp hàng theo hạng gói (luật thuần; kho kiểm ở `db-revisions.ts` / `db-runs.ts`, màn Thiết lập tối ưu đọc cùng các
 * hàm này). Hai điều kiện: **gói cho phép** — như `TIER_ALLOWED_ALGORITHMS` của dịch vụ tối ưu, hạng nào cũng gồm các hạng dưới nó — và
 * **nguồn chạy được** (`RUNNABLE_ALGORITHMS`). Gói chặn trước nguồn: người dùng biết cần nâng gói trước khi biết bản demo chưa chạy được.
 */

import { PLAN_TIERS, TIER_ALGORITHM, type AlgorithmTier, type PlanTier } from './billing-model'
import { MockDbError } from './errors'
import { DEFAULT_RUN_ALGORITHM, OPTIMIZATION_ALGORITHMS, type OptimizationAlgorithm } from './source-types'

/** Thuật toán gói được dùng theo hạng thuật toán của gói. Công ty chưa có gói tính như Basic (dịch vụ tối ưu: `normalize_tier`). */
const PLAN_ALGORITHMS: Readonly<Record<AlgorithmTier, readonly OptimizationAlgorithm[]>> = {
  EP_DBLF: ['EP_DBLF'],
  EP_DBLF_GA: ['EP_DBLF', 'EP_DBLF_GA'],
  EP_DBLF_GA_AI: ['EP_DBLF', 'EP_DBLF_GA', 'EP_DBLF_GA_AI'],
}

export function planAlgorithms(tier: AlgorithmTier | null): readonly OptimizationAlgorithm[] {
  return PLAN_ALGORITHMS[tier ?? 'EP_DBLF']
}

/** Hạng gói thấp nhất có thuật toán: "Cần gói Pro" / "Cần gói Ultimate". */
export function requiredPlanTier(algorithm: OptimizationAlgorithm): PlanTier {
  return PLAN_TIERS.find((tier) => PLAN_ALGORITHMS[TIER_ALGORITHM[tier]].includes(algorithm)) ?? 'ULTIMATE'
}

/**
 * Nguồn chạy tối ưu. Hiện chỉ có kho mẫu: Java `POST /api/trips/{tripId}/optimize-loading` chưa chuyển tiếp `algorithm_name` cho dịch vụ
 * tối ưu (gán cứng) nên app chưa có nhóm backend cho tối ưu.
 */
export type OptimizationSource = 'mock'

/**
 * **Bảng duy nhất** nói mỗi nguồn chạy được thuật toán nào. Kho mẫu chỉ có bộ xếp kệ chạy dưới tên EP + DBLF. Backend chuyển tiếp
 * `algorithm_name` thì thêm nguồn đó vào bảng này.
 */
export const RUNNABLE_ALGORITHMS: Readonly<Record<OptimizationSource, readonly OptimizationAlgorithm[]>> = {
  mock: ['EP_DBLF'],
}

/** Vì sao một thuật toán không chọn được — trùng mã lỗi của kho. */
export type AlgorithmBlock = 'ALGORITHM_NOT_ALLOWED' | 'ALGORITHM_UNAVAILABLE'

export function algorithmBlock(
  algorithm: OptimizationAlgorithm,
  tier: AlgorithmTier | null,
  runnable: readonly OptimizationAlgorithm[],
): AlgorithmBlock | null {
  if (!planAlgorithms(tier).includes(algorithm)) return 'ALGORITHM_NOT_ALLOWED'
  if (!runnable.includes(algorithm)) return 'ALGORITHM_UNAVAILABLE'
  return null
}

/** Một dòng của ô chọn thuật toán: lý do không chọn được (vắng là chọn được) và gói thấp nhất có nó. */
export type AlgorithmChoice = { algorithm: OptimizationAlgorithm; block: AlgorithmBlock | null; requiredTier: PlanTier }

/** Đủ ba thuật toán theo thứ tự hạng, mỗi thuật toán kèm lý do bị chặn. */
export function algorithmChoices(tier: AlgorithmTier | null, runnable: readonly OptimizationAlgorithm[]): AlgorithmChoice[] {
  return OPTIMIZATION_ALGORITHMS.map((algorithm) => ({ algorithm, block: algorithmBlock(algorithm, tier, runnable), requiredTier: requiredPlanTier(algorithm) }))
}

/** Mặc định: thuật toán cao nhất vừa được gói cho phép vừa chạy được; không có thì EP + DBLF. */
export function defaultAlgorithm(tier: AlgorithmTier | null, runnable: readonly OptimizationAlgorithm[]): OptimizationAlgorithm {
  return OPTIMIZATION_ALGORITHMS.findLast((algorithm) => algorithmBlock(algorithm, tier, runnable) === null) ?? DEFAULT_RUN_ALGORITHM
}

/** Từ chối thuật toán bị chặn bằng mã lỗi của kho (`ALGORITHM_NOT_ALLOWED` kèm gói cần có, `ALGORITHM_UNAVAILABLE`). */
export function assertRunAlgorithm(algorithm: OptimizationAlgorithm, tier: AlgorithmTier | null, runnable: readonly OptimizationAlgorithm[]): void {
  const block = algorithmBlock(algorithm, tier, runnable)
  if (block === 'ALGORITHM_NOT_ALLOWED') throw new MockDbError(block, { algorithm, requiredTier: requiredPlanTier(algorithm) })
  if (block === 'ALGORITHM_UNAVAILABLE') throw new MockDbError(block, { algorithm })
}
