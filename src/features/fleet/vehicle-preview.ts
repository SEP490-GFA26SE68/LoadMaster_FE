import { z } from 'zod'
import { eq, gt, lt, roundCm, roundKg } from '@/domain/geometry'
import { validateVehicle } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import { OBSTACLE_TYPES } from './vehicle-form'

/**
 * Xem trước 3D ở form xe (LM-042): phần thuần, không React.
 *
 * - `previewVehicle` lấy **phần hình học** của giá trị đang nhập (lòng thùng, cửa, vật cản, vị trí từng trục) và trả `null`
 *   khi phần đó chưa parse được hoặc vi phạm `validateVehicle`. Tên xe, tải trọng, tải trên của vật cản, tên và tải của trục
 *   không có hình nên không chặn hình.
 * - `previewFacts` đọc hai số không có hình nhưng có trong bảng số dưới mô hình: tải trọng và khoảng hở.
 * - `nextPreview` giữ hình hợp lệ gần nhất; `frame` chỉ đổi tham chiếu khi kích thước lòng thùng đổi, nên sửa vật cản,
 *   cửa hay trục không làm camera canh khung lại.
 */

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
