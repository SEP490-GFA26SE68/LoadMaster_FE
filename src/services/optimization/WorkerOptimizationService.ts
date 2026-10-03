import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import type { CandidateRun } from './mock-candidates'
import type { CandidateOptions, OptimizationService, OptimizeOptions } from './OptimizationService'
import { OptimizationServiceError } from './service-errors'
import type { OptimizationWorker, WorkerRequest, WorkerResponse } from './worker-protocol'

export type WorkerServiceOptions = {
  readonly createWorker?: () => OptimizationWorker
  /** Kết quả về sớm hơn thì vẫn chờ đủ, để trạng thái đang tối ưu nhìn thấy được (LM-025). */
  readonly minimumLatencyMs?: number
  readonly clock?: () => number
}

/** Worker thật của Vite: bundle riêng, chỉ tạo khi chạy trong trình duyệt. */
function browserWorker(): OptimizationWorker {
  return new Worker(new URL('./optimization.worker.ts', import.meta.url), { type: 'module' }) as unknown as OptimizationWorker
}

/**
 * `OptimizationService` chạy mock trong Web Worker (D-30): main thread không bị chặn, tiến trình qua `onProgress`.
 * Mỗi lần gọi một worker riêng, luôn `terminate` khi xong, lỗi, huỷ hoặc hết giờ. Ba phương án ứng viên chạy trong **một** job của
 * một worker (FE-5b-05): huỷ là huỷ cả ba.
 * - `signal` huỷ → reject với lý do của signal.
 * - Quá `settings.timeLimitSeconds` → reject `TIME_LIMIT_EXCEEDED`. Mock tính một mạch nên không có "kết quả tốt nhất hiện có" để trả.
 */
export class WorkerOptimizationService implements OptimizationService {
  readonly #createWorker: () => OptimizationWorker
  readonly #minimumLatencyMs: number
  readonly #clock: () => number

  constructor({ createWorker = browserWorker, minimumLatencyMs = 600, clock = () => performance.now() }: WorkerServiceOptions = {}) {
    this.#createWorker = createWorker
    this.#minimumLatencyMs = minimumLatencyMs
    this.#clock = clock
  }

  optimize(request: OptimizationRequest, { signal, onProgress }: OptimizeOptions = {}): Promise<OptimizationResult> {
    return this.#run({ type: 'start', request }, signal, (data) => {
      if (data.type === 'progress') onProgress?.(data.progress)
      return data.type === 'result' ? { value: data.result } : undefined
    })
  }

  optimizeCandidates(request: OptimizationRequest, { signal, onProgress }: CandidateOptions = {}): Promise<CandidateRun> {
    return this.#run({ type: 'start-candidates', request }, signal, (data) => {
      if (data.type === 'candidate-progress') onProgress?.(data.progress)
      return data.type === 'candidates' ? { value: data.run } : undefined
    })
  }

  /** Một job trong một worker; `read` nhận từng message của worker và trả `{ value }` khi đó là kết quả của job. */
  #run<T>(message: WorkerRequest, signal: AbortSignal | undefined, read: (data: WorkerResponse) => { value: T } | undefined): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason)
        return
      }
      const worker = this.#createWorker()
      const startedAt = this.#clock()
      let settled = false
      const timers: ReturnType<typeof setTimeout>[] = []
      const finish = (settle: () => void) => {
        if (settled) return
        settled = true
        timers.forEach(clearTimeout)
        signal?.removeEventListener('abort', onAbort)
        worker.terminate()
        settle()
      }
      const onAbort = () => finish(() => reject(signal?.reason))
      signal?.addEventListener('abort', onAbort, { once: true })
      timers.push(
        setTimeout(() => finish(() => reject(new OptimizationServiceError('TIME_LIMIT_EXCEEDED'))), message.request.settings.timeLimitSeconds * 1000),
      )
      worker.onmessage = ({ data }) => {
        if (data.type === 'error') {
          finish(() => reject(new OptimizationServiceError('MOCK_FAILED', data.message)))
          return
        }
        const done = read(data)
        if (done === undefined) return
        const waitMs = Math.max(0, this.#minimumLatencyMs - (this.#clock() - startedAt))
        timers.push(setTimeout(() => finish(() => resolve(done.value)), waitMs))
      }
      worker.onerror = () => finish(() => reject(new OptimizationServiceError('WORKER_CRASHED')))
      worker.postMessage(message)
    })
  }
}
