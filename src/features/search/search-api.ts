/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchSearchSources (kho kiện và loại kiện đọc qua `package-pool-api.ts`: GET /api/packages khi nối nhóm packages)
 */

import { fetchPackages, fetchPackageTypes } from '@/features/package-pool/package-pool-api'
import { isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type Package, type PackageType } from '@/lib/mock-db'
import type { SearchGroup, SearchSources } from './quick-search'

const POOL_ON_BACKEND = usesBackend('packages')

/** Kiện của kho kiện, kho mẫu: dòng phụ là tên loại kiện, kiện không gắn loại thì điểm đến; mở ở Kho kiện theo mã của kho. */
function mockPool(packages: readonly Package[], types: readonly PackageType[]): SearchSources['pool'] {
  const typeName = new Map(types.map((type) => [type.id, type.name]))
  return packages.map((pkg) => ({
    id: pkg.id,
    ...(pkg.packageCode === pkg.id ? {} : { reference: pkg.packageCode }),
    qrToken: pkg.qrToken,
    typeName: (pkg.packageTypeId === undefined ? undefined : typeName.get(pkg.packageTypeId)) ?? pkg.destination,
  }))
}

/**
 * Kiện của kho kiện, nối backend: mã của kho là số ngắn nên dòng đầu là mã của bên gửi; danh sách của máy chủ không có loại kiện, điểm
 * đến thường vắng nên dòng phụ là điểm đến (nếu có), trạng thái và loại hàng — không phải mã QR. Kiện mở ở Kho kiện theo mã QR (`?q=`
 * theo mã số khớp cả kiện khác); mã QR vẫn tìm được. Người xem không đọc được kho kiện thì `fetchSearchSources` không gọi tới đây
 * (`quickSearchGroups`); máy chủ vẫn từ chối (403) thì nhóm không có kết quả.
 */
async function backendPool(): Promise<SearchSources['pool']> {
  try {
    return (await fetchPackages()).map((pkg) => ({
      id: pkg.id,
      label: pkg.packageCode,
      qrToken: pkg.qrToken,
      typeName: pkg.destination,
      query: pkg.qrToken,
      status: pkg.status,
      handlingClass: pkg.handlingClass,
    }))
  } catch (error) {
    if (isApiError(error) && error.status === 403) return []
    throw error
  }
}

/**
 * Lớp gọi API của tìm nhanh (LM-099) — nơi duy nhất của hộp thoại biết về kho. Chỉ đọc những gì các nhóm được phép cần: điều phối
 * viên không kéo danh sách người dùng về máy. Nối backend thật thì thay bằng một API tìm kiếm phía server; kho kiện và loại kiện đi
 * theo nguồn của màn Kho kiện (`package-pool-api.ts`), nên khi nối nhóm packages tìm nhanh thấy đúng kiện của máy chủ.
 */
// chưa có ở BE
export async function fetchSearchSources(groups: readonly SearchGroup[]): Promise<SearchSources> {
  const db = getMockDb()
  const wants = (group: SearchGroup) => groups.includes(group)
  const sourcing = !POOL_ON_BACKEND && (wants('pool') || wants('packageTypes'))
  const [trips, vehicles, users, requirements, packages, packageTypes] = await Promise.all([
    wants('trips') || wants('packages') ? db.listTrips() : [],
    wants('vehicles') ? db.listVehicles() : [],
    wants('users') ? db.listUsers() : [],
    wants('requirements') ? db.listDeliveryRequirements() : [],
    wants('pool') && !POOL_ON_BACKEND ? fetchPackages() : [],
    sourcing ? fetchPackageTypes() : [],
  ])
  const pool = !wants('pool') ? [] : POOL_ON_BACKEND ? await backendPool() : mockPool(packages, packageTypes)
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
    pool,
    packageTypes: packageTypes.map(({ id, name }) => ({ id, name })),
  }
}
