/**
 * Hàm → endpoint backend (FE-0-09). Trang công khai, không cần đăng nhập.
 *   runTry → không có endpoint: bộ tối ưu mô phỏng chạy ngay trên trình duyệt của người xem
 */

import type { ConstraintIssue } from '@/domain/constraints'
import { createOptimizationService } from '@/services/optimization'
import type { TryInput } from './try-form'
import { tryOutcome, type TryOutcome } from './try-outcome'
import { buildTryRequest, tryRequestIssues } from './try-request'

/** Vì sao lần thử không ra kết quả: request bị chặn (kèm issue mã + tham số), hoặc bộ tối ưu trả `FAILED`. */
export type TryRunErrorCode = 'INVALID_REQUEST' | 'FAILED'

export class TryRunError extends Error {
  readonly code: TryRunErrorCode
  readonly issues: readonly ConstraintIssue[]

  constructor(code: TryRunErrorCode, issues: readonly ConstraintIssue[] = []) {
    super(code)
    this.name = 'TryRunError'
    this.code = code
    this.issues = issues
  }
}

/**
 * Một lần chạy ba phương án A · B · C (`optimizeCandidates`, theo `PLAN_OBJECTIVES`) trên xe và kiện khách nhập, bằng đúng bộ tối ưu mô
 * phỏng của ứng dụng: Web Worker khi trình duyệt có (luồng chính vẫn rảnh; worker luôn bị `terminate` khi xong, lỗi hay huỷ), trên luồng
 * gọi khi không có. Không tài khoản, không kho mẫu, không credit, không gửi gì lên máy chủ. Kết quả luôn `isMockResult`; trang công khai
 * không hiện nhãn MOCK RESULT, câu nguồn dưới kết quả nói số do bộ tối ưu mô phỏng chạy trên trình duyệt tính.
 */
// không có endpoint — chạy trên trình duyệt
export async function runTry(input: TryInput, { signal }: { readonly signal?: AbortSignal } = {}): Promise<TryOutcome> {
  const request = buildTryRequest(input)
  const issues = tryRequestIssues(request)
  if (issues.length > 0) throw new TryRunError('INVALID_REQUEST', issues)
  const run = await createOptimizationService().optimizeCandidates(request, { signal })
  if (run.plans.length === 0 || run.plans.some((plan) => plan.result.status !== 'COMPLETED')) throw new TryRunError('FAILED')
  return tryOutcome(input, request, run.plans)
}
