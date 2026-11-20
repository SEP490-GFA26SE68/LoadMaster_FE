import { validateRequest, type ConstraintIssue } from '@/domain/constraints'
import { roundCm, roundKg } from '@/domain/geometry'
import type { CargoPackage, OptimizationRequest, VehicleConfig } from '@/domain/models'
import { DEFAULT_SETTINGS } from '@/features/optimization/optimization-request'
import { cargoFromPackage } from '@/lib/mock-db'
import type { TryInput } from './try-form'

/**
 * Dựng request Spec cho bản thử từ số khách nhập. Đơn vị cm/kg, làm tròn tại biên (`roundCm`, `roundKg`). Không đọc kho mẫu, không gửi
 * gì đi đâu.
 */

/** Mã dòng kiện thứ `index` (0–3) của bản thử: ASCII, không lọt vào giao diện. */
export function tryPackageId(index: number): string {
  return `TRY-${index + 1}`
}

/**
 * Xe của bản thử: lòng thùng và tải trọng khách nhập; cửa sau mở hết lòng thùng, không vật cản, **không trục** — bản thử không hỏi vị trí
 * và giới hạn trục, nên không có số tải trục nào (màn nói rõ điều này).
 */
function tryVehicle({ truck }: TryInput): VehicleConfig {
  const lengthCm = roundCm(truck.lengthCm)
  const widthCm = roundCm(truck.widthCm)
  const heightCm = roundCm(truck.heightCm)
  return {
    id: 'TRY-VEHICLE',
    name: 'TRY',
    innerLengthCm: lengthCm,
    innerWidthCm: widthCm,
    innerHeightCm: heightCm,
    maxPayloadKg: roundKg(truck.payloadKg),
    doorWidthCm: widthCm,
    doorHeightCm: heightCm,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [],
  }
}

/**
 * Dòng kiện theo cùng mặc định của kiện thêm lẻ ở kho kiện (`cargoFromPackage`: giữ đứng, hai hướng đặt, xếp chồng được), mỗi loại một
 * điểm giao khách chọn. Không bắt buộc xếp: hàng vượt tải trọng thành "chưa xếp" kèm lý do thay vì làm hỏng cả lần chạy.
 */
function tryPackages({ cartons }: TryInput): CargoPackage[] {
  return cartons.map((carton, index) => {
    const id = tryPackageId(index)
    const cargo = cargoFromPackage(
      {
        id,
        packageCode: id,
        lengthCm: roundCm(carton.lengthCm),
        widthCm: roundCm(carton.widthCm),
        heightCm: roundCm(carton.heightCm),
        weightKg: roundKg(carton.weightKg),
        handlingClass: 'STANDARD',
      },
      undefined,
      { id, quantity: carton.quantity, deliveryStop: carton.stop },
    )
    return { ...cargo, mustLoad: false }
  })
}

/** Request Spec của bản thử, cùng thiết lập mặc định của màn Thiết lập tối ưu (giữ thứ tự dỡ theo điểm giao, trọng tâm thấp). */
export function buildTryRequest(input: TryInput): OptimizationRequest {
  return { vehicle: tryVehicle(input), packages: tryPackages(input), settings: { ...DEFAULT_SETTINGS } }
}

/** Lỗi của kiện riêng lẻ không chặn lần chạy: bộ tối ưu đưa kiện đó vào "chưa xếp" kèm lý do. */
const PACKAGE_LEVEL = new Set<ConstraintIssue['code']>(['DOOR_TOO_SMALL', 'NO_ALLOWED_ORIENTATION'])

/** Lỗi chặn lần chạy (`validateRequest`, chỉ mức `error`, trừ lỗi riêng của một kiện). Form đã giới hạn số nên thường rỗng. */
export function tryRequestIssues(request: OptimizationRequest): ConstraintIssue[] {
  return validateRequest(request).filter((issue) => issue.severity === 'error' && !PACKAGE_LEVEL.has(issue.code))
}
