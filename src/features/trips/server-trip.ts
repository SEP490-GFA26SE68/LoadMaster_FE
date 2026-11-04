import type { TripStatus } from '@/types/trip'

/**
 * Chuyến của Chi tiết chuyến khi nhóm `trips` đọc backend (`fetchServerTrip`): chỉ những gì máy chủ trả — không có phương án, kiện
 * hay tiến độ kho như `TripDetail` của kho mẫu.
 */

/** Trạng thái điểm giao của backend: `ARRIVED` là điểm đang giao (backend đặt ngay khi tài xế hoàn tất điểm trước), không phải "xe đã tới". */
export type ServerTripStopStatus = 'PENDING' | 'ARRIVED' | 'COMPLETED'

export type ServerTripStop = {
  readonly id: string
  /** Thứ tự đi, từ 1. */
  readonly number: number
  readonly name: string
  readonly address: string
  readonly lat?: number
  readonly lng?: number
  readonly status: ServerTripStopStatus
  /** Giờ đến dự kiến của tuyến đã tối ưu; vắng khi chưa tối ưu tuyến. */
  readonly plannedArrival?: string
  readonly actualArrival?: string
  readonly deadline?: string
}

export type ServerTrip = {
  /** Mã chuyến (`tripCode`) — cũng là mã trên URL. */
  readonly id: string
  readonly name: string
  readonly status: TripStatus
  readonly departureAt: string | null
  readonly vehicleName: string
  readonly licensePlate: string
  /** `null` khi chưa gán tài xế. */
  readonly driverName: string | null
  readonly origin: { readonly name: string; readonly address: string; readonly lat?: number; readonly lng?: number }
  /** `null` khi máy chủ không trả số kiện. */
  readonly packageCount: number | null
  readonly stops: readonly ServerTripStop[]
}
