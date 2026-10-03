import { restingOnIds } from '@/domain/constraints'
import type { AuditAction, AuditTargetType } from './audit'
import { addDays, vnTime } from './clock'
import { plannedStops } from './operations'
import type { TripSpec } from './seed-trips'
import type { DeliveryIssue, DeliveryProgress, LoadingProgress, Revision, StopProgress, Trip } from './types'
import type { PackageVerification, VerifyContext } from './verify-model'

/** Một sự kiện seed chưa đánh mã: `seed.ts` sắp theo thời điểm rồi cấp `EV-…`. */
export type SeedEvent = {
  at: string
  actorId: string | null
  action: AuditAction
  target: { type: AuditTargetType; id: string }
  params?: Record<string, string | number>
}

const addSeconds = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString()

/** Thời gian soạn một kiện (quét vào khu chờ) và xếp một kiện trong seed. */
const STAGE_SECONDS = 5
const STEP_SECONDS = 30
/** Tài xế đến điểm giao trước khi hoàn tất điểm đó bấy nhiêu phút. */
const ARRIVAL_LEAD_MINUTES = 25

/** Kiện của phương án theo `loadingOrder` — thứ tự kho làm. */
function loadingSequence(revision: Revision): string[] {
  return revision.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
}

/** Kiện của điểm giao theo `unloadingOrder`, trừ kiện hỏng bị bỏ lại kho. */
function unloadSequence(revision: Revision, stopNumber: number, leftOut: ReadonlySet<string>): string[] {
  const stops = plannedStops(revision)
  return revision.result.placements
    .filter((p) => stops.get(p.packageInstanceId) === stopNumber && !leftOut.has(p.packageInstanceId))
    .toSorted((a, b) => a.unloadingOrder - b.unloadingOrder)
    .map((p) => p.packageInstanceId)
}

/** Các lần đối chiếu của chuyến seed: mọi kiện đều quét QR (D-83), mã `VF-NNN` theo thứ tự ghi. */
function verifier(by: string | null) {
  const entries: PackageVerification[] = []
  return {
    entries,
    add(context: VerifyContext, packageInstanceId: string, at: string, stopNumber?: number) {
      const id = `VF-${String(entries.length + 1).padStart(3, '0')}`
      entries.push({ id, context, ...(stopNumber === undefined ? {} : { stopNumber }), packageInstanceId, method: 'QR', at, by })
    },
  }
}

/**
 * Tiến độ ở kho (FE-6-02, FE-6-05): kho soạn đủ mọi kiện (mỗi kiện 5 giây) rồi xếp từ 05:30 ngày chạy (chuyến hôm nay 04:45), mỗi
 * kiện 30 giây; `loading` chỉ ghi `loadedSteps` bước đầu. `damagedAtStep` là kiện hỏng bị bỏ lại kho — trong phương án không kiện nào
 * tựa lên nó, nên kho xếp tiếp. Mọi kiện đều đối chiếu bằng quét QR.
 */
export function seedLoading(spec: TripSpec, today: string, approved: Revision, events: SeedEvent[]): { loading: LoadingProgress; verifications: PackageVerification[] } {
  const day = addDays(today, spec.day)
  const loadingFrom = vnTime(day, spec.day === 0 ? '04:45' : '05:30')
  const sequence = loadingSequence(approved)
  const startedAt = addSeconds(loadingFrom, -sequence.length * STAGE_SECONDS)
  const verify = verifier(spec.warehouseId)
  sequence.forEach((id, index) => verify.add('STAGING', id, addSeconds(startedAt, (index + 1) * STAGE_SECONDS)))
  const count = spec.outcome === 'loading' ? (spec.loadedSteps ?? 0) : sequence.length
  const steps = sequence.slice(0, count).map((packageInstanceId, index) => {
    const at = addSeconds(loadingFrom, (index + 1) * STEP_SECONDS)
    if (index + 1 === spec.damagedAtStep) return { packageInstanceId, outcome: 'damaged' as const, at }
    verify.add('LOADING', packageInstanceId, at)
    return { packageInstanceId, outcome: 'loaded' as const, at, via: 'qr' as const }
  })
  const target = { type: 'trip' as const, id: spec.id }
  events.push({ at: startedAt, actorId: spec.warehouseId, action: 'loading.started', target, params: { revisionId: approved.id } })
  for (const step of steps.filter((item) => item.outcome === 'damaged')) {
    if (restingOnIds(approved.result.placements, step.packageInstanceId).length > 0) {
      throw new Error(`Chuyến seed ${spec.id}: kiện hỏng ${step.packageInstanceId} có kiện tựa lên trong phương án — chọn bước khác`)
    }
    // Kiện thêm ngay trong chuyến mang mã của bên gửi bằng mã instance (FE-3b-07)
    events.push({ at: step.at, actorId: spec.warehouseId, action: 'loading.damaged', target, params: { packageInstanceId: step.packageInstanceId, packageCode: step.packageInstanceId } })
  }
  const base = { revisionId: approved.id, startedAt, startedBy: spec.warehouseId, stagedIds: sequence, steps }
  if (spec.outcome === 'loading') return { loading: base, verifications: verify.entries }
  const completedAt = addSeconds(loadingFrom, (steps.length + 1) * STEP_SECONDS)
  const damaged = steps.filter((step) => step.outcome === 'damaged').length
  events.push({ at: completedAt, actorId: spec.warehouseId, action: 'loading.completed', target, params: { loaded: steps.length - damaged, damaged } })
  return { loading: { ...base, completedAt }, verifications: verify.entries }
}

