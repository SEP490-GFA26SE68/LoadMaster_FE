import { z } from 'zod'
import { eq, gt, lt, roundCm, roundKg } from '@/domain/geometry'
import { validateVehicle } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
const OBSTACLE_TYPES = [
  'WHEEL_ARCH',
  'COOLING_UNIT',
  'PARTITION',
  'RESERVED_ZONE',
  'OTHER',
] as const



const cm = () => z.number()

const geometrySchema = z.object({
  innerLengthCm: cm(),
  innerWidthCm: cm(),
  innerHeightCm: cm(),
  doorWidthCm: cm(),
  doorHeightCm: cm(),
  obstacles: z.array(
    z.object({
      id: z.string(),
      type: z.enum(OBSTACLE_TYPES),
      xCm: cm(),
      yCm: cm(),
      zCm: cm(),
      lengthCm: cm(),
      widthCm: cm(),
      heightCm: cm(),
      loadBearing: z.boolean(),
    }),
  ),
  // Trục chỉ vẽ theo vị trí: tên và hai ô tải đang gõ dở không giữ hình cũ.
  axles: z.array(z.object({ id: z.string(), name: z.string().optional(), positionXCm: cm() })).optional(),
})

/** Trường không vẽ trong xem trước: lỗi của chúng không giữ hình cũ. */
const IGNORED_FIELD = /^(maxPayloadKg|obstacles\.\d+\.maxTopLoadKg)$/

export function previewVehicle(values: unknown): VehicleConfig | null {
  const parsed = geometrySchema.safeParse(values)
  if (!parsed.success) return null
  const data = parsed.data
  const vehicle: VehicleConfig = {
    id: 'preview',
    name: 'preview',
    innerLengthCm: roundCm(data.innerLengthCm),
    innerWidthCm: roundCm(data.innerWidthCm),
    innerHeightCm: roundCm(data.innerHeightCm),
    // Tải trọng không vẽ; giá trị dương cố định để `validateVehicle` chỉ xét hình học.
    maxPayloadKg: 1,
    doorWidthCm: roundCm(data.doorWidthCm),
    doorHeightCm: roundCm(data.doorHeightCm),
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: data.obstacles.map((row) => ({
      id: row.id,
      type: row.type,
      xCm: roundCm(row.xCm),
      yCm: roundCm(row.yCm),
      zCm: roundCm(row.zCm),
      lengthCm: roundCm(row.lengthCm),
      widthCm: roundCm(row.widthCm),
      heightCm: roundCm(row.heightCm),
      loadBearing: row.loadBearing,
    })),
    // Không trục nào thì vắng hẳn, như `toVehicleConfig`: mô hình khi đó vẽ bánh minh hoạ.
    ...(data.axles?.length
      ? {
        axles: data.axles.map((row) => ({
          id: row.id,
          name: row.name?.trim() ?? '',
          positionXCm: roundCm(row.positionXCm),
          // Tải trục không có hình; 0 là "chưa khai" ở mô hình tải trục và không tham gia gì ở đây.
          emptyLoadKg: 0,
          maxLoadKg: 0,
        })),
      }
      : {}),
  }
  const blocking = validateVehicle(vehicle).filter(
    (issue) => issue.severity === 'error' && !(issue.field !== undefined && IGNORED_FIELD.test(issue.field)),
  )
  return blocking.length === 0 ? vehicle : null
}

/** Số không có hình nhưng có trong bảng số dưới mô hình; `null` khi ô đang trống hoặc chưa hợp lệ. */
export type PreviewFacts = { readonly payloadKg: number | null; readonly clearanceCm: number | null }

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function previewFacts(values: { maxPayloadKg?: unknown; clearanceCm?: unknown }): PreviewFacts {
  const { maxPayloadKg, clearanceCm } = values
  return {
    payloadKg: finite(maxPayloadKg) && gt(maxPayloadKg, 0) ? roundKg(maxPayloadKg) : null,
    clearanceCm: finite(clearanceCm) && !lt(clearanceCm, 0) ? roundCm(clearanceCm) : null,
  }
}

/** Giữ đúng object cũ khi hai số không đổi, để React bỏ qua render. */
export function nextFacts(state: PreviewFacts, next: PreviewFacts): PreviewFacts {
  return state.payloadKg === next.payloadKg && state.clearanceCm === next.clearanceCm ? state : next
}

/**
 * Kiện lớn nhất lọt cửa theo luật của domain (`door.ts`: cạnh kiện + khoảng hở ≤ cạnh cửa). `null` khi khoảng hở bằng 0 (ô cửa
 * đã nói hết) hoặc lớn tới mức không kiện nào lọt.
 */
export function passableOpening(vehicle: Pick<VehicleConfig, 'doorWidthCm' | 'doorHeightCm'>, clearanceCm: number | null) {
  if (clearanceCm === null || !gt(clearanceCm, 0)) return null
  const widthCm = roundCm(vehicle.doorWidthCm - clearanceCm), heightCm = roundCm(vehicle.doorHeightCm - clearanceCm)
  return gt(widthCm, 0) && gt(heightCm, 0) ? { widthCm, heightCm } : null
}

export type PreviewState = {
  /** Hình hợp lệ gần nhất, `null` khi chưa từng có. */
  vehicle: VehicleConfig | null
  /** Xe để canh camera: chỉ đổi tham chiếu khi kích thước lòng thùng đổi. */
  frame: VehicleConfig | null
  /** Giá trị đang nhập chưa hợp lệ, hình đang là hình cũ. */
  pending: boolean
}

export const EMPTY_PREVIEW: PreviewState = { vehicle: null, frame: null, pending: false }

