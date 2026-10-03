import type { z } from 'zod'

/**
 * Mã lỗi của schema domain. Message của mọi issue zod là một mã trong danh sách này,
 * không bao giờ là câu chữ (D-28): UI dịch mã sang câu theo ngôn ngữ (LM-028),
 * test so mã cùng `path` của issue.
 *
 * Quy ước tên `<phạm vi>.<chủ thể>.<quy tắc>`:
 * - phạm vi: thực thể có schema phát ra lỗi (`vehicle`, `obstacle`, `axle`, `package`, `placement`),
 *   hoặc `common` cho lỗi kiểu dữ liệu dùng chung mọi thực thể;
 * - chủ thể: tên trường khi quy tắc chỉ thuộc một trường; tên nhóm khi nhiều trường dùng chung
 *   một quy tắc (`dimension`, `door`, `obstacle`) — lúc đó `path` chỉ ra đúng trường;
 * - quy tắc: tên ngắn camelCase (`min`, `range`, `positive`, `empty`, `notStackable`…).
 */
export const MODEL_ISSUE_CODES = [
  // Kiểu dữ liệu, dùng chung mọi thực thể
  'common.number.invalid', // không phải số hữu hạn: NaN (ô số để trống), ±Infinity, thiếu, sai kiểu
  'common.string.invalid', // không phải chuỗi hoặc thiếu
  'common.boolean.invalid', // không phải true/false hoặc thiếu
  'common.enum.invalid', // giá trị ngoài tập cho phép (hướng đặt, mức dễ vỡ, loại vật cản, trạng thái…)
  'common.array.invalid', // không phải mảng hoặc thiếu
  'common.object.invalid', // không phải đối tượng hoặc thiếu (null ở chỗ cần một dòng dữ liệu)

  // VehicleConfig
  'vehicle.dimension.positive', // innerLength/Width/HeightCm, doorWidth/HeightCm ≤ 0
  'vehicle.maxPayloadKg.positive', // maxPayloadKg ≤ 0
  'vehicle.clearanceCm.nonNegative', // clearanceCm < 0
  'vehicle.floorMaxLoadKg.nonNegative', // floorMaxLoadKg < 0
  'vehicle.floorPressureLimitKgPerCm2.nonNegative', // floorPressureLimitKgPerCm2 < 0
  'vehicle.door.exceedsInner', // doorWidthCm > innerWidthCm hoặc doorHeightCm > innerHeightCm
  'vehicle.obstacle.outsideInterior', // vật cản vượt ra ngoài lòng thùng (path: obstacles[i])
  'vehicle.axleLimitKg.positive', // frontAxleLimitKg / rearAxleLimitKg ≤ 0
  'vehicle.maxCogOffsetRatio.range', // maxCogOffsetRatio ngoài (0, 0,5]

  // VehicleObstacle (path bắt đầu bằng obstacles[i])
  'obstacle.dimension.positive', // lengthCm / widthCm / heightCm ≤ 0
  'obstacle.maxTopLoadKg.nonNegative', // maxTopLoadKg < 0
  'obstacle.maxTopLoadKg.notLoadBearing', // loadBearing = false nhưng maxTopLoadKg > 0

  // VehicleAxle (path bắt đầu bằng axles[i]); đầu vào của mô hình tải trục (FE-5b-03)
  'axle.emptyLoadKg.nonNegative', // emptyLoadKg < 0
  'axle.maxLoadKg.nonNegative', // maxLoadKg < 0

  // CargoPackage
  'package.dimension.positive', // lengthCm / widthCm / heightCm ≤ 0
  'package.weightKg.nonNegative', // weightKg < 0
  'package.quantity.integer', // quantity không phải số nguyên
  'package.quantity.min', // quantity < 1
  'package.allowedOrientations.empty', // không có hướng đặt nào
  'package.allowedOrientations.duplicate', // một mã hướng lặp lại (path: allowedOrientations[lần lặp])
  'package.keepUpright.orientation', // keepUpright = true nhưng cho phép hướng nằm (path: allowedOrientations[i])
  'package.maxTopLoadKg.nonNegative', // maxTopLoadKg < 0
  'package.maxTopLoadKg.notStackable', // stackable = false nhưng maxTopLoadKg > 0
  'package.maxStackCount.integer', // maxStackCount không phải số nguyên
  'package.maxStackCount.min', // maxStackCount < 1
  'package.minSupportRatio.range', // minSupportRatio ngoài [0, 1]
  'package.deliveryStop.integer', // deliveryStop không phải số nguyên
  'package.deliveryStop.min', // deliveryStop < 1

  // PackagePlacement (path bắt đầu bằng placements[i] khi nằm trong OptimizationResult)
  'placement.dimension.positive', // placedLengthCm / placedWidthCm / placedHeightCm ≤ 0
  'placement.supportRatio.range', // supportRatio ngoài [0, 1]
] as const

export type ModelIssueCode = (typeof MODEL_ISSUE_CODES)[number]

/**
 * Tham số cho một kiểm tra trên trường, mang mã đã đăng ký (gõ sai mã là lỗi biên dịch).
 * `abort`: trường đã sai thì các refinement nhiều trường phía trên nó không chạy, nên không có lỗi kéo theo
 * (rộng trong thùng = 0 không sinh thêm `vehicle.door.exceedsInner`). Refinement nhiều trường chỉ thấy dữ liệu hợp lệ từng trường.
 */
export function rule(code: ModelIssueCode) {
  return { error: code, abort: true }
}

/** Ghi một issue từ refinement nhiều trường, `path` tính từ đối tượng đang kiểm. */
export function report(ctx: z.core.$RefinementCtx, code: ModelIssueCode, path: PropertyKey[]) {
  ctx.addIssue({ code: 'custom', message: code, path })
}
