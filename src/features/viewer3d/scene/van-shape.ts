import type { VehicleConfig } from '@/domain/models'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import { containerSize, toScene } from './units'

/**
 * Dáng xe van liền khối của **hình minh hoạ** (AGENTS mục 7): bốn dáng tham số, thuần, không Three.js. Đơn vị scene (m), hệ trục của
 * nhóm xe: x dọc thùng (vách trước = 0, cửa sau = L, âm là phía mũi), y cao (sàn lòng thùng = 0), z ngang (vách trái = 0). Lòng thùng
 * luôn đúng số đang khai; dáng chỉ đổi phần quanh nó (mũi, vách, nóc, bánh). Không vào phép tính nào.
 *
 * Số tham chiếu: `ghi-chu/xe-tham-chieu-2026-11-27.md` mục A (bảng số đo) và C (tỷ lệ). Chỗ ghi "ước" là số nguồn không có (KTT).
 */

type P2 = readonly [number, number]
export type VanRearDoor = 'liftgate' | 'swing'

type VanStyleSpec = {
  readonly wheelRadius: number
  readonly tireWidth: number
  /** Sàn khoang hàng cách đất của xe tham chiếu; khi vẽ được nâng tới mức bánh nằm dưới sàn (`WHEEL_UNDER_FLOOR`). */
  readonly floorHeight: number
  /** Bề dày vách: (rộng ngoài − rộng lòng) / 2 */
  readonly wall: number
  /** Nóc ngoài cao hơn trần lòng thùng */
  readonly roof: number
  /** Phần trước khoang hàng (mũi + ca-bin) của xe tham chiếu; lòng thùng khác xe tham chiếu thì theo tỷ lệ `noseRatio` × dài lòng */
  readonly nose: number
  readonly noseRatio: readonly [number, number]
  /** Cầu trước cách mũi xe */
  readonly frontOverhang: number
  /** Chiều dài cơ sở / chiều dài toàn xe (mũi + lòng thùng) */
  readonly wheelbaseRatio: number
  /** Nắp máy dài theo x (gần 0 là mũi phẳng) */
  readonly hood: number
  /** Chân kính chắn gió: phần chiều cao toàn xe tính từ mặt đất */
  readonly cowl: number
  /** Kính chắn gió dài theo x, từ chân lên nóc */
  readonly windshieldRun: number
  readonly rearDoor: VanRearDoor
}

/** Bốn dáng. Mọi số theo bảng A / C của ghi chú tham chiếu. */
export const VAN_STYLE_SPECS: Record<VehicleBodyStyle, VanStyleSpec> = {
  // Suzuki Super Carry Blind Van: 3290 × 1395 × 1780, cơ sở 1840, lòng 1700 × 1270 × 1190, mũi phẳng, cầu trước dưới ghế, cửa sau hất.
  // Bánh 12 inch ≈ Ø 520 (ước), sàn ≈ 1780 − 1190 − nóc; nhô trước ước.
  VAN_MINI_FLAT: {
    wheelRadius: 0.26, tireWidth: 0.155, floorHeight: 0.55, wall: 0.0625, roof: 0.04, nose: 1.59, noseRatio: [0.85, 1],
    frontOverhang: 0.6, wheelbaseRatio: 0.56, hood: 0.05, cowl: 0.52, windshieldRun: 0.3, rearDoor: 'liftgate',
  },
  // Thaco Towner Van TF420V (4200 × 1690 × 2000, cơ sở 2700, lòng 2330 × 1505 × 1340, 175/70R14 ≈ Ø 601) và Kenbo Van 2S
  // (4020 × 1620 × 1910, cơ sở 2630, lòng 2170 × 1270 × 1210, Ø 610): mũi 0,80–0,85 Lc, cơ sở 0,64–0,65 toàn xe. Nhô trước ước.
  VAN_MINI_HOOD: {
    wheelRadius: 0.3, tireWidth: 0.175, floorHeight: 0.6, wall: 0.09, roof: 0.05, nose: 1.86, noseRatio: [0.8, 0.85],
    frontOverhang: 0.66, wheelbaseRatio: 0.645, hood: 0.42, cowl: 0.5, windshieldRun: 0.55, rearDoor: 'liftgate',
  },
  // Toyota HiAce LWB 2019+: 5265 × 1950 × 1990, cơ sở 3210, nhô trước 950, lòng 2530 × 1760 × 1340, 215/70R16 ≈ Ø 707, mũi 1,08 Lc.
  VAN_MID: {
    wheelRadius: 0.354, tireWidth: 0.215, floorHeight: 0.6, wall: 0.095, roof: 0.05, nose: 2.735, noseRatio: [1, 1.15],
    frontOverhang: 0.95, wheelbaseRatio: 0.61, hood: 0.62, cowl: 0.47, windshieldRun: 0.75, rearDoor: 'liftgate',
  },
  // Ford Transit L2H2 / L3H2: 5531 / 5981 dài, cơ sở 3300 / 3750, lòng 3083 / 3533 × 1784 × 1886, cao 2411, Ø 684–729, phần trước gần
  // như cố định ≈ 2450 (0,69–0,79 Lc), cơ sở 0,60–0,63; rộng 2000 (bản VN). Hai cánh cửa sau. Nhô trước ước.
  VAN_LARGE: {
    wheelRadius: 0.355, tireWidth: 0.225, floorHeight: 0.475, wall: 0.11, roof: 0.06, nose: 2.45, noseRatio: [0.69, 0.79],
    frontOverhang: 1, wheelbaseRatio: 0.6, hood: 0.85, cowl: 0.42, windshieldRun: 0.7, rearDoor: 'swing',
  },
}

