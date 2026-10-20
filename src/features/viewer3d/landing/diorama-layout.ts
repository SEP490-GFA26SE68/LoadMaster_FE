import { expandPackages } from '@/domain/cargo'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import type { Insets } from '../scene/frame-fit'
import type { Vec3 } from '../scene/units'

/**
 * Sân kho thu nhỏ quanh xe trong khung 3D trang giới thiệu: nền, đường, sàn dock, bốn làn chờ theo điểm giao, nhà kho, cây — cảnh
 * minh hoạ, không chữ, không số, không biển hiệu. Toạ độ (m) theo hệ của nhóm xe trong `SceneCanvas`: x từ vách trước (0) tới cửa
 * sau (6), y cao (0 = sàn thùng), z ngang (0 = vách xa, 2,4 = vách gần). Thuần — không Three.js: hình 3D dựng ở `diorama-geometry.ts`,
 * hình poster SVG ở `features/marketing/DioramaPoster.tsx`, cùng các số này.
 */

export type StageView = 'overview' | 'truck' | 'zones'
/** Bề rộng trang: `wide` từ 1.280 px · `medium` 768–1.279 px · `narrow` dưới 768 px. */
export type HeroTier = 'wide' | 'medium' | 'narrow'

/**
 * Lề (px) của góc Toàn cảnh nơi nút, thẻ chuyến và Lumo nằm đè lên khung: cảnh được canh vào phần còn lại. Lề dưới của `wide` là đỉnh
 * bong bóng của Lumo: cách mép 16 px, đáy bong bóng nâng 72 px cho đuôi ngang miệng Lumo 144 px, câu dài nhất ba dòng (chừng 96 px).
 */
export const HERO_INSETS: Record<HeroTier, Insets> = {
  wide: { top: 76, right: 16, bottom: 184, left: 48 },
  medium: { top: 72, right: 16, bottom: 16, left: 16 },
  narrow: { top: 72, right: 12, bottom: 12, left: 12 },
}

/** Camera của khung: góc nhìn dọc hẹp (độ), sân kho đọc như mô hình thu nhỏ; góc Xe và Vùng điểm giao không HUD nên đứng gần hơn khung vừa khít `zoom` lần. */
export const STAGE_CAMERA = { fov: 26, zoom: 1.3 } as const

export type Range = readonly [number, number]
/** Đa giác trên mặt bằng: các đỉnh (x, z) theo một chiều. */
export type Footprint = readonly (readonly [number, number])[]

export type DioramaLane = {
  readonly stop: number
  /** Một ô (m) theo [x, y, z]: đúng dài × cao × rộng của kiện thuộc điểm giao đó */
  readonly cell: Vec3
  /** Số ô theo x, số ô theo z, số tầng */
  readonly grid: readonly [number, number, number]
  readonly z: Range
}

export type Diorama = {
  readonly slab: { readonly footprint: Footprint; readonly top: number; readonly bottom: number }
  /** Bãi đỗ dưới xe; đầu bãi dừng trước hàng cây (cây chỉ đứng ở x < −2) */
  readonly road: { readonly x: Range; readonly z: Range; readonly top: number; readonly line: number }
  readonly dock: { readonly footprint: Footprint; readonly top: number; readonly band: number }
  readonly leveller: { readonly x: Range; readonly z: Range; readonly top: number; readonly thickness: number }
  readonly warehouse: {
    /** Mái ở `top`, tường chắn mái cao `parapet` dày `parapetWidth`; dải màu quanh hai mặt nhìn thấy ở độ cao `band` */
    readonly x: Range; readonly z: Range; readonly top: number; readonly parapet: number; readonly parapetWidth: number; readonly band: Range
    /** Hai cửa dock trên mặt +z, từ mặt dock lên `doorTop` */
    readonly doors: readonly Range[]; readonly doorTop: number
  }
  readonly trees: readonly { readonly x: number; readonly z: number; readonly height: number }[]
  /** Hộp bao của xe minh hoạ: đầu cabin tới mút hai cánh cửa sau đang mở (110°) */
  readonly truck: { readonly x: Range; readonly y: Range; readonly z: Range }
  /** Đầu các làn, sát mép trước của dock */
  readonly laneX: number
  readonly lanes: readonly DioramaLane[]
}

