import type { VehicleConfig } from '@/domain/models'
import { chassisNumbersOf, defaultSteerX, TYPICAL_PAYLOAD_KG, type TruckClass } from './truck-chassis-numbers'

/**
 * Hạng xe của **hình minh hoạ** quanh thùng (AGENTS mục 7): suy từ số người dùng đã khai — chiều dài lòng thùng, tải trọng, số trục —
 * vì máy chủ không trả kiểu xe. Chỉ đổi hình (cabin, cỡ bánh, chiều cao sàn), không phải dữ liệu nghiệp vụ: không hiện chữ "tải nhẹ /
 * tải nặng" ở đâu trên giao diện, không đưa vào phép tính nào. Thuần, tất định, không Three.js.
 */
export type VehicleClass = 'van' | 'light' | 'medium' | 'heavy'

/**
 * Ngưỡng theo xe chở hàng thường gặp ở Việt Nam:
 * - Van: xe van / xe tải siêu nhẹ chở tới khoảng 1 tấn (Suzuki Blind Van 580 kg, Towner Van 945 kg), thùng ngắn.
 * - Tải nhẹ: dòng N / 300 (Hino XZU 3,5 t, Isuzu NQR 5,5 t) — cabin lật hẹp, sàn thấp.
 * - Tải trung: dòng F / 500 (Hino FC 6 t, Isuzu FVR 9 t, Hyundai HD210 9,5 t).
 * - Tải nặng: từ 3 trục, chở trên 12 t, hoặc thùng từ 9 m (xe 3–4 chân, xe container).
 */
export const VAN_MAX_PAYLOAD_KG = 1200
export const VAN_MAX_LENGTH_CM = 300
/** Tải nhỏ mà thùng dài hơn mức này là xe tải nhẹ thùng dài (mũi van kéo thùng 5 m thì không còn giống xe nào), không phải van. */
export const VAN_PAYLOAD_MAX_LENGTH_CM = 420
export const LIGHT_MAX_PAYLOAD_KG = 5500
export const MEDIUM_MAX_PAYLOAD_KG = 12_000
export const HEAVY_MIN_LENGTH_CM = 900
export const HEAVY_MIN_AXLES = 3
/** Tải nhẹ chở dưới mức này dùng bánh đơn cầu sau (xe 1,5–2,5 t), từ đó trở lên bánh đôi. */
export const LIGHT_DUAL_MIN_PAYLOAD_KG = 2500
/** Tải trọng chưa khai (form đang gõ dở): hạng suy từ chiều dài thùng với các mốc này (cm). */
const LIGHT_MAX_LENGTH_CM = 600
const MEDIUM_MAX_LENGTH_CM = 860

export type VehicleClassInput = Pick<VehicleConfig, 'innerLengthCm' | 'maxPayloadKg'> & Partial<Pick<VehicleConfig, 'axles'>>

const knownPayload = (kg: number) => Number.isFinite(kg) && kg > 0

export function vehicleClassOf(vehicle: VehicleClassInput): VehicleClass {
  const length = vehicle.innerLengthCm, payload = vehicle.maxPayloadKg
  if ((vehicle.axles?.length ?? 0) >= HEAVY_MIN_AXLES || length >= HEAVY_MIN_LENGTH_CM) return 'heavy'
  if (!knownPayload(payload)) {
    if (length <= VAN_MAX_LENGTH_CM) return 'van'
    return length <= LIGHT_MAX_LENGTH_CM ? 'light' : length <= MEDIUM_MAX_LENGTH_CM ? 'medium' : 'heavy'
  }
  if (payload > MEDIUM_MAX_PAYLOAD_KG) return 'heavy'
  if (length <= VAN_MAX_LENGTH_CM || (payload <= VAN_MAX_PAYLOAD_KG && length <= VAN_PAYLOAD_MAX_LENGTH_CM)) return 'van'
  return payload <= LIGHT_MAX_PAYLOAD_KG ? 'light' : 'medium'
}

