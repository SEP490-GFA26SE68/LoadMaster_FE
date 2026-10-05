import type { ConstraintEngineInput, ConstraintIssue } from '@/domain/constraints'
import type { OrientationCode, OrientationRules, PackageDimensions } from '@/domain/geometry'
import type { FragilityLevel, OptimizationResult, UnplacedPackage, VehicleConfig } from '@/domain/models'
import type { DeadlineStatus } from '@/domain/routing'
import type { StopZone } from '@/domain/zones'
import type { Packaging } from './viewer-types'

/**
 * Dữ liệu vào của engine 3D (LM-030, LM-031): **cm** theo hệ toạ độ Spec (x dọc thùng từ vách trong ra cửa, y ngang từ vách
 * trái, z cao từ sàn). Mọi nguồn đổi sang kiểu này đúng một lần tại biên; bên trong `viewer3d` không còn mm.
 */
export type PositionCm = { readonly x: number; readonly y: number; readonly z: number }

export type ScenePlacement = {
  /** `packageInstanceId` */
  readonly id: string
  readonly packageId: string
  readonly name: string
  /** Số thứ tự điểm giao, 1-based (`deliveryStop`) */
  readonly stop: number
  /** Kích thước đã xoay theo `orientation`, cm */
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly weightKg: number
  readonly position: PositionCm
  /** Thứ tự xếp lên xe, 1-based (`loadingOrder` của kết quả) */
  readonly step: number
  /** Thứ tự dỡ, 1-based (`unloadingOrder` của kết quả) */
  readonly unloadingOrder: number
  readonly orientation: OrientationCode
  /** Contract Spec chưa có trường bao bì: kết quả dùng một kiểu trung tính, atlas giữ cho lúc có trường (LM-030). */
  readonly packaging: Packaging
  readonly fragilityLevel: FragilityLevel
  /** `fragilityLevel = HIGH` */
  readonly fragile: boolean
  readonly stackable: boolean
  readonly pinned: boolean
  /** Tỷ lệ đỡ đáy và mã cảnh báo do engine tính trên kết quả (Spec 7.6, LM-049); fixture không qua engine: 1 và rỗng. */
  readonly supportRatio: number
  readonly constraintWarnings: readonly string[]
  /** Vùng theo điểm giao mà kiện đang nằm (vùng chứa tâm kiện theo X, FE-5b-07); vắng khi phương án không chia vùng. */
  readonly zoneId?: string
  /** Kiện nằm ngoài vùng của điểm giao mình — một lần dỡ-xếp lại. */
  readonly outOfZone: boolean
}

export type SceneUnplaced = {
  readonly id: string
  readonly packageId: string
  readonly name: string
  readonly stop: number
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly weightKg: number
  /** Kết quả theo contract: mã lý do, UI dịch */
  readonly reasonCode?: UnplacedPackage['reasonCode']
  /** `message` của contract — mock ghi lại mã lý do; service thật có thể ghi câu riêng. */
  readonly message?: string
  /** Lý do `CONSTRAINT_VIOLATED`: các ràng buộc đã chặn kiện (FE-5b-04), UI dịch bằng `formatIssue`. */
  readonly violatedConstraints?: readonly ConstraintIssue[]
}

export type SceneStop = {
  readonly number: number
  readonly name: string
  readonly packageCount: number
  /** Hạn giao của điểm (ISO 8601); vắng khi điểm không có yêu cầu giao nào. */
  readonly deadline?: string
  /** Giờ đến dự kiến và mức hạn theo tuyến đã tối ưu của chuyến (FE-4b-09); vắng khi chuyến chưa tối ưu tuyến. */
  readonly eta?: string
  readonly deadlineStatus?: DeadlineStatus
}

/** Vùng theo điểm giao của phương án (FE-5b-02) kèm tên điểm và tỷ lệ thể tích hàng của điểm đó, %. `stopId` là số điểm giao. */
export type SceneZone = StopZone & { readonly name: string; readonly sharePercent: number }

/** Snapshot bất biến của một phương án cho engine; không nắm quyền sửa dữ liệu nguồn. */
export type ViewerSceneModel = {
  readonly tripId: string
  readonly vehicle: VehicleConfig
  /** Tỷ lệ lấp đầy thể tích, % */
  readonly fillRate: number
  readonly stops: readonly SceneStop[]
  /** Theo thứ tự giao: vùng đầu sát cửa. Rỗng khi phương án không chia vùng. */
  readonly zones: readonly SceneZone[]
  readonly placements: readonly ScenePlacement[]
  readonly unplaced: readonly SceneUnplaced[]
  readonly placementById: ReadonlyMap<string, ScenePlacement>
  /** Kích thước danh nghĩa của kiện gốc — xoay luôn áp lên đây, không đảo ngược từ kích thước đã xoay */
  readonly baseDimensionsById: ReadonlyMap<string, PackageDimensions>
  readonly orientationRulesById: ReadonlyMap<string, OrientationRules>
  readonly isMockResult: boolean
  /** Thứ tự xếp/dỡ được tính lại ở FE khi Duyệt (D-32) */
  readonly ordersRecomputed: boolean
  /** Đầu vào constraint engine cho editor (LM-035); `null` khi không chỉnh sửa được. */
  readonly engineInput: ConstraintEngineInput | null
  /** `result.metrics` của kết quả (LM-049); `null` khi nguồn không có metrics. */
  readonly metrics: OptimizationResult['metrics'] | null
  /** Revision nguồn (LM-049, LM-050); `null` với fixture benchmark. */
  readonly revision: {
    readonly id: string
    readonly jobId: string
    readonly method: string
    readonly approved: boolean
    /** Thời điểm duyệt (ISO 8601) của revision đã duyệt, `null` với revision chưa duyệt (LM-094: "Đã duyệt lúc …"). */
    readonly approvedAt: string | null
    readonly manuallyEdited: boolean
    /** Xe hoặc kiện của chuyến đổi sau khi tối ưu (D-31) — Duyệt bị chặn. */
    readonly stale: boolean
  } | null
}