export const DIORAMA: Diorama = {
  slab: { footprint: [[-3.4, 3.4], [8.6, 3.4], [12, 0], [12, -10.8], [5, -10.8], [-3.4, -3]], top: -1.12, bottom: -1.35 },
  road: { x: [-2.1, 6], z: [-0.6, 3], top: -1.115, line: 0.08 },
  dock: { footprint: [[7.4, 3], [9, 3], [11.6, 0.4], [11.6, -8.6], [7.4, -8.6]], top: 0, band: 0.06 },
  leveller: { x: [6, 7.4], z: [0.2, 2.2], top: 0, thickness: 0.08 },
  warehouse: { x: [7.2, 11.8], z: [-10.6, -8.6], top: 2.9, parapet: 0.3, parapetWidth: 0.16, band: [2.42, 2.58], doors: [[7.8, 9.2], [9.8, 11.2]], doorTop: 2.3 },
  trees: [{ x: -2.7, z: -2.2, height: 1.6 }, { x: -2.9, z: -0.6, height: 2 }, { x: -2.6, z: 1, height: 1.3 }, { x: -2.9, z: 2.6, height: 1.8 }],
  truck: { x: [-1.85, 7.13], y: [-1.1, 2.55], z: [-0.41, 2.81] },
  laneX: 7.65,
  lanes: [
    { stop: 1, cell: [0.6, 0.4, 0.4], grid: [6, 4, 4], z: [-2, -0.4] },
    { stop: 2, cell: [0.6, 0.3, 0.4], grid: [6, 4, 4], z: [-4, -2.4] },
    { stop: 3, cell: [0.8, 0.48, 0.6], grid: [4, 3, 3], z: [-6.2, -4.4] },
    { stop: 4, cell: [0.4, 0.3, 0.3], grid: [9, 4, 4], z: [-7.8, -6.6] },
  ],
}

/** Màu của từng phần (tên token ở `src/index.css`); màu làn là màu điểm giao của làn đó (`stopColor`). */
export const DIORAMA_COLORS = {
  slabTop: '--n-700',
  slabSide: '--cyan-950',
  road: '--n-800',
  roadLine: '--n-500',
  dockTop: '--n-600',
  dockFace: '--n-700',
  dockEdge: '--cyan-300',
  leveller: '--n-500',
  wall: '--n-200',
  roof: '--cyan-700',
  band: '--cyan-300',
  door: '--cyan-950',
  canopy: '--cyan-800',
  trunk: '--n-700',
} as const

/** Hệ số sáng (nhân trong không gian tuyến tính) của phần quá tối dưới ánh sáng chung của `SceneLighting`: tán cây cyan-800 lẫn vào nền tối. */
export const DIORAMA_LIFT: Partial<Record<keyof typeof DIORAMA_COLORS, number>> = { canopy: 1.8 }

/** Mặt cắt cabin (x, y) quanh `CAB_X`, như `TruckCab`: khối thay cabin ở tier thấp và ảnh tĩnh dùng chung. */
export const CAB_PROFILE: Footprint = [[-0.75, 0.35], [0.75, 0.35], [0.75, 2.3], [-0.46, 2.3], [-0.75, 1.35]]

export function prismCorners(footprint: Footprint, bottom: number, top: number): Vec3[] {
  return footprint.flatMap(([x, z]): Vec3[] => [[x, bottom, z], [x, top, z]])
}

export function boxCorners(x: Range, y: Range, z: Range): Vec3[] {
  return x.flatMap((px) => y.flatMap((py) => z.map((pz): Vec3 => [px, py, pz])))
}

/** Điểm canh khung của góc Toàn cảnh (`SceneCanvas framePoints`): các góc của nền và của nhà kho kể cả tường chắn mái. */
export const DIORAMA_FRAME_POINTS: readonly Vec3[] = [
  ...prismCorners(DIORAMA.slab.footprint, DIORAMA.slab.bottom, DIORAMA.slab.top),
  ...boxCorners(DIORAMA.warehouse.x, [DIORAMA.slab.top, DIORAMA.warehouse.top + DIORAMA.warehouse.parapet], DIORAMA.warehouse.z),
]

