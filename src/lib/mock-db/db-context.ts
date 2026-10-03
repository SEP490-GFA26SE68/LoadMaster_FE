import type { VehicleConfig } from '@/domain/models'
import type { User } from '@/types/user'
import type { AuditAction, AuditEvent, AuditTargetType } from './audit'
import { MockDbError, type MockDbCollection } from './errors'
import type { TripIncidents } from './exception-model'
import type { Package } from './package-model'
import type { DeliveryRequirement } from './requirement-model'
import { randomQrToken } from './qr-token'
import type {
  Company,
  OptimizationRun,
  PackageType,
  VehicleType,
} from './source-types'
import type { TripPackageLink } from './review1-status'
import { createTenancy, type Tenancy } from './tenancy'
import type { TripTracking } from './tracking-model'
import type { Revision, Trip } from './types'

/** Toàn bộ dữ liệu của một kho. Chỉ các module `db-*.ts` đọc/ghi; bên ngoài đi qua `MockDb`. */
export type DbState = {
  vehicles: Map<string, VehicleConfig>
  /** Xe → công ty của xe (D-64) — lưu ngoài `VehicleConfig` vì type Spec không thêm trường (D-04). Xe nào cũng có một dòng. */
  vehicleCompany: Map<string, string>
  /** Xe đang bảo dưỡng (D-53) — lưu ngoài `VehicleConfig` vì type Spec không thêm trường (D-04). */
  maintenance: Map<string, { note: string; since: string }>
  trips: Map<string, Trip>
  revisions: Map<string, Revision>
  users: Map<string, User>
  /** Mật khẩu theo mã người dùng; không bao giờ trả ra ngoài kho. */
  passwords: Map<string, string>
  /** Cũ trước. */
  events: AuditEvent[]
  /** Phiên của "server", như cookie: người làm của mọi sự kiện ghi mới. */
  session: { userId: string | null }

  // Review 1 (LM-104)
  companies: Map<string, Company>
  packageTypes: Map<string, PackageType>
  /** Kho kiện (FE-3b-01). */
  packages: Map<string, Package>
  /**
   * Chuyến → kiện kho kiện của từng dòng kiện, kiện thứ i là instance thứ i của dòng: dòng thêm ngay trong chuyến (FE-3b-07), dòng
   * sinh từ yêu cầu giao (`requirementId`, FE-4b-04) và kiện đưa thẳng từ kho kiện (FE-4b-05). Lưu ngoài `Trip` vì `Trip.packages`
   * giữ đúng `CargoPackage` của Spec (D-04).
   */
  tripPackageLinks: Map<string, TripPackageLink[]>
  /** Yêu cầu giao (FE-4b-01). */
  requirements: Map<string, DeliveryRequirement>
  runs: Map<string, OptimizationRun>
  vehicleTypes: Map<string, VehicleType>
  /** Xe → loại xe; lưu ngoài `VehicleConfig` (D-04). */
  vehicleTypeOf: Map<string, string>
  /** Chuyến → lịch sử vị trí xe và mức hạn đã tính (FE-6-08, FE-6-09); kho ghi dần khi có người đọc, seed để trống. */
  tracking: Map<string, TripTracking>
  /** Chuyến → sự cố cấp chuyến, các khoảng xe mô phỏng bị giữ lại và tuyến thay thế (FE-6-11); seed để trống. */
  exceptions: Map<string, TripIncidents>
}