/** Tham số hình của một hạng, đơn vị scene (m); y tính từ sàn thùng (= 0), x từ vách trước (= 0, âm là phía cabin). */
export type VehicleProfile = {
  /** `van`: mũi liền thùng, nóc ngang nóc thùng; `cabover`: cabin lật đầu bằng đứng trước thùng */
  readonly cab: 'van' | 'cabover'
  /** Khoảng sáng từ mặt đất tới sàn thùng */
  readonly floorHeight: number
  readonly wheelRadius: number
  readonly tireWidth: number
  readonly dualRear: boolean
  /** Số trục vẽ khi xe không khai trục */
  readonly defaultAxles: 2 | 3
  /**
   * Cầu trước minh hoạ khi xe không khai trục — xe tải: theo đầu xe của hạng (`defaultSteerX` của `truck-chassis-numbers.ts`); cầu sau
   * theo tỉ lệ đuôi xe (`defaultRearX`)
   */
  readonly defaultSteerX: number
  readonly tandemSpacing: number
  /** Lưng cabin cách vách trước thùng */
  readonly cabGap: number
  readonly cabLength: number
  /** Nóc cabin; van: trần của nóc, nóc thật theo thùng nếu thùng thấp hơn */
  readonly cabTop: number
  readonly cabMaxWidth: number
  /** Chiều cao bản bụng khung sườn; 0 là thân liền khối (van) */
  readonly railHeight: number
  /** Cánh gió nóc, đèn cờ, ống xả đứng, còi hơi */
  readonly roofDeflector: boolean
  readonly stackExhaust: boolean
}

type CabParts = Omit<VehicleProfile, 'floorHeight' | 'wheelRadius' | 'cabTop' | 'defaultSteerX'>

/**
 * Hạng xe tải: cabin và khung khai ở đây; bánh, sàn, nóc cabin là của cỡ xe thường gặp nhất trong hạng (`truck-chassis-numbers.ts`) —
 * `truckLayout` thay bằng số theo đúng tải trọng của xe.
 */
function truckProfile(vehicleClass: TruckClass, parts: CabParts): VehicleProfile {
  return {
    ...parts,
    ...chassisNumbersOf(vehicleClass, TYPICAL_PAYLOAD_KG[vehicleClass]),
    defaultSteerX: defaultSteerX(vehicleClass, parts.cabGap, parts.cabLength),
  }
}

export const VEHICLE_PROFILES: Record<VehicleClass, VehicleProfile> = {
  van: {
    cab: 'van', floorHeight: 0.62, wheelRadius: 0.3, tireWidth: 0.2, dualRear: false, defaultAxles: 2, defaultSteerX: -1,
    tandemSpacing: 0, cabGap: 0, cabLength: 1.5, cabTop: 1.45, cabMaxWidth: 2,
    railHeight: 0, roofDeflector: false, stackExhaust: false,
  },
  light: truckProfile('light', {
    cab: 'cabover', tireWidth: 0.22, dualRear: true, defaultAxles: 2, tandemSpacing: 0, cabGap: 0.1, cabLength: 1.6, cabMaxWidth: 1.95,
    railHeight: 0.2, roofDeflector: false, stackExhaust: false,
  }),
  medium: truckProfile('medium', {
    cab: 'cabover', tireWidth: 0.25, dualRear: true, defaultAxles: 2, tandemSpacing: 0, cabGap: 0.12, cabLength: 1.78, cabMaxWidth: 2.25,
    railHeight: 0.24, roofDeflector: true, stackExhaust: false,
  }),
  heavy: truckProfile('heavy', {
    cab: 'cabover', tireWidth: 0.29, dualRear: true, defaultAxles: 3, tandemSpacing: 1.32, cabGap: 0.32, cabLength: 2.05, cabMaxWidth: 2.45,
    railHeight: 0.28, roofDeflector: true, stackExhaust: true,
  }),
}
