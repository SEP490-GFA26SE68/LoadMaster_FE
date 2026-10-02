import { expandPackages } from '@/domain/cargo'
import type { Package } from './package-model'
import { normalizeQrToken } from './qr-token'
import type { TripLabel } from './source-types'
import type { Trip } from './types'

/**
 * Hàm thuần nối kiện kho kiện ↔ kiện của chuyến (LM-104, FE-3b-07). Yêu cầu giao đưa vào chuyến sinh các dòng kiện `PKG-NNN`
 * (FE-4b-01, FE-4b-04); kiện thứ i của dòng là instance thứ i (`PKG-NNN-0i`, cùng cách đặt mã của `expandPackages`). Dòng của yêu cầu
 * bị sửa số lượng sau khi vào chuyến thì mất liên kết với yêu cầu — kho cấp kiện kho kiện riêng cho dòng đó như kiện thêm trong chuyến
 * (hai liên kết cùng `lineId`: của yêu cầu, lệch số lượng nên bị bỏ qua, và của chuyến). Trạng thái kiện **không** suy ở đây: kho ghi
 * thật qua `movePackage` (FE-3b-01).
 */

/**
 * Một dòng kiện của chuyến và các kiện kho kiện của nó: kiện thứ i là instance thứ i của dòng. `requirementId` có khi dòng sinh từ một
 * yêu cầu giao (FE-4b-04) — thay `requirement.assignment` tạm của FE-4b-01. `fromPool`: dòng sinh từ kiện kho kiện đưa thẳng vào chuyến
 * (FE-4b-05) — kiện giữ dữ liệu của chính nó. Vắng cả hai là dòng thêm ngay trong chuyến.
 */
export type TripPackageLink = { lineId: string; packageIds: string[]; requirementId?: string; fromPool?: boolean }

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

/**
 * Nhãn QR của mọi instance trong chuyến (FE-3b-07): mã QR là mã của kiện kho kiện — `links` là mọi liên kết của chuyến (kiện của yêu
 * cầu giao, kiện thêm ngay trong chuyến, kiện đưa thẳng từ kho kiện). Instance chưa có kiện kho kiện (dữ liệu hỏng) không có nhãn.
 */
export function tripLabels(trip: Pick<Trip, 'packages'>, links: readonly TripPackageLink[], pool: ReadonlyMap<string, Pick<Package, 'qrToken'>>): TripLabel[] {
  const poolIdOf = new Map([...lineInstances(links, trip)].map(([packageId, instanceId]) => [instanceId, packageId]))
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
