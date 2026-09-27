import { roundCm } from '@/domain/geometry'
import type { PositionCm, ScenePlacement } from '@/features/viewer3d/scene-input'
import type { ObstacleBox } from '../scene/units'

/**
 * Trọng lực khi chỉnh tay (nhánh `fix/update-animation` của minkoi, đưa vào LM-108): kéo một kiện ra khỏi chồng thì các kiện đang tựa
 * lên nó rơi xuống mặt đỡ gần nhất bên dưới — kiện khác, mặt trên vật cản hoặc sàn thùng — và rơi dây chuyền lên trên. Chỉ đổi `z`,
 * không trượt ngang, không lật. Hàm thuần theo cm; dung sai chạm mặt 0,5 cm (lưới hút 5 cm, ngưỡng hút 2 cm của editor lớn hơn nhiều).
 * Kiện đã ghim giữ nguyên chỗ (ghim khoá dời, LM-034) — nếu nó lơ lửng thì constraint engine báo tỷ lệ đỡ đáy như mọi chỉnh tay khác.
 */
const TOUCH_TOLERANCE_CM = 0.5

type Box = Pick<ScenePlacement, 'position' | 'lengthCm' | 'widthCm' | 'heightCm'>

function overlaps(a: number, lengthA: number, b: number, lengthB: number): boolean {
  return a + lengthA > b + TOUCH_TOLERANCE_CM && b + lengthB > a + TOUCH_TOLERANCE_CM
}

/** Hai hộp chồng lên nhau khi nhìn từ trên xuống (mặt sàn x × y). */
function footprintsOverlap(a: Box, b: Box): boolean {
  return overlaps(a.position.x, a.lengthCm, b.position.x, b.lengthCm) && overlaps(a.position.y, a.widthCm, b.position.y, b.widthCm)
}

/** `upper` đang tựa lên `lower`: đáy chạm nóc (trong dung sai) và hai hộp chồng nhau nhìn từ trên. */
function restsOn(upper: Box, lower: Box): boolean {
  return Math.abs(upper.position.z - (lower.position.z + lower.heightCm)) < TOUCH_TOLERANCE_CM && footprintsOverlap(upper, lower)
}

function obstacleBox(obstacle: ObstacleBox): Box {
  return {
    position: { x: obstacle.xCm, y: obstacle.yCm, z: obstacle.zCm },
    lengthCm: obstacle.lengthCm, widthCm: obstacle.widthCm, heightCm: obstacle.heightCm,
  }
}

/** Mặt đỡ cao nhất bên dưới đáy `target` (nóc kiện khác hoặc vật cản có chồng nhau nhìn từ trên); không có thì sàn thùng (0). */
export function restingZ(target: Box & { id: string }, others: readonly (Box & { id?: string })[]): number {
  let top = 0
  for (const other of others) {
    if (other.id === target.id || !footprintsOverlap(target, other)) continue
    const otherTop = other.position.z + other.heightCm
    if (otherTop <= target.position.z + TOUCH_TOLERANCE_CM && otherTop > top) top = otherTop
  }
  return top
}

/**
 * Sau khi dời `movedId` (`before` → `after` chỉ khác kiện đó): các kiện đang tựa lên nó ở `before` mà nay không còn gì đỡ thì rơi xuống,
 * rồi tới các kiện tựa lên chúng. Trả vị trí mới (cm, đã `roundCm`) của những kiện rơi; rỗng khi không kiện nào rơi.
 */
export function settleAfterMove(
  movedId: string,
  before: readonly ScenePlacement[],
  after: readonly ScenePlacement[],
  obstacles: readonly ObstacleBox[] = [],
): Array<{ id: string; position: PositionCm }> {
  const moved = before.find((placement) => placement.id === movedId)
  if (!moved) return []
  const working = new Map(after.map((placement) => [placement.id, placement]))
  const supports = obstacles.map(obstacleBox)
  const queue = before.filter((placement) => placement.id !== movedId && restsOn(placement, moved)).map((placement) => placement.id)
  const fallen = new Map<string, PositionCm>()

  // Mỗi kiện rơi xuống thì chỉ thấp đi, nên vòng lặp dừng; giới hạn số bước để dữ liệu hỏng không treo trình duyệt
  for (let guard = 0; queue.length > 0 && guard < 5000; guard++) {
    const id = queue.shift()
    const placement = id === undefined ? undefined : working.get(id)
    if (!placement || placement.pinned) continue
    const z = roundCm(restingZ(placement, [...working.values(), ...supports]))
    if (z >= placement.position.z - TOUCH_TOLERANCE_CM) continue
    const position = { ...placement.position, z }
    working.set(placement.id, { ...placement, position })
    fallen.set(placement.id, position)
    // Kiện đang tựa lên kiện vừa rơi (theo chỗ cũ của nó) cũng có thể rơi theo
    for (const other of working.values()) {
      if (other.id !== placement.id && restsOn(other, placement)) queue.push(other.id)
    }
  }
  return [...fallen].map(([id, position]) => ({ id, position }))
}
