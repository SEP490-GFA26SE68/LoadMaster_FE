import type { MockDb, Trip } from '@/lib/mock-db'

/**
 * Đưa một chuyến của kho test đi qua các bước vận hành bằng đúng lối của app (FE-6-02 → FE-6-06): mọi kiện đều qua đối chiếu bằng mã
 * QR của nó — kho không còn lối ghi "đã xếp" / "đã dỡ" không đối chiếu. Phiên của kho do nơi gọi đặt.
 */

async function tokens(db: MockDb, tripId: string): Promise<Map<string, string>> {
  return new Map((await db.listTripLabels(tripId)).map((label) => [label.packageInstanceId, label.qrToken]))
}

/** Kiện của phương án kho đang làm theo, theo thứ tự xếp. */
export async function loadingOrder(db: MockDb, tripId: string): Promise<string[]> {
  const trip = await db.getTrip(tripId)
  const plan = await db.getRevision(trip.loading?.revisionId ?? '')
  return plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((placement) => placement.packageInstanceId)
}

/** Kho soạn mọi kiện chưa soạn của chuyến đang xếp, trừ `except`. */
export async function stageAll(db: MockDb, tripId: string, except: readonly string[] = []): Promise<void> {
  const token = await tokens(db, tripId)
  const staged = new Set((await db.getTrip(tripId)).loading?.stagedIds)
  for (const id of await loadingOrder(db, tripId)) {
    if (!staged.has(id) && !except.includes(id)) await db.confirmStagingByQr(tripId, token.get(id) ?? '')
  }
}

/** Kho xếp các kiện chưa có kết quả theo thứ tự xếp, dừng trước kiện `until` (vắng: xếp hết). */
export async function loadAll(db: MockDb, tripId: string, until?: string): Promise<void> {
  const token = await tokens(db, tripId)
  const recorded = new Set((await db.getTrip(tripId)).loading?.steps.map((step) => step.packageInstanceId))
  for (const id of await loadingOrder(db, tripId)) {
    if (id === until) return
    if (!recorded.has(id)) await db.confirmLoadingByQr(tripId, token.get(id) ?? '')
  }
}

/** Chuyến đã duyệt đi tới "Xếp xong — chờ xuất phát": bắt đầu, soạn đủ, xếp đủ, hoàn tất xếp. */
export async function loadTrip(db: MockDb, tripId: string): Promise<Trip> {
  await db.startLoading(tripId)
  await stageAll(db, tripId)
  await loadAll(db, tripId)
  return db.completeLoading(tripId)
}

/** Tài xế đến điểm `stopNumber` rồi dỡ mọi kiện của điểm đó bằng quét, trừ `except`. Không hoàn tất điểm. */
export async function unloadStop(db: MockDb, tripId: string, stopNumber: number, except: readonly string[] = []): Promise<void> {
  await db.arriveAtStop(tripId, stopNumber)
  const trip = await db.getTrip(tripId)
  const leftOut = new Set(trip.loading?.steps.filter((step) => step.outcome === 'damaged').map((step) => step.packageInstanceId))
  const unloaded = new Set(trip.delivery?.stops.find((stop) => stop.number === stopNumber)?.unloadedIds)
  for (const label of await db.listTripLabels(tripId)) {
    const id = label.packageInstanceId
    if (label.deliveryStop !== stopNumber || leftOut.has(id) || unloaded.has(id) || except.includes(id)) continue
    await db.confirmUnloadByQr(tripId, stopNumber, label.qrToken)
  }
}
