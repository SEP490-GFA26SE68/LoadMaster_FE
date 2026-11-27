import type { VehicleConfig } from '@/domain/models'
import { isTruckBodyStyle, isVanBodyStyle, type TruckBodyStyle, type VehicleBodyStyle } from '@/types/vehicle-body-style'
import { containerSize, toScene } from './units'
import { vanShapeOf, type VanShape } from './van-shape'
import { LIGHT_DUAL_MIN_PAYLOAD_KG, VEHICLE_PROFILES, vehicleClassOf, type VehicleClass, type VehicleProfile } from './vehicle-class'

/** Đơn vị scene (m), hệ trục của nhóm xe: x dọc thùng (vách trước = 0), y cao (sàn thùng = 0), z ngang (vách trái = 0). */

/** Mặt trên của tấm gầm thùng: khung sườn treo ngay dưới nó. */
const RAIL_TOP = -0.15
/** Mũi cabin phủ cầu trước ít nhất chừng này trước mép lốp. */
const NOSE_CLEARANCE = 0.08

export type TruckAxle = { readonly x: number; readonly kind: 'steer' | 'drive'; readonly dual: boolean }
export type TruckWheel = { readonly x: number; readonly z: number }
export type Range = readonly [number, number]
export type Point2 = readonly [number, number]

export type TruckCabShape = {
  readonly kind: VehicleProfile['cab']
  readonly frontX: number
  readonly backX: number
  readonly bottomY: number
  readonly topY: number
  /** Chân kính chắn gió trên mặt trước */
  readonly beltY: number
  /** Cabin canh giữa theo bề rộng, không rộng hơn thùng */
  readonly z: Range
  /** Mặt cắt cạnh (x, y), đóng kín: đùn theo z thành thân cabin */
  readonly profile: readonly Point2[]
  /** Hai đầu cạnh kính chắn gió trên mặt cắt: chân, đỉnh */
  readonly windshield: readonly [Point2, Point2]
}

export type TruckLayout = {
  readonly vehicleClass: VehicleClass
  readonly profile: VehicleProfile
  /** Mặt đất dưới bánh xe — mọi thứ đặt lên mặt đất (bóng tiếp xúc, mặt nhận bóng, đường kích thước) lấy từ đây. */
  readonly groundY: number
  /** Hình chiếu của xe trên mặt đất: mũi cản trước → qua cản sau (x), hai hông kể cả gương (z) */
  readonly footprint: { readonly x: Range; readonly z: Range }
  /** Nóc thùng (cao lòng thùng): cánh gió nóc cabin không vượt quá nó */
  readonly boxTopY: number
  readonly wheelY: number
  /** Tâm cản sau chống luồn; biển số và đèn hậu đặt theo nó */
  readonly rearBumperY: number
  readonly wheelRadius: number
  readonly tireWidth: number
  readonly cab: TruckCabShape
  readonly axles: readonly TruckAxle[]
  readonly wheels: readonly TruckWheel[]
  /** Hai thanh khung sườn dọc, từ cản trước tới qua cửa sau; `y`: mặt trên, mặt dưới bản bụng */
  readonly frame: { readonly fromX: number; readonly toX: number; readonly railZ: readonly [number, number]; readonly y: Range }
  /** Trục các-đăng: từ hộp số tới từng cầu chủ động */
  readonly driveshaft: readonly { readonly fromX: number; readonly toX: number }[]
  readonly gearboxX: number
  /** Miệng ống xả (hệ nhóm xe) */
  readonly exhaust: readonly [number, number, number]
  /** Dàn lạnh ngoài vách trước, trên nóc cabin — chỉ khi xe khai vật cản `COOLING_UNIT` */
  readonly reefer: { readonly x: Range; readonly y: Range; readonly z: Range } | null
  /** Dáng van liền khối (`van-shape.ts`) khi hạng là van; `null` với xe tải */
  readonly van: VanShape | null
  /**
   * Kiểu thân của xe tải (`null` với van): kiểu khai ở loại xe, vắng thì thùng đông lạnh khi xe khai vật cản `COOLING_UNIT`, không
   * thì thùng kín. Chỉ đổi hình — lòng thùng, ô cửa và mọi số vẫn theo `VehicleConfig`.
   */
  readonly body: TruckBodyStyle | null
}

export type TruckLayoutInput = Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg'>
  & Partial<Pick<VehicleConfig, 'axles' | 'obstacles'>>

