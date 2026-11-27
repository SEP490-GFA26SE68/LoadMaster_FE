import type { VehicleClass } from './vehicle-class'

/**
 * Số khung gầm của **hình minh hoạ** xe tải theo cỡ xe thật thường gặp ở Việt Nam (đơn vị m): đường kính lốp, chiều cao sàn thùng và
 * chiều cao nóc cabin so với mặt đất, nội suy tuyến tính theo tải trọng trong từng hạng — xe tải 1,9 t và xe 5 t cùng hạng "tải nhẹ"
 * nhưng bánh và sàn khác nhau. Mốc lấy từ thông số công bố của các dòng xe:
 * - Tải nhẹ: Isuzu QKR230 (lốp 7.00-15, Ø ≈ 0,73), Hino XZU720 (7.50R16, Ø ≈ 0,80), Isuzu NQR75 (8.25R16, Ø ≈ 0,845).
 * - Tải trung: Hino FC (8.25R20, Ø ≈ 0,97), Isuzu FVR / Hino FG (10.00R20 – 11R22.5, Ø ≈ 1,035).
 * - Tải nặng 3 trục: 11.00R20 / 295/80R22.5, Ø ≈ 1,075.
 * Chỉ đổi hình (AGENTS mục 7), không vào phép tính nào; trục khai ở `positionXCm` vẫn đặt đúng chỗ khai. Thuần, không Three.js.
 */
export type TruckClass = Exclude<VehicleClass, 'van'>

type Anchor = {
  readonly payloadKg: number
  readonly tireDiameter: number
  /** Mặt đất → sàn thùng */
  readonly floorHeight: number
  /** Mặt đất → nóc cabin */
  readonly cabHeight: number
}

export const CHASSIS_ANCHORS: Record<TruckClass, readonly Anchor[]> = {
  light: [
    { payloadKg: 2000, tireDiameter: 0.73, floorHeight: 0.94, cabHeight: 2.3 },
    { payloadKg: 3500, tireDiameter: 0.8, floorHeight: 1.02, cabHeight: 2.33 },
    { payloadKg: 5000, tireDiameter: 0.845, floorHeight: 1.1, cabHeight: 2.36 },
  ],
  medium: [
    { payloadKg: 6000, tireDiameter: 0.97, floorHeight: 1.22, cabHeight: 2.7 },
    { payloadKg: 9000, tireDiameter: 1.035, floorHeight: 1.3, cabHeight: 2.88 },
  ],
  heavy: [{ payloadKg: 15_000, tireDiameter: 1.075, floorHeight: 1.38, cabHeight: 3.05 }],
}

/** Tải trọng chưa khai (form đang gõ dở): dùng cỡ xe thường gặp nhất của hạng. */
export const TYPICAL_PAYLOAD_KG: Record<TruckClass, number> = { light: 3500, medium: 9000, heavy: 15_000 }

/** Mũi cản trước nhô ra trước mặt cabin chừng này (hình chiếu của xe trên mặt đất bắt đầu từ đó). */
export const FRONT_BUMPER_OUT = 0.1
/** Đầu xe (mũi cản trước → tâm cầu trước) của xe cabin lật. */
export const FRONT_OVERHANG: Record<TruckClass, number> = { light: 1.11, medium: 1.25, heavy: 1.35 }
/** Đuôi xe (tâm cầu sau, hay giữa cụm cầu sau → đuôi thùng) chia cho chiều dài cơ sở. */
export const REAR_OVERHANG_RATIO: Record<TruckClass, number> = { light: 0.48, medium: 0.5, heavy: 0.42 }

export type ChassisNumbers = { readonly wheelRadius: number; readonly floorHeight: number; readonly cabTop: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Bán kính bánh, chiều cao sàn (mặt đất → sàn) và nóc cabin (tính từ sàn thùng) của hạng ở tải trọng đó, ngoài mốc thì giữ mốc gần nhất. */
export function chassisNumbersOf(vehicleClass: TruckClass, payloadKg: number): ChassisNumbers {
  const anchors = CHASSIS_ANCHORS[vehicleClass]
  const kg = Number.isFinite(payloadKg) && payloadKg > 0 ? payloadKg : TYPICAL_PAYLOAD_KG[vehicleClass]
  let low = anchors[0]!, high = anchors[0]!
  for (const anchor of anchors) {
    if (anchor.payloadKg <= kg) low = anchor
    if (anchor.payloadKg >= kg) { high = anchor; break }
    high = anchor
  }
  const t = high.payloadKg > low.payloadKg ? (kg - low.payloadKg) / (high.payloadKg - low.payloadKg) : 0
  const floorHeight = lerp(low.floorHeight, high.floorHeight, t)
  return {
    wheelRadius: lerp(low.tireDiameter, high.tireDiameter, t) / 2,
    floorHeight,
    cabTop: lerp(low.cabHeight, high.cabHeight, t) - floorHeight,
  }
}

/** Tâm cầu trước minh hoạ (xe không khai trục): mũi cản trước lùi về đúng đầu xe của hạng. */
export function defaultSteerX(vehicleClass: TruckClass, cabGap: number, cabLength: number): number {
  return -(cabGap + cabLength) - FRONT_BUMPER_OUT + FRONT_OVERHANG[vehicleClass]
}

/**
 * Tâm cầu sau (giữa cụm cầu) minh hoạ: đuôi xe tính tới đuôi thùng cộng cản sau (`length + 0,1`) bằng tỉ lệ đuôi xe của hạng nhân
 * chiều dài cơ sở — giải `(L + 0,1 − sau) = k × (sau − trước)`.
 */
export function defaultRearX(vehicleClass: TruckClass, length: number, steerX: number): number {
  const k = REAR_OVERHANG_RATIO[vehicleClass]
  return (length + 0.1 + k * steerX) / (1 + k)
}
