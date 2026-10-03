import type { DeadlineStatus, LiveStopEta, VehicleFix } from '@/domain/routing'

/**
 * Vị trí xe và ETA trực tiếp của chuyến đang vận chuyển (FE-6-08, FE-6-09, D-85). Khi chưa có backend mọi thứ ở đây nằm trong kho của
 * tab đang mở (D-95).
 */

/** Nguồn của một điểm vị trí: xe mô phỏng của kho, hoặc GPS thật từ điện thoại tài xế (FE-6-13). */
export const LOCATION_SOURCES = ['SIMULATED', 'GPS'] as const
export type LocationSource = (typeof LOCATION_SOURCES)[number]

/** Một điểm vị trí của xe; `recordedAt` theo đồng hồ của kho. */
export type LocationPoint = VehicleFix & { source: LocationSource }

/** Lịch sử vị trí giữ tối đa chừng này điểm mỗi chuyến; điểm cũ hơn bị cắt. */
export const MAX_LOCATION_POINTS = 2000

/** Vị trí điện thoại tài xế gửi lên; kho ghi giờ nhận theo đồng hồ của mình. Tốc độ và hướng vắng là 0. */
export type DriverLocationInput = { lat: number; lng: number; speedKmh?: number; heading?: number }

/** ETA trực tiếp của một điểm chưa hoàn tất: số điểm (1-based), giờ đến dự kiến tính từ vị trí xe, hạn và mức hạn. */
export type TripLiveStop = LiveStopEta & { number: number; deadline?: string }

/** Mức hạn đáng báo: sát hạn hoặc trễ hạn dự kiến. */
export type EtaRiskStatus = Exclude<DeadlineStatus, 'OK'>

/** Một lần mức hạn của một điểm xấu đi (sự kiện `ETA_RISK` của backend) — kho đã ghi thành sự kiện nhật ký `eventId`. */
export type EtaRiskAlert = {
  eventId: string
  /** Lúc kho ghi sự kiện, ISO 8601. */
  at: string
  tripId: string
  stopId: string
  stopNumber: number
  status: EtaRiskStatus
  eta: string
  deadline: string
}

/** Giám sát một chuyến: vị trí mới nhất, ETA trực tiếp của các điểm chưa hoàn tất và các cảnh báo nguy cơ trễ đã phát. */
export type TripMonitoring = {
  tripId: string
  /** `null` khi xe chưa xuất phát, hoặc tuyến còn điểm chưa có toạ độ nên không có vị trí. */
  location: LocationPoint | null
  /** Theo thứ tự đi; rỗng khi không có vị trí hoặc chuyến đã giao xong. */
  stops: TripLiveStop[]
  /** Cũ trước. */
  alerts: EtaRiskAlert[]
  /** Số ms **thật** tới điểm vị trí kế tiếp (ít nhất 1 giây); `null` khi chuyến không còn chạy — màn không cần làm mới nữa. */
  refreshMs: number | null
  /** Vị trí mô phỏng và ETA đều là kết quả mock (công thức D-76). */
  isMockResult: true
}

/** Phần kho giữ cho mỗi chuyến đã xuất phát. */
export type TripTracking = {
  /** Cũ trước, tối đa `MAX_LOCATION_POINTS`. */
  points: LocationPoint[]
  /** Số thứ tự của điểm vị trí mô phỏng kế tiếp (điểm 0 là lúc xuất phát). */
  nextSlot: number
  /** Mức hạn gần nhất đã tính của từng điểm có hạn, theo mã điểm. */
  statuses: Record<string, DeadlineStatus>
  /** ETA trực tiếp tính ở điểm vị trí mới nhất. */
  live: TripLiveStop[]
  alerts: EtaRiskAlert[]
  /** Đang nhận GPS thật: xe mô phỏng không ghi điểm nào trước mốc này (epoch ms theo đồng hồ của kho). */
  gpsUntilMs: number
}