/** Cabin lật đầu bằng của xe tải (van dựng mũi từ `vanCab`). */
function cabShape(p: VehicleProfile, steerX: number, width: number, bottomY: number, wheelRadius: number): TruckCabShape {
  const backX = -p.cabGap
  const frontX = Math.min(backX - p.cabLength, steerX - wheelRadius - NOSE_CLEARANCE)
  const length = backX - frontX
  const cabWidth = Math.min(width, p.cabMaxWidth)
  const z: Range = [(width - cabWidth) / 2, (width + cabWidth) / 2]
  const topY = p.cabTop
  const beltY = bottomY + (topY - bottomY) * 0.5
  const rake = Math.min(0.3, length * 0.16)
  return {
    kind: 'cabover', frontX, backX, bottomY, topY, beltY, z,
    profile: [[frontX, bottomY], [backX, bottomY], [backX, topY], [frontX + rake, topY], [frontX, beltY]],
    windshield: [[frontX, beltY], [frontX + rake, topY]],
  }
}

/** Mũi van: mặt cắt đúng mặt ngoài (thân đùn với `bevelOffset` âm), hai mặt bên trùng mặt ngoài vách thân (z = −vách, W + vách). */
function vanCab(van: VanShape, width: number): TruckCabShape {
  // Thân đùn có chiều dày vát 0,025 ở hai đầu z: dời z ra 0,025 để mặt bên nằm đúng mặt ngoài vách
  const z: Range = [-van.wall - 0.025, width + van.wall + 0.025]
  return {
    kind: 'van', frontX: van.front, backX: van.back, bottomY: 0, topY: van.roofY, beltY: van.cowl[1], z,
    profile: van.outline, windshield: [van.cowl, van.windshieldTop],
  }
}

function axlePositions(vehicle: TruckLayoutInput, p: VehicleProfile, length: number): number[] {
  if (vehicle.axles?.length) return vehicle.axles.map((axle) => toScene(axle.positionXCm)).sort((a, b) => a - b)
  // Cầu sau minh hoạ: bánh không lòi ra sau cửa thùng
  const rear = Math.min(length * p.defaultRearRatio, length - p.wheelRadius - p.tandemSpacing / 2 - 0.15)
  return p.defaultAxles === 3
    ? [p.defaultSteerX, rear - p.tandemSpacing / 2, rear + p.tandemSpacing / 2]
    : [p.defaultSteerX, rear]
}

/**
 * Bố cục xe **minh hoạ** (không phải hình học trục có thẩm quyền, AGENTS mục 7) theo hạng `vehicleClassOf`: cabin, cỡ bánh, chiều cao
 * sàn, khung sườn. Van lấy mũi, cỡ bánh, sàn, trục minh hoạ từ dáng `vanShapeOf`. `bodyStyle` (kiểu thân khai ở loại xe): kiểu van
 * chọn dáng van; kiểu xe tải giữ hạng suy từ số (lòng thùng cỡ van thì vẽ hạng tải nhẹ) và chọn thân `body`; vắng thì suy từ số. Trục lấy `vehicle.axles` khi có khai báo (`positionXCm` tính từ vách trước, âm là dưới cabin) — hạng chỉ đổi hình,
 * không dời trục khai; không có thì vẽ số trục mặc định của hạng. Trục đầu tiên theo x là cầu dẫn hướng bánh đơn, các trục sau là cầu
 * chủ động (bánh đôi trừ van và tải nhẹ dưới `LIGHT_DUAL_MIN_PAYLOAD_KG`). Cabin dài ra khi cầu trước khai xa hơn mũi của hạng.
 *
 * `positionXCm` cùng hệ toạ độ với thùng (FE-5b-03): `toScene(positionXCm)` đặt thẳng lên trục x của nhóm xe, chính là trục X của
 * placement — không cộng thêm độ dời nào. Hàm này chỉ vẽ, không tính tải trục; trục mặc định không đưa vào phép tính. Sàn thùng luôn
 * ở y = 0: hạng chỉ đổi phần dưới sàn (mặt đất, bánh, khung) và cabin.
 */
