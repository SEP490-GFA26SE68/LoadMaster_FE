import type { TripStatus } from '@/types/trip'

/**
 * Chi tiết chuyến đang xếp hàng hoặc đang vận chuyển đổi theo việc của kho và tài xế ở thiết bị khác (tiến độ xếp, giao, xác nhận tay,
 * báo thiếu): đọc lại mỗi 30 giây và khi cửa sổ được focus lại. Trạng thái khác thì không có nhịp nào.
 */
export const LIVE_TRIP_REFRESH_MS = 30_000

export function isLiveTripStatus(status: TripStatus | undefined | null): boolean {
  return status === 'LOADING' || status === 'IN_TRANSIT'
}

/** Giá trị `refetchInterval` của TanStack Query theo trạng thái chuyến đọc được. */
export function liveTripRefetchInterval(status: TripStatus | undefined | null): number | false {
  return isLiveTripStatus(status) ? LIVE_TRIP_REFRESH_MS : false
}
