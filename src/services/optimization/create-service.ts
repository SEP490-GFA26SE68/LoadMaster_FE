import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import type { CandidateRun } from './mock-candidates'
import { MockOptimizationService } from './MockOptimizationService'
import type { OptimizationService } from './OptimizationService'
import { OptimizationServiceError } from './service-errors'
import { WorkerOptimizationService } from './WorkerOptimizationService'

/**
 * Mô phỏng service tối ưu không phản hồi (demo lỗi, D-12): chờ như một lần gọi thật rồi reject `SERVICE_UNAVAILABLE`.
 * Tầng `-api.ts` bật bằng tham số URL `?mo-phong=loi`; domain và service không đọc URL.
 */
export class UnavailableOptimizationService implements OptimizationService {
  readonly #minimumLatencyMs: number

  constructor({ minimumLatencyMs = 600 }: { readonly minimumLatencyMs?: number } = {}) {
    this.#minimumLatencyMs = minimumLatencyMs
  }

  optimize(_request: OptimizationRequest, { signal }: { readonly signal?: AbortSignal } = {}): Promise<OptimizationResult> {
    return this.#fail(signal)
  }

  optimizeCandidates(_request: OptimizationRequest, { signal }: { readonly signal?: AbortSignal } = {}): Promise<CandidateRun> {
    return this.#fail(signal)
  }

  #fail(signal: AbortSignal | undefined): Promise<never> {
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new OptimizationServiceError('SERVICE_UNAVAILABLE')), this.#minimumLatencyMs)
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          reject(signal.reason)
        },
        { once: true },
      )
    })
  }
}

/**
 * Service cho tầng `-api.ts` (LM-048): Web Worker khi trình duyệt có (D-30), chạy trên luồng gọi khi không có (test, jsdom),
 * service lỗi khi `simulateFailure`.
 */
export function createOptimizationService({ simulateFailure = false }: { readonly simulateFailure?: boolean } = {}): OptimizationService {
  if (simulateFailure) return new UnavailableOptimizationService()
  return typeof Worker === 'undefined' ? new MockOptimizationService() : new WorkerOptimizationService()
}
