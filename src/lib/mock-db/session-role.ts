import type { Role, User } from '@/types/user'
import type { DbContext } from './db-context'
import { MockDbError } from './errors'

/** Người đang đăng nhập; `undefined` khi kho không có phiên (test logic kho, dựng seed). */
export function sessionUser(ctx: DbContext): User | undefined {
  const { session, users } = ctx.state
  return session.userId === null ? undefined : users.get(session.userId)
}

/** Việc của một vai trò; kho không có phiên thì không xét. Sai là `ROLE_NOT_ALLOWED`. */
export function assertRole(ctx: DbContext, ...roles: Role[]) {
  const user = sessionUser(ctx)
  if (user !== undefined && !roles.includes(user.role)) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
}
