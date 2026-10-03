import type { CargoPackage } from '@/domain/models'
import { latestApproved, type Revision, type Trip } from '@/lib/mock-db'

/**
 * Số liệu của các thanh thông báo dưới thanh trên Planner (V2.3, LM-107): chênh kiện phương án ↔ chuyến khi lỗi thời, tiến độ kho khi
 * phương án đã chốt, và bản đã duyệt kho đang đọc khi người dùng mở một revision chưa duyệt. Module thuần, số lấy từ kho.
 */

export type StopDelta = { readonly number: number; readonly plan: number; readonly trip: number }

export type PlanTripDelta = {
  /** Số kiện (đã mở `quantity`) của request đã gửi tối ưu. */
  readonly plan: number
  /** Số kiện chuyến đang có. */
  readonly trip: number
  /** Chỉ những điểm giao có số kiện khác nhau, theo số điểm. */
  readonly stops: readonly StopDelta[]
}

function countByStop(packages: readonly Pick<CargoPackage, 'quantity' | 'deliveryStop'>[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const { quantity, deliveryStop } of packages) counts.set(deliveryStop, (counts.get(deliveryStop) ?? 0) + quantity)
  return counts
}

/** Kiện của phương án (request lúc tối ưu) so với kiện chuyến đang có — phần chênh nói vì sao phương án lỗi thời. */
export function planTripDelta(
  planPackages: readonly Pick<CargoPackage, 'quantity' | 'deliveryStop'>[],
  tripPackages: readonly Pick<CargoPackage, 'quantity' | 'deliveryStop'>[],
): PlanTripDelta {
  const plan = countByStop(planPackages)
  const trip = countByStop(tripPackages)
  const numbers = [...new Set([...plan.keys(), ...trip.keys()])].toSorted((a, b) => a - b)
  const sum = (counts: Map<number, number>) => [...counts.values()].reduce((total, count) => total + count, 0)
  return {
    plan: sum(plan),
    trip: sum(trip),
    stops: numbers
      .map((number) => ({ number, plan: plan.get(number) ?? 0, trip: trip.get(number) ?? 0 }))
      .filter((stop) => stop.plan !== stop.trip),
  }
}

export type WarehouseProgress = {
  /** Kiện kho đã xếp (không tính kiện hỏng bị bỏ lại kho). */
  readonly loaded: number
  /** Kiện của bản duyệt kho đang xếp theo. */
  readonly total: number
  /** ISO 8601 */
  readonly startedAt: string
  readonly startedBy: string | null
}

/** Tiến độ kho của chuyến đã chốt phương án: `null` khi kho chưa bắt đầu. Tổng lấy từ bản duyệt kho chốt lúc bắt đầu xếp. */
export function warehouseProgress(
  trip: Pick<Trip, 'loading'>,
  revisions: readonly Pick<Revision, 'id' | 'result'>[],
): WarehouseProgress | null {
  const { loading } = trip
  if (!loading) return null
  const damaged = loading.steps.filter((step) => step.outcome === 'damaged').length
  const plan = revisions.find((revision) => revision.id === loading.revisionId)
  return {
    loaded: loading.steps.length - damaged,
    total: plan ? plan.result.placements.length : loading.steps.length,
    startedAt: loading.startedAt,
    startedBy: loading.startedBy,
  }
}

/**
 * Bản đã duyệt mới nhất của chuyến khi revision đang xem **chưa duyệt** và khác bản đó — kho và tài xế đọc bản duyệt, không đọc bản
 * đang xem. `null` khi đang xem chính bản đã duyệt, hoặc chuyến chưa có bản duyệt nào.
 */
export function approvedElsewhere<R extends Pick<Revision, 'id' | 'approvedAt'>>(viewedId: string, revisions: readonly R[]): R | null {
  const viewed = revisions.find((revision) => revision.id === viewedId)
  if (!viewed || viewed.approvedAt !== undefined) return null
  const approved = latestApproved(revisions)
  return approved && approved.id !== viewedId ? approved : null
}
