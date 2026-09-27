import type { VehicleConfig } from '@/domain/models'
import type { User } from '@/types/user'
import type { AuditAction, AuditEvent, AuditTargetType } from './audit'
import { MockDbError, type MockDbCollection } from './errors'
import { randomQrToken } from './qr-token'
import type {
  Company,
  OptimizationRun,
  PackageType,
  RegisteredPackage,
  ReviewDecision,
  Shipment,
  TransportOrder,
  VehicleType,
} from './source-types'
import type { Revision, Trip } from './types'

/** Toàn bộ dữ liệu của một kho. Chỉ các module `db-*.ts` đọc/ghi; bên ngoài đi qua `MockDb`. */
export type DbState = {
  vehicles: Map<string, VehicleConfig>
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
  registeredPackages: Map<string, RegisteredPackage>
  shipments: Map<string, Shipment>
  orders: Map<string, TransportOrder>
  /** Cũ trước. */
  reviews: ReviewDecision[]
  runs: Map<string, OptimizationRun>
  vehicleTypes: Map<string, VehicleType>
  /** Xe → loại xe; lưu ngoài `VehicleConfig` (D-04). */
  vehicleTypeOf: Map<string, string>
}

export type DbContext = {
  state: DbState
  nowIso(): string
  /**
   * Một lượt gọi như qua mạng: chờ độ trễ rồi mới đọc/ghi. Kết quả luôn là bản sao, nên nơi gọi không sửa được dữ liệu
   * trong kho; lỗi của `operation` thành promise bị từ chối.
   */
  respond<T>(operation: () => T): Promise<T>
  /** Thêm một sự kiện nhật ký, người làm là phiên hiện tại. */
  log(action: AuditAction, target: { type: AuditTargetType; id: string }, params?: Record<string, string | number>): void
  /** Mã QR mới cho kiện đăng ký, không trùng mã đã cấp (LM-104). */
  newQrToken(): string
}

export function createDbContext(state: DbState, latencyMs: number, now: () => Date, random: () => number = Math.random): DbContext {
  const nowIso = () => now().toISOString()
  return {
    state,
    nowIso,
    newQrToken: () => {
      const taken = new Set([...state.registeredPackages.values()].map((pkg) => pkg.qrToken))
      return randomQrToken(random, (token) => taken.has(token))
    },
    async respond(operation) {
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
      return structuredClone(operation())
    },
    log(action, target, params = {}) {
      state.events.push({
        id: nextEventId(state.events.length),
        at: nowIso(),
        actorId: state.session.userId,
        action,
        target,
        params,
      })
    },
  }
}

export function nextEventId(count: number): string {
  return `EV-${String(count + 1).padStart(6, '0')}`
}

/** Bản ghi `id`, hoặc lỗi `NOT_FOUND`. */
export function found<T>(table: ReadonlyMap<string, T>, collection: MockDbCollection, id: string): T {
  const record = table.get(id)
  if (record === undefined) throw new MockDbError('NOT_FOUND', { collection, id })
  return record
}

/** Người của phiên hiện tại; `undefined` khi chưa đăng nhập (test logic kho không đăng nhập). */
export function sessionUserOf(state: DbState): User | undefined {
  return state.session.userId === null ? undefined : state.users.get(state.session.userId)
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
