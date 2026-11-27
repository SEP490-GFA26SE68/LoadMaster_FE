import type { TruckBodyStyle } from '@/types/vehicle-body-style'
import { boardHeight, boxPiece, evenCenters, headboardHeight, rodPiece, type BodyPiece } from './body-pieces'
import { containerFrame, type ContainerBox } from './container-structure'

/**
 * Mảnh đặc **ngoài** lòng thùng của bốn thân xe tải (hệ góc thùng): mọi mảnh nằm hẳn ở x ≤ 0, x ≥ L, y ≤ 0, y ≥ H, z ≤ 0 hoặc z ≥ W,
 * nên kiện xếp sát vách không xuyên gì (`tests/viewer-truck-bodies.test.ts`). Component gộp tất cả vào một lưới màu theo đỉnh.
 * `detail` tắt (tier low) chỉ giữ dầm sàn và các trụ chính; cue nghiệp vụ (12 cạnh lòng thùng, cửa) không nằm ở đây.
 *
 * - Thùng kín: khung của `containerFrame` cộng đèn cờ góc trước, đèn hông.
 * - Đông lạnh: trụ góc trước và xà nóc tròn bằng nhôm (góc bo), khung cửa sau dày, ray nhôm chân vách.
 * - Mui bạt: dầm mép sàn, cọc thành, nẹp trên thành, trụ góc, khung mui cong qua nóc và thả xuống hai bên, bạt sau cuộn trên nóc.
 * - Lửng: dầm mép sàn, cọc thành, trụ góc sau thấp, tấm chắn đầu có khung trên và song chắn.
 */
const DECK = 0.12
const BEAM = 0.035
const POST = 0.05
const ROD = 0.045
const STAKE_PITCH = 1.2
/** Bạt sau cuộn tròn trên mép nóc sau. */
export const ROLLED_TARP_RADIUS = 0.09

/** Đèn cờ hông (hổ phách) giữa thân và đèn hông đỏ gần đuôi, gắn trên mặt ngoài cách vách `out`, ở độ cao `y`. */
function sideMarkers({ length: L, width: W }: ContainerBox, out: number, y: number): BodyPiece[] {
  const pieces: BodyPiece[] = []
  for (const [x, tone] of [[L / 2, 'marker'], [L - 0.25, 'tailLight']] as const) {
    pieces.push(boxPiece([x - 0.04, y - 0.025, -out - 0.012], [x + 0.04, y + 0.025, -out], tone))
    pieces.push(boxPiece([x - 0.04, y - 0.025, W + out], [x + 0.04, y + 0.025, W + out + 0.012], tone))
  }
  return pieces
}

/** Đèn cờ hai góc trên mặt trước (hổ phách), nhìn được từ cabin. */
function frontCornerMarkers({ width: W, height: H }: ContainerBox, out: number): BodyPiece[] {
  return [
    boxPiece([-out - 0.012, H - 0.07, -out], [-out, H - 0.02, -out + 0.04], 'marker'),
    boxPiece([-out - 0.012, H - 0.07, W + out - 0.04], [-out, H - 0.02, W + out], 'marker'),
  ]
}

function closedBox(box: ContainerBox, detail: boolean): BodyPiece[] {
  const frame: BodyPiece[] = containerFrame(box, detail).map(({ min, max, tone }) => boxPiece(min, max, tone))
  return detail ? [...frame, ...sideMarkers(box, 0.03, 0.14), ...frontCornerMarkers(box, ROD)] : frame
}

function reefer(box: ContainerBox, detail: boolean): BodyPiece[] {
  const { length: L, width: W, height: H } = box, r = ROD
  const pieces: BodyPiece[] = [
    // Khung cửa sau dày (bề dày vách cách nhiệt), ray nhôm chân hai vách
    boxPiece([L - 0.1, -0.05, -0.06], [L, H + 0.05, 0], 'insulated'),
    boxPiece([L - 0.1, -0.05, W], [L, H + 0.05, W + 0.06], 'insulated'),
    boxPiece([L - 0.1, H, 0], [L, H + 0.1, W], 'insulated'),
    boxPiece([0, -0.08, -BEAM], [L, 0.1, 0], 'metal'),
    boxPiece([0, -0.08, W], [L, 0.1, W + BEAM], 'metal'),
  ]
  if (!detail) return pieces
  pieces.push(
    // Góc bo: trụ góc trước, xà nóc hai bên và xà trên / dưới mặt trước là thanh nhôm tròn
    rodPiece('y', [-r, H / 2, -r], r, H, 'metal'),
    rodPiece('y', [-r, H / 2, W + r], r, H, 'metal'),
    rodPiece('x', [(L - 0.1 - r) / 2, H, -r], r, L - 0.1 + r, 'metal'),
    rodPiece('x', [(L - 0.1 - r) / 2, H, W + r], r, L - 0.1 + r, 'metal'),
    rodPiece('z', [-r, H, W / 2], r, W + 2 * r, 'metal'),
    rodPiece('z', [-r, 0, W / 2], r, W + 2 * r, 'metal'),
    // Nẹp nhôm khung cửa
    boxPiece([L - 0.015, -0.05, -0.065], [L + 0.005, H + 0.055, -0.045], 'metal'),
    boxPiece([L - 0.015, -0.05, W + 0.045], [L + 0.005, H + 0.055, W + 0.065], 'metal'),
    ...sideMarkers(box, BEAM, 0.02),
    ...frontCornerMarkers(box, 2 * r),
  )
  return pieces
}

