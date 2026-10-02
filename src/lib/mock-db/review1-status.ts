import { expandPackages } from '@/domain/cargo'
import type { Package } from './package-model'
import { normalizeQrToken } from './qr-token'
import type { DeliveryRequirement } from './requirement-model'
import type { TripLabel } from './source-types'
import type { Trip } from './types'

/**
 * Hàm thuần nối kiện kho kiện ↔ kiện của chuyến (LM-104, FE-3b-07). Yêu cầu giao đưa vào điểm giao sinh các dòng kiện `PKG-NNN`
 * (FE-4b-01); kiện thứ i của dòng là instance thứ i (`PKG-NNN-0i`, cùng cách đặt mã của `expandPackages`). Dòng của yêu cầu bị sửa số
 * lượng sau khi vào chuyến thì mất liên kết với yêu cầu — kho cấp kiện kho kiện riêng cho dòng đó như kiện thêm trong chuyến. Trạng
 * thái kiện **không** suy ở đây: kho ghi thật qua `movePackage` (FE-3b-01).
 */

/** Một dòng kiện của chuyến và các kiện kho kiện của nó: kiện thứ i là instance thứ i của dòng. */
export type TripPackageLink = { lineId: string; packageIds: string[] }

/** Kiện kho kiện → mã instance của các dòng `lines` trong chuyến; dòng có số lượng khác số kiện đã nối thì bỏ qua (mất liên kết). */
export function lineInstances(lines: readonly TripPackageLink[], trip: Pick<Trip, 'packages'>): Map<string, string> {
  const instances = new Map<string, string>()
  for (const line of lines) {
    const tripLine = trip.packages.find((pkg) => pkg.id === line.lineId)
    if (tripLine?.quantity !== line.packageIds.length) continue
    const width = Math.max(2, String(tripLine.quantity).length)
    line.packageIds.forEach((packageId, index) => instances.set(packageId, `${line.lineId}-${String(index + 1).padStart(width, '0')}`))
  }
  return instances
}

type Assigned = Pick<DeliveryRequirement, 'tripId' | 'assignment'>

/** Kiện kho kiện → mã instance trong chuyến của yêu cầu giao. */
export function assignmentInstances(requirement: Pick<DeliveryRequirement, 'assignment'>, trip: Pick<Trip, 'packages'> | undefined): Map<string, string> {
  return requirement.assignment && trip ? lineInstances(requirement.assignment.lines, trip) : new Map()
}

/**
 * Kiện kho kiện → mã instance của **mọi** kiện trong chuyến (FE-3b-07): kiện vào chuyến qua yêu cầu giao (`requirement.assignment`) và
 * kiện thêm ngay trong chuyến (`own`, kho ghi ở `syncTripPool`).
 */
export function tripInstances(trip: Pick<Trip, 'id' | 'packages'>, requirements: Iterable<Assigned>, own: readonly TripPackageLink[]): Map<string, string> {
  const instances = lineInstances(own, trip)
  for (const requirement of requirements) {
    if (requirement.tripId !== trip.id) continue
    for (const [packageId, instanceId] of assignmentInstances(requirement, trip)) instances.set(packageId, instanceId)
  }
  return instances
}

/**
 * Nhãn QR của mọi instance trong chuyến (FE-3b-07): mã QR là mã của kiện kho kiện — kiện nối từ yêu cầu giao hoặc kiện kho tạo lúc thêm
 * kiện trong chuyến (`own`). Instance chưa có kiện kho kiện (dữ liệu hỏng) không có nhãn.
 */
export function tripLabels(
  trip: Pick<Trip, 'id' | 'packages'>,
  requirements: Iterable<Assigned>,
  pool: ReadonlyMap<string, Pick<Package, 'qrToken'>>,
  own: readonly TripPackageLink[] = [],
): TripLabel[] {
  const poolIdOf = new Map([...tripInstances(trip, requirements, own)].map(([packageId, instanceId]) => [instanceId, packageId]))
  const lineById = new Map(trip.packages.map((pkg) => [pkg.id, pkg]))
  const { instances, packageIdByInstanceId } = expandPackages(trip.packages)
  return instances.flatMap(({ packageInstanceId, deliveryStop }) => {
    const poolPackageId = poolIdOf.get(packageInstanceId)
    const qrToken = poolPackageId === undefined ? undefined : pool.get(poolPackageId)?.qrToken
    if (poolPackageId === undefined || qrToken === undefined) return []
    const packageId = packageIdByInstanceId.get(packageInstanceId) ?? ''
    return [{ packageInstanceId, packageId, name: lineById.get(packageId)?.name ?? packageId, deliveryStop, qrToken, poolPackageId }]
  })
}

/** Nhãn khớp mã quét (so sau khi chuẩn hoá). */
export function labelByToken(labels: readonly TripLabel[], token: string): TripLabel | undefined {
  const wanted = normalizeQrToken(token)
  return labels.find((label) => label.qrToken === wanted)
}
