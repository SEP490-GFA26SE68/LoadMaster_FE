import type { VehicleAxle } from '@/domain/models'
import { toScene } from './units'

/** Đơn vị scene (m), hệ trục của nhóm xe: x dọc thùng (vách trước = 0), y cao (sàn thùng = 0), z ngang (vách trái = 0). */
export const CAB_X = -1
export const WHEEL_RADIUS = 0.5
export const WHEEL_Y = -0.6
const TIRE_WIDTH = 0.3
/** Khoảng tâm hai lốp của bánh đôi: bề rộng lốp + khe 2 cm. */
const DUAL_SPACING = TIRE_WIDTH + 0.02

export type TruckAxle = { readonly x: number; readonly kind: 'steer' | 'drive'; readonly dual: boolean }
export type TruckWheel = { readonly x: number; readonly z: number }

export type TruckLayout = {
  readonly axles: readonly TruckAxle[]
  readonly wheels: readonly TruckWheel[]
  /** Hai thanh khung sườn dọc, từ cản trước tới qua cửa sau */
  readonly frame: { readonly fromX: number; readonly toX: number; readonly railZ: readonly [number, number] }
  /** Trục các-đăng: từ hộp số tới từng cầu chủ động */
  readonly driveshaft: readonly { readonly fromX: number; readonly toX: number }[]
}

/**
 * Bố cục khung gầm **minh hoạ** (không phải hình học trục có thẩm quyền, AGENTS mục 7): trục lấy `vehicle.axles`
 * (`positionXCm` tính từ vách trước, âm là nằm dưới cabin) khi xe có khai báo; không có thì cầu trước dưới cabin và
 * cầu sau đôi như bản vẽ cũ. Trục đầu tiên theo x là cầu dẫn hướng bánh đơn, các trục sau là cầu chủ động bánh đôi.
 *
 * `positionXCm` cùng hệ toạ độ với thùng (FE-5b-03): `toScene(positionXCm)` đặt thẳng lên trục x của nhóm xe, chính là trục X của
 * placement (`xCm`, vách trước = 0, cửa sau ở `innerLengthCm`) — không cộng thêm độ dời nào. Mô hình tải trục của domain
 * (`axleLoadsOf`) vì vậy dùng `positionXCm` và hoành độ trọng tâm hàng trên cùng một trục, và cũng coi trục có x nhỏ nhất là trục trước.
 * Hàm này chỉ vẽ, không tính tải trục; trục mặc định khi xe không khai báo là hình minh hoạ và **không** đưa vào phép tính.
 */
export function truckLayout(length: number, width: number, axles?: readonly VehicleAxle[]): TruckLayout {
  const positions = axles?.length
    ? axles.map((axle) => toScene(axle.positionXCm)).sort((a, b) => a - b)
    : [CAB_X, length * 0.72, length * 0.72 + 1.15]
  const list: TruckAxle[] = positions.map((x, i) => ({ x, kind: i === 0 ? 'steer' : 'drive', dual: i > 0 }))

  const outer = TIRE_WIDTH / 2 + 0.03
  const wheels: TruckWheel[] = list.flatMap(({ x, dual }) => dual
    ? [outer, outer + DUAL_SPACING, width - outer - DUAL_SPACING, width - outer].map((z) => ({ x, z }))
    : [0.2, width - 0.2].map((z) => ({ x, z })))

  const gearboxX = CAB_X + 0.7
  const driveshaft: { fromX: number; toX: number }[] = []
  let from = gearboxX
  for (const axle of list) {
    if (axle.kind !== 'drive') continue
    driveshaft.push({ fromX: from, toX: axle.x })
    from = axle.x
  }

  return {
    axles: list,
    wheels,
    frame: { fromX: Math.min(CAB_X - 0.85, positions[0]! - 0.9), toX: length + 0.12, railZ: [width / 2 - 0.45, width / 2 + 0.45] },
    driveshaft,
  }
}
