import { afterEach, expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { getMockDb } from '@/lib/mock-db'
import { ROLES, type Role } from '@/types/user'
import { searchGroupsFor } from './quick-search'
import { fetchSearchSources } from './search-api'

/**
 * FE-0-04: tìm nhanh chỉ đọc kho những gì nhóm của vai trò cần — không gọi hàm kho của màn vai trò không mở được (quản trị không kéo
 * chuyến, điều phối viên không kéo danh sách người dùng). Theo dõi lời gọi trên kho dùng chung; hàm kho trả rỗng để phép kiểm không phụ
 * thuộc phiên đăng nhập hay luật lọc theo công ty của kho.
 */
const READS = ['listTrips', 'listVehicles', 'listUsers', 'listOrders', 'listPackages', 'listPackageTypes'] as const

afterEach(() => {
  vi.restoreAllMocks()
})

async function readsOf(role: Role): Promise<string[]> {
  const db = getMockDb()
  const spies = READS.map((name) => [name, vi.spyOn(db, name).mockResolvedValue([])] as const)
  const groups = searchGroupsFor((permission) => can(role, permission))
  // Vai trò không có nhóm nào thì hộp tìm nhanh không gắn, không có lời gọi nào (`useSearchSourcesQuery` bỏ qua)
  if (groups.length > 0) await fetchSearchSources(groups)
  return spies.filter(([, spy]) => spy.mock.calls.length > 0).map(([name]) => name)
}

/** Khai theo `Record<Role, …>`: thêm vai trò mà quên dòng ở đây là lỗi TypeScript. */
const EXPECTED_READS: Readonly<Record<Role, readonly string[]>> = {
  systemAdmin: ['listUsers'],
  systemManager: [],
  systemSupporter: [],
  companyAdmin: ['listUsers'],
  // Quản lý công ty xem kho kiện (FE-3b-03): đọc kiện và tên loại kiện của kiện
  manager: ['listTrips', 'listVehicles', 'listOrders', 'listPackages', 'listPackageTypes'],
  dispatcher: ['listTrips', 'listVehicles', 'listOrders', 'listPackages', 'listPackageTypes'],
  warehouse: [],
  driver: [],
}

test.each(ROLES)('quick search of %s reads only what its groups need from the store', async (role) => {
  expect(await readsOf(role)).toStrictEqual(EXPECTED_READS[role])
})
