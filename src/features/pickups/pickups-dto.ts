import { PICKUP_RULE_CODES, type PickupRule, type PickupRuleCode, type PickupRuleResult } from '@/domain/pickup'
import type { HandlingClass, OrientationCode, UnplacedPackage } from '@/domain/models'
import { backendLocalDateTime, isoFromBackend } from '@/lib/backend-time'
import type { Package, PickupLayout, PickupPoint, PickupRequest, PickupRequestInput, PickupStatus } from '@/lib/mock-db'

/*
 * Dữ liệu `/api/trips/{id}/pickup-requests` của máy chủ và cách đổi sang kiểu của màn nhận hàng dọc đường. Chỉ `pickups-api.ts` import file
 * này: kiểu DTO không ra khỏi lớp gọi backend. Mã số thành chuỗi, mốc giờ `LocalDateTime` (giờ Việt Nam) thành ISO 8601.
 */

type PointDto = { readonly name: string | null; readonly address: string | null; readonly latitude: number | null; readonly longitude: number | null }

type PackageDto = {
  readonly lineIndex: number | null
  readonly packageCode: string | null
  readonly lengthCm: number | null
  readonly widthCm: number | null
  readonly heightCm: number | null
  readonly weightKg: number | null
  readonly handlingClass: string | null
  /** Kiện kho kiện của dòng, từ lúc duyệt. */
  readonly cargoPackageId?: number | null
  readonly warehouseCode?: string | null
  readonly trackingBarcode?: string | null
  readonly qrToken?: string | null
}

type RuleDto = { readonly rule: number; readonly passed: boolean; readonly code: string; readonly params?: Readonly<Record<string, unknown>> | null }

type LayoutDto = {
  readonly placements?: readonly {
    readonly packageIndex: number
    readonly rotation: number
    readonly xCm: number
    readonly yCm: number
    readonly zCm: number
    readonly placedLengthCm: number
    readonly placedWidthCm: number
    readonly placedHeightCm: number
  }[] | null
  readonly unplaced?: readonly { readonly packageIndex: number; readonly reasonCode: string }[] | null
  readonly plannedAt?: string | null
}

export type PickupRequestDto = {
  readonly id: number
  readonly tripId: number | null
  readonly tripCode?: string | null
  readonly status: string
  readonly pickup: PointDto | null
  readonly delivery: PointDto | null
  readonly deadline?: string | null
  readonly packages?: readonly PackageDto[] | null
  readonly validationResults?: readonly RuleDto[] | null
  readonly overrideReason?: string | null
  readonly rejectReason?: string | null
  readonly createdById?: number | null
  readonly createdByName?: string | null
  readonly createdAt?: string | null
  readonly approvedById?: number | null
  readonly approvedAt?: string | null
  readonly rejectedById?: number | null
  readonly rejectedAt?: string | null
  readonly pickupStopId?: number | null
  readonly deliveryStopId?: number | null
  readonly layout?: LayoutDto | null
  readonly loadedAt?: string | null
  readonly deliveredAt?: string | null
}

const STATUSES: readonly PickupStatus[] = ['PENDING', 'VALIDATED', 'REJECTED', 'APPROVED', 'LOADED', 'DELIVERED']
const HANDLING: readonly HandlingClass[] = ['STANDARD', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS', 'HIGH_VALUE']
/** `rotation` của máy chủ: bộ ba cạnh kiện dọc trục X, Y, Z của thùng (cùng thứ tự với dịch vụ tối ưu). */
const ROTATIONS: readonly OrientationCode[] = ['LWH', 'WLH', 'LHW', 'WHL', 'HLW', 'HWL']
const UNPLACED: readonly UnplacedPackage['reasonCode'][] = ['DOOR_TOO_SMALL', 'OVER_PAYLOAD', 'NO_SPACE', 'STACKING_VIOLATION']
/** Tham số của luật 9 là mốc giờ của máy chủ. */
const TIME_PARAMS = new Set(['eta', 'deadline'])

const statusOf = (value: string): PickupStatus => STATUSES.find((status) => status === value) ?? 'PENDING'
const handlingOf = (value: string | null): HandlingClass => HANDLING.find((item) => item === value) ?? 'STANDARD'
const time = (value: string | null | undefined): string | undefined => (value ? isoFromBackend(value) : undefined)
const idOf = (value: number | null | undefined): string | undefined => (value === null || value === undefined ? undefined : String(value))

function pointOf(dto: PointDto | null): PickupPoint {
  return { name: dto?.name ?? '', address: dto?.address ?? '', lat: dto?.latitude ?? 0, lng: dto?.longitude ?? 0 }
}

/** Kết quả một luật; mã máy chủ trả mà web chưa biết thì bỏ (không đoán câu cho nó). */
function ruleOf(dto: RuleDto): PickupRuleResult[] {
  const code = PICKUP_RULE_CODES.find((item) => item === dto.code) as PickupRuleCode | undefined
  if (code === undefined || dto.rule < 1 || dto.rule > 10) return []
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(dto.params ?? {})) {
    if (typeof value === 'number') params[key] = value
    else if (typeof value === 'string') params[key] = TIME_PARAMS.has(key) ? isoFromBackend(value) : value
  }
  return [{ rule: dto.rule as PickupRule, passed: dto.passed, code, params }]
}

