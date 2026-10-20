import { axleLoadsOf, checkAxleLoads, type AxleGroup, type AxleGroupLoad } from '@/domain/metrics'
import type { VehicleConfig } from '@/domain/models'
import { seedVehicles } from '@/lib/mock-db/seed-vehicles'

/**
 * Tải trục tương tác của trang giới thiệu (`#tai-truc`), hàm thuần. Xe là một xe mẫu của seed (`seed-vehicles.ts` — chỉ dữ liệu thuần, không
 * kéo kho mẫu vào trang): kích thước lòng thùng, tải trọng và hai trục khai bằng `twoAxles` (số ước lượng theo cỡ xe, chưa đối chiếu thông số
 * nhà sản xuất). Người xem dời một khối hàng dài một phần ba thùng: giá trị của thanh trượt chính là hoành độ trọng tâm hàng (cm, tính từ vách
 * trước), và tải hai nhóm trục do `axleLoadsOf` của domain tính — cùng mô hình đòn bẩy mà Planner dùng —, vượt giới hạn do `checkAxleLoads`.
 */

/** Xe tải 7,2 m của seed: hai trục, tải trọng lớn nhất trong đội xe mẫu đang chạy. */
export const AXLE_DEMO_VEHICLE_ID = 'VEHICLE-002'

/** Bước của thanh trượt trọng tâm (cm) và của thanh trượt khối lượng (kg): bước của giao diện, không phải số đo. */
export const CENTER_STEP_CM = 10
export const WEIGHT_STEP_KG = 500

export type AxleDemoTruck = Pick<
  VehicleConfig,
  'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg' | 'axles' | 'frontAxleLimitKg' | 'rearAxleLimitKg'
>

/** Xe mẫu của mục tải trục, đọc từ seed. Seed đổi mà xe này mất trục là lỗi lập trình — test canh. */
export function demoTruck(): AxleDemoTruck {
  const vehicle = seedVehicles().find((item) => item.id === AXLE_DEMO_VEHICLE_ID)
  if (vehicle === undefined || (vehicle.axles ?? []).length < 2) throw new Error(`Xe mẫu ${AXLE_DEMO_VEHICLE_ID} phải có hai trục`)
  return vehicle
}

/** Khối hàng dài một phần ba lòng thùng; trọng tâm của nó chạy từ nửa khối sau vách trước tới nửa khối trước cửa sau. */
export function cargoLengthCm(truck: AxleDemoTruck): number {
  return truck.innerLengthCm / 3
}

export type SliderRange = { readonly min: number; readonly max: number; readonly step: number }

export function centerRange(truck: AxleDemoTruck): SliderRange {
  const half = cargoLengthCm(truck) / 2
  return { min: half, max: truck.innerLengthCm - half, step: CENTER_STEP_CM }
}

export function weightRange(truck: AxleDemoTruck): SliderRange {
  return { min: WEIGHT_STEP_KG, max: truck.maxPayloadKg, step: WEIGHT_STEP_KG }
}

/** Lúc mở: hàng đủ tải trọng, trọng tâm giữa thùng. */
export function initialState(truck: AxleDemoTruck): AxleDemoInput {
  return { centerXCm: truck.innerLengthCm / 2, totalKg: truck.maxPayloadKg }
}

export type AxleDemoInput = { readonly centerXCm: number; readonly totalKg: number }

export type AxleDemoGroup = AxleGroupLoad & {
  readonly group: AxleGroup
  /** Giới hạn của nhóm (xe mẫu khai đủ cả hai). */
  readonly limitKg: number
  /** Phần vượt giới hạn đã làm tròn 0,01 kg như issue `AXLE_OVERLOAD`; `null` khi không vượt. */
  readonly overKg: number | null
}

export type AxleDemoResult = { readonly front: AxleDemoGroup; readonly rear: AxleDemoGroup }

const clamp = (value: number, { min, max }: SliderRange) => Math.min(max, Math.max(min, value))

/** Giá trị của hai thanh trượt → tải hai nhóm trục. Giá trị ngoài khoảng của thanh trượt bị kẹp lại, như trình duyệt kẹp ô `range`. */
export function axleDemo(truck: AxleDemoTruck, input: AxleDemoInput): AxleDemoResult {
  const cargo = { totalKg: clamp(input.totalKg, weightRange(truck)), centerXCm: clamp(input.centerXCm, centerRange(truck)) }
  const loads = axleLoadsOf(truck, cargo)
  if (loads.status !== 'computed') throw new Error(`Xe mẫu không tính được tải trục: ${loads.reason}`)
  const issues = checkAxleLoads(loads)
  const group = (name: AxleGroup): AxleDemoGroup => {
    const load = loads[name]
    if (load.limitKg === undefined) throw new Error('Xe mẫu phải khai giới hạn cho cả hai nhóm trục')
    const issue = issues.find((item) => item.params.group === name)
    return { ...load, group: name, limitKg: load.limitKg, overKg: issue?.params.overKg ?? null }
  }
  return { front: group('front'), rear: group('rear') }
}

/** Thanh đo của một trục chia theo 1,5 lần giới hạn: vạch giới hạn ở hai phần ba thanh, tải lớn nhất của xe mẫu vẫn nằm trong thanh. */
export const METER_SCALE = 1.5

/** Tỷ lệ 0–1 của thanh đo: phần tải khi xe rỗng (hàng nhấc bớt tải thì phần này ngắn lại) và phần hàng dồn lên. */
export function meterParts(load: Pick<AxleDemoGroup, 'emptyLoadKg' | 'cargoLoadKg' | 'loadKg' | 'limitKg'>) {
  const scale = load.limitKg * METER_SCALE
  const ratio = (kg: number) => Math.min(1, Math.max(0, kg / scale))
  const base = ratio(Math.min(load.emptyLoadKg, load.loadKg))
  return { base, cargo: Math.max(0, ratio(load.loadKg) - base), limit: 1 / METER_SCALE }
}