export type DbContext = {
  state: DbState
  nowIso(): string
  /** Đồng hồ của kho chạy nhanh gấp mấy lần giờ thật (`?toc-do`, FE-6-08): để đổi một khoảng giờ của kho ra thời gian chờ thật. */
  clockSpeed(): number
  /** Đổi tốc độ đồng hồ của kho từ bây giờ, giờ không nhảy (FE-6-13: nhận GPS thật thì đồng hồ chạy theo giờ thật). */
  setClockSpeed(speed: number): void
  /**
   * Một lượt gọi như qua mạng: chờ độ trễ rồi mới đọc/ghi. Kết quả luôn là bản sao, nên nơi gọi không sửa được dữ liệu
   * trong kho; lỗi của `operation` thành promise bị từ chối.
   */
  respond<T>(operation: () => T): Promise<T>
  /**
   * Thêm một sự kiện nhật ký: người làm là phiên hiện tại; công ty theo `tenancy.eventCompany` — sự kiện về một tài khoản thuộc công ty
   * của tài khoản đó, sự kiện khác thuộc công ty của phiên. Gọi **trước khi xoá** tài khoản là đối tượng. `companyId` chỉ truyền khi
   * luật đó không áp được: lần đăng nhập sai bằng email không có trong kho không thuộc công ty nào.
   */
  log(action: AuditAction, target: { type: AuditTargetType; id: string }, params?: Record<string, string | number>, companyId?: string | null): void
  /**
   * Sự kiện do **hệ thống** ghi (nguy cơ trễ hạn theo vị trí xe, FE-6-09): không có người làm — ai đang đăng nhập lúc kho tính ra cũng
   * không phải người làm — và thuộc công ty `companyId` của đối tượng. Trả sự kiện vừa ghi.
   */
  logSystem(action: AuditAction, target: { type: AuditTargetType; id: string }, params: Record<string, string | number>, companyId: string): AuditEvent
  /**
   * Mã QR mới cho kiện của kho kiện, không trùng mã đã cấp (LM-104). Tạo nhiều kiện một lượt thì truyền `taken` (`qrTokensInUse`) để
   * không quét lại cả kho cho từng mã; mã mới được thêm vào đó.
   */
  newQrToken(taken?: Set<string>): string
  /** Mọi mã QR đã cấp. */
  qrTokensInUse(): Set<string>
  /** Phạm vi theo công ty của phiên (D-64): mọi đọc/ghi của `db-*.ts` đi qua đây, không đọc thẳng bảng của `state`. */
  scope: Tenancy
}

export function createDbContext(
  state: DbState, latencyMs: number, now: () => Date, random: () => number = Math.random, clockSpeed: () => number = () => 1,
  setClockSpeed: (speed: number) => void = () => {},
): DbContext {
  const nowIso = () => now().toISOString()
  const scope = createTenancy(state)
  const qrTokensInUse = () => new Set([...state.packages.values()].map((pkg) => pkg.qrToken))
  return {
    state,
    nowIso,
    clockSpeed,
    setClockSpeed,
    scope,
    qrTokensInUse,
    newQrToken: (taken = qrTokensInUse()) => {
      const token = randomQrToken(random, (candidate) => taken.has(candidate))
      taken.add(token)
      return token
    },
    async respond(operation) {
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
      return structuredClone(operation())
    },
    log(action, target, params = {}, companyId = scope.eventCompany(target)) {
      state.events.push({
        id: nextEventId(state.events.length),
        at: nowIso(),
        actorId: state.session.userId,
        companyId,
        action,
        target,
        params,
      })
    },
    logSystem(action, target, params, companyId) {
      const event: AuditEvent = { id: nextEventId(state.events.length), at: nowIso(), actorId: null, companyId, action, target, params }
      state.events.push(event)
      return event
    },
  }
}

export function nextEventId(count: number): string {
  return `EV-${String(count + 1).padStart(6, '0')}`
}

/**
 * Bản ghi `id`, hoặc lỗi `NOT_FOUND` — **không xét công ty**: chỉ dùng cho bản ghi đã nằm trong phạm vi của phiên (chuyến của một
 * revision vừa qua `scope`, phương án kho đang xếp theo…). Đầu vào của nơi gọi đi qua `ctx.scope`.
 */
export function found<T>(table: ReadonlyMap<string, T>, collection: MockDbCollection, id: string): T {
  const record = table.get(id)
  if (record === undefined) throw new MockDbError('NOT_FOUND', { collection, id })
  return record
}

/** Chuỗi đã bỏ khoảng trắng hai đầu; rỗng thì bỏ hẳn trường (không lưu chuỗi rỗng). */
export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Ghi bản sao của `record`: nơi gọi sửa object của mình sau đó không đổi dữ liệu trong kho. */
export function put<T extends { id: string }>(table: Map<string, T>, record: T): T {
  const stored = structuredClone(record)
  table.set(stored.id, stored)
  return stored
}

/**
 * Mã mới dạng `PREFIX-NNN` (tối thiểu `digits` chữ số): số lớn nhất trong các mã cùng dạng cộng 1, tất định. Mã khác dạng
 * (`TRIP-2026-0914`) không được tính và cũng không bao giờ trùng mã sinh ra.
 */
export function nextId(prefix: string, ids: Iterable<string>, digits = 3): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  const numbers = [...ids].map((id) => Number(pattern.exec(id)?.[1] ?? 0))
  return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(digits, '0')}`
}

/** JSON với khoá object sắp theo tên: hai dữ liệu cùng nội dung cho cùng chuỗi dù khoá khác thứ tự; khoá mang `undefined` coi như vắng. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, field: unknown) =>
    field !== null && typeof field === 'object' && !Array.isArray(field)
      ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : field,
  )
}

/** Cùng nội dung: lưu lại form không đổi gì thì không làm revision lỗi thời. */
export function sameData(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b)
}
