import { expandPackages } from '@/domain/cargo'
import { roundKg } from '@/domain/geometry'
import type { DeadlineStatus } from '@/domain/routing'
import type { TripException, TripReroute } from './exception-model'
import { leftOutIds, plannedStops } from './operations'
import type { Cancellation, DeliveryIssue, Revision, Trip } from './types'
import { latestVerifications, VERIFY_CONTEXTS, VERIFY_METHODS, type ManualConfirm, type PackageVerification, type VerifyContext, type VerifyMethod } from './verify-model'

/** Một điểm giao trong báo cáo chuyến. */
export type TripReportStop = {
  number: number
  name: string
  address: string
  /** Kiện của phương án thuộc điểm này (trừ kiện hỏng bị bỏ lại kho). */
  planned: number
  unloaded: number
  /** Kiện dỡ đối chiếu bằng nhãn (quét hoặc gõ mã). */
  qrConfirmed: number
  /**
   * Kiện của điểm này thành Hoàn trả (D-91): ở lại xe khi tài xế hoàn tất điểm, hoặc chưa giao khi chuyến bị huỷ lúc đang vận chuyển —
   * kể cả kiện đã dỡ ở điểm chưa hoàn tất.
   */
  returned: number
  issues: number
  /** Giờ đến dự kiến của tuyến đã tối ưu; `null` khi chuyến chưa tối ưu tuyến. */
  plannedEta: string | null
  /** Giờ tài xế bấm "Đã đến"; `null` khi chưa đến. */
  arrivedAt: string | null
  /** Hạn giao của điểm (hạn sớm nhất của các yêu cầu ở điểm, kể cả sau khi quản lý gia hạn); `null` khi điểm không có hạn. */
  deadline: string | null
  /** Mức hạn theo giờ đến dự kiến của tuyến; `null` khi điểm không có hạn hoặc chuyến chưa tối ưu tuyến. */
  plannedStatus: DeadlineStatus | null
  /** Đến thật có kịp hạn không; `null` khi chưa đến hoặc điểm không có hạn. */
  arrivedOnTime: boolean | null
  completedAt: string | null
}

/** Một xác nhận tay của chuyến (mức 3, D-83) kèm quyết định của điều phối viên. */
export type TripReportManualConfirm = PackageVerification & { manual: ManualConfirm }

/**
 * Báo cáo chuyến (luồng 5, LM-104; luồng mới FE-6-14) — dữ liệu suy từ chuyến, phương án kho đã xếp và sự cố của chuyến, không lưu
 * riêng. Mọi số đếm từ tiến độ kho / giao; thời lượng tính bằng ms giữa hai mốc đã ghi, thiếu mốc thì `null` (không đoán).
 */
export type TripReport = {
  tripId: string
  completed: boolean
  /** Chuyến đã huỷ: lúc, lý do, pha lúc huỷ. */
  cancellation: Cancellation | null
  stops: TripReportStop[]
  packages: {
    /** Kiện có trong phương án (đã xếp được). */
    planned: number
    /** Kiện kho đã soạn vào khu chờ (FE-6-02). */
    staged: number
    loaded: number
    /** Kiện hỏng lúc xếp, bị bỏ lại kho (FE-6-05). */
    damaged: number
    loadedByQr: number
    /** Kiện đã giao: đã dỡ; chuyến bị huỷ lúc đang vận chuyển thì chỉ tính kiện của điểm đã hoàn tất. */
    delivered: number
    /** Tổng kiện Hoàn trả của các điểm. */
    returned: number
    withIssue: number
  }
  /** Số kiện theo cách đối chiếu có hiệu lực (lần mới nhất của từng kiện) ở từng bước: soạn, xếp, dỡ (FE-6-03). */
  verifications: Record<VerifyContext, Record<VerifyMethod, number>>
  /** Mọi xác nhận tay còn trong chuyến, theo thứ tự ghi. */
  manualConfirms: TripReportManualConfirm[]
  weight: { plannedKg: number; deliveredKg: number }
  issues: DeliveryIssue[]
  /** Sự cố cấp chuyến (FE-6-11), cũ trước — kèm chuyển quản lý, gia hạn, xử lý. */
  exceptions: TripException[]
  /** Tuyến thay thế điều phối viên đã chọn, cũ trước. */
  reroutes: TripReroute[]
  /** Lý do cho chở chung kiện khác loại hàng (D-74); `null` khi chuyến không vượt luật phân tách. */
  overrideReason: string | null
  times: {
    loadingStartedAt: string | null
    loadingCompletedAt: string | null
    deliveryStartedAt: string | null
    deliveryCompletedAt: string | null
  }
  durations: { loadingMs: number | null; deliveryMs: number | null; totalMs: number | null }
  seal: { number: string; at: string } | null
}

