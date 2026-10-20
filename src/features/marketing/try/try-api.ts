/**
 * Hàm → endpoint backend (FE-0-09). Trang công khai, không cần đăng nhập.
 *   runTry → không có endpoint: bộ tối ưu mô phỏng chạy ngay trên trình duyệt của người xem
 */

import type { ConstraintIssue } from '@/domain/constraints'
import type { OptimizationProgress } from '@/services/optimization'
import type { TryInput } from './try-form'
import type { TryOutcome } from './try-request'

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

export type TryRunOptions = {
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: OptimizationProgress) => void
}

/**
 * Xếp thử bằng đúng bộ tối ưu mô phỏng của ứng dụng: Web Worker khi trình duyệt có (luồng chính vẫn rảnh, worker luôn bị `terminate`
 * khi xong, lỗi, huỷ hay hết giờ), trên luồng gọi khi không có. Không tài khoản, không credit, không gửi gì lên máy chủ. Bộ tối ưu và phần
 * dựng request tải lười ở đây, lúc khách bấm "Tính thử", để chunk của trang giới thiệu không lớn thêm. Kết quả luôn `isMockResult`.
 */
// không có endpoint — chạy trên trình duyệt
export async function runTry(input: TryInput, { signal, onProgress }: TryRunOptions = {}): Promise<TryOutcome> {
  const [{ buildTryRequest, tryOutcome, tryRequestIssues }, { createOptimizationService }] = await Promise.all([
    import('./try-request'),
    import('@/services/optimization'),
  ])
  signal?.throwIfAborted()
  const request = buildTryRequest(input)
  const issues = tryRequestIssues(request)
  if (issues.length > 0) throw new TryRunError('INVALID_REQUEST', issues)
  const result = await createOptimizationService().optimize(request, { signal, onProgress })
  if (result.status !== 'COMPLETED') throw new TryRunError('FAILED')
  return tryOutcome(input, request, result)
}