/**
 * Lòng thùng không có hốc bánh (domain không khai), nên bánh vẽ dưới sàn: sàn ít nhất 2r + khoảng này. HiAce và Transit vì vậy cao
 * hơn xe thật vài tấc — lệch có chủ ý, để không bánh nào xuyên lên kiện.
 */
const WHEEL_UNDER_FLOOR = 0.07
/** Hốc bánh rộng hơn lốp chừng này; chân thân xe (mép dưới tấm sườn) cách đất 0,55 r + 5 cm. */
export const ARCH_GAP = 0.035
const SILL_RISE = 0.05
/** Lưng mũi cách vách trước lòng thùng; nóc mũi bo một đoạn trước khi gập xuống kính. */
const NOSE_GAP = 0.01
const ROOF_ROUND = 0.09
/** Mũi phủ cầu trước ít nhất chừng này trước mép hốc bánh khi cầu trước khai xa hơn mũi của dáng. */
const NOSE_CLEARANCE = 0.12
/** Mũi không ngắn / dài hơn mũi của xe tham chiếu quá mức này, dù lòng thùng khác xa. */
const NOSE_LIMITS: P2 = [0.75, 1.25]
/** Chân kính chắn gió không thấp hơn chừng này trên sàn; mặt trước của mũi luôn cao ít nhất chừng này (thùng rất thấp). */
const COWL_MIN = 0.3
const NOSE_FACE_MIN = 0.06

export type VanShapeInput = Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg'>
  & Partial<Pick<VehicleConfig, 'axles'>>

/** Ngưỡng chọn dáng khi loại xe không khai kiểu thân (cm, kg) — theo lòng thùng của các xe tham chiếu. */
export const VAN_LARGE_MIN_LENGTH_CM = 280
export const VAN_LARGE_MIN_HEIGHT_CM = 150
export const VAN_MID_MIN_LENGTH_CM = 245
export const VAN_MID_MIN_WIDTH_CM = 165
export const VAN_MINI_FLAT_MAX_LENGTH_CM = 195
export const VAN_MINI_FLAT_MAX_PAYLOAD_KG = 600

/** Dáng suy từ lòng thùng và tải trọng: nóc cao hoặc thùng dài là van lớn, rộng / dài vừa là cỡ trung, ngắn hoặc chở dưới 600 kg là mũi phẳng. */
export function vanStyleOf(vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg'>): VehicleBodyStyle {
  const { innerLengthCm: l, innerWidthCm: w, innerHeightCm: h, maxPayloadKg: kg } = vehicle
  if (l >= VAN_LARGE_MIN_LENGTH_CM || h >= VAN_LARGE_MIN_HEIGHT_CM) return 'VAN_LARGE'
  if (l >= VAN_MID_MIN_LENGTH_CM || w >= VAN_MID_MIN_WIDTH_CM) return 'VAN_MID'
  const lightLoad = Number.isFinite(kg) && kg > 0 && kg <= VAN_MINI_FLAT_MAX_PAYLOAD_KG
  return l < VAN_MINI_FLAT_MAX_LENGTH_CM || lightLoad ? 'VAN_MINI_FLAT' : 'VAN_MINI_HOOD'
}

