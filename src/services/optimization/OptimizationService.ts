import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import type { CandidateProgress, CandidateRun } from './mock-candidates'

/** Tiến trình xếp: số instance đã xét trên tổng số. */
export type OptimizationProgress = { readonly placed: number; readonly total: number }

export type OptimizeOptions = {
  /** Huỷ job (LM-025: worker bị `terminate`). */
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: OptimizationProgress) => void
}

/** Như `OptimizeOptions`, tiến trình báo theo từng phương án ứng viên. Huỷ là huỷ cả job — không phương án nào được trả. */
export type CandidateOptions = {
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: CandidateProgress) => void
}

/**
 * Spec mục 11: UI chỉ biết interface này. Hiện chỉ có `MockOptimizationService`; API thật sau này thay ở tầng `-api.ts`
 * mà không đổi UI. Tham số thứ hai là tuỳ chọn nên vẫn đúng chữ ký `optimize(request)` của Spec.
 *
 * `optimizeCandidates` (FE-5b-05, D-77, ngoài Spec): một job ra ba phương án ứng viên theo ba mục tiêu — lối app dùng khi chạy tối ưu.
 */
export interface OptimizationService {
  optimize(request: OptimizationRequest, options?: OptimizeOptions): Promise<OptimizationResult>
  optimizeCandidates(request: OptimizationRequest, options?: CandidateOptions): Promise<CandidateRun>
}
