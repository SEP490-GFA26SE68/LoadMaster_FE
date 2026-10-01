import { DEMO_ACCOUNTS, SEED_ANCHOR_DATE } from '@/lib/mock-db'
import { seedUsers } from '@/lib/mock-db/seed-users'
import type { Role } from '@/types/user'

/** Mã người dùng của seed, ví dụ `US-0006`: đăng nhập đúng một người khi tài khoản demo của vai trò không phải người làm việc đó. */
export type SeedUserId = `US-${string}`

/**
 * Ghi phiên của một tài khoản seed vào `sessionStorage`, như sau khi đăng nhập; `AuthProvider` đọc khi mount và kho xác nhận lại
 * phiên. Truyền vai trò thì lấy tài khoản demo của vai trò (tài khoản đầu tiên của vai trò trong seed); truyền mã thì lấy đúng người đó
 * — ví dụ tài xế của một chuyến cụ thể.
 */
export function signedInAs(account: Role | SeedUserId) {
  const id = account.startsWith('US-') ? account : DEMO_ACCOUNTS.find((item) => item.role === account)?.id
  const user = seedUsers(SEED_ANCHOR_DATE).find((item) => item.id === id)
  if (!user) throw new Error(`Không có tài khoản seed cho ${account}`)
  sessionStorage.setItem('loadmaster.phien', JSON.stringify(user))
  return user
}