export type VanShape = {
  readonly style: VehicleBodyStyle
  readonly rearDoor: VanRearDoor
  readonly wheelRadius: number
  readonly tireWidth: number
  /** Sàn lòng thùng cách đất khi vẽ (đã nâng cho bánh nằm dưới sàn) */
  readonly floorHeight: number
  readonly wall: number
  readonly roof: number
  readonly groundY: number
  readonly wheelY: number
  /** Mép dưới tấm sườn — chân thân xe, nơi hốc bánh cắt vào */
  readonly sillY: number
  readonly archRadius: number
  /** Nóc ngoài: nóc mũi và nóc thân liền một đường */
  readonly roofY: number
  readonly front: number
  readonly back: number
  /** Chân và đỉnh kính chắn gió trên mặt cắt cạnh */
  readonly cowl: P2
  readonly windshieldTop: P2
  /** Mặt cắt cạnh của mũi (ngược chiều kim đồng hồ), đúng mặt ngoài — thân mũi đùn theo z */
  readonly outline: readonly P2[]
  /** Vị trí các trục theo x, tăng dần: trục khai thì đúng `positionXCm`, không thì trục minh hoạ của dáng */
  readonly axles: readonly number[]
  /** Tâm bánh hai bên theo z: lốp lùi vào trong mép thân 5 cm */
  readonly wheelZ: readonly [number, number]
  /** Cản sau liền thân: mép dưới, mép trên */
  readonly rearBumper: P2
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function noseLength(spec: VanStyleSpec, length: number): number {
  const ratio = clamp(spec.nose, spec.noseRatio[0] * length, spec.noseRatio[1] * length)
  return clamp(ratio, spec.nose * NOSE_LIMITS[0], spec.nose * NOSE_LIMITS[1])
}

function defaultAxles(spec: VanStyleSpec, front: number, length: number, radius: number): number[] {
  const steer = front + spec.frontOverhang
  const wheelbase = spec.wheelbaseRatio * (length - front)
  // Bánh sau không lòi ra sau cửa và không chạm hốc bánh trước
  const rear = clamp(steer + wheelbase, steer + radius * 2 + 0.3, Math.max(steer + radius * 2 + 0.3, length - radius - 0.15))
  return [steer, rear]
}

/** Mặt cắt cạnh của mũi: đáy ngang sàn, lưng sát vách trước, nóc ngang nóc thân, kính chắn gió, nắp máy (mũi phẳng thì không có). */
function noseOutline(spec: VanStyleSpec, front: number, back: number, roofY: number, cowl: P2, windshieldTop: P2): P2[] {
  const [cowlX, cowlY] = cowl
  const flat = spec.hood < 0.2
  const nose: P2[] = flat
    ? [[front, cowlY - 0.09]]
    : [[front + 0.08, cowlY - Math.min(0.1, spec.hood * 0.12)], [front, Math.max(NOSE_FACE_MIN, cowlY - Math.min(0.1, spec.hood * 0.12) - 0.1)]]
  return [
    [front, 0], [back, 0], [back, roofY], [windshieldTop[0] + ROOF_ROUND, roofY], windshieldTop, [cowlX, cowlY], ...nose,
  ]
}

/**
 * Dáng của một xe van: `bodyStyle` khai ở loại xe thắng; vắng thì `vanStyleOf`. Trục khai đặt đúng `positionXCm` (cm → m qua `toScene`),
 * mũi dài ra khi cầu trước khai xa hơn mũi của dáng.
 */
export function vanShapeOf(vehicle: VanShapeInput, bodyStyle?: VehicleBodyStyle): VanShape {
  const style = bodyStyle ?? vanStyleOf(vehicle)
  const spec = VAN_STYLE_SPECS[style]
  const { length, width, height } = containerSize(vehicle)
  const radius = spec.wheelRadius, archRadius = radius + ARCH_GAP
  const floorHeight = Math.max(spec.floorHeight, radius * 2 + WHEEL_UNDER_FLOOR)
  const groundY = -floorHeight, wheelY = groundY + radius
  const roofY = height + spec.roof
  const declared = vehicle.axles?.length ? vehicle.axles.map((axle) => toScene(axle.positionXCm)).sort((a, b) => a - b) : null
  let front = -noseLength(spec, length)
  if (declared) front = Math.min(front, declared[0]! - archRadius - NOSE_CLEARANCE)
  const axles = declared ?? defaultAxles(spec, front, length, radius)
  const back = -NOSE_GAP
  const cowlX = front + spec.hood
  const cowlY = clamp(groundY + spec.cowl * (roofY - groundY), COWL_MIN, roofY - 0.35)
  const topX = Math.min(back - 0.3, cowlX + spec.windshieldRun)
  const cowl: P2 = [cowlX, cowlY], windshieldTop: P2 = [topX, roofY - ROOF_ROUND * 0.6]
  const sillY = groundY + radius * 0.55 + SILL_RISE
  const wheelZ = spec.tireWidth / 2 + 0.05 - spec.wall
  return {
    style, rearDoor: spec.rearDoor, wheelRadius: radius, tireWidth: spec.tireWidth, floorHeight, wall: spec.wall, roof: spec.roof,
    groundY, wheelY, sillY, archRadius, roofY, front, back, cowl, windshieldTop,
    outline: noseOutline(spec, front, back, roofY, cowl, windshieldTop),
    axles, wheelZ: [wheelZ, width - wheelZ], rearBumper: [sillY - 0.03, Math.min(-0.03, sillY + 0.24)],
  }
}

/** Cửa hất sau mở 100° quanh bản lề ngang ở mép trên ô cửa (Blind Van "hất lên 90°", nghiêng thêm cho thấy là cửa đang mở). */
export const LIFTGATE_OPEN_RAD = 100 * Math.PI / 180

/** Mép dưới của cửa hất đang mở (x, y), cửa cao `doorHeight`, bản lề ở (L, doorHeight): để camera canh khung chạm tới. */
export function liftgateTip(length: number, doorHeight: number): P2 {
  return [length + doorHeight * Math.sin(LIFTGATE_OPEN_RAD), doorHeight * (1 - Math.cos(LIFTGATE_OPEN_RAD))]
}
