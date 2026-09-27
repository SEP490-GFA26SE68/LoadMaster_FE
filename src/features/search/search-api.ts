import { getMockDb } from '@/lib/mock-db'
import type { SearchGroup, SearchSources } from './quick-search'

/**
 * Lớp gọi API của tìm nhanh (LM-099) — nơi duy nhất của hộp thoại biết về kho. Chỉ đọc những gì các nhóm được phép cần: điều phối
 * viên không kéo danh sách người dùng về máy. Kho lọc dữ liệu Review 1 theo công ty của người đăng nhập (LM-104), nên nhà sản xuất chỉ
 * tìm thấy kiện, lô của mình và logistics chỉ thấy lô giao cho mình. Nối backend thật thì thay bằng một API tìm kiếm phía server.
 */
export async function fetchSearchSources(groups: readonly SearchGroup[]): Promise<SearchSources> {
  const db = getMockDb()
  const wants = (group: SearchGroup) => groups.includes(group)
  const sourcing = wants('registered') || wants('packageTypes')
  const shipping = wants('shipments') || wants('incoming')
  const [trips, vehicles, users, orders, registered, packageTypes, shipments, companies] = await Promise.all([
    wants('trips') || wants('packages') ? db.listTrips() : [],
    wants('vehicles') ? db.listVehicles() : [],
    wants('users') ? db.listUsers() : [],
    wants('orders') ? db.listOrders() : [],
    wants('registered') ? db.listRegisteredPackages() : [],
    sourcing ? db.listPackageTypes() : [],
    shipping ? db.listShipments() : [],
    shipping ? db.listCompanies() : [],
  ])
  const typeName = new Map(packageTypes.map((type) => [type.id, type.name]))
  const companyName = new Map(companies.map((company) => [company.id, company.name]))
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
    shipments: shipments.map(({ id, manufacturerId, logisticsCompanyId }) => ({
      id,
      manufacturer: companyName.get(manufacturerId) ?? manufacturerId,
      logistics: companyName.get(logisticsCompanyId) ?? logisticsCompanyId,
    })),
    packageTypes: packageTypes.map(({ id, name }) => ({ id, name })),
  }
}