/** Sự cố cấp chuyến và tuyến đã đổi của chuyến — kho giữ ngoài `Trip`. */
export type TripReportIncidents = { exceptions?: readonly TripException[]; reroutes?: readonly TripReroute[] }

function between(from: string | undefined, to: string | undefined): number | null {
  return from === undefined || to === undefined ? null : Date.parse(to) - Date.parse(from)
}

function verificationCounts(trip: Trip): TripReport['verifications'] {
  const empty = () => Object.fromEntries(VERIFY_METHODS.map((method) => [method, 0])) as Record<VerifyMethod, number>
  const counts = Object.fromEntries(VERIFY_CONTEXTS.map((context) => [context, empty()])) as TripReport['verifications']
  for (const context of VERIFY_CONTEXTS) {
    for (const entry of latestVerifications(trip, context).values()) counts[context][entry.method] += 1
  }
  return counts
}

/** `plan`: bản kho làm theo (`trip.loading.revisionId`); chuyến chưa xếp thì `undefined` — báo cáo chỉ còn khung điểm giao. */
export function tripReport(trip: Trip, plan: Pick<Revision, 'request' | 'result'> | undefined, incidents: TripReportIncidents = {}): TripReport {
  const planned = plan ? plannedStops(plan, trip.stops) : new Map<string, number>()
  const weightById = new Map(plan ? expandPackages(plan.request.packages).instances.map((i) => [i.packageInstanceId, i.weightKg]) : [])
  const leftOut = leftOutIds(trip)
  const delivery = trip.delivery
  const issues = delivery?.issues ?? []
  const cancelledInTransit = trip.cancellation?.fromPhase === 'delivering'
  const weightOf = (ids: Iterable<string>) => roundKg([...ids].reduce((sum, id) => sum + (weightById.get(id) ?? 0), 0))
  const delivered = new Set<string>()

  const stops = trip.stops.map((stop, index): TripReportStop => {
    const number = index + 1
    const progress = delivery?.stops.find((item) => item.number === number)
    const items = [...planned].filter(([id, stopNumber]) => stopNumber === number && !leftOut.has(id)).map(([id]) => id)
    const unloaded = new Set(progress?.unloadedIds)
    const settled = progress?.completedAt !== undefined
    if (settled || !cancelledInTransit) for (const id of unloaded) delivered.add(id)
    const route = trip.routePlan?.stops.find((item) => item.stopId === stop.id)
    const arrivedAt = progress?.arrivedAt ?? null
    return {
      number,
      name: stop.name,
      address: stop.address,
      planned: items.length,
      unloaded: unloaded.size,
      qrConfirmed: progress?.qrConfirmedIds?.length ?? 0,
      returned: settled ? items.filter((id) => !unloaded.has(id)).length : cancelledInTransit && delivery ? items.length : 0,
      issues: issues.filter((issue) => issue.stopNumber === number).length,
      plannedEta: route?.eta ?? null,
      arrivedAt,
      deadline: stop.deadline ?? null,
      plannedStatus: route?.deadlineStatus ?? null,
      arrivedOnTime: arrivedAt === null || stop.deadline === undefined ? null : Date.parse(arrivedAt) <= Date.parse(stop.deadline),
      completedAt: progress?.completedAt ?? null,
    }
  })
  const steps = trip.loading?.steps ?? []
  const loading = trip.loading
  return {
    tripId: trip.id,
    completed: trip.phase === 'completed',
    cancellation: trip.cancellation ?? null,
    stops,
    packages: {
      planned: planned.size,
      staged: loading?.stagedIds.length ?? 0,
      loaded: steps.filter((step) => step.outcome === 'loaded').length,
      damaged: leftOut.size,
      loadedByQr: steps.filter((step) => step.outcome === 'loaded' && step.via === 'qr').length,
      delivered: delivered.size,
      returned: stops.reduce((sum, stop) => sum + stop.returned, 0),
      withIssue: new Set(issues.flatMap((issue) => (issue.packageInstanceId === undefined ? [] : [issue.packageInstanceId]))).size,
    },
    verifications: verificationCounts(trip),
    manualConfirms: (trip.verifications ?? []).flatMap((entry) => (entry.manual === undefined ? [] : [{ ...entry, manual: entry.manual }])),
    weight: { plannedKg: weightOf(planned.keys()), deliveredKg: weightOf(delivered) },
    issues,
    exceptions: [...(incidents.exceptions ?? [])],
    reroutes: [...(incidents.reroutes ?? [])],
    overrideReason: trip.overrideReason ?? null,
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
