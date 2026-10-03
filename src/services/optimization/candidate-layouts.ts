import type { PackageInstance } from '@/domain/cargo'
import { gt, lt } from '@/domain/geometry'
import { axleLoadsOf, cargoMass } from '@/domain/metrics'
import { packInput, rehandlingOf, type MockPlan } from './mock-plan'
import type { OptimizationProgress } from './OptimizationService'
import { packShelves, packWholeLane, type Packed } from './shelf-packer'

/** Bước lùi của lượt cân tải trục, cm — cùng bước lưới của editor. */
const SHIFT_STEP_CM = 5

/** Một cách xếp đã chấm theo ba mục tiêu. */
export type Layout = {
  readonly packed: Packed
  readonly placed: number
  readonly volumeCm3: number
  /**
   * Hàng dồn về đầu nào: mức dùng nhóm trục trước − mức dùng nhóm trục sau (tải / giới hạn); dương là nặng đầu. Xe không đủ dữ liệu
   * trục, hoặc một nhóm chưa có giới hạn, thì là độ lệch trọng tâm hàng so với giữa thùng theo tỷ lệ chiều dài (dương là dồn về vách
   * trong). Giá trị tuyệt đối là độ lệch mà mục tiêu cân tải trục muốn nhỏ nhất.
   */
  readonly lean: number
  readonly rehandling: number
}

type Report = ((progress: OptimizationProgress) => void) | undefined

function layoutOf(plan: MockPlan, packed: Packed): Layout {
  const { vehicle } = plan.request
  const mass = cargoMass(packed.placements, ({ packageInstanceId }) => plan.instances.get(packageInstanceId)?.weightKg ?? 0)
  const centerXCm = mass.center?.x
  const loads = axleLoadsOf(vehicle, { totalKg: mass.totalKg, centerXCm })
  const byAxles = loads.status === 'computed' && loads.front.limitKg !== undefined && loads.rear.limitKg !== undefined
    ? loads.front.loadKg / loads.front.limitKg - loads.rear.loadKg / loads.rear.limitKg
    : undefined
  return {
    packed,
    placed: packed.placements.length,
    volumeCm3: packed.placements.reduce((sum, p) => sum + p.placedLengthCm * p.placedWidthCm * p.placedHeightCm, 0),
    lean: byAxles ?? (centerXCm === undefined ? 0 : (vehicle.innerLengthCm / 2 - centerXCm) / vehicle.innerLengthCm),
    rehandling: rehandlingOf(plan, packed),
  }
}

/** Còn kiện ở lại vì hết chỗ (không phải vì lý do biết trước hay ràng buộc). */
function outOfSpace({ packed }: Layout): boolean {
  return packed.unplaced.some(({ reasonCode }) => reasonCode === 'NO_SPACE' || reasonCode === 'STACKING_VIOLATION')
}

/** Nặng đầu: có kiện ở lại vì nhóm trục trước vượt giới hạn, hoặc hàng đang dồn về phía trước. */
function frontHeavy(layout: Layout): boolean {
  const overloaded = layout.packed.unplaced.flatMap(({ violatedConstraints = [] }) => violatedConstraints)
    .flatMap((issue) => (issue.code === 'AXLE_OVERLOAD' ? [issue.params.group] : []))
  if (overloaded.length > 0) return overloaded.includes('front')
  return gt(layout.lean, 0)
}

/**
 * Các lượt xếp lùi về phía cửa: cùng dải liền của lượt dồn sát nhưng bắt đầu cách vách trong một đoạn. Chỉ thử khi lượt dồn sát nặng
 * đầu và không thiếu chỗ. Tìm nhị phân trên lưới 5 cm điểm bắt đầu mà hàng thôi nặng đầu: lượt còn nặng đầu thì lùi thêm, lượt hết chỗ
 * hoặc đã nặng đuôi thì lùi ít lại — vài lượt là tới hai mốc lưới kề nhau quanh điểm cân. Trả mọi lượt đã thử, theo điểm bắt đầu tăng dần.
 */
function shiftedLayouts(plan: MockPlan, order: readonly PackageInstance[], compact: Layout, report: Report): Layout[] {
  if (outOfSpace(compact) || !frontHeavy(compact)) return []
  const tried: { startXCm: number; layout: Layout }[] = []
  let near = 0
  let far = Math.floor(plan.request.vehicle.innerLengthCm / SHIFT_STEP_CM)
  while (far - near > 1) {
    const middle = Math.floor((near + far) / 2)
    const startXCm = middle * SHIFT_STEP_CM
    // Chỉ lượt đầu báo tiến độ: các lượt sau xếp lại cùng số kiện
    const layout = layoutOf(plan, packWholeLane({ ...packInput(plan, order), onProgress: tried.length === 0 ? report : undefined }, startXCm))
    tried.push({ startXCm, layout })
    if (!outOfSpace(layout) && frontHeavy(layout)) near = middle
    else far = middle
  }
  return tried.toSorted((a, b) => a.startXCm - b.startXCm).map(({ layout }) => layout)
}

