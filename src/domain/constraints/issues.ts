import type { OrientationCode } from '@/domain/geometry'

/**
 * Danh mục mã lỗi ràng buộc (D-28). Domain chỉ trả mã + tham số số thô; UI dịch mã sang câu theo
 * ngôn ngữ (LM-028) và format số theo locale. Khác `MODEL_ISSUE_CODES` của `@/domain/models`: mã schema
 * báo từng ô nhập sai, mã ở đây báo ràng buộc nghiệp vụ của Spec mục 7 kèm số liệu.
 */
export const CONSTRAINT_CODES = [
  'DIMENSION_NOT_POSITIVE',
  'DOOR_EXCEEDS_INNER',
  'NO_ALLOWED_ORIENTATION',
  'PAYLOAD_EXCEEDED',
  'MUST_LOAD_PAYLOAD_EXCEEDED',
  'DOOR_TOO_SMALL',
  'EXCEEDS_BOUNDARY',
  'OVERLAP',
  'OBSTACLE_OVERLAP',
  'NON_BEARING_SUPPORT',
  'SUPPORT_BELOW_MIN',
  'TOP_LOAD_EXCEEDED',
  'NOT_STACKABLE',
  'STACK_COUNT_EXCEEDED',
  'LIFO_BLOCKED',
  'LIFO_PARTIAL',
  'COG_LATERAL',
  'COG_LONGITUDINAL',
  'COG_HIGH',
  'AXLE_OVERLOAD',
  'MUST_LOAD_UNPLACED',
  'LOADING_ORDER_INFEASIBLE',
  'DUPLICATE_INSTANCE_ID',
  'ORIENTATION_MISMATCH',
  'ORIENTATION_NOT_ALLOWED',
  'PINNED_INSTANCE_UNKNOWN',
] as const

export type ConstraintCode = (typeof CONSTRAINT_CODES)[number]

/**
 * - `error`: chặn (nút Tối ưu, commit trong editor).
 * - `warning`: vẫn cho làm, hiện cảnh báo.
 * - `blockApproval`: kết quả vẫn xem được nhưng không được Duyệt (D-24).
 */
export type ConstraintSeverity = 'error' | 'warning' | 'blockApproval'

type NoParams = Readonly<Record<string, never>>

