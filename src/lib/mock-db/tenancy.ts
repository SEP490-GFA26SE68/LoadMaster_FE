import { isPlatformRole, type User } from '@/types/user'
import type { AuditTargetType } from './audit'
import type { DbState } from './db-context'
import { MockDbError, type MockDbCollection } from './errors'

/**
 * Cách ly dữ liệu theo công ty ở tầng kho (D-64, FE-0-02) — kho lọc theo công ty của phiên như backend lọc mọi truy vấn theo
 * `company_id`; component và `-api.ts` không tự lọc. Ba phạm vi:
 *
 * - **Không có phiên** (test logic kho, dựng seed, hai trang tài liệu ngoài `RequireAuth`): không lọc. Bản ghi tạo ra thuộc
 *   `DEFAULT_COMPANY_ID`.
 * - **Phiên của một công ty** (`User.companyId`): hàm liệt kê chỉ trả bản ghi của công ty; đọc theo mã bản ghi của công ty khác là
 *   `NOT_FOUND` (không lộ là có tồn tại); ghi vào bản ghi của công ty khác, hoặc tham chiếu tới nó, là `FORBIDDEN_COMPANY`.
 * - **Phiên không thuộc công ty nào** (ba vai trò nền tảng): mọi hàm dữ liệu vận hành từ chối `COMPANY_REQUIRED`. Người dùng và nhật ký
 *   không phải dữ liệu vận hành: vai trò nền tảng đọc được hết.
 */

/** Công ty nhận bản ghi tạo khi kho không có phiên. */
export const DEFAULT_COMPANY_ID = 'LOG-001'

/** `null`: không lọc. */
type CompanyFilter = string | null

type SessionScope =
  | { readonly kind: 'none' }
  | { readonly kind: 'company'; readonly companyId: string }
  /** Đã đăng nhập nhưng không thuộc công ty nào; `platform` là một trong ba vai trò nền tảng. */
  | { readonly kind: 'noCompany'; readonly platform: boolean }

function sessionScope(state: DbState): SessionScope {
  if (state.session.userId === null) return { kind: 'none' }
  const user = state.users.get(state.session.userId)
  if (user?.companyId !== undefined) return { kind: 'company', companyId: user.companyId }
  return { kind: 'noCompany', platform: user !== undefined && isPlatformRole(user.role) }
}

/** Công ty lọc **dữ liệu vận hành** (xe, loại xe, loại kiện, kiện, yêu cầu giao, chuyến, revision, lần chạy, tiến độ, quét). */
function operationalFilter(state: DbState): CompanyFilter {
  const scope = sessionScope(state)
  if (scope.kind === 'noCompany') throw new MockDbError('COMPANY_REQUIRED', {})
  return scope.kind === 'company' ? scope.companyId : null
}

/**
 * Công ty lọc **người dùng, nhật ký và danh sách công ty**: vai trò nền tảng thấy hết. Tài khoản vai trò công ty mà không gắn công ty
 * nào là dữ liệu hỏng — từ chối thay vì cho thấy hết.
 */
function directoryFilter(state: DbState): CompanyFilter {
  const scope = sessionScope(state)
  if (scope.kind === 'noCompany' && !scope.platform) throw new MockDbError('COMPANY_REQUIRED', {})
  return scope.kind === 'company' ? scope.companyId : null
}

/** Một bộ sưu tập nhìn qua phạm vi của phiên. Mỗi hàm xét lại phiên lúc được gọi. */
export type Scoped<T> = {
  /** Bản ghi phiên được thấy, theo thứ tự của kho. */
  list(): T[]
  /** Đọc theo mã. Không có, hoặc của công ty khác: `NOT_FOUND`. */
  read(id: string): T
  /** Đích của một lệnh ghi. Không có: `NOT_FOUND`; của công ty khác: `FORBIDDEN_COMPANY`. */
  own(id: string): T
  /**
   * Bản ghi mà một bản ghi của công ty `companyId` tham chiếu tới (xe của chuyến, loại kiện của kiện…). Không có: `NOT_FOUND`; khác
   * công ty: `FORBIDDEN_COMPANY` — luật của dữ liệu, kiểm cả khi không có phiên.
   */
  ref(id: string, companyId: string | undefined): T
}