/** Mặt bằng và chiều cao chồng hàng đầy của một làn. */
export function laneBounds(lane: DioramaLane): { x: Range; z: Range; height: number } {
  return { x: [DIORAMA.laneX, DIORAMA.laneX + lane.grid[0] * lane.cell[0]], z: lane.z, height: lane.grid[2] * lane.cell[1] }
}

export type LaneSlot = {
  readonly instanceId: string
  readonly stop: number
  /** 0 = làn của điểm giao đầu */
  readonly lane: number
  /** 0 = tầng đáy */
  readonly layer: number
  /** `loadingOrder` của kiện trong phương án; `null`: kiện chưa xếp được, ở lại làn */
  readonly loadingOrder: number | null
  /** Tâm ô (m) */
  readonly center: Vec3
  /** Kích thước ô [x, y, z] (m) */
  readonly size: Vec3
}

type Cell = { layer: number; ix: number; iz: number }

/**
 * Mỗi kiện của lần chạy giữ **đúng một** ô trong làn của điểm giao mình. Kiện của một điểm xếp theo `loadingOrder`, kiện chưa xếp được
 * đứng cuối. Ô có hàng là các ô thấp nhất (tầng đáy trước, nên không hộp nào lơ lửng); kiện lấy ô theo thứ tự bốc: tầng trên trước,
 * rồi x tăng từ phía cầu dẫn, rồi z tiến về phía xe — làn vơi từ trên xuống, kiện chưa xếp được nằm dưới cùng.
 */
export function laneSlots(request: OptimizationRequest, result: OptimizationResult): LaneSlot[] {
  const orderOf = new Map(result.placements.map((p) => [p.packageInstanceId, p.loadingOrder]))
  const { instances } = expandPackages(request.packages)
  const missing = instances.find((instance) => !DIORAMA.lanes.some((lane) => lane.stop === instance.deliveryStop))
  if (missing) throw new Error(`Sân kho không có làn cho điểm giao ${missing.deliveryStop}`)
  return DIORAMA.lanes.flatMap((lane, index) => {
    const queue = instances
      .filter((instance) => instance.deliveryStop === lane.stop)
      .map((instance) => ({ id: instance.packageInstanceId, order: orderOf.get(instance.packageInstanceId) ?? null }))
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.id.localeCompare(b.id))
    const [nx, nz, layers] = lane.grid
    if (queue.length > nx * nz * layers) throw new Error(`Làn của điểm giao ${lane.stop} có ${nx * nz * layers} ô cho ${queue.length} kiện`)
    const filled: Cell[] = []
    for (let layer = 0; layer < layers && filled.length < queue.length; layer++)
      for (let ix = 0; ix < nx && filled.length < queue.length; ix++)
        for (let iz = 0; iz < nz && filled.length < queue.length; iz++) filled.push({ layer, ix, iz })
    const picks = filled.sort((a, b) => b.layer - a.layer || a.ix - b.ix || a.iz - b.iz)
    const [cx, cy, cz] = lane.cell
    return queue.map(({ id, order }, k): LaneSlot => {
      const { layer, ix, iz } = picks[k]!
      return {
        instanceId: id, stop: lane.stop, lane: index, layer, loadingOrder: order,
        center: [DIORAMA.laneX + (ix + 0.5) * cx, DIORAMA.dock.top + (layer + 0.5) * cy, lane.z[0] + (iz + 0.5) * cz],
        size: [cx, cy, cz],
      }
    })
  })
}

/** Hộp còn ở làn khi kiện chưa vào thùng ở bước `step` (thùng hiện kiện có `loadingOrder` ≤ `step`): mỗi kiện ở đúng một nơi. */
export function laneVisible(slot: LaneSlot, step: number): boolean {
  return slot.loadingOrder === null || slot.loadingOrder > step
}