/** Tham số theo từng mã, đơn vị domain (cm, kg, tỷ lệ 0..1). `relatedIds` của issue chứa mã kiện liên quan. */
export type ConstraintParams = {
  DIMENSION_NOT_POSITIVE:
    | { entity: 'vehicle' }
    | { entity: 'obstacle'; obstacleId: string }
    | { entity: 'package'; packageId: string }
  DOOR_EXCEEDS_INNER: { axis: 'y' | 'z'; doorCm: number; innerCm: number }
  NO_ALLOWED_ORIENTATION: { packageId: string }
  /** Spec 7.3, D-23: tổng mọi kiện vượt tải — cảnh báo. */
  PAYLOAD_EXCEEDED: { totalKg: number; maxPayloadKg: number; overKg: number }
  /** D-23: riêng tổng kiện `mustLoad` đã vượt tải — lỗi, chặn tối ưu. */
  MUST_LOAD_PAYLOAD_EXCEEDED: { totalKg: number; maxPayloadKg: number; overKg: number }
  DOOR_TOO_SMALL: { packageId: string; doorWidthCm: number; doorHeightCm: number }
  EXCEEDS_BOUNDARY: { axis: 'x' | 'y' | 'z'; side: 'beforeOrigin' | 'beyondInterior'; overCm: number }
  /** `relatedIds`: kiện bị chồng lấn. */
  OVERLAP: NoParams
  OBSTACLE_OVERLAP: { obstacleId: string }
  /** Kiện tựa lên mặt trên vật cản `loadBearing = false` (Spec 7.6). */
  NON_BEARING_SUPPORT: { obstacleId: string }
  SUPPORT_BELOW_MIN: { ratio: number; required: number }
  /** Tải truyền xuống kiện (hoặc vật cản chịu tải) vượt `maxTopLoadKg` (Spec 7.8, D-18). */
  TOP_LOAD_EXCEEDED: { loadKg: number; maxKg: number }
  /** `relatedIds`: kiện đang tựa lên kiện `stackable = false`. */
  NOT_STACKABLE: NoParams
  STACK_COUNT_EXCEEDED: { layers: number; maxStackCount: number }
  /** D-26: mặt sau bị kiện giao muộn che kín; `coverage` = 1. Lỗi khi `enforceLifo`, cảnh báo khi không. */
  LIFO_BLOCKED: { coverage: number }
  /** D-26: mặt sau bị che một phần, 0 < `coverage` < 1 — cảnh báo. */
  LIFO_PARTIAL: { coverage: number }
  /** D-79: trọng tâm hàng lệch ngang khỏi giữa thùng quá `maxCogOffsetRatio` × chiều rộng thùng. */
  COG_LATERAL: { offsetCm: number; limitCm: number }
  /** D-79: trọng tâm hàng lệch dọc khỏi giữa thùng quá `maxCogOffsetRatio` × chiều dài thùng; `toward` là phía bị lệch về. */
  COG_LONGITUDINAL: { offsetCm: number; limitCm: number; toward: 'front' | 'rear' }
  /** Trọng tâm hàng cao quá nửa chiều cao thùng — giữ từ D-36, loại xe không khai ngưỡng này. */
  COG_HIGH: { heightCm: number; limitCm: number }
  /** D-78: tải của nhóm trục trước / sau (mô hình đòn bẩy) vượt giới hạn — lỗi, chặn Duyệt. */
  AXLE_OVERLOAD: { group: 'front' | 'rear'; loadKg: number; limitKg: number; overKg: number }
  /** D-24: kiện `mustLoad` nằm trong `unplacedPackages` — chặn Duyệt. */
  MUST_LOAD_UNPLACED: { packageId: string }
  /** D-32: kiện được xếp trước kiện đỡ nó; `relatedIds`: các kiện đỡ bị xếp sau. */
  LOADING_ORDER_INFEASIBLE: NoParams
  /** LM-013: nhiều dòng kiện dùng cùng một ID; `relatedIds`: mã kiện gốc dùng ID đó. */
  DUPLICATE_INSTANCE_ID: { occurrences: number }
  /** Spec 7.5: kích thước đã xếp không khớp hướng `orientation` khai báo. */
  ORIENTATION_MISMATCH: { orientation: OrientationCode }
  /** Spec 7.5, PRD mục 8 (LM-023): hướng đặt của placement không nằm trong `effectiveOrientations` của kiện (`allowedOrientations`, `keepUpright`). */
  ORIENTATION_NOT_ALLOWED: { orientation: OrientationCode }
  /** FE-BL-02: kiện ghim không thuộc kiện nào của request (chuyến đã đổi kiện sau khi ghim); `packageInstanceId` là mã kiện ghim. */
  PINNED_INSTANCE_UNKNOWN: NoParams
}

/**
 * Chủ thể của issue, để `formatIssue` (LM-028) dựng câu và UI chỉ tới đúng chỗ:
 * - `packageInstanceId`: kiện đã xếp mà issue nói tới; khi đó `relatedIds` là các kiện/đối tượng liên quan.
 * - Issue không gắn kiện mà nói về một dòng vật cản của xe (validation LM-017) đặt vật cản đó ở `relatedIds[0]`.
 * - `field`: đường dẫn trong form của chính đối tượng theo cú pháp react-hook-form (`innerLengthCm`, `obstacles.0.lengthCm`).
 */
export type ConstraintIssue<Code extends ConstraintCode = ConstraintCode> = {
  [C in Code]: {
    code: C
    severity: ConstraintSeverity
    packageInstanceId?: string
    relatedIds?: readonly string[]
    field?: string
    params: ConstraintParams[C]
  }
}[Code]
