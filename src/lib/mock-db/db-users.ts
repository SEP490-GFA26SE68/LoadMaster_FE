import { isPlatformRole, type User } from '@/types/user'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import type { MockDb, UserChanges } from './types'

type UserMethods = Pick<
  MockDb,
  | 'authenticate' | 'signOut' | 'restoreSession' | 'sessionUser' | 'listUsers' | 'getUser' | 'createUser' | 'updateUser'
  | 'setUserStatus' | 'deleteUser' | 'resetPassword' | 'changePassword' | 'updateProfile'
>

export const MIN_PASSWORD_LENGTH = 8

/** Bỏ ký tự dễ nhầm khi đọc cho người khác chép (0/O, 1/l/I). */
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Mật khẩu tạm 10 ký tự cho tài khoản mới và lần đặt lại (D-42). Chỉ trả về một lần. */
function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return [...bytes].map((byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('')
}

const USER_FIELDS = ['fullName', 'email', 'phone', 'role', 'depot'] as const satisfies readonly (keyof UserChanges)[]

/**
 * Người dùng nền tảng không thuộc kho hay công ty nào (FE-0-03): tài khoản tạo với vai trò nền tảng, hoặc đổi sang vai trò nền tảng,
 * thì bỏ cả `depot` lẫn `companyId` trước khi ghi — dù nơi gọi có gửi.
 */
function withoutCompanyForPlatform(user: User): User {
  if (!isPlatformRole(user.role)) return user
  const { depot: _depot, companyId: _companyId, ...rest } = user
  return rest
}

/**
 * Người dùng và phiên. Người dùng không phải dữ liệu vận hành (D-64): phiên của một công ty chỉ thấy và sửa người của công ty mình
 * (người của công ty khác, kể cả tài khoản nền tảng: đọc `NOT_FOUND`, ghi `FORBIDDEN_COMPANY`); phiên nền tảng thấy hết. Luật theo
 * vai trò (ai tạo được vai trò nào, quản trị công ty cuối cùng) là việc của FE-0-08.
 */
export function userMethods(ctx: DbContext): UserMethods {
  const { users, passwords, trips, session } = ctx.state
  const scope = ctx.scope.users

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

  /** Không để hệ thống mất quản trị hệ thống đang hoạt động cuối cùng. Luật theo từng công ty cho quản trị công ty: FE-0-08. */
  function assertNotLastAdmin(user: User) {
    if (user.role !== 'systemAdmin' || user.status !== 'active') return
    const activeAdmins = [...users.values()].filter((item) => item.role === 'systemAdmin' && item.status === 'active')
    if (activeAdmins.length <= 1) throw new MockDbError('LAST_ADMIN', {})
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
        // Vai trò sau khi sửa là vai trò nền tảng thì kho gửi kèm không tính là thay đổi (form luôn gửi cả ô kho)
        const changes: UserChanges = isPlatformRole(input.role ?? current.role) ? { ...input, depot: undefined } : input
        const changed = USER_FIELDS.filter((field) => changes[field] !== undefined && changes[field] !== current[field])
        if (changed.length === 0) return current
        if (changed.includes('email')) assertEmailFree(changes.email ?? '', id)
        if (changed.includes('role')) {
          assertNotSelf(id)
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
        assertNotSelf(id)
        assertNotLastAdmin(current)
        assertNoOpenTrips(current)
        users.delete(id)
        passwords.delete(id)
        ctx.log('user.deleted', { type: 'user', id }, { fullName: current.fullName })
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
