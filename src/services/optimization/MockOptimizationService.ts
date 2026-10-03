import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { runMockCandidates, type CandidateRun } from './mock-candidates'
import { runMockOptimization } from './mock-optimization'
import type { CandidateOptions, OptimizationService, OptimizeOptions } from './OptimizationService'

/**
 * `OptimizationService` chạy mock ngay trên luồng gọi — cho test và làm đường lui khi môi trường không có Web Worker (LM-025).
 * Kết quả luôn `isMockResult: true`; UI gắn nhãn MOCK RESULT.
 */
export class MockOptimizationService implements OptimizationService {
  readonly #clock: () => number

  constructor(clock: () => number = () => performance.now()) {
    this.#clock = clock
  }

  async optimize(request: OptimizationRequest, { signal, onProgress }: OptimizeOptions = {}): Promise<OptimizationResult> {
    signal?.throwIfAborted()
    return runMockOptimization(request, { clock: this.#clock, onProgress })
  }

  async optimizeCandidates(request: OptimizationRequest, { signal, onProgress }: CandidateOptions = {}): Promise<CandidateRun> {
    signal?.throwIfAborted()
    return runMockCandidates(request, { clock: this.#clock, onProgress })
  }
}
