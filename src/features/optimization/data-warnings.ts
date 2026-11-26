/**
 * Cảnh báo dữ liệu đầu vào của một lần chạy tối ưu máy chủ (`dataWarnings` của `GET /api/trips/optimization-jobs/{jobId}`): kiện chưa có
 * sức chịu nén mặt trên σ, kiện chưa gắn loại kiện (bị cấm xoay). Không chặn lần chạy. Chỉ giữ mã màn có câu — mã lạ bị bỏ, không bao giờ
 * hiện mã thô. `packageIds` là mã số kiện của máy chủ.
 */

export const DATA_WARNING_CODES = ['TOP_LOAD_CAPACITY_MISSING', 'PACKAGE_TYPE_MISSING'] as const
export type DataWarningCode = (typeof DATA_WARNING_CODES)[number]

export type DataWarningDto = {
  readonly code?: string | null
  readonly packageIds?: readonly (string | number)[] | null
}

export type DataWarning = {
  readonly code: DataWarningCode
  /** Mã số kiện, không trùng, theo thứ tự máy chủ trả. */
  readonly packageIds: readonly string[]
}

function isDataWarningCode(code: string): code is DataWarningCode {
  return (DATA_WARNING_CODES as readonly string[]).includes(code)
}

/** DTO → cảnh báo: bỏ mã lạ và cảnh báo không có kiện nào; hai mục cùng mã thì gộp. Thứ tự theo `DATA_WARNING_CODES`. */
export function dataWarningsOf(dtos: readonly DataWarningDto[] | null | undefined): readonly DataWarning[] {
  const byCode = new Map<DataWarningCode, Set<string>>()
  for (const dto of dtos ?? []) {
    const code = dto.code?.trim() ?? ''
    if (!isDataWarningCode(code)) continue
    const ids = byCode.get(code) ?? new Set<string>()
    for (const id of dto.packageIds ?? []) {
      const text = String(id).trim()
      if (text !== '') ids.add(text)
    }
    byCode.set(code, ids)
  }
  return DATA_WARNING_CODES.flatMap((code) => {
    const ids = byCode.get(code)
    return ids && ids.size > 0 ? [{ code, packageIds: [...ids] }] : []
  })
}

type PackageRef = { readonly packageId: string; readonly code: string }
/** Phần của `LoadPlan` mà bảng mã cần (khai cấu trúc để file này không import ngược `load-plan-dto`). */
type PlanPackages = { readonly placements: readonly PackageRef[]; readonly unplaced: readonly PackageRef[] }

/**
 * Mã số kiện → mã in trên nhãn, lấy từ chỗ xếp và kiện chưa xếp của các phương án. Chỉ giữ mã khác mã số: mã số là mã nội bộ, không phải
 * thứ người dùng tìm được ở Kho kiện.
 */
export function packageCodeIndex(plans: readonly PlanPackages[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>()
  for (const plan of plans) {
    for (const item of [...plan.placements, ...plan.unplaced]) {
      if (item.code !== item.packageId && !index.has(item.packageId)) index.set(item.packageId, item.code)
    }
  }
  return index
}
