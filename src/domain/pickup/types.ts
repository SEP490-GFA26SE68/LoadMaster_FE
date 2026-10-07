import type { Box } from '@/domain/geometry'
import type { CargoPackage, HandlingClass, VehicleConfig } from '@/domain/models'
import type { GeoPoint } from '@/domain/routing'
import type { StopZone } from '@/domain/zones'

/**
 * Nhận hàng dọc đường (FE-7-02, D-88, PRD v2 mục 8.7): mười luật kiểm một yêu cầu nhận khi chuyến Đang vận chuyển, và vị trí chèn
 * điểm mới vào tuyến. Hàm thuần, trả mã + tham số (D-28); UI dịch. Luật 4–7 và 10 là **ước lượng** theo thể tích, khối lượng của các
 * vùng đã trống cho tới khi có tái tối ưu vùng trống (P2).
 */

/**
 * Hằng số của mười luật — chỗ duy nhất khai chúng. **Đề xuất FE — chờ nghiệp vụ xác nhận** (PRD v2 mục 17.2), trừ 10 km là số của
 * luật 1 theo issue BE S7-02.
 */
export const PICKUP_CONSTANTS = {
  /** Luật 1: điểm nhận cách tuyến còn lại của xe tối đa chừng này, km. */
  MAX_ROUTE_DISTANCE_KM: 10,
  /** Hai toạ độ cách nhau không quá chừng này là cùng một điểm (điểm giao dùng lại điểm có sẵn), km. */
  SAME_PLACE_KM: 0.05,
} as const

export const PICKUP_RULES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type PickupRule = (typeof PICKUP_RULES)[number]

/** Mã kết quả của từng luật: một mã cho Đạt, một hoặc hai mã cho lý do Không đạt. UI dịch từng mã. */
export const PICKUP_RULE_CODES = [
  'PICKUP_ON_ROUTE', 'PICKUP_OFF_ROUTE', 'PICKUP_BEHIND_VEHICLE',
  'PICKUP_DELIVERY_IN_RANGE', 'PICKUP_DELIVERY_NOT_AFTER_CURRENT', 'PICKUP_DELIVERY_BEYOND_PROTECTED',
  'PICKUP_PAYLOAD_OK', 'PICKUP_PAYLOAD_EXCEEDED',
  'PICKUP_FREED_SPACE_OK', 'PICKUP_FREED_SPACE_INSUFFICIENT',
  'PICKUP_AXLE_OK', 'PICKUP_AXLE_OVERLOAD', 'PICKUP_AXLE_UNAVAILABLE',
  'PICKUP_COG_OK', 'PICKUP_COG_OFF_CENTER',
  'PICKUP_STACK_OK', 'PICKUP_FRAGILE_STACKED',
  'PICKUP_CLASS_OK', 'PICKUP_CLASS_OVERRIDDEN', 'PICKUP_CLASS_CONFLICT',
  'PICKUP_DEADLINE_OK', 'PICKUP_NO_DEADLINE', 'PICKUP_DEADLINE_MISSED',
  'PICKUP_NOT_BLOCKING', 'PICKUP_BLOCKS_CARGO',
  /** Luật 1, 2, 9 không có điểm nào còn lại trên tuyến để so. */
  'PICKUP_NO_REMAINING_STOP',
] as const
export type PickupRuleCode = (typeof PICKUP_RULE_CODES)[number]

export type PickupRuleResult = {
  rule: PickupRule
  passed: boolean
  code: PickupRuleCode
  params: Readonly<Record<string, string | number>>
  /** Kết quả là ước lượng theo thể tích, khối lượng vùng đã trống (luật 4–7, 10). */
  estimated: boolean
}

/** Một kiện của yêu cầu nhận: một kiện vật lý, cm / kg. Vắng loại hàng là hàng thường. */
export type PickupCargo = Pick<CargoPackage, 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg'> & { handlingClass?: HandlingClass }

export type PickupRequestFacts = {
  pickup: GeoPoint
  delivery: GeoPoint
  /** Hạn giao, ISO 8601; vắng thì luật 9 không có gì để trễ. */
  deadline?: string
  packages: readonly PickupCargo[]
}

/** Một điểm của chuyến, theo thứ tự tuyến (`Trip.stops`, điểm nhận dọc đường đã chèn trước đó cũng là một điểm). */
export type PickupRouteStop = {
  stopId: string
  /** Số điểm trong phương án đã duyệt — khớp `StopZone.stopId`, để biết vùng nào là của điểm này. */
  number: number
  location: GeoPoint
  /** Hạn giao của điểm, ISO 8601. */
  deadline?: string
  /** Điểm đã hoàn tất: vùng của nó là vùng đã trống. */
  completed: boolean
  /** Số kiện của điểm còn trên xe; > 0 là điểm được bảo vệ (luật 2). */
  onboardCount: number
  /** Xe đã tới điểm (`StopProgress.arrivedAt`), ISO 8601; chỉ có nghĩa ở điểm hiện tại. */
  arrivedAt?: string
}

/** Kiện còn trên xe: vị trí và kích thước đã xếp (cm, hệ toạ độ thùng) của phương án đã duyệt, cộng khối lượng. */
export type OnboardCargo = Box & { weightKg: number }

export type PickupVehicle = Pick<
  VehicleConfig,
  'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg' | 'axles' | 'frontAxleLimitKg' | 'rearAxleLimitKg' | 'maxCogOffsetRatio'
>

/**
 * Mọi thứ mười luật cần — kho dựng từ chuyến, phương án đã duyệt, vị trí xe và tiến độ giao. Hàm đánh giá không đọc gì ngoài đây.
 */
export type PickupContext = {
  request: PickupRequestFacts
  vehicle: PickupVehicle
  /** Vị trí xe lúc `at`. */
  position: GeoPoint
  /** Giờ của kho, ISO 8601: gốc của ETA. */
  at: string
  /** Mọi điểm của chuyến theo thứ tự tuyến, kể cả điểm đã hoàn tất. */
  stops: readonly PickupRouteStop[]
  /** Vùng theo điểm giao của phương án đã duyệt (`result.stopZones`); rỗng khi phương án không chia vùng. */
  zones: readonly StopZone[]
  /** Kiện còn trên xe (chưa dỡ, chưa bị bỏ lại kho). */
  onboard: readonly OnboardCargo[]
  /** Dòng kiện của chuyến (`Trip.packages`): loại hàng đang khoá theo `segregation`. */
  tripCargo: readonly Pick<CargoPackage, 'id' | 'quantity' | 'handlingClass'>[]
  /** Lý do vượt luật phân tách hàng đã ghi cho chuyến (`Trip.overrideReason`, D-74). */
  overrideReason?: string
}
