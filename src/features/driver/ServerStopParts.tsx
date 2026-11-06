import { useMemo } from 'react'
import { CargoPositionDialog } from './CargoPositionDialog'
import type { UnplacedPickup } from './driver-pickups'
import { driverServerScene } from './driver-server-scene'
import { serverStopTiming } from './server-stop-timing'
import { StopTimingFacts } from './StopEta'
import { useDriverLoadPlanQuery, useDriverStopTimesQuery } from './useDriverQueries'

/**
 * Giờ đến và hạn giao của điểm đang giao theo máy chủ, trong thẻ liên hệ — cùng bố cục với `StopEta` của kho mẫu: đã đến thì giờ đến thật
 * và kịp / trễ hạn, chưa đến thì giờ đến dự kiến từ GPS (không có GPS thì giờ kế hoạch của tuyến). Máy chủ tính nên không kèm MOCK RESULT;
 * đọc lại theo `refreshMs` máy chủ trả. Máy chủ chưa trả điểm này (đang đọc, lỗi) thì không có phần giờ.
 */
export function ServerStopEta({ tripId, stopNumber }: { tripId: string; stopNumber: number }) {
  const query = useDriverStopTimesQuery(tripId)
  const stop = query.data?.stops.find((entry) => entry.number === stopNumber)
  if (!query.data || !stop) return null
  return <StopTimingFacts timing={serverStopTiming(stop, query.data.location)} mock={false} />
}

/** Máy chủ chưa có nhận hàng dọc đường: không có kiện nhận nào cạnh khung. */
const NO_PICKUP_CARGO: readonly UnplacedPickup[] = []

/**
 * "Xem vị trí hàng" theo phương án kho đã xếp của máy chủ (`driverServerScene`): kiện đã dỡ ở các điểm trước và điểm này mờ như đã gỡ.
 * Máy chủ không trả đủ để vẽ đúng (chưa khai lòng thùng, kiện thiếu điểm giao, chưa có phương án đã xếp) thì không có nút — không vẽ khung sai.
 */
export function ServerCargoPosition({ tripId, stopNumber }: { tripId: string; stopNumber: number }) {
  const query = useDriverLoadPlanQuery(tripId)
  const scene = useMemo(() => (query.data ? driverServerScene(query.data) : null), [query.data])
  if (scene === null) return null
  return <CargoPositionDialog model={scene.model} stopNumber={stopNumber} doneIds={scene.doneIds} pickupCargo={NO_PICKUP_CARGO} />
}
