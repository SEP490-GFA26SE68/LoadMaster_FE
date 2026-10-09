import { isPlatformRole, type Role, type User } from '@/types/user'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import type { MockDb, UserChanges } from './types'
import { isLastActiveAdmin, userScopeOf, type UserScope } from './user-scope'

type UserMethods = Pick<
  MockDb,
  | 'authenticate' | 'signOut' | 'restoreSession' | 'sessionUser' | 'listUsers' | 'getUser' | 'createUser' | 'updateUser'
  | 'setUserStatus' | 'deleteUser' | 'resetPassword' | 'changePassword' | 'updateProfile'
>

export const MIN_PASSWORD_LENGTH = 8

/** Bỏ ký tự dễ nhầm khi đọc cho người khác chép (0/O, 1/l/I). */
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Mật khẩu tạm 10 ký tự cho tài khoản mới và lần đặt lại (D-42). Chỉ trả về một lần. */
export function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return [...bytes].map((byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('')
}

const USER_FIELDS = ['fullName', 'email', 'phone', 'role', 'depot'] as const satisfies readonly (keyof UserChanges)[]

/**
 * Người dùng nền tảng không thuộc kho hay công ty nào (FE-0-03): tài khoản vai trò nền tảng bỏ cả `depot` lẫn `companyId` trước khi
 * ghi — dù nơi gọi có gửi.
 */
function withoutCompanyForPlatform(user: User): User {
  if (!isPlatformRole(user.role)) return user
  const { depot: _depot, companyId: _companyId, ...rest } = user
  return rest
}

/**
 * Người dùng và phiên. Người dùng không phải dữ liệu vận hành (D-64): phiên của một công ty chỉ thấy và sửa người của công ty mình
 * (người của công ty khác, kể cả tài khoản nền tảng: đọc `NOT_FOUND`, ghi `FORBIDDEN_COMPANY`); phiên nền tảng thấy hết.
 *
 * Phạm vi quản lý theo vai trò của phiên (D-65, FE-0-08, `user-scope.ts`) — kho kiểm như server, màn chỉ làm mờ trước:
 * - Tạo: phiên nền tảng chỉ tạo vai trò nền tảng, phiên công ty chỉ tạo vai trò công ty cho công ty mình (`ROLE_OUT_OF_SCOPE`).
 * - Sửa, xoá: phiên nền tảng không sửa, không xoá nhân sự công ty (`USER_MANAGED_BY_COMPANY`); đổi vai trò không vượt giữa hai nhóm
 *   vai trò (`ROLE_OUT_OF_SCOPE`), kể cả khi kho không có phiên.
 * - Khoá, mở khoá, đặt lại mật khẩu: mọi tài khoản phiên thấy.
 * - Không ai tự khoá, tự xoá, tự đổi vai trò; mỗi phạm vi giữ một người quản trị đang hoạt động (`LAST_ADMIN`).
 * Kho không có phiên (test logic kho) chỉ giữ luật của dữ liệu, không giữ luật "ai được làm".
 */
export function userMethods(ctx: DbContext): UserMethods {
  const { users, passwords, trips, session } = ctx.state
  const scope = ctx.scope.users

  /** Phạm vi quản lý của phiên; `null` khi kho không có phiên. */
  function managerScope(): UserScope | null {
    const manager = session.userId === null ? undefined : users.get(session.userId)
    return manager ? userScopeOf(manager.role) : null
  }

  /** Vai trò sắp gán phải thuộc phạm vi của phiên, và (khi sửa) cùng nhóm với vai trò hiện tại `from`. */
  function assertRoleInScope(role: Role, from?: Role) {
    const manager = managerScope()
    const crosses = from !== undefined && userScopeOf(from) !== userScopeOf(role)
    if (crosses || (manager !== null && userScopeOf(role) !== manager)) throw new MockDbError('ROLE_OUT_OF_SCOPE', { role })
  }

  /** Sửa và xoá nhân sự công ty là việc của quản trị công ty đó, không phải của phiên nền tảng. */
  function assertManages(user: User) {
    if (managerScope() === 'platform' && userScopeOf(user.role) === 'company') throw new MockDbError('USER_MANAGED_BY_COMPANY', { userId: user.id })
  }

  const byEmail = (email: string) => {
    const normalised = email.trim().toLowerCase()
    return [...users.values()].find((user) => user.email.toLowerCase() === normalised)
  }

  function assertEmailFree(email: string, exceptId?: string) {
    const owner = byEmail(email)
    if (owner && owner.id !== exceptId) throw new MockDbError('EMAIL_TAKEN', { email: email.trim() })
  }

  function assertNotSelf(id: string) {
    if (session.userId === id) throw new MockDbError('SELF_CHANGE_FORBIDDEN', {})
  }

  /** Không để nền tảng mất quản trị hệ thống, hay một công ty mất quản trị công ty, đang hoạt động cuối cùng. */
  function assertNotLastAdmin(user: User) {
    if (isLastActiveAdmin(user, users.values())) throw new MockDbError('LAST_ADMIN', {})
  }

  /** Tài xế còn được gán cho chuyến chưa kết thúc thì không xoá, không đổi vai trò. */
  function assertNoOpenTrips(user: User) {
    const tripIds = [...trips.values()]
      .filter((trip) => trip.driverId === user.id && trip.phase !== 'completed' && trip.phase !== 'cancelled')
      .map((trip) => trip.id)
    if (tripIds.length > 0) throw new MockDbError('USER_IN_USE', { userId: user.id, tripIds })
  }

  function signedIn(): User {
    const user = session.userId === null ? undefined : users.get(session.userId)
    if (!user) throw new MockDbError('NOT_SIGNED_IN', {})
    return user
  }

  return {
    authenticate: (email, password) =>
      ctx.respond(() => {
        const user = byEmail(email)
        // Lần đăng nhập sai không do phiên nào làm: sự kiện thuộc công ty của tài khoản bị thử, để quản trị công ty đó đọc được
        const company = user?.companyId ?? null
        if (!user || passwords.get(user.id) !== password) {
          ctx.log('auth.signInFailed', { type: 'user', id: user?.id ?? email.trim().toLowerCase() }, { email: email.trim() }, company)
          throw new MockDbError('INVALID_CREDENTIALS', {})
        }
        if (user.status === 'suspended') {
          ctx.log('auth.signInFailed', { type: 'user', id: user.id }, { email: user.email, reason: 'suspended' }, company)
          throw new MockDbError('ACCOUNT_SUSPENDED', {})
        }
        session.userId = user.id
        ctx.log('auth.signedIn', { type: 'user', id: user.id })
        return put(users, { ...user, lastActiveAt: ctx.nowIso() })
      }),
    signOut: () =>
      ctx.respond(() => {
        if (session.userId !== null) ctx.log('auth.signedOut', { type: 'user', id: session.userId })
        session.userId = null
      }),
    restoreSession: (userId) => {
      const user = userId === null ? undefined : users.get(userId)
      session.userId = user?.status === 'active' ? user.id : null
      return session.userId === null || !user ? null : structuredClone(user)
    },
    sessionUser: () => {
      const user = session.userId === null ? undefined : users.get(session.userId)
      return user ? structuredClone(user) : null
    },
    listUsers: () => ctx.respond(() => scope.list()),
    getUser: (id) => ctx.respond(() => scope.read(id)),
    createUser: ({ companyId: requested, ...input }) =>
      ctx.respond(() => {
        assertRoleInScope(input.role)
        const companyId = ctx.scope.newUserCompany(requested)
        assertEmailFree(input.email)
        const user = put(users, withoutCompanyForPlatform({
          ...input, ...(companyId === undefined ? {} : { companyId }), email: input.email.trim(), id: nextId('US', users.keys(), 4), status: 'active', lastActiveAt: null,
        }))
        const password = temporaryPassword()
        passwords.set(user.id, password)
        ctx.log('user.created', { type: 'user', id: user.id }, { fullName: user.fullName, role: user.role })
        return { user, temporaryPassword: password }
      }),
    updateUser: (id, input) =>
      ctx.respond(() => {
        const current = scope.own(id)
        assertManages(current)
        // Vai trò sau khi sửa là vai trò nền tảng thì kho gửi kèm không tính là thay đổi (form luôn gửi cả ô kho)
        const changes: UserChanges = isPlatformRole(input.role ?? current.role) ? { ...input, depot: undefined } : input
        const changed = USER_FIELDS.filter((field) => changes[field] !== undefined && changes[field] !== current[field])
        if (changed.length === 0) return current
        if (changed.includes('email')) assertEmailFree(changes.email ?? '', id)
        if (changed.includes('role')) {
          assertNotSelf(id)
          assertRoleInScope(changes.role ?? current.role, current.role)
          assertNotLastAdmin(current)
          if (current.role === 'driver') assertNoOpenTrips(current)
        }
        const next = { ...current }
        for (const field of changed) Object.assign(next, { [field]: changes[field] })
        ctx.log('user.updated', { type: 'user', id }, { fields: changed.join(',') })
        return put(users, withoutCompanyForPlatform(next))
      }),
    setUserStatus: (id, status) =>
      ctx.respond(() => {
        const current = scope.own(id)
        if (current.status === status) return current
        assertNotSelf(id)
        if (status === 'suspended') assertNotLastAdmin(current)
        ctx.log(status === 'suspended' ? 'user.locked' : 'user.unlocked', { type: 'user', id })
        return put(users, { ...current, status })
      }),
    deleteUser: (id) =>
      ctx.respond(() => {
        const current = scope.own(id)
        assertManages(current)
        assertNotSelf(id)
        assertNotLastAdmin(current)
        assertNoOpenTrips(current)
        // Ghi nhật ký khi tài khoản còn trong kho: sự kiện thuộc công ty của tài khoản bị xoá
        ctx.log('user.deleted', { type: 'user', id }, { fullName: current.fullName })
        users.delete(id)
        passwords.delete(id)
      }),
    resetPassword: (id) =>
      ctx.respond(() => {
        const user = scope.own(id)
        const password = temporaryPassword()
        passwords.set(id, password)
        ctx.log('user.passwordReset', { type: 'user', id })
        return { user, temporaryPassword: password }
      }),
    changePassword: (currentPassword, nextPassword) =>
      ctx.respond(() => {
        const user = signedIn()
        if (passwords.get(user.id) !== currentPassword) throw new MockDbError('PASSWORD_INCORRECT', {})
        if (nextPassword.length < MIN_PASSWORD_LENGTH) throw new MockDbError('PASSWORD_TOO_SHORT', { min: MIN_PASSWORD_LENGTH })
        passwords.set(user.id, nextPassword)
        ctx.log('user.passwordChanged', { type: 'user', id: user.id })
      }),
    updateProfile: ({ fullName, phone }) =>
      ctx.respond(() => {
        const user = signedIn()
        const next = { ...user, fullName: fullName?.trim() ?? user.fullName, phone: phone?.trim() ?? user.phone }
        const changed = (['fullName', 'phone'] as const).filter((field) => next[field] !== user[field])
        if (changed.length === 0) return user
        ctx.log('user.profileUpdated', { type: 'user', id: user.id }, { fields: changed.join(',') })
        return put(users, next)
      }),
  }
}
