import { PLAN_LABELS, PLAN_OBJECTIVES, type OptimizationRequest, type OptimizationResult, type PlanObjective } from '@/domain/models'
import { candidateLayouts, type Layout } from './candidate-layouts'
import { completedResult, failedResult, mockJobId, planMockRun } from './mock-plan'
import type { OptimizationProgress } from './OptimizationService'

/** Tiến trình của một phương án ứng viên: số instance đã xét trong lượt xếp của mục tiêu đó. */
export type CandidateProgress = OptimizationProgress & { readonly objective: PlanObjective }

export type CandidatePlan = { readonly objective: PlanObjective; readonly result: OptimizationResult }

/** Một job ra ba phương án, theo thứ tự `PLAN_OBJECTIVES` (A · B · C); `jobId` của từng kết quả là mã job kèm nhãn (`…-A`). */
export type CandidateRun = { readonly jobId: string; readonly plans: readonly CandidatePlan[] }

export type CandidateRunOptions = {
  /** Đồng hồ ms cho `runtimeMs`; test truyền đồng hồ giả để kết quả tất định. */
  readonly clock?: () => number
  readonly onProgress?: (progress: CandidateProgress) => void
}

/**
 * Ba phương án ứng viên của một lần chạy (FE-5b-05, D-77), thuần và tất định như `runMockOptimization`: cùng request + seed cho cùng
 * ba kết quả. Mock dựng vài cách xếp trên cùng request rồi mỗi mục tiêu lấy cách tốt nhất theo chỉ số của chính nó
 * (`candidateLayouts`): tối đa thể tích (A), cân tải trục (B), ít dỡ-xếp lại (C). Kiện đặt chỗ theo thứ tự điểm giao khi `enforceLifo`
 * (điểm muộn vào sâu trước), không bật thì theo thứ tự chọn. Hai mục tiêu chọn trùng một cách xếp thì hai phương án giống nhau — mock
 * không sửa số cho khác đi.
 *
 * `runtimeMs` của từng phương án là thời gian kiểm request, lượt xếp của mục tiêu đó và phần domain tính cho nó. Request không chạy
 * được thì cả ba là `FAILED`. Tiến trình báo theo lượt xếp của từng mục tiêu, lần lượt A, B, C.
 */
export function runMockCandidates(request: OptimizationRequest, { clock = () => performance.now(), onProgress }: CandidateRunOptions = {}): CandidateRun {
  const startedAt = clock()
  const jobId = mockJobId(request)
  const idOf = (objective: PlanObjective) => `${jobId}-${PLAN_LABELS[objective]}`
  const planned = planMockRun(request)
  if (!planned.ok) {
    const runtimeMs = clock() - startedAt
    return { jobId, plans: PLAN_OBJECTIVES.map((objective) => ({ objective, result: failedResult(request, planned.instances, idOf(objective), runtimeMs) })) }
  }
  const { plan } = planned
  const prepareMs = clock() - startedAt
  const { chosen, packMs } = candidateLayouts(plan, request.settings.enforceLifo ? plan.lifo : plan.chosen, {
    clock,
    report: (objective) => onProgress && ((progress) => onProgress({ objective, ...progress })),
  })

  const finished = new Map<Layout, OptimizationResult>()
  const plans = PLAN_OBJECTIVES.map((objective, index): CandidatePlan => {
    const layout = chosen[objective]
    const finishFrom = clock()
    const runtimeMs = () => prepareMs + (packMs[index] as number) + (clock() - finishFrom)
    const known = finished.get(layout)
    // Hai mục tiêu chọn trùng một cách xếp: phần domain tính một lần, mỗi phương án giữ mã job và thời gian chạy riêng
    if (known !== undefined) {
      const copy = structuredClone(known)
      return { objective, result: { ...copy, jobId: idOf(objective), metrics: { ...copy.metrics, runtimeMs: runtimeMs() } } }
    }
    const result = completedResult(plan, layout.packed, idOf(objective), runtimeMs)
    finished.set(layout, result)
    return { objective, result }
  })
  return { jobId, plans }
}
