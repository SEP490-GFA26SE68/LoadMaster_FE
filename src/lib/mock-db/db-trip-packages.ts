import type { CargoPackage } from '@/domain/models'
import { nextId, put, sameData, type DbContext } from './db-context'
import { movePackage } from './db-packages'
import type { Package } from './package-model'
import type { TripPackageLink } from './review1-status'
import type { Trip } from './types'

/**
 * Kiện thêm ngay trong chuyến tự vào kho kiện (FE-3b-07, D-68): mỗi instance của một dòng kiện (`quantity`) là một bản ghi kho kiện
 * nguồn `TRIP`, trạng thái `ASSIGNED`, có mã QR cấp ngay — nhãn in được và quét được khi xếp, dỡ như mọi kiện khác. Kho gọi sau mỗi lần
 * ghi dòng kiện hay điểm giao của chuyến còn lập kế hoạch:
 *
 * - dòng mới, hoặc tăng số lượng: tạo thêm kiện cho các instance còn thiếu;
 * - giảm số lượng: các kiện cuối dòng về `IMPORTED`, rời chuyến và điểm giao; xoá dòng: mọi kiện của dòng về `IMPORTED`;
 * - sửa kích thước, khối lượng, loại hàng hay điểm giao của dòng: kiện của dòng đổi theo, mã QR giữ nguyên.
 *
 * Dòng của yêu cầu giao đã có kiện kho kiện của yêu cầu nên bỏ qua — trừ khi bị sửa số lượng (mất liên kết với yêu cầu), lúc đó dòng được cấp kiện
 * riêng như dòng nhập tay. Không ghi sự kiện nhật ký riêng: `trip.created` / `trip.updated` đã nói việc đổi kiện của chuyến.
 */

type LineFields = Pick<Package, 'packageCode' | 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'handlingClass' | 'destination' | 'stopId'>

/** Trường kho kiện của instance thứ `index` (từ 0) của dòng: mã của bên gửi là mã instance, điểm đến là địa chỉ điểm giao của dòng. */
function lineFields(trip: Trip, line: CargoPackage, index: number): LineFields {
  const stop = trip.stops[line.deliveryStop - 1]
  const width = Math.max(2, String(line.quantity).length)
  return {
    packageCode: `${line.id}-${String(index + 1).padStart(width, '0')}`,
    lengthCm: line.lengthCm,
    widthCm: line.widthCm,
    heightCm: line.heightCm,
    weightKg: line.weightKg,
    handlingClass: line.handlingClass ?? 'STANDARD',
    destination: stop?.address.trim() || stop?.name.trim() || trip.name,
    stopId: stop?.id,
  }
}

/** Dòng kiện đang nối đủ với một yêu cầu giao: kiện kho kiện của yêu cầu là kiện của dòng. */
function requirementLines(ctx: DbContext, trip: Trip): Set<string> {
  const quantityOf = new Map(trip.packages.map((line) => [line.id, line.quantity]))
  const linked = new Set<string>()
  for (const requirement of ctx.state.requirements.values()) {
    if (requirement.tripId !== trip.id || !requirement.assignment) continue
    for (const line of requirement.assignment.lines) if (quantityOf.get(line.lineId) === line.packageIds.length) linked.add(line.lineId)
  }
  return linked
}

/** `newId`: seed cấp mã riêng cho kiện của chuyến seed; mặc định mã `PK-NNNN` kế tiếp của kho. */
export function syncTripPool(ctx: DbContext, trip: Trip, options: { newId?: () => string } = {}): void {
  const { packages, tripPackageLinks } = ctx.state
  const at = ctx.nowIso()
  const actorId = ctx.state.session.userId
  let taken: Set<string> | undefined
  let lastNumber: number | undefined
  const newId = options.newId ?? (() => {
    lastNumber = (lastNumber ?? Number(nextId('PK', packages.keys()).slice(3)) - 1) + 1
    return `PK-${String(lastNumber).padStart(4, '0')}`
  })

  function release(packageId: string) {
    const pkg = packages.get(packageId)
    if (pkg?.tripId === trip.id && pkg.status !== 'IMPORTED') movePackage(ctx, pkg, 'IMPORTED')
  }

  function create(fields: LineFields): string {
    taken ??= ctx.qrTokensInUse()
    const { stopId, ...rest } = fields
    const created: Package = {
      id: newId(), companyId: trip.companyId, qrToken: ctx.newQrToken(taken), ...rest, status: 'IMPORTED', flags: [], source: 'TRIP',
      createdAt: at, createdBy: actorId, history: [{ at, actorId, kind: 'created', source: 'TRIP' }],
    }
    return movePackage(ctx, created, 'ASSIGNED', { tripId: trip.id, ...(stopId === undefined ? {} : { stopId }) }).id
  }

  /** Kiện còn trong chuyến đổi theo dòng; kiện đã rời chuyến (báo thiếu, chuyến huỷ) đứng yên. */
  function update(packageId: string, fields: LineFields) {
    const pkg = packages.get(packageId)
    if (pkg?.tripId !== trip.id || pkg.status !== 'ASSIGNED') return
    const { stopId: _stop, ...rest } = pkg
    const next: Package = { ...rest, ...fields }
    if (next.stopId === undefined) delete next.stopId
    if (!sameData(next, pkg)) put(packages, next)
  }

  const before = tripPackageLinks.get(trip.id) ?? []
  const viaRequirement = requirementLines(ctx, trip)
  const next: TripPackageLink[] = []
  for (const line of trip.packages) {
    if (viaRequirement.has(line.id)) continue
    const existing = before.find((link) => link.lineId === line.id)?.packageIds ?? []
    existing.slice(line.quantity).forEach(release)
    const packageIds = Array.from({ length: line.quantity }, (_, index) => {
      const fields = lineFields(trip, line, index)
      const packageId = existing[index]
      if (packageId === undefined) return create(fields)
      update(packageId, fields)
      return packageId
    })
    next.push({ lineId: line.id, packageIds })
  }
  const kept = new Set(next.map((link) => link.lineId))
  for (const link of before) if (!kept.has(link.lineId)) link.packageIds.forEach(release)
  if (next.length > 0) tripPackageLinks.set(trip.id, next)
  else tripPackageLinks.delete(trip.id)
}

/** Kiện kho kiện của các dòng thêm ngay trong chuyến `tripId`. */
export function ownTripLinks(ctx: DbContext, tripId: string): readonly TripPackageLink[] {
  return ctx.state.tripPackageLinks.get(tripId) ?? []
}
