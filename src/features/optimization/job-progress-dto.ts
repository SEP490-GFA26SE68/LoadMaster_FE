import { PLAN_ALGORITHMS } from './plan-algorithm-codes'

/**
 * Tiến trình của một lần chạy tối ưu máy chủ (`elapsedMs`, `progress` của `GET /api/trips/optimization-jobs/{jobId}`) và phép đổi sang
 * kiểu của app. Máy chủ cũ không trả hai trường này: mọi trường vắng là `null`, màn bỏ phần đó. Giá trị lạ (bước, thuật toán chưa có tên
 * trong từ điển, số âm, số không hữu hạn) bị bỏ riêng phần đó, không làm hỏng cả tiến trình. Chỉ `load-plan-dto.ts` import. Hàm thuần.
 */

/** Bước của dịch vụ tối ưu, theo thứ tự chạy. */
export const JOB_STAGES = ['BUILDING', 'IMPROVING', 'SELECTING', 'SAVING'] as const
export type JobStage = (typeof JOB_STAGES)[number]

/** Thuật toán có tên ở `serverPlans.algorithms.plan`; mã khác bị bỏ. */
export type ProgressAlgorithm = (typeof PLAN_ALGORITHMS)[number]

export type JobProgressDto = {
  readonly stage?: string | null
  readonly algorithm?: string | null
  readonly layoutsTried?: number | null
  readonly totalPackages?: number | null
  readonly bestPlacedCount?: number | null
  readonly bestVolumePercent?: number | string | null
  readonly updatedAt?: string | null
}

export type JobProgress = {
  readonly stage: JobStage | null
  readonly algorithm: ProgressAlgorithm | null
  readonly layoutsTried: number | null
  readonly totalPackages: number | null
  /** Kiện xếp được của cách xếp tốt nhất tới lúc này; `null` tới khi có cách xếp đầu tiên. Không vượt `totalPackages`. */
  readonly bestPlacedCount: number | null
  /** 0–100; `null` tới khi có cách xếp đầu tiên. */
  readonly bestVolumePercent: number | null
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function percent(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

const known = <T extends string>(list: readonly T[], value: string | null | undefined): T | null =>
  list.find((item) => item === value?.trim()) ?? null

/** DTO → tiến trình; `null` khi máy chủ không trả `progress` hoặc trả một `progress` không có gì đọc được. */
export function jobProgressOf(dto: JobProgressDto | null | undefined): JobProgress | null {
  if (dto === null || dto === undefined || typeof dto !== 'object') return null
  const totalPackages = count(dto.totalPackages)
  const placed = count(dto.bestPlacedCount)
  const progress: JobProgress = {
    stage: known(JOB_STAGES, dto.stage),
    algorithm: known(PLAN_ALGORITHMS, dto.algorithm),
    layoutsTried: count(dto.layoutsTried),
    totalPackages,
    bestPlacedCount: placed !== null && (totalPackages === null || placed <= totalPackages) ? placed : null,
    bestVolumePercent: percent(dto.bestVolumePercent),
  }
  return Object.values(progress).every((value) => value === null) ? null : progress
}

/** `elapsedMs`: số mili giây không âm, không thì `null`. */
export function elapsedMsOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