function layoutOf(dto: LayoutDto | null | undefined): PickupLayout | undefined {
  if (!dto || !dto.plannedAt) return undefined
  return {
    placements: (dto.placements ?? []).map((item) => ({
      packageIndex: item.packageIndex,
      orientation: ROTATIONS[item.rotation] ?? 'LWH',
      xCm: item.xCm,
      yCm: item.yCm,
      zCm: item.zCm,
      placedLengthCm: item.placedLengthCm,
      placedWidthCm: item.placedWidthCm,
      placedHeightCm: item.placedHeightCm,
    })),
    unplaced: (dto.unplaced ?? []).map((item) => ({ packageIndex: item.packageIndex, reasonCode: UNPLACED.find((code) => code === item.reasonCode) ?? 'NO_SPACE' })),
    plannedAt: isoFromBackend(dto.plannedAt),
  }
}

/** Yêu cầu của máy chủ ở dạng màn dùng. `tripId` là mã chuyến khi máy chủ trả, như Giám sát; công ty máy chủ không trả nên để trống. */
export function pickupRequestOf(dto: PickupRequestDto): PickupRequest {
  const packages = [...(dto.packages ?? [])].sort((a, b) => (a.lineIndex ?? 0) - (b.lineIndex ?? 0))
  const packageIds = packages.flatMap((pkg) => (pkg.cargoPackageId === null || pkg.cargoPackageId === undefined ? [] : [String(pkg.cargoPackageId)]))
  const optional = {
    deadline: time(dto.deadline),
    overrideReason: dto.overrideReason ?? undefined,
    rejectReason: dto.rejectReason ?? undefined,
    rejectedAt: time(dto.rejectedAt),
    rejectedBy: idOf(dto.rejectedById),
    approvedAt: time(dto.approvedAt),
    approvedBy: idOf(dto.approvedById),
    packageIds: packageIds.length > 0 ? packageIds : undefined,
    layout: layoutOf(dto.layout),
    pickupStopId: idOf(dto.pickupStopId),
    deliveryStopId: idOf(dto.deliveryStopId),
    loadedAt: time(dto.loadedAt),
    deliveredAt: time(dto.deliveredAt),
  }
  return {
    id: String(dto.id),
    companyId: '',
    tripId: dto.tripCode ?? String(dto.tripId ?? ''),
    pickup: pointOf(dto.pickup),
    delivery: pointOf(dto.delivery),
    packages: packages.map((pkg) => ({
      packageCode: pkg.packageCode ?? '',
      lengthCm: pkg.lengthCm ?? 0,
      widthCm: pkg.widthCm ?? 0,
      heightCm: pkg.heightCm ?? 0,
      weightKg: pkg.weightKg ?? 0,
      handlingClass: handlingOf(pkg.handlingClass),
    })),
    status: statusOf(dto.status),
    validationResults: (dto.validationResults ?? []).flatMap(ruleOf),
    createdAt: time(dto.createdAt) ?? new Date(0).toISOString(),
    createdBy: idOf(dto.createdById) ?? null,
    ...optional,
  }
}

/**
 * Kiện kho kiện máy chủ tạo lúc duyệt, ở dạng `Package` mà hộp duyệt liệt kê: mã là mã số của máy chủ (trang in nhãn của máy chủ đọc mã số),
 * mã của bên gửi là mã kho cấp (thêm hậu tố khi trùng). Lịch sử và nguồn máy chủ không trả cho màn này.
 */
export function pickupPackagesOf(dto: PickupRequestDto): Package[] {
  const createdAt = time(dto.approvedAt) ?? time(dto.createdAt) ?? new Date(0).toISOString()
  return (dto.packages ?? []).flatMap((pkg): Package[] => {
    if (pkg.cargoPackageId === null || pkg.cargoPackageId === undefined) return []
    return [{
      id: String(pkg.cargoPackageId),
      companyId: '',
      packageCode: pkg.warehouseCode ?? pkg.packageCode ?? '',
      qrToken: pkg.qrToken ?? '',
      lengthCm: pkg.lengthCm ?? 0,
      widthCm: pkg.widthCm ?? 0,
      heightCm: pkg.heightCm ?? 0,
      weightKg: pkg.weightKg ?? 0,
      handlingClass: handlingOf(pkg.handlingClass),
      destination: dto.delivery?.address ?? '',
      status: 'ASSIGNED',
      flags: [],
      source: 'PICKUP',
      createdAt,
      createdBy: null,
      history: [],
    }]
  })
}

const pointBody = (point: PickupPoint) => ({ name: point.name, address: point.address, latitude: point.lat, longitude: point.lng })

/** Thân `POST /api/trips/{id}/pickup-requests`: hạn là `LocalDateTime` giờ Việt Nam. */
export function createBodyOf(input: PickupRequestInput) {
  return {
    pickup: pointBody(input.pickup),
    delivery: pointBody(input.delivery),
    ...(input.deadline === undefined ? {} : { deadline: backendLocalDateTime(input.deadline) }),
    packages: input.packages.map((pkg) => ({
      packageCode: pkg.packageCode,
      lengthCm: pkg.lengthCm,
      widthCm: pkg.widthCm,
      heightCm: pkg.heightCm,
      weightKg: pkg.weightKg,
      handlingClass: pkg.handlingClass,
    })),
  }
}