/** Cách xếp tốt nhất theo `better`; hoà thì giữ cách đứng trước trong `layouts`. */
function pick(layouts: readonly Layout[], better: (a: Layout, b: Layout) => boolean): Layout {
  return layouts.reduce((best, layout) => (better(layout, best) ? layout : best))
}

export type CandidateLayouts = {
  /** Cách xếp mỗi mục tiêu chọn. Hai mục tiêu có thể chọn trùng một cách xếp (cùng một đối tượng). */
  readonly chosen: { readonly MAX_VOLUME: Layout; readonly AXLE_BALANCE: Layout; readonly MIN_REHANDLING: Layout }
  /** Thời gian của ba lượt xếp — dồn sát, lùi về phía cửa, theo vùng — theo đúng thứ tự A · B · C, ms. */
  readonly packMs: readonly [number, number, number]
}

/**
 * Dựng các cách xếp của một lần chạy rồi chọn cho từng mục tiêu (FE-5b-05, D-77):
 * - **dồn sát**: một dải liền từ vách trong, không chừa vùng — dùng ít chiều dài thùng nhất;
 * - **lùi về phía cửa** (`shiftedLayouts`): dải liền đó, bắt đầu cách vách trong một đoạn để hai nhóm trục cùng mức dùng;
 * - **theo vùng điểm giao**: `packShelves` với các vùng của D-79, điểm cuối trước.
 * Kiện đặt chỗ theo `order`; lượt theo vùng luôn theo điểm giao.
 *
 * - `MAX_VOLUME`: cách xếp được nhiều thể tích nhất; hoà thì nhiều kiện hơn, rồi cách dồn về vách trong hơn.
 * - `AXLE_BALANCE`: trong các cách xếp được nhiều kiện nhất, cách lệch tải giữa hai nhóm trục ít nhất.
 * - `MIN_REHANDLING`: trong các cách xếp được nhiều kiện nhất, cách có ít kiện nằm ngoài vùng điểm giao nhất; hoà thì cách theo vùng.
 * Không mục tiêu nào đổi kiện lấy chỉ số: B và C chỉ chọn trong các cách xếp được nhiều kiện nhất.
 */
export function candidateLayouts(
  plan: MockPlan,
  order: readonly PackageInstance[],
  { clock, report }: { clock: () => number; report: (objective: 'MAX_VOLUME' | 'AXLE_BALANCE' | 'MIN_REHANDLING') => Report },
): CandidateLayouts {
  const marks = [clock()]
  const compact = layoutOf(plan, packWholeLane({ ...packInput(plan, order), onProgress: report('MAX_VOLUME') }))
  marks.push(clock())
  const shifted = shiftedLayouts(plan, order, compact, report('AXLE_BALANCE'))
  // Không có lượt lùi nào: phương án cân tải trục chọn trong các lượt khác, coi như đã xét xong
  if (shifted.length === 0 && order.length > 0) report('AXLE_BALANCE')?.({ placed: order.length, total: order.length })
  marks.push(clock())
  const zoned = layoutOf(plan, packShelves({ ...packInput(plan, plan.lifo), zones: plan.zones, onProgress: report('MIN_REHANDLING') }))
  marks.push(clock())

  const most = Math.max(compact.placed, zoned.placed, ...shifted.map(({ placed }) => placed))
  const fullest = (layouts: readonly Layout[]) => layouts.filter(({ placed }) => placed === most)
  const [t0, t1, t2, t3] = marks as [number, number, number, number]
  return {
    chosen: {
      MAX_VOLUME: pick([compact, ...shifted, zoned], (a, b) => gt(a.volumeCm3, b.volumeCm3) || (!lt(a.volumeCm3, b.volumeCm3) && a.placed > b.placed)),
      AXLE_BALANCE: pick(fullest([...shifted, compact, zoned]), (a, b) => lt(Math.abs(a.lean), Math.abs(b.lean))),
      MIN_REHANDLING: pick(fullest([zoned, compact, ...shifted]), (a, b) => a.rehandling < b.rehandling),
    },
    packMs: [t1 - t0, t2 - t1, t3 - t2],
  }
}
