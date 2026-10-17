import type { VehicleConfig } from '@/domain/models'
import type { CameraPreset } from '@/features/viewer3d/viewer-types'
import { WHEEL_RADIUS, WHEEL_Y } from './truck-layout'
import { containerSize, toScene, type Vec3 } from './units'

/**
 * Đường kích thước của xem trước ở form xe: mọi toạ độ suy thẳng từ số đang nhập (cm → scene qua `toScene`), không có số nào
 * tự đặt ngoài khoảng đưa đường ra khỏi cạnh thùng. Thuần, không Three.js — component chỉ đổi kết quả thành buffer.
 *
 * Hệ trục của nhóm xe: x dọc thùng (vách trước = 0, cửa sau = L), y cao (sàn = 0), z ngang (vách trái = 0).
 */

/** Khoảng đưa đường kích thước ra khỏi cạnh thùng, và độ dài phần nhô của đường gióng (m scene). */
export const DIMENSION_OFFSET = 0.3
const OVERSHOOT = 0.08
/** Đường gốc của vị trí trục nằm dưới mặt đất chừng này (m scene). */
const AXLE_BASELINE_DROP = 0.3
const AXLE_SIDE_OFFSET = 0.12
/** Hai trục gần nhau hơn chừng này (cầu đôi) thì nhãn của trục sau xuống tầng dưới để không đè nhau (m scene). */
const AXLE_LABEL_SPACING = 2.4

/** Mũi cabin và mặt đất của mô hình xe minh hoạ, tính từ vách trước và sàn thùng (m scene). */
const CAB_FRONT_X = -1.85
const GROUND_Y = WHEEL_Y - WHEEL_RADIUS
/** Cánh cửa sau mở 110°: đầu cánh lệch khỏi bản lề chừng này lần bề rộng cánh, về phía sau và sang ngang. */
const DOOR_SWING_BACK = 0.94
const DOOR_SWING_SIDE = 0.34

export type SpecMarkRole = 'dimension' | 'door' | 'axle'
export type SpecLabel = 'length' | 'width' | 'height' | 'door' | 'axles'
export const SPEC_LABELS: readonly SpecLabel[] = ['length', 'width', 'height', 'door', 'axles']

/**
 * Nhãn không hiện ở từng góc nhìn cố định: đường của nó nằm dọc tia nhìn (chỉ còn một chấm) hoặc nhãn rơi đè lên nhãn khác. Người
 * dùng tự xoay camera thì mọi nhãn hiện lại.
 */
export const HIDDEN_SPEC_LABELS: Partial<Record<CameraPreset, readonly SpecLabel[]>> = {
  'ben-hong': ['width', 'door'],
  'cua-sau': ['length', 'height', 'axles'],
  tren: ['height', 'axles'],
}
export type SpecSegment = { readonly role: SpecMarkRole; readonly from: Vec3; readonly to: Vec3 }

/** Ô cửa sau trong scene: căn giữa theo chiều ngang, sát sàn — domain chỉ dùng kích thước cửa, vị trí là hình minh hoạ. */
export type DoorOpening = {
  readonly width: number
  readonly height: number
  /** Bề rộng mỗi trụ cửa hai bên: (rộng thùng − rộng cửa) / 2 */
  readonly jamb: number
  /** Phần vách phía trên cửa: cao thùng − cao cửa */
  readonly header: number
}

export function doorOpening(vehicle: Pick<VehicleConfig, 'innerWidthCm' | 'innerHeightCm' | 'doorWidthCm' | 'doorHeightCm'>): DoorOpening {
  const width = toScene(Math.min(vehicle.doorWidthCm, vehicle.innerWidthCm))
  const height = toScene(Math.min(vehicle.doorHeightCm, vehicle.innerHeightCm))
  return {
    width,
    height,
    jamb: (toScene(vehicle.innerWidthCm) - width) / 2,
    header: toScene(vehicle.innerHeightCm) - height,
  }
}

export type SpecMarks = {
  readonly segments: readonly SpecSegment[]
  /** Điểm neo nhãn: giữa đường kích thước tương ứng */
  readonly anchors: { readonly length: Vec3; readonly width: Vec3; readonly height: Vec3; readonly door: Vec3 }
  /**
   * Trục đã khai, theo thứ tự vị trí; rỗng khi xe chưa khai trục (bánh trong hình khi đó là minh hoạ). `tier` là tầng của nhãn:
   * 0 sát đường gốc, 1 thấp hơn một dòng.
   */
  readonly axles: readonly { readonly id: string; readonly positionXCm: number; readonly anchor: Vec3; readonly tier: 0 | 1 }[]
}

