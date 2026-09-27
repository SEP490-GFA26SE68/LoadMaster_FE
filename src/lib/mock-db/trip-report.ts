import { expandPackages } from '@/domain/cargo'
import { roundKg } from '@/domain/geometry'
import { missingIds, plannedStops } from './operations'
import type { DeliveryIssue, Revision, Trip } from './types'

/** Một điểm giao trong báo cáo chuyến. */
export type TripReportStop = {
  number: number
  name: string
  address: string
  /** Kiện của phương án thuộc điểm này (trừ kiện kho báo thiếu). */
  planned: number
  unloaded: number
  /** Kiện dỡ được xác nhận bằng quét QR. */
  qrConfirmed: number
  issues: number
  completedAt: string | null
}

/**
 * Báo cáo chuyến (luồng 5, LM-104) — dữ liệu suy từ chuyến và phương án kho đã xếp, không lưu riêng. Mọi số đếm từ tiến độ kho / giao;
 * thời lượng tính bằng ms giữa hai mốc đã ghi, thiếu mốc thì `null` (không đoán).
 */
export type TripReport = {
  tripId: string
  completed: boolean
  stops: TripReportStop[]
  packages: {
    /** Kiện có trong phương án (đã xếp được). */
    planned: number
    loaded: number
    /** Kho báo thiếu. */
    missing: number
    loadedByQr: number
    delivered: number
    withIssue: number
  }
  weight: { plannedKg: number; deliveredKg: number }
  issues: DeliveryIssue[]
  times: {
    loadingStartedAt: string | null
    loadingCompletedAt: string | null
    deliveryStartedAt: string | null
    deliveryCompletedAt: string | null
  }
  durations: { loadingMs: number | null; deliveryMs: number | null; totalMs: number | null }
  seal: { number: string; at: string } | null
}

function between(from: string | undefined, to: string | undefined): number | null {
  return from === undefined || to === undefined ? null : Date.parse(to) - Date.parse(from)
}

/** `plan`: bản kho làm theo (`trip.loading.revisionId`); chuyến chưa xếp thì `undefined` — báo cáo chỉ còn khung điểm giao. */
export function tripReport(trip: Trip, plan: Pick<Revision, 'request' | 'result'> | undefined): TripReport {
  const planned = plan ? plannedStops(plan) : new Map<string, number>()
  const weightById = new Map(plan ? expandPackages(plan.request.packages).instances.map((i) => [i.packageInstanceId, i.weightKg]) : [])
  const missing = missingIds(trip)
  const delivery = trip.delivery
  const issues = delivery?.issues ?? []
  const unloaded = new Set(delivery?.stops.flatMap((stop) => stop.unloadedIds))
  const weightOf = (ids: Iterable<string>) => roundKg([...ids].reduce((sum, id) => sum + (weightById.get(id) ?? 0), 0))

  const stops = trip.stops.map((stop, index): TripReportStop => {
    const number = index + 1
    const progress = delivery?.stops.find((item) => item.number === number)
    return {
      number,
      name: stop.name,
      address: stop.address,
      planned: [...planned].filter(([id, stopNumber]) => stopNumber === number && !missing.has(id)).length,
      unloaded: progress?.unloadedIds.length ?? 0,
      qrConfirmed: progress?.qrConfirmedIds?.length ?? 0,
      issues: issues.filter((issue) => issue.stopNumber === number).length,
      completedAt: progress?.completedAt ?? null,
    }
  })
  const steps = trip.loading?.steps ?? []
  const loading = trip.loading
  return {
    tripId: trip.id,
    completed: trip.phase === 'completed',
    stops,
    packages: {
      planned: planned.size,
      loaded: steps.filter((step) => step.outcome === 'loaded').length,
      missing: missing.size,
      loadedByQr: steps.filter((step) => step.outcome === 'loaded' && step.via === 'qr').length,
      delivered: unloaded.size,
      withIssue: new Set(issues.flatMap((issue) => (issue.packageInstanceId === undefined ? [] : [issue.packageInstanceId]))).size,
    },
    weight: { plannedKg: weightOf(planned.keys()), deliveredKg: weightOf(unloaded) },
    issues,
    times: {
      loadingStartedAt: loading?.startedAt ?? null,
      loadingCompletedAt: loading?.completedAt ?? null,
      deliveryStartedAt: delivery?.startedAt ?? null,
      deliveryCompletedAt: delivery?.completedAt ?? null,
    },
    durations: {
      loadingMs: between(loading?.startedAt, loading?.completedAt),
      deliveryMs: between(delivery?.startedAt, delivery?.completedAt),
      totalMs: between(loading?.startedAt, delivery?.completedAt),
    },
    seal: loading?.seal ? { number: loading.seal.number, at: loading.seal.at } : null,
  }
}
