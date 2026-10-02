import { getMockDb } from '@/lib/mock-db'
import type { SearchGroup, SearchSources } from './quick-search'

/**
 * Lớp gọi API của tìm nhanh (LM-099) — nơi duy nhất của hộp thoại biết về kho. Chỉ đọc những gì các nhóm được phép cần: điều phối
 * viên không kéo danh sách người dùng về máy. Nối backend thật thì thay bằng một API tìm kiếm phía server.
 */
export async function fetchSearchSources(groups: readonly SearchGroup[]): Promise<SearchSources> {
  const db = getMockDb()
  const wants = (group: SearchGroup) => groups.includes(group)
  const sourcing = wants('registered') || wants('packageTypes')
  const [trips, vehicles, users, orders, registered, packageTypes] = await Promise.all([
    wants('trips') || wants('packages') ? db.listTrips() : [],
    wants('vehicles') ? db.listVehicles() : [],
    wants('users') ? db.listUsers() : [],
    wants('orders') ? db.listOrders() : [],
    wants('registered') ? db.listRegisteredPackages() : [],
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
    orders: orders.map(({ id, customerName, deliveryAddress }) => ({ id, customerName, deliveryAddress })),
    registered: registered.map((pkg) => ({
      id: pkg.id,
      reference: pkg.reference,
      qrToken: pkg.qrToken,
      typeName: typeName.get(pkg.packageTypeId) ?? pkg.packageTypeId,
    })),
    packageTypes: packageTypes.map(({ id, name }) => ({ id, name })),
  }
}
