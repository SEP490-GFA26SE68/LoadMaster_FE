import { roundKg } from '@/domain/geometry'
import { cargoPackageSchema, type CargoPackage, type HandlingClass } from '@/domain/models'
import type { Package } from './package-model'
import type { PackageTypeInput } from './source-types'

/** Tỷ lệ đỡ tối thiểu của kiện — loại kiện không khai trường này, dùng như hàng tạp hoá của seed. */
const DEFAULT_MIN_SUPPORT_RATIO = 0.8

/**
 * Dòng kiện của chuyến dựng từ loại kiện (LM-104): mọi trường xếp hàng lấy từ loại kiện, phần còn lại mặc định (ưu tiên 1, bắt buộc
 * xếp). `groupId` giữ mã yêu cầu giao để truy ngược kiện về yêu cầu.
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

/** Kiện không có loại kiện chịu được ba kiện nặng như nó đặt lên trên. */
const DEFAULT_TOP_LOAD_FACTOR = 3

type CargoLine = { id: string; quantity: number; deliveryStop: number; groupId?: string }

/**
 * Dòng kiện Spec dựng từ một kiện của kho kiện (FE-3b-04, D-69): kích thước, khối lượng và loại hàng của chính kiện. Ràng buộc xếp
 * (hướng đặt, giữ đứng, xếp chồng, tải trên, độ dễ vỡ) lấy từ `packageType` khi có; không có thì mặc định theo loại hàng — `FRAGILE`
 * không cho kiện khác đè lên, loại khác xếp như hàng thường. `line` vắng là một kiện ở điểm giao 1, mã dòng là mã kiện.
 */
export function cargoFromPackage(
  pkg: Pick<Package, 'id' | 'packageCode' | 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'handlingClass'>,
  packageType?: PackageTypeInput,
  line: CargoLine = { id: pkg.id, quantity: 1, deliveryStop: 1 },
): CargoPackage {
  const fragile = pkg.handlingClass === 'FRAGILE'
  const stacking: PackageTypeInput = packageType ?? {
    name: pkg.packageCode,
    lengthCm: pkg.lengthCm,
    widthCm: pkg.widthCm,
    heightCm: pkg.heightCm,
    weightKg: pkg.weightKg,
    fragilityLevel: fragile ? 'HIGH' : 'NONE',
    allowedOrientations: ['LWH', 'WLH'],
    keepUpright: true,
    stackable: !fragile,
    maxTopLoadKg: fragile ? 0 : roundKg(pkg.weightKg * DEFAULT_TOP_LOAD_FACTOR),
  }
  return {
    ...cargoFromType({ ...stacking, lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm, weightKg: pkg.weightKg }, line),
    handlingClass: pkg.handlingClass,
  }
}

/** Loại hàng của kiện tạo theo một loại kiện: loại kiện dễ vỡ nhất (`HIGH`) là hàng dễ vỡ, còn lại hàng thường. */
export function handlingClassOfType(type: Pick<PackageTypeInput, 'fragilityLevel'>): HandlingClass {
  return type.fragilityLevel === 'HIGH' ? 'FRAGILE' : 'STANDARD'
}

/** Mã issue (`package.*`) của loại kiện, kiểm bằng chính schema kiện Spec: loại kiện hợp lệ thì kiện theo nó hợp lệ. */
export function packageTypeIssues(input: PackageTypeInput): string[] {
  const result = cargoPackageSchema.safeParse(cargoFromType(input, { id: 'PT', quantity: 1, deliveryStop: 1 }))
  const codes = result.success ? [] : result.error.issues.map((issue) => issue.message)
  if (input.name.trim() === '') codes.unshift('packageType.name.required')
  return [...new Set(codes)]
}