function scoped<T>(
  state: DbState,
  table: ReadonlyMap<string, T>,
  collection: MockDbCollection,
  companyOf: (record: T) => string | undefined,
  filterOf: (state: DbState) => CompanyFilter = operationalFilter,
): Scoped<T> {
  const visible = (record: T, filter: CompanyFilter) => filter === null || companyOf(record) === filter
  const existing = (id: string): T => {
    const record = table.get(id)
    if (record === undefined) throw new MockDbError('NOT_FOUND', { collection, id })
    return record
  }
  return {
    list: () => {
      const filter = filterOf(state)
      return [...table.values()].filter((record) => visible(record, filter))
    },
    read: (id) => {
      const filter = filterOf(state)
      const record = table.get(id)
      if (record === undefined || !visible(record, filter)) throw new MockDbError('NOT_FOUND', { collection, id })
      return record
    },
    own: (id) => {
      const filter = filterOf(state)
      const record = existing(id)
      if (!visible(record, filter)) throw new MockDbError('FORBIDDEN_COMPANY', { collection, id })
      return record
    },
    ref: (id, companyId) => {
      const record = existing(id)
      if (companyOf(record) !== companyId) throw new MockDbError('FORBIDDEN_COMPANY', { collection, id })
      return record
    },
  }
}

export type Tenancy = ReturnType<typeof createTenancy>