/**
 * Những điểm xa nhất mà hình xem trước chạm tới — cabin, mặt đất, đường kích thước, đường gốc của trục, đầu hai cánh cửa đang mở —
 * để camera canh khung vừa khít. Chỉ phụ thuộc dài · rộng · cao lòng thùng: sửa cửa, vật cản hay trục không làm camera canh lại.
 */
export function specFramePoints(vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm'>): Vec3[] {
  const { length: L, height: H, width: W } = containerSize(vehicle)
  const top = H + DIMENSION_OFFSET + OVERSHOOT
  const marks = GROUND_Y - AXLE_BASELINE_DROP - OVERSHOOT
  const leaf = W / 2
  const points: Vec3[] = []
  for (const z of [0, W]) {
    for (const x of [CAB_FRONT_X, L]) points.push([x, GROUND_Y, z], [x, H, z])
    for (const x of [0, L]) points.push([x, top, z])
    for (const y of [0, H]) points.push([L + leaf * DOOR_SWING_BACK, y, z === 0 ? -leaf * DOOR_SWING_SIDE : W + leaf * DOOR_SWING_SIDE])
  }
  for (const y of [0, H]) points.push([0, y, W + DIMENSION_OFFSET + OVERSHOOT])
  for (const x of [CAB_FRONT_X, L]) points.push([x, marks, W + AXLE_SIDE_OFFSET])
  return points
}

export function vehicleSpecMarks(vehicle: VehicleConfig): SpecMarks {
  const { length: L, height: H, width: W } = containerSize(vehicle)
  const door = doorOpening(vehicle)
  const top = H + DIMENSION_OFFSET
  const side = W + DIMENSION_OFFSET
  const segments: SpecSegment[] = []
  const add = (role: SpecMarkRole, from: Vec3, to: Vec3) => segments.push({ role, from, to })

  // Dài: dọc cạnh nóc phía vách phải. Rộng: dọc cạnh nóc phía cửa sau. Hai đường gặp nhau ở góc nóc sau-phải.
  add('dimension', [0, top, W], [L, top, W])
  add('dimension', [L, top, 0], [L, top, W])
  for (const [x, z] of [[0, W], [L, W], [L, 0]] as const) add('dimension', [x, H, z], [x, top + OVERSHOOT, z])
  // Cao: dọc cạnh đứng trước-phải, đưa ra ngoài vách phải.
  add('dimension', [0, 0, side], [0, H, side])
  for (const y of [0, H]) add('dimension', [0, y, W], [0, y, side + OVERSHOOT])

  // Ô cửa sau: đúng rộng × cao đang nhập.
  const z0 = door.jamb, z1 = W - door.jamb
  add('door', [L, 0, z0], [L, door.height, z0])
  add('door', [L, door.height, z0], [L, door.height, z1])
  add('door', [L, door.height, z1], [L, 0, z1])
  add('door', [L, 0, z1], [L, 0, z0])

  const baseline = GROUND_Y - AXLE_BASELINE_DROP
  const axleZ = W + AXLE_SIDE_OFFSET
  const declared = [...(vehicle.axles ?? [])].sort((a, b) => a.positionXCm - b.positionXCm)
  const axles: SpecMarks['axles'][number][] = []
  for (const axle of declared) {
    const x = toScene(axle.positionXCm)
    const previous = axles.at(-1)
    add('axle', [x, WHEEL_Y, axleZ], [x, baseline - OVERSHOOT, axleZ])
    axles.push({
      id: axle.id,
      positionXCm: axle.positionXCm,
      anchor: [x, baseline - OVERSHOOT, axleZ],
      tier: previous && previous.tier === 0 && x - previous.anchor[0] < AXLE_LABEL_SPACING ? 1 : 0,
    })
  }
  if (axles.length > 0) {
    const xs = axles.map((axle) => axle.anchor[0])
    // Đường gốc nối mốc 0 (vách trước, có vạch gióng từ sàn xuống) với mọi trục: vị trí trục đo từ vách trước, âm là dưới cabin.
    add('axle', [Math.min(0, ...xs), baseline, axleZ], [Math.max(0, ...xs), baseline, axleZ])
    add('axle', [0, 0, axleZ], [0, baseline - OVERSHOOT, axleZ])
  }

  return {
    segments,
    anchors: {
      length: [L / 2, top, W],
      width: [L, top, W / 2],
      height: [0, H / 2, side],
      // Giữa ô cửa: nhãn nằm trong khoảng trống của ô, không đè lên đường kích thước chiều rộng ngay phía trên.
      door: [L, door.height / 2, W / 2],
    },
    axles,
  }
}
