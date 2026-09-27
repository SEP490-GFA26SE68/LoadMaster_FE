import type { ConstraintIssue } from '@/domain/constraints'
import type { CargoPackage, OptimizationRequest, VehicleConfig } from '@/domain/models'
import { DEFAULT_RUN_SETTINGS, type RunSettings } from '@/lib/mock-db'

/**
 * Thiết lập tối ưu trên form (Spec 9.4). `method` luôn là `MOCK` (chỉ mock chạy được, kết quả mang MOCK RESULT); thuật toán người
 * dùng chọn đi riêng trong `RunSettings` (LM-104), nên màn không còn hiện ô "Phương pháp" khoá.
 */
export type OptimizationSettings = OptimizationRequest['settings']

export const METHODS = ['MOCK', 'EP_DBLF', 'GA', 'SA', 'BBMP_DCS_PQNET'] as const satisfies readonly OptimizationSettings['method'][]

export const DEFAULT_SETTINGS: OptimizationSettings = {
  method: 'MOCK',
  timeLimitSeconds: 30,
  randomSeed: 1,
  enforceLifo: true,
  prioritizeLowCenterOfGravity: true,
}

/**
 * Giá trị form của màn thiết lập: thiết lập Spec gửi service cộng mục tiêu và thuật toán của lần chạy (luồng 3 Review 1, LM-104).
 * Mục tiêu và thuật toán không thuộc contract `OptimizationRequest` — kho lưu chúng vào lịch sử lần chạy, mock tối ưu bỏ qua.
 */
export type SetupValues = OptimizationSettings & RunSettings

export const DEFAULT_SETUP: SetupValues = { ...DEFAULT_SETTINGS, ...DEFAULT_RUN_SETTINGS }

/** Tách giá trị form thành thiết lập của request và lựa chọn của lần chạy. */
export function splitSetup({ objective, algorithm, ...settings }: SetupValues): { settings: OptimizationSettings; run: RunSettings } {
  return { settings, run: { objective, algorithm } }
}

/** Request gửi service: xe đang chọn, kiện của chuyến (đã có `deliveryStop` theo thứ tự điểm giao, LM-046) và thiết lập. */
export function buildOptimizationRequest(
  trip: { readonly packages: readonly CargoPackage[] },
  vehicle: VehicleConfig,
  settings: OptimizationSettings,
): OptimizationRequest {
  return { vehicle, packages: [...trip.packages], settings }
}

export type IssueGroup = 'vehicle' | 'packages' | 'payload'

/** Một dòng của validation summary: issue và nơi sửa nó. */
export type IssueLink = { readonly issue: ConstraintIssue; readonly to: string }

export type RequestIssueSummary = {
  readonly groups: Readonly<Record<IssueGroup, readonly IssueLink[]>>
  /** Nút Tối ưu chỉ bị chặn bởi `error` (D-23) — vượt tải thường là cảnh báo, `MUST_LOAD_PAYLOAD_EXCEEDED` là lỗi. */
  readonly canRun: boolean
}

const PAYLOAD_CODES = new Set<ConstraintIssue['code']>(['PAYLOAD_EXCEEDED', 'MUST_LOAD_PAYLOAD_EXCEEDED'])

function packageIdOf(issue: ConstraintIssue): string | undefined {
  const params: Readonly<Record<string, unknown>> = issue.params
  return typeof params.packageId === 'string' ? params.packageId : undefined
}

/**
 * Gom `validateRequest` theo Xe / Kiện / Tải trọng (LM-047), mỗi mục kèm đường tới chỗ sửa: trang xe, panel kiện trên
 * chi tiết chuyến (`?kien=`), hoặc chi tiết chuyến cho tải trọng. Giữ thứ tự của `validateRequest` (lỗi trước).
 */
export function groupRequestIssues(
  issues: readonly ConstraintIssue[],
  { tripId, vehicleId }: { readonly tripId: string; readonly vehicleId: string },
): RequestIssueSummary {
  const groups: Record<IssueGroup, IssueLink[]> = { vehicle: [], packages: [], payload: [] }
  for (const issue of issues) {
    const packageId = packageIdOf(issue)
    if (PAYLOAD_CODES.has(issue.code)) groups.payload.push({ issue, to: `/chuyen/${tripId}` })
    else if (packageId !== undefined) groups.packages.push({ issue, to: `/chuyen/${tripId}?kien=${packageId}` })
    else if (issue.code === 'DUPLICATE_INSTANCE_ID') groups.packages.push({ issue, to: `/chuyen/${tripId}` })
    else groups.vehicle.push({ issue, to: `/doi-xe/${vehicleId}` })
  }
  return { groups, canRun: !issues.some(({ severity }) => severity === 'error') }
}
