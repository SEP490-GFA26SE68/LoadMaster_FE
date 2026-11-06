import { PLAN_OBJECTIVES, type PlanObjective } from '@/domain/models'
import type { OptimizationProgress } from '@/services/optimization'

/**
 * Các bước thật của một lần chạy, theo đúng thứ tự `runOptimization` làm: giữ credit ở kho → service xếp ba phương án → kho lưu lần
 * chạy cùng ba revision. Không có bước nào ngoài ba bước đó.
 */
export const RUN_STAGES = ['reserve', 'pack', 'save'] as const
export type RunStage = (typeof RUN_STAGES)[number]

/** Tiến trình của một lần chạy: tổng số kiện, bước đang làm và số kiện đã xét của từng phương án ứng viên (chưa tới lượt thì vắng). */
export type RunProgress = {
  readonly total: number
  readonly stage: RunStage
  readonly plans: Partial<Record<PlanObjective, OptimizationProgress>>
}

export type RunProgressView = {
  readonly total: number
  /** Ba phương án theo thứ tự A · B · C; `placed` vắng khi service chưa báo gì về phương án đó. */
  readonly plans: readonly { readonly objective: PlanObjective; readonly placed: number | undefined }[]
  /** Số phương án đã xét hết kiện. */
  readonly done: number
  /** Kiện đã xét cộng cả ba phương án, và tổng việc của job (`total` × số phương án). */
  readonly checked: number
  readonly workload: number
  /**
   * `checked / workload` — phần việc thật đã xong. `null` (không xác định) khi chưa có sự kiện tiến trình nào của phương án nào, hoặc
   * nguồn không báo số kiện (máy chủ chỉ báo trạng thái job): khi đó không có con số nào để vẽ.
   */
  readonly fraction: number | null
}

/** Số liệu của hộp thoại đang chạy, tính từ tiến trình service báo; `fallbackTotal` là tổng kiện của chuyến khi chưa có tiến trình. */
export function runProgressView(progress: RunProgress | null, fallbackTotal: number): RunProgressView {
  const total = progress?.total ?? fallbackTotal
  const plans = PLAN_OBJECTIVES.map((objective) => ({ objective, placed: progress?.plans[objective]?.placed }))
  const done = plans.filter(({ placed }) => placed !== undefined && placed >= total).length
  const checked = plans.reduce((sum, { placed = 0 }) => sum + Math.min(placed, total), 0)
  const workload = total * plans.length
  const reported = plans.some(({ placed }) => placed !== undefined)
  return { total, plans, done, checked, workload, fraction: reported && workload > 0 ? Math.min(1, checked / workload) : null }
}

/**
 * Số khối hình hiện ra cho phần việc đã xong: mỗi khối là `1 / boxCount` công việc thật, và khối thứ i chỉ hiện khi phần việc tới nó
 * đã xong (làm tròn xuống) — hình không bao giờ đi trước tiến trình. `null` khi tiến trình không xác định.
 */
export function revealedBoxCount(fraction: number | null, boxCount: number): number | null {
  if (fraction === null) return null
  return Math.floor(Math.min(1, Math.max(0, fraction)) * boxCount)
}
