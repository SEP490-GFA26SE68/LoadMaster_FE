/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchSearchSources
 */

import { getMockDb } from '@/lib/mock-db'
import type { SearchGroup, SearchSources } from './quick-search'

/**
 * Lớp gọi API của tìm nhanh (LM-099) — nơi duy nhất của hộp thoại biết về kho. Chỉ đọc những gì các nhóm được phép cần: điều phối
 * viên không kéo danh sách người dùng về máy. Nối backend thật thì thay bằng một API tìm kiếm phía server.
 */
// chưa có ở BE
export async function fetchSearchSources(groups: readonly SearchGroup[]): Promise<SearchSources> {
  const db = getMockDb()
  const wants = (group: SearchGroup) => groups.includes(group)
  const sourcing = wants('pool') || wants('packageTypes')
  const [trips, vehicles, users, requirements, pool, packageTypes] = await Promise.all([
    wants('trips') || wants('packages') ? db.listTrips() : [],
    wants('vehicles') ? db.listVehicles() : [],
    wants('users') ? db.listUsers() : [],
    wants('requirements') ? db.listDeliveryRequirements() : [],
    wants('pool') ? db.listPackages() : [],
    sourcing ? db.listPackageTypes() : [],
  ])
  const typeName = new Map(packageTypes.map((type) => [type.id, type.name]))
  return {
    trips: trips.map((trip) => ({
      id: trip.id,
      name: trip.name,
      stops: trip.stops.map((stop) => stop.name),
      packageIds: trip.packages.map((pkg) => pkg.id),
    })),
    vehicles: vehicles.map(({ id, name }) => ({ id, name })),
    users: users.map(({ id, fullName, email, role }) => ({ id, fullName, email, role })),
    requirements: requirements.map(({ id, destinationName, address }) => ({ id, destinationName, address })),
    pool: pool.map((pkg) => ({
      id: pkg.id,
      ...(pkg.packageCode === pkg.id ? {} : { reference: pkg.packageCode }),
      qrToken: pkg.qrToken,
      // Kiện không gắn loại kiện thì dòng phụ là điểm đến
      typeName: (pkg.packageTypeId === undefined ? undefined : typeName.get(pkg.packageTypeId)) ?? pkg.destination,
    })),
    packageTypes: packageTypes.map(({ id, name }) => ({ id, name })),
  }
}