/** Dầm mép sàn hai bên và đầu sàn (thân có sàn hở: mui bạt, lửng). */
function deckBeams({ length: L, width: W }: ContainerBox): BodyPiece[] {
  return [
    boxPiece([0, -DECK, -BEAM], [L, 0, 0], 'skirt'),
    boxPiece([0, -DECK, W], [L, 0, W + BEAM], 'skirt'),
    boxPiece([-BEAM, -DECK, -BEAM], [0, 0, W + BEAM], 'skirt'),
  ]
}

/** Trụ đứng ở hai góc tại `x0..x1`, cao tới `top`, bám mặt ngoài hai vách. */
function cornerPosts(x0: number, x1: number, top: number, W: number): BodyPiece[] {
  return [boxPiece([x0, -DECK, -POST], [x1, top, 0], 'skirt'), boxPiece([x0, -DECK, W], [x1, top, W + POST], 'skirt')]
}

/** Cọc thành và nẹp trên thành ván của hai bên. */
function sideBoards({ length: L, width: W }: ContainerBox, board: number): BodyPiece[] {
  const pieces: BodyPiece[] = []
  for (const x of evenCenters(L, STAKE_PITCH)) {
    pieces.push(boxPiece([x - 0.03, -DECK, -BEAM], [x + 0.03, board, 0], 'beam'), boxPiece([x - 0.03, -DECK, W], [x + 0.03, board, W + BEAM], 'beam'))
  }
  pieces.push(rodPiece('x', [L / 2, board, -0.025], 0.025, L, 'metal'), rodPiece('x', [L / 2, board, W + 0.025], 0.025, L, 'metal'))
  return pieces
}

function canvas(box: ContainerBox, detail: boolean): BodyPiece[] {
  const { length: L, width: W, height: H } = box
  const pieces = [...deckBeams(box), ...cornerPosts(L - 0.06, L, H, W), ...cornerPosts(-POST, 0, H, W)]
  if (!detail) return pieces
  const board = boardHeight(H), tarp = ROLLED_TARP_RADIUS
  pieces.push(...sideBoards(box, board), boxPiece([-POST, H - 0.05, 0], [0, H, W], 'skirt'))
  for (const x of evenCenters(L, 1)) {
    // Khung mui: thanh cong qua nóc, hai chân thả xuống tới thành
    pieces.push(rodPiece('z', [x, H + 0.02, W / 2], 0.02, W + 0.08, 'metal'))
    for (const z of [-0.02, W + 0.02]) pieces.push(rodPiece('y', [x, (board + H) / 2, z], 0.02, H - board, 'metal'))
  }
  pieces.push(rodPiece('x', [L / 2, H, -0.02], 0.02, L, 'metal'), rodPiece('x', [L / 2, H, W + 0.02], 0.02, L, 'metal'))
  // Bạt sau cuộn trên mép nóc sau, hai dây buộc
  const cx = L + 0.03 + tarp, cy = H - tarp
  pieces.push(rodPiece('z', [cx, cy, W / 2], tarp, W, 'tarp'))
  for (const z of [W * 0.25, W * 0.75]) pieces.push(rodPiece('z', [cx, cy, z], tarp + 0.006, 0.04, 'chassis'))
  pieces.push(...sideMarkers(box, BEAM, -DECK / 2))
  return pieces
}

function flatbed(box: ContainerBox, detail: boolean): BodyPiece[] {
  const { length: L, width: W, height: H } = box
  const board = boardHeight(H), head = headboardHeight(H)
  const pieces = [...deckBeams(box), ...cornerPosts(L - 0.06, L, Math.min(H, board + 0.06), W), ...cornerPosts(-POST, 0, head, W)]
  if (!detail) return pieces
  pieces.push(...sideBoards(box, board), boxPiece([-POST, head - 0.05, 0], [0, head, W], 'skirt'))
  if (head > board + 0.1) for (const z of evenCenters(W, 0.25)) pieces.push(boxPiece([-0.03, board, z - 0.012], [0, head - 0.05, z + 0.012], 'metal'))
  pieces.push(...sideMarkers(box, BEAM, -DECK / 2))
  return pieces
}

export function truckBodyExterior(body: TruckBodyStyle, box: ContainerBox, detail: boolean): BodyPiece[] {
  if (body === 'TRUCK_CANVAS') return canvas(box, detail)
  if (body === 'TRUCK_FLATBED') return flatbed(box, detail)
  if (body === 'TRUCK_REEFER') return reefer(box, detail)
  return closedBox(box, detail)
}
