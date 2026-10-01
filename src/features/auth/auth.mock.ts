import { QUICK_LOGIN_ACCOUNTS, SEED_COMPANIES, SEED_PASSWORD } from '@/lib/mock-db'
import { ROLES, type Role } from '@/types/user'

/**
 * Tài khoản dùng thử hiện ở màn đăng nhập khi còn chạy kho mock, chung một mật khẩu, chia nhóm (FE-0-03): tài khoản nền tảng, rồi từng
 * công ty — mỗi công ty một tài khoản cho mỗi vai trò. Người dùng và mật khẩu thật nằm trong kho (`@/lib/mock-db`, D-42) — tài khoản
 * quản trị tạo mới cũng đăng nhập được.
 */
export const DEMO_PASSWORD = SEED_PASSWORD

export type DemoHint = { readonly role: Role; readonly email: string }

export type DemoGroup = {
  readonly id: string
  /** Tên công ty trong seed (tên riêng, không dịch); `null` là nhóm tài khoản nền tảng — màn dịch tên nhóm đó. */
  readonly company: string | null
  readonly hints: readonly DemoHint[]
}

/** Tài khoản của một công ty (`undefined`: nền tảng), theo thứ tự vai trò của `ROLES`. */
function hintsOf(companyId: string | undefined): DemoHint[] {
  return QUICK_LOGIN_ACCOUNTS
    .filter((account) => account.companyId === companyId)
    .map(({ role, email }) => ({ role, email }))
    .toSorted((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
}

/** Nền tảng trước, rồi các công ty logistics theo thứ tự của seed. Công ty không có tài khoản dùng thử thì không thành nhóm. */
export const DEMO_GROUPS: readonly DemoGroup[] = [
  { id: 'platform', company: null, hints: hintsOf(undefined) },
  ...SEED_COMPANIES.map((company) => ({ id: company.id, company: company.name, hints: hintsOf(company.id) })),
].filter((group) => group.hints.length > 0)