/**
 * Tiến độ giao (FE-6-06): xuất phát 20 phút sau khi kho xếp xong (nhật ký giữ đúng thứ tự xếp xong → xuất phát), mỗi điểm hoàn tất sau
 * 70 phút, tài xế bấm "Đã đến" 25 phút trước đó. Điểm đang giao: đã đến, dỡ được nửa số kiện. Mọi kiện dỡ đều quét QR.
 * Hàng hỏng vẫn tính đã dỡ; khách từ chối thì kiện ở lại xe.
 */
export function seedDelivery(spec: TripSpec, trip: Trip, approved: Revision, events: SeedEvent[]): { delivery: DeliveryProgress; verifications: PackageVerification[] } {
  const loadedAt = trip.loading?.completedAt
  if (loadedAt === undefined) throw new Error(`Chuyến seed ${spec.id} giao hàng khi kho chưa xếp xong`)
  const startedAt = addSeconds(loadedAt, 20 * 60)
  const leftOut = new Set(trip.loading?.steps.filter((step) => step.outcome === 'damaged').map((step) => step.packageInstanceId))
  const done = spec.outcome === 'delivering' ? (spec.stopsDone ?? 0) : trip.stops.length
  const actor = spec.driverId
  const target = { type: 'trip' as const, id: spec.id }
  const verify = verifier(actor)
  verify.entries.push(...(trip.verifications ?? []))
  events.push({ at: startedAt, actorId: actor, action: 'delivery.started', target })
  const issues: DeliveryIssue[] = []
  const stops = trip.stops.map((_, index): StopProgress => {
    const number = index + 1
    const items = unloadSequence(approved, number, leftOut)
    const completedAt = addSeconds(startedAt, number * 70 * 60)
    const arrivedAt = addSeconds(completedAt, -ARRIVAL_LEAD_MINUTES * 60)
    // Điểm sau điểm đang giao: xe chưa tới
    if (number > done + 1) return { number, unloadedIds: [] }
    events.push({ at: arrivedAt, actorId: actor, action: 'delivery.arrived', target, params: { stopNumber: number } })
    for (const issueSpec of spec.issues?.filter((issue) => issue.stop === number) ?? []) {
      const packageInstanceId = issueSpec.pick === 'first' ? items[0] : items.at(-1)
      const at = addSeconds(completedAt, -10 * 60)
      issues.push({ id: `ISS-${String(issues.length + 1).padStart(3, '0')}`, stopNumber: number, kind: issueSpec.kind, note: issueSpec.note, at, reportedBy: actor, ...(packageInstanceId ? { packageInstanceId } : {}) })
      events.push({ at, actorId: actor, action: 'delivery.issue', target, params: { kind: issueSpec.kind, stopNumber: number, ...(packageInstanceId ? { packageInstanceId } : {}) } })
    }
    const refused = new Set(issues.filter((issue) => issue.stopNumber === number && issue.kind !== 'damaged').map((issue) => issue.packageInstanceId))
    // Điểm đang giao: đã dỡ nửa số kiện
    const unloadedIds = number <= done ? items.filter((id) => !refused.has(id)) : items.slice(0, Math.floor(items.length / 2))
    // Dỡ xong trong 15 phút đầu sau khi đến, trước lúc báo sự cố và hoàn tất điểm
    const pace = Math.min(20, Math.floor((15 * 60) / Math.max(1, items.length)))
    unloadedIds.forEach((id, order) => verify.add('UNLOADING', id, addSeconds(arrivedAt, (order + 1) * pace), number))
    const progress = { number, unloadedIds, qrConfirmedIds: unloadedIds, arrivedAt }
    if (number > done) return progress
    events.push({ at: completedAt, actorId: actor, action: 'delivery.stopCompleted', target, params: { stopNumber: number } })
    return { ...progress, completedAt }
  })
  if (done < trip.stops.length) return { delivery: { startedAt, startedBy: actor, stops, issues }, verifications: verify.entries }
  const completedAt = stops.at(-1)?.completedAt ?? startedAt
  events.push({ at: completedAt, actorId: actor, action: 'delivery.completed', target, params: { stops: stops.length, issues: issues.length } })
  return { delivery: { startedAt, startedBy: actor, completedAt, stops, issues }, verifications: verify.entries }
}
