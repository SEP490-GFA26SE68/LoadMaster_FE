import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { DeadlineRenegotiationInput, TripExceptionInput } from '@/lib/mock-db'
import { confirmReroute, escalateTripException, renegotiateDeadline, reportTripException, requestReroute, resolveTripException } from './exceptions-api'
import { fetchMonitoringBoard, getLocationHistory, subscribeTrip } from './monitoring-api'

/**
 * Hook Query của màn Giám sát (FE-6-10 → FE-6-12). Vị trí, ETA và sự cố đọc theo nhịp của kho ở `useTrackingQuery.ts`
 * (`useFleetMonitoringQuery`); ở đây là phần ít đổi (tên chuyến, xe, tài xế, điểm giao), lịch sử vị trí của chuyến đang chọn và các
 * lệnh ghi. Mọi khoá nằm dưới `['trips']`: ghi của chuyến ở màn khác (tài xế hoàn tất điểm, chuyến giao xong) làm mới chúng.
 */
export function useMonitoringBoardQuery() {
  return useQuery({ queryKey: ['trips', 'monitoring-board'], queryFn: fetchMonitoringBoard, staleTime: 0 })
}

const historyKey = (tripId: string) => ['trips', tripId, 'location-history']

/** Lịch sử vị trí của một chuyến. Không tự hẹn giờ: `useTripChannel` làm mới nó khi chuyến có điểm vị trí mới. */
export function useLocationHistoryQuery(tripId: string) {
  return useQuery({ queryKey: historyKey(tripId), queryFn: () => getLocationHistory(tripId), enabled: tripId !== '', staleTime: 0 })
}

/**
 * Nghe kênh cập nhật của một chuyến (`subscribeTrip`) suốt lúc thành phần còn trên màn: có điểm vị trí mới thì làm mới lịch sử vị
 * trí; chuyến kết thúc thì làm mới bảng giám sát. Không có đồng hồ hẹn giờ nào ở đây — gỡ thành phần là thôi nghe.
 */
export function useTripChannel(tripId: string) {
  const client = useQueryClient()
  useEffect(() => {
    if (tripId === '') return
    return subscribeTrip(tripId, (event) => {
      if (event.type === 'LocationUpdate') void client.invalidateQueries({ queryKey: historyKey(tripId) })
      else if (event.type === 'TripCompleted') void client.invalidateQueries({ queryKey: ['trips', 'monitoring-board'] })
    })
  }, [client, tripId])
}

/** Sự cố đổi thì vị trí, ETA, chuông và — khi quản lý gia hạn — yêu cầu giao đều đổi theo. */
function refresh(client: QueryClient) {
  return Promise.all([['trips'], ['notifications'], ['requirements'], ['dashboard']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useReportExceptionMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: TripExceptionInput) => reportTripException(tripId, input), onSettled: () => refresh(client) })
}

export function useEscalateExceptionMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (exceptionId: string) => escalateTripException(tripId, exceptionId), onSettled: () => refresh(client) })
}

export function useResolveExceptionMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (exceptionId: string) => resolveTripException(tripId, exceptionId), onSettled: () => refresh(client) })
}

/** "Tìm tuyến khác" là một lệnh ghi (kho giữ lần tìm gần nhất để xác nhận), không phải truy vấn có cache. */
export function useRequestRerouteMutation(tripId: string) {
  return useMutation({ mutationFn: () => requestReroute(tripId) })
}

export function useConfirmRerouteMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (routeIndex: number) => confirmReroute(tripId, routeIndex), onSettled: () => refresh(client) })
}

export function useRenegotiateDeadlineMutation(tripId: string, exceptionId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: DeadlineRenegotiationInput) => renegotiateDeadline(tripId, exceptionId, input), onSettled: () => refresh(client) })
}