/** Phạm vi theo công ty của mọi bộ sưu tập — nơi duy nhất trong kho biết luật lọc; các module `db-*.ts` chỉ gọi vào đây. */
export function createTenancy(state: DbState) {
  const tripCompany = (tripId: string) => state.trips.get(tripId)?.companyId
  return {
    vehicles: scoped(state, state.vehicles, 'vehicles', (vehicle) => state.vehicleCompany.get(vehicle.id)),
    vehicleTypes: scoped(state, state.vehicleTypes, 'vehicleTypes', (type) => type.companyId),
    packageTypes: scoped(state, state.packageTypes, 'packageTypes', (type) => type.companyId),
    packages: scoped(state, state.packages, 'packages', (pkg) => pkg.companyId),
    requirements: scoped(state, state.requirements, 'requirements', (requirement) => requirement.companyId),
    trips: scoped(state, state.trips, 'trips', (trip) => trip.companyId),
    /** Revision thuộc công ty của chuyến. */
    revisions: scoped(state, state.revisions, 'revisions', (revision) => tripCompany(revision.tripId)),
    /** Danh mục gói (FE-8-01): dữ liệu nền tảng, không thuộc công ty nào — mọi phiên đọc được. */
    plans: scoped(state, state.plans, 'plans', () => undefined, () => null),
    /** Gói, tài khoản credit, sổ cái và thanh toán thuộc công ty (FE-8-01): vai trò nền tảng bị từ chối `COMPANY_REQUIRED`. */
    subscriptions: scoped(state, state.subscriptions, 'subscriptions', (subscription) => subscription.companyId),
    creditAccounts: scoped(state, state.creditAccounts, 'creditAccounts', (account) => account.companyId),
    creditTransactions: scoped(state, state.creditTransactions, 'creditTransactions', (transaction) => transaction.companyId),
    payments: scoped(state, state.payments, 'payments', (payment) => payment.companyId),
    users: scoped(state, state.users, 'users', (user) => user.companyId, directoryFilter),
    companies: scoped(state, state.companies, 'companies', (company) => company.id, directoryFilter),
    /** Sự kiện nhật ký phiên được đọc, cũ trước. */
    events: () => {
      const filter = directoryFilter(state)
      return state.events.filter((event) => filter === null || event.companyId === filter)
    },
    /**
     * Người dùng, chuyến và xe trong phạm vi **nhật ký** của phiên: không đòi quyền dữ liệu vận hành (màn nhật ký của vai trò nền tảng).
     * Người dùng gồm người phiên được thấy, rồi người làm của những sự kiện phiên đọc được mà nằm ngoài số đó — quản trị hệ thống đã
     * khoá hay đặt lại mật khẩu cho người của công ty (FE-0-08): quản trị công ty đọc được tên người làm, dù không quản lý tài khoản ấy.
     */
    auditTargets: () => {
      const filter = directoryFilter(state)
      const users = [...state.users.values()].filter((user) => filter === null || user.companyId === filter)
      const known = new Set(users.map((user) => user.id))
      for (const event of state.events) {
        if (event.actorId === null || known.has(event.actorId) || (filter !== null && event.companyId !== filter)) continue
        known.add(event.actorId)
        const actor = state.users.get(event.actorId)
        if (actor) users.push(actor)
      }
      return {
        users,
        trips: [...state.trips.values()].filter((trip) => filter === null || trip.companyId === filter),
        vehicles: [...state.vehicles.values()].filter((vehicle) => filter === null || state.vehicleCompany.get(vehicle.id) === filter),
      }
    },
    /** Công ty của bản ghi vận hành sắp tạo: công ty của phiên; không có phiên thì `DEFAULT_COMPANY_ID`. */
    newRecordCompany: (): string => operationalFilter(state) ?? DEFAULT_COMPANY_ID,
    /**
     * Công ty của tài khoản **vai trò công ty** sắp tạo. Phiên của một công ty chỉ tạo người cho công ty mình (`requested` khác là
     * `FORBIDDEN_COMPANY`); không có phiên thì `requested`, vắng là `DEFAULT_COMPANY_ID`. Phiên nền tảng không tạo vai trò công ty
     * (`db-users.ts` từ chối trước khi tới đây, FE-0-08) nên kết quả `undefined` của nó chỉ đi cùng tài khoản nền tảng.
     */
    newUserCompany: (requested: string | undefined): string | undefined => {
      const filter = directoryFilter(state)
      if (filter === null) return requested ?? (sessionScope(state).kind === 'none' ? DEFAULT_COMPANY_ID : undefined)
      if (requested !== undefined && requested !== filter) throw new MockDbError('FORBIDDEN_COMPANY', { collection: 'companies', id: requested })
      return filter
    },
    /**
     * Công ty ghi vào sự kiện nhật ký về `target` (`auditEventCompany`); công ty của người làm là công ty của phiên — tài khoản nền
     * tảng `null`, không có phiên thì `DEFAULT_COMPANY_ID`.
     */
    eventCompany: (target: AuditTarget): string | null => {
      const scope = sessionScope(state)
      const actorCompany = scope.kind === 'none' ? DEFAULT_COMPANY_ID : scope.kind === 'company' ? scope.companyId : null
      return auditEventCompany(state.users, target, actorCompany)
    },
  }
}

type AuditTarget = { readonly type: AuditTargetType; readonly id: string }

/**
 * Công ty của một sự kiện nhật ký (D-64, FE-0-08) — một luật cho sự kiện seed lẫn sự kiện ghi mới. Sự kiện **về một tài khoản** thuộc
 * công ty của tài khoản đó, ai làm cũng vậy: quản trị hệ thống khoá một nhân viên thì quản trị công ty của người đó đọc được; việc trên
 * tài khoản nền tảng không thuộc công ty nào (`null`). Sự kiện khác, hoặc tài khoản không (còn) trong kho, thuộc công ty của người làm
 * `actorCompany`.
 */
export function auditEventCompany(
  users: ReadonlyMap<string, Pick<User, 'companyId'>>,
  target: AuditTarget,
  actorCompany: string | null,
): string | null {
  const account = target.type === 'user' ? users.get(target.id) : undefined
  return account === undefined ? actorCompany : (account.companyId ?? null)
}
