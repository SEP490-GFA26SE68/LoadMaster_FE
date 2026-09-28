import { roundKg } from '@/domain/geometry'
import type { CargoPackage, VehicleConfig } from '@/domain/models'
import type { IssueGroup, IssueLink, RequestIssueSummary } from './optimization-request'

/**
 * Danh sách kiểm tra trực tiếp của Thiết lập tối ưu (V2.3 `ThietLapToiUu.jpg`, LM-106): mỗi điều kiện đầu vào là một mục — đạt, lỗi
 * (chặn tối ưu), cảnh báo (vẫn chạy) hoặc thông tin — kèm số của chính chuyến để người dùng thấy **vì sao** đạt. Mục lỗi mang các issue
 * của `validateRequest` (mỗi issue kèm nơi sửa). Hàm thuần: không câu chữ, component dịch.
 */
export type CheckState = 'pass' | 'fail' | 'warn'

export type CheckItem = { readonly state: CheckState; readonly issues: readonly IssueLink[] }

export type SetupChecklist = {
  /** Lòng thùng, cửa và vật cản của xe. */
  readonly vehicle: CheckItem
  /** Kích thước, hướng đặt, mã kiện không trùng: mọi issue nhóm Kiện trừ qua cửa. */
  readonly dimensions: CheckItem & { readonly lines: number; readonly instances: number }
  /** Mọi kiện lọt qua cửa sau; `largest` là dòng kiện thể tích lớn nhất (vắng khi chuyến chưa có kiện). */
  readonly door: CheckItem & { readonly largest: CargoPackage | undefined }
  /** Kiện không bắt buộc xếp (`mustLoad: false`) — mục thông tin, `null` khi không có. */
  readonly optional: { readonly instances: number; readonly lines: readonly CargoPackage[] } | null
  /** Tổng khối lượng và riêng kiện bắt buộc so với tải trọng xe (Spec 7.3). */
  readonly payload: CheckItem & { readonly totalKg: number; readonly mustLoadKg: number; readonly maxPayloadKg: number }
  /** Số issue `error` của đầu vào và nhóm chứa chúng, theo thứ tự Xe → Kiện → Tải trọng — lý do nút Tối ưu tắt. */
  readonly errorCount: number
  readonly errorGroups: readonly IssueGroup[]
}

const GROUPS: readonly IssueGroup[] = ['vehicle', 'packages', 'payload']

function item(issues: readonly IssueLink[]): CheckItem {
  const state: CheckState = issues.some(({ issue }) => issue.severity === 'error') ? 'fail' : issues.length > 0 ? 'warn' : 'pass'
  return { state, issues }
}

const volumeOf = (pkg: CargoPackage) => pkg.lengthCm * pkg.widthCm * pkg.heightCm
const weightOf = (packages: readonly CargoPackage[]) => roundKg(packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0))

export function buildSetupChecklist(
  packages: readonly CargoPackage[],
  vehicle: Pick<VehicleConfig, 'maxPayloadKg'>,
  summary: RequestIssueSummary,
): SetupChecklist {
  const { groups } = summary
  const optionalLines = packages.filter((pkg) => !pkg.mustLoad)
  const largest = packages.reduce<CargoPackage | undefined>((best, pkg) => (best && volumeOf(best) >= volumeOf(pkg) ? best : pkg), undefined)
  const errorGroups = GROUPS.filter((group) => groups[group].some(({ issue }) => issue.severity === 'error'))
  return {
    vehicle: item(groups.vehicle),
    dimensions: {
      ...item(groups.packages.filter(({ issue }) => issue.code !== 'DOOR_TOO_SMALL')),
      lines: packages.length,
      instances: packages.reduce((sum, pkg) => sum + pkg.quantity, 0),
    },
    door: { ...item(groups.packages.filter(({ issue }) => issue.code === 'DOOR_TOO_SMALL')), largest },
    optional: optionalLines.length > 0
      ? { instances: optionalLines.reduce((sum, pkg) => sum + pkg.quantity, 0), lines: optionalLines }
      : null,
    payload: {
      ...item(groups.payload),
      totalKg: weightOf(packages),
      mustLoadKg: weightOf(packages.filter((pkg) => pkg.mustLoad)),
      maxPayloadKg: vehicle.maxPayloadKg,
    },
    errorCount: GROUPS.reduce((sum, group) => sum + groups[group].filter(({ issue }) => issue.severity === 'error').length, 0),
    errorGroups,
  }
}
