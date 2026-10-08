import type { User } from '@/types/user'

export type UserSummary = {
  readonly total: number
  readonly active: number
  readonly suspended: number
}

/**
 * Số của ba ô trên đầu màn Người dùng (V2): đếm trên **toàn bộ** danh sách từ kho, không theo ô tìm hay bộ lọc — ô số liệu nói
 * về hệ thống, bảng mới nói về kết quả lọc.
 */
export function userSummary(users: readonly Pick<User, 'status'>[]): UserSummary {
  const active = users.filter((user) => user.status === 'active').length
  return { total: users.length, active, suspended: users.length - active }
}

export type UserDistinct = {
  readonly roles: number
  readonly depots: number
  readonly companies: number
}

/**
 * Số vai trò, kho / chi nhánh và công ty khác nhau trong danh sách (dòng số đếm dưới tiêu đề màn Người dùng). Tài khoản nền tảng không
 * có kho hay công ty nên không góp vào hai số đó.
 */
export function userDistinct(users: readonly Pick<User, 'role' | 'depot' | 'companyId'>[]): UserDistinct {
  const depots = new Set(users.flatMap((user) => (user.depot ? [user.depot] : [])))
  const companies = new Set(users.flatMap((user) => (user.companyId === undefined ? [] : [user.companyId])))
  return { roles: new Set(users.map((user) => user.role)).size, depots: depots.size, companies: companies.size }
}
