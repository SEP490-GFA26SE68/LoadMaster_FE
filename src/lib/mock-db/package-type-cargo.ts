import { cargoPackageSchema, type CargoPackage } from '@/domain/models'
import type { PackageTypeInput } from './source-types'

/** Tỷ lệ đỡ tối thiểu của kiện đăng ký — loại kiện không khai trường này, dùng như hàng tạp hoá của seed. */
const DEFAULT_MIN_SUPPORT_RATIO = 0.8

/**
 * Dòng kiện của chuyến dựng từ loại kiện (LM-104): mọi trường xếp hàng lấy từ loại kiện, phần còn lại mặc định (ưu tiên 1, bắt buộc
 * xếp). `groupId` giữ mã đơn hàng để truy ngược kiện về đơn.
 */
export function cargoFromType(
  type: PackageTypeInput,
  line: { id: string; quantity: number; deliveryStop: number; groupId?: string },
): CargoPackage {
  return {
    id: line.id,
    name: type.name,
    lengthCm: type.lengthCm,
    widthCm: type.widthCm,
    heightCm: type.heightCm,
    weightKg: type.weightKg,
    quantity: line.quantity,
    allowedOrientations: [...type.allowedOrientations],
    keepUpright: type.keepUpright,
    fragilityLevel: type.fragilityLevel,
    stackable: type.stackable,
    maxTopLoadKg: type.maxTopLoadKg,
    ...(type.maxStackCount === undefined ? {} : { maxStackCount: type.maxStackCount }),
    minSupportRatio: DEFAULT_MIN_SUPPORT_RATIO,
    deliveryStop: line.deliveryStop,
    priority: 1,
    mustLoad: true,
    ...(line.groupId === undefined ? {} : { groupId: line.groupId }),
  }
}

/** Mã issue (`package.*`) của loại kiện, kiểm bằng chính schema kiện Spec: loại kiện hợp lệ thì kiện đăng ký theo nó hợp lệ. */
export function packageTypeIssues(input: PackageTypeInput): string[] {
  const result = cargoPackageSchema.safeParse(cargoFromType(input, { id: 'PT', quantity: 1, deliveryStop: 1 }))
  const codes = result.success ? [] : result.error.issues.map((issue) => issue.message)
  if (input.name.trim() === '') codes.unshift('packageType.name.required')
  return [...new Set(codes)]
}