export function sameCargoSpace(a: VehicleConfig, b: VehicleConfig): boolean {
  return eq(a.innerLengthCm, b.innerLengthCm) && eq(a.innerWidthCm, b.innerWidthCm) && eq(a.innerHeightCm, b.innerHeightCm)
}

/** Trạng thái sau một lần debounce. Không có gì đổi thì trả đúng `state` cũ để React bỏ qua render. */
export function nextPreview(state: PreviewState, candidate: VehicleConfig | null): PreviewState {
  if (candidate === null) return state.pending ? state : { ...state, pending: true }
  const unchanged = state.vehicle !== null && JSON.stringify(state.vehicle) === JSON.stringify(candidate)
  const vehicle = unchanged ? state.vehicle! : candidate
  const frame = state.frame !== null && sameCargoSpace(state.frame, candidate) ? state.frame : candidate
  if (vehicle === state.vehicle && frame === state.frame && !state.pending) return state
  return { vehicle, frame, pending: false }
}


/**
 * Chuyển dữ liệu form loại xe sang cấu trúc hình học
 * mà VehiclePreview hiện tại đang sử dụng.
 */
const vehicleTypePreviewSchema = z.object({
  cargoLengthCm: z.number().finite().positive(),
  cargoWidthCm: z.number().finite().positive(),
  cargoHeightCm: z.number().finite().positive(),

  doorWidthCm: z.number().optional(),
  doorHeightCm: z.number().optional(),

  frontAxleX: z.number().optional(),
  rearAxleX: z.number().optional(),

  obstacles: z.array(
    z.object({
      type: z.enum(OBSTACLE_TYPES),
      x: z.number(),
      y: z.number(),
      z: z.number(),
      length: z.number(),
      width: z.number(),
      height: z.number(),
      loadBearing: z.boolean(),
    }),
  ).optional(),
})

/**
 * Xem trước hình học của loại xe.
 * Không yêu cầu tên, tải trọng hay những trường không ảnh hưởng hình học.
 */
export function previewVehicleType(
  values: unknown,
): VehicleConfig | null {
  const parsed = vehicleTypePreviewSchema.safeParse(values)
  if (!parsed.success) return null

  const data = parsed.data

  const obstacles = (data.obstacles ?? []).map(
    (obstacle, index) => ({
      id: `obstacle-${index}`,
      type: obstacle.type,
      xCm: obstacle.x,
      yCm: obstacle.y,
      zCm: obstacle.z,
      lengthCm: obstacle.length,
      widthCm: obstacle.width,
      heightCm: obstacle.height,
      loadBearing: obstacle.loadBearing,
    }),
  )

  const axles = [
    { id: 'front', name: 'front', positionXCm: data.frontAxleX },
    { id: 'rear', name: 'rear', positionXCm: data.rearAxleX },
  ].filter(
    (axle): axle is {
      id: string
      name: string
      positionXCm: number
    } =>
      axle.positionXCm !== undefined &&
      Number.isFinite(axle.positionXCm),
  )

  // Không khai cửa thì dùng mặt cắt thùng để xem trước.
  // Đây chỉ là giá trị hiển thị, không gửi lên Backend.
  const doorWidth = Number.isFinite(data.doorWidthCm)
    ? data.doorWidthCm!
    : data.cargoWidthCm

  const doorHeight = Number.isFinite(data.doorHeightCm)
    ? data.doorHeightCm!
    : data.cargoHeightCm

  return previewVehicle({
    innerLengthCm: data.cargoLengthCm,
    innerWidthCm: data.cargoWidthCm,
    innerHeightCm: data.cargoHeightCm,
    doorWidthCm: doorWidth,
    doorHeightCm: doorHeight,
    obstacles,
    axles,
  })
}

export type VehicleTypePreviewIssue =
  | 'lengthMissing'
  | 'widthMissing'
  | 'heightMissing'
  | 'doorWidthExceeded'
  | 'doorHeightExceeded'
  | 'obstacleIncomplete'
  | 'obstacleOutside'

export function getVehicleTypePreviewIssues(
  values: unknown,
): VehicleTypePreviewIssue[] {
  const input = z.object({
    cargoLengthCm: z.number().optional(),
    cargoWidthCm: z.number().optional(),
    cargoHeightCm: z.number().optional(),
    doorWidthCm: z.number().optional(),
    doorHeightCm: z.number().optional(),
    obstacles: z.array(z.object({
      x: z.number().optional(),
      y: z.number().optional(),
      z: z.number().optional(),
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })).optional(),
  }).safeParse(values)

  if (!input.success) return ['obstacleIncomplete']

  const data = input.data
  const issues: VehicleTypePreviewIssue[] = []

  const validDimension = (value: number | undefined) =>
    value !== undefined && Number.isFinite(value) && value > 0

  if (!validDimension(data.cargoLengthCm)) issues.push('lengthMissing')
  if (!validDimension(data.cargoWidthCm)) issues.push('widthMissing')
  if (!validDimension(data.cargoHeightCm)) issues.push('heightMissing')

  if (
    validDimension(data.doorWidthCm) &&
    validDimension(data.cargoWidthCm) &&
    data.doorWidthCm! > data.cargoWidthCm!
  ) {
    issues.push('doorWidthExceeded')
  }

  if (
    validDimension(data.doorHeightCm) &&
    validDimension(data.cargoHeightCm) &&
    data.doorHeightCm! > data.cargoHeightCm!
  ) {
    issues.push('doorHeightExceeded')
  }

  for (const obstacle of data.obstacles ?? []) {
    const valid = [obstacle.x, obstacle.y, obstacle.z].every(
      (value) => value !== undefined && Number.isFinite(value) && value >= 0,
    ) &&
    [obstacle.length, obstacle.width, obstacle.height].every(validDimension)

    if (!valid) {
      issues.push('obstacleIncomplete')
    }
  }

  return [...new Set(issues)]
}