import type { TruckBodyStyle } from '@/types/vehicle-body-style'

/**
 * Mảnh đặc **ngoài** lòng thùng của bốn thân xe tải (đơn vị scene, hệ góc thùng: x từ vách trước = 0 tới cửa sau = L, y từ sàn = 0,
 * z từ vách trái = 0): hộp hoặc thanh tròn, mỗi mảnh một tông màu. Component gộp mọi mảnh vào **một** lưới màu theo đỉnh. Thuần, không
 * Three.js — test kiểm không mảnh nào chạm vào khoảng mở (0, L) × (0, H) × (0, W) của lòng thùng.
 */
export type Vec3 = readonly [number, number, number]
export type BodyTone = 'skirt' | 'beam' | 'metal' | 'chassis' | 'marker' | 'tailLight' | 'tarp' | 'insulated' | 'light'
export type BoxPiece = { readonly kind: 'box'; readonly min: Vec3; readonly max: Vec3; readonly tone: BodyTone }
export type RodPiece = {
  readonly kind: 'rod'; readonly axis: 'x' | 'y' | 'z'; readonly center: Vec3; readonly radius: number; readonly span: number
  readonly tone: BodyTone
}
export type BodyPiece = BoxPiece | RodPiece

export const boxPiece = (min: Vec3, max: Vec3, tone: BodyTone): BoxPiece => ({ kind: 'box', min, max, tone })
export const rodPiece = (axis: RodPiece['axis'], center: Vec3, radius: number, span: number, tone: BodyTone): RodPiece =>
  ({ kind: 'rod', axis, center, radius, span, tone })

const AXIS = { x: 0, y: 1, z: 2 } as const

/** Hộp bao của một mảnh: thanh tròn là trụ nên hộp bao ôm sát tiết diện của nó. */
export function pieceBounds(piece: BodyPiece): { min: Vec3; max: Vec3 } {
  if (piece.kind === 'box') return piece
  const along = AXIS[piece.axis]
  const half = (i: number) => (i === along ? piece.span / 2 : piece.radius)
  const min = piece.center.map((c, i) => c - half(i)) as unknown as Vec3
  const max = piece.center.map((c, i) => c + half(i)) as unknown as Vec3
  return { min, max }
}

/** Thành thấp của thân mui bạt và thân lửng: một phần tư cao lòng thùng, trong 0,4–0,6 m, không bao giờ cao hơn lòng thùng. */
export const BOARD_MIN = 0.4
export const BOARD_MAX = 0.6
export function boardHeight(height: number): number {
  return Math.min(height, Math.min(BOARD_MAX, Math.max(BOARD_MIN, height * 0.25)))
}

/** Tấm chắn đầu thân lửng (sau lưng cabin): cao ít nhất 1 m, không thấp hơn thành, không cao hơn lòng thùng. */
export function headboardHeight(height: number): number {
  return Math.min(height, Math.max(boardHeight(height), 1))
}

/** Bửng sau của thân mui bạt và thân lửng: dày chừng này, cao bằng thành (không quá ô cửa). */
export const TAILGATE_THICKNESS = 0.04
export function tailgateHeight(height: number, doorHeight: number): number {
  return Math.min(boardHeight(height), doorHeight)
}

/** Thân có bửng sau hạ xuống (thay hai cánh cửa). */
export function hasTailgate(body: TruckBodyStyle | null): boolean {
  return body === 'TRUCK_CANVAS' || body === 'TRUCK_FLATBED'
}

/** Vị trí tâm các mốc cách đều (khung mui, cọc thành), không trùng hai đầu `length`; bước gần `pitch`. */
export function evenCenters(length: number, pitch: number): number[] {
  const count = Math.max(1, Math.round(length / pitch) - 1)
  return Array.from({ length: count }, (_, i) => (length * (i + 1)) / (count + 1))
}

/**
 * Bửng sau ở hệ của chính nó (bản lề nằm trên trục z qua gốc): tấm dày `TAILGATE_THICKNESS` ở x ∈ [−dày, 0], cao y ∈ [0, `height`],
 * rộng đúng ô cửa z ∈ [jamb, jamb + width]. `detail` thêm gân ngang và nẹp trên ở mặt ngoài (x ≥ 0), hai chốt trên và các khớp bản lề
 * trong bề dày tấm. Quay quanh z từ 0 (đứng) tới −π (thõng xuống): mọi điểm có x ≥ −dày nên không bao giờ lọt vào lòng thùng.
 */
export function tailgatePieces(height: number, width: number, jamb: number, detail: boolean): BodyPiece[] {
  const t = TAILGATE_THICKNESS, z0 = jamb, z1 = jamb + width
  const pieces: BodyPiece[] = [boxPiece([-t, 0, z0], [0, height, z1], 'beam')]
  if (!detail) return pieces
  for (const y of [height * 0.36, height * 0.68]) pieces.push(boxPiece([0, y - 0.015, z0 + 0.03], [0.012, y + 0.015, z1 - 0.03], 'skirt'))
  pieces.push(boxPiece([0, height - 0.04, z0], [0.014, height, z1], 'skirt'))
  for (const z of [z0 + 0.09, z1 - 0.09]) pieces.push(boxPiece([0, height - 0.09, z - 0.035], [0.03, height - 0.045, z + 0.035], 'metal'))
  for (const z of evenCenters(width, 0.45)) pieces.push(rodPiece('z', [-t / 2, 0.02, z0 + z], 0.018, 0.12, 'metal'))
  return pieces
}
