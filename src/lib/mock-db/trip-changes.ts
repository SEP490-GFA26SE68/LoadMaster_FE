import type { CargoPackage } from '@/domain/models'
import { sameData } from './db-context'
import type { Trip, TripChanges } from './types'

/** Trường của chuyến có một giá trị đơn, ghi được "trước → sau". */
const SCALAR_TRIP_FIELDS = ['name', 'scheduledDate', 'driverId', 'vehicleId'] as const

/** Trường của một dòng kiện ghi được "trước → sau" (số, chữ). Cờ và danh sách hướng đặt chỉ ghi mã kiện. */
export const PACKAGE_CHANGE_FIELDS = [
  'name', 'lengthCm', 'widthCm', 'heightCm', 'weightKg', 'quantity', 'deliveryStop', 'fragilityLevel', 'maxTopLoadKg', 'priority',
] as const

export type PackageChangeField = (typeof PACKAGE_CHANGE_FIELDS)[number]

type Params = Record<string, string | number>

/**
 * Tham số "trước → sau" của sự kiện `trip.updated` (V2.3, quyết định 2): nhật ký và banner "Cần xem lại" nói **cái gì** đã đổi.
 * Chỉ ghi khi lần sửa đổi đúng một giá trị — một trường đơn của chuyến (`before`, `after`), hoặc một trường của một dòng kiện
 * (`packageId`, `field`, `before`, `after`). Sửa nhiều chỗ một lúc thì chỉ còn tham số `fields` như trước. Không ghi câu hiển thị.
 */
export function tripChangeParams(current: Trip, next: Trip, changed: readonly (keyof TripChanges)[]): Params {
  if (changed.length !== 1) return {}
  const [field] = changed
  if (field === 'packages') return packageChange(current.packages, next.packages)
  if (SCALAR_TRIP_FIELDS.some((scalar) => scalar === field)) {
    const key = field as (typeof SCALAR_TRIP_FIELDS)[number]
    return { before: current[key] ?? '', after: next[key] ?? '' }
  }
  return {}
}

function packageChange(before: readonly CargoPackage[], after: readonly CargoPackage[]): Params {
  if (before.length !== after.length) return {}
  const byId = new Map(before.map((pkg) => [pkg.id, pkg]))
  const diffs: { id: string; key: string; from: unknown; to: unknown }[] = []
  for (const pkg of after) {
    const old = byId.get(pkg.id)
    if (old === undefined) return {}
    const keys = new Set([...Object.keys(old), ...Object.keys(pkg)])
    for (const key of keys) {
      const from: unknown = old[key as keyof CargoPackage]
      const to: unknown = pkg[key as keyof CargoPackage]
      if (!sameData(from, to)) diffs.push({ id: pkg.id, key, from, to })
    }
  }
  const [diff] = diffs
  if (diffs.length !== 1 || diff === undefined) return {}
  const tracked = PACKAGE_CHANGE_FIELDS.some((name) => name === diff.key)
  if (!tracked || !isScalar(diff.from) || !isScalar(diff.to)) return { packageId: diff.id }
  return { packageId: diff.id, field: diff.key, before: diff.from, after: diff.to }
}

function isScalar(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}