export function truckLayout(vehicle: TruckLayoutInput, bodyStyle?: VehicleBodyStyle): TruckLayout {
  const { length, width, height } = containerSize(vehicle)
  // Kiểu van khai ở loại xe thắng hạng suy từ số; kiểu xe tải giữ hạng suy từ số nhưng không bao giờ là van
  const derived = vehicleClassOf(vehicle)
  const vehicleClass: VehicleClass = isVanBodyStyle(bodyStyle) ? 'van' : isTruckBodyStyle(bodyStyle) && derived === 'van' ? 'light' : derived
  const van = vehicleClass === 'van' ? vanShapeOf(vehicle, isVanBodyStyle(bodyStyle) ? bodyStyle : undefined) : null
  const p = van ? { ...VEHICLE_PROFILES.van, floorHeight: van.floorHeight, wheelRadius: van.wheelRadius, tireWidth: van.tireWidth,
    cabLength: van.back - van.front, cabTop: van.roofY } : VEHICLE_PROFILES[vehicleClass]
  const groundY = -p.floorHeight, wheelRadius = p.wheelRadius, wheelY = groundY + wheelRadius, tire = p.tireWidth
  const positions = van ? [...van.axles] : axlePositions(vehicle, p, length)
  const dualRear = p.dualRear && !(vehicleClass === 'light' && vehicle.maxPayloadKg > 0 && vehicle.maxPayloadKg < LIGHT_DUAL_MIN_PAYLOAD_KG)
  const axles: TruckAxle[] = positions.map((x, i) => ({ x, kind: i === 0 ? 'steer' : 'drive', dual: i > 0 && dualRear }))

  const outer = tire / 2 + 0.03, spacing = tire + 0.02
  const wheels: TruckWheel[] = axles.flatMap(({ x, dual }) => van
    ? van.wheelZ.map((z) => ({ x, z }))
    : dual
      ? [outer, outer + spacing, width - outer - spacing, width - outer].map((z) => ({ x, z }))
      : [outer + 0.05, width - outer - 0.05].map((z) => ({ x, z })))

  const cab = van ? vanCab(van, width) : cabShape(p, positions[0]!, width, wheelY + wheelRadius + 0.04, wheelRadius)
  const gearboxX = cab.backX - 0.2
  const driveshaft: { fromX: number; toX: number }[] = []
  let from = gearboxX
  for (const axle of axles) {
    if (axle.kind !== 'drive') continue
    driveshaft.push({ fromX: from, toX: axle.x })
    from = axle.x
  }
  // Khung sườn hẹp lại ở xe hẹp để không lấn vào lốp trong
  const innerTyre = dualRear ? outer + spacing + tire / 2 : outer + 0.05 + tire / 2
  const railHalf = Math.max(0.2, Math.min(0.45, width / 2 - innerTyre - 0.08))
  const railH = p.railHeight || 0.1
  const cooling = vehicle.obstacles?.some((obstacle) => obstacle.type === 'COOLING_UNIT') ?? false
  const body: TruckBodyStyle | null = van ? null : isTruckBodyStyle(bodyStyle) ? bodyStyle : cooling ? 'TRUCK_REEFER' : 'TRUCK_BOX'
  const reeferTop = height - 0.06, reeferBottom = Math.max(cab.topY + 0.08, reeferTop - 0.6)
  const reeferWidth = Math.min(width - 0.3, 1.6)

  return {
    vehicleClass,
    profile: p,
    groundY,
    // Van: gương nhỏ, cản liền thân — hình chiếu sát thân hơn xe tải
    footprint: van
      ? { x: [cab.frontX - 0.12, length + 0.3], z: [-van.wall - 0.16, width + van.wall + 0.16] }
      : { x: [cab.frontX - 0.1, length + 0.25], z: [Math.min(0, cab.z[0]) - 0.3, Math.max(width, cab.z[1]) + 0.3] },
    boxTopY: height,
    wheelY,
    rearBumperY: van ? (van.rearBumper[0] + van.rearBumper[1]) / 2 : groundY + Math.min(0.5, p.floorHeight * 0.42),
    wheelRadius,
    tireWidth: tire,
    cab,
    axles,
    wheels,
    frame: {
      fromX: Math.min(cab.frontX + 0.05, positions[0]! - 0.9), toX: length + 0.12,
      railZ: [width / 2 - railHalf, width / 2 + railHalf], y: [RAIL_TOP, RAIL_TOP - railH],
    },
    driveshaft,
    gearboxX,
    exhaust: van ? [length - 0.2, van.sillY + 0.02, width * 0.78] : [cab.backX + 0.4, wheelY + 0.09, width + 0.02],
    reefer: cooling && reeferTop - reeferBottom > 0.2
      ? { x: [-0.3, -0.02], y: [reeferBottom, reeferTop], z: [(width - reeferWidth) / 2, (width + reeferWidth) / 2] }
      : null,
    van,
    body,
  }
}

/**
 * Khoá canh khung của xe có cabin: đổi theo kích thước lòng thùng và theo những gì làm hình xe dài / thấp đi (hạng, mũi cabin) —
 * đổi tải trọng ở form xe sang hạng khác thì camera canh lại, đổi trong cùng hạng thì không.
 */
export function vehicleFrameKey(vehicle: TruckLayoutInput, bodyStyle?: VehicleBodyStyle): string {
  const layout = truckLayout(vehicle, bodyStyle)
  const shape = layout.van ? `:${layout.van.style}` : `:${layout.body}`
  return `${vehicle.innerLengthCm}x${vehicle.innerWidthCm}x${vehicle.innerHeightCm}:${layout.vehicleClass}${shape}:${layout.cab.frontX.toFixed(2)}`
}
