import type { JobStage, JobStatus } from './load-plan-dto'

/**
 * Các bước của một lần chạy tối ưu máy chủ, chỉ những bước dữ liệu chứng minh được. Chưa có `progress` (máy chủ cũ, chưa báo gì): "chờ
 * tới lượt" rồi "tính ba phương án" — đúng những gì `status` nói. Có `progress.stage`: bước tính tách thành xếp thử → (tìm cách tốt hơn,
 * chỉ khi máy chủ đã báo bước đó) → chọn và chấm điểm → lưu. Job đã kết thúc không có bước nào (hộp thoại nói kết quả). Thuần.
 */
export const SERVER_RUN_STEPS = ['queue', 'compute', 'build', 'improve', 'select', 'save'] as const
export type ServerRunStep = (typeof SERVER_RUN_STEPS)[number]
export type StepState = 'done' | 'current' | 'pending'
export type ServerRunStepView = { readonly step: ServerRunStep; readonly state: StepState }

const STAGE_STEP: Readonly<Record<JobStage, ServerRunStep>> = { BUILDING: 'build', IMPROVING: 'improve', SELECTING: 'select', SAVING: 'save' }

export function serverRunSteps({ status, stage, sawImproving }: {
  status: JobStatus
  /** Bước máy chủ báo ở lần đọc này; `null` khi không có `progress` hoặc bước lạ. */
  stage: JobStage | null
  /** Máy chủ đã từng báo `IMPROVING` trong lần chạy này. */
  sawImproving: boolean
}): ServerRunStepView[] {
  const waiting = status === 'PENDING' || status === 'QUEUED'
  if (!waiting && status !== 'RUNNING') return []
  const detailed = !waiting && stage !== null
  const steps: ServerRunStep[] = detailed
    ? ['queue', 'build', ...(sawImproving || stage === 'IMPROVING' ? ['improve' as const] : []), 'select', 'save']
    : ['queue', 'compute']
  const current = waiting ? 0 : detailed ? steps.indexOf(STAGE_STEP[stage]) : 1
  return steps.map((step, index) => ({ step, state: index < current ? 'done' : index === current ? 'current' : 'pending' }))
}
