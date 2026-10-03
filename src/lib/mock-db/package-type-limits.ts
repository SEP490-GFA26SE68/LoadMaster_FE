import { gt, isUpright, ORIENTATION_CODES } from '@/domain/geometry'
import type { OrientationCode } from '@/domain/models'
import type { PackageTypeInput, PackageTypeLimits } from './source-types'

/** Các trường Spec mà ba trường của backend ánh xạ sang (FE-5b-01). */
export type PackageTypeStacking = Pick<PackageTypeInput, 'maxTopLoadKg' | 'stackable' | 'allowedOrientations' | 'fragilityLevel'>

/** Hướng đặt gốc của kiện: dài theo chiều dài thùng, không xoay. */
const BASE_ORIENTATION: OrientationCode = 'LWH'

/**
 * `rotationAllowed` → `allowedOrientations`: không cho xoay thì chỉ hướng gốc `LWH`; cho xoay thì mọi hướng, riêng kiện giữ thẳng đứng
 * chỉ hai hướng đứng (`LWH`, `WLH`). Giữ thứ tự chuẩn của Spec.
 */
export function orientationsFor(rotationAllowed: boolean, keepUpright: boolean): OrientationCode[] {
  if (!rotationAllowed) return [BASE_ORIENTATION]
  return keepUpright ? ORIENTATION_CODES.filter(isUpright) : [...ORIENTATION_CODES]
}

/**
 * Backend → Spec: `maxStackWeightKg` thành `maxTopLoadKg` (0 kg là không xếp chồng), `rotationAllowed` thành `allowedOrientations`,
 * `fragile` thành `fragilityLevel` (`HIGH` — mức mà `handlingClassOfType` coi là hàng dễ vỡ — hoặc `NONE`).
 */
export function specFieldsOf(limits: PackageTypeLimits, { keepUpright }: { keepUpright: boolean }): PackageTypeStacking {
  return {
    maxTopLoadKg: limits.maxStackWeightKg,
    stackable: gt(limits.maxStackWeightKg, 0),
    allowedOrientations: orientationsFor(limits.rotationAllowed, keepUpright),
    fragilityLevel: limits.fragile ? 'HIGH' : 'NONE',
  }
}

/**
 * Spec → backend, phép chiếu thô: tải trên của loại không xếp chồng là 0; "cho xoay" khi có hơn một hướng đặt; "dễ vỡ" khi mức dễ vỡ
 * là `HIGH`. Đi một vòng `backendLimitsOf(specFieldsOf(x))` trả lại đúng `x`.
 */
export function backendLimitsOf(type: PackageTypeStacking): PackageTypeLimits {
  return {
    maxStackWeightKg: type.stackable ? type.maxTopLoadKg : 0,
    rotationAllowed: type.allowedOrientations.length > 1,
    fragile: type.fragilityLevel === 'HIGH',
  }
}
