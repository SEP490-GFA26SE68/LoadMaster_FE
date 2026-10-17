/**
 * Hàm → endpoint backend (FE-0-09) của Tra cứu kiện:
 *   scanPackage        → GET /api/packages/scan/{qrToken}
 *   lookupPackages     → GET /api/packages/scan/{qrToken} · GET /api/packages?packageCode= · GET /api/packages/{id}
 *   chưa có ở BE: reportPackageFound (kho quét thấy lại kiện mang cờ — backend không có cờ kiện)
 */

import { ApiError, isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, isMockDbError, MockDbError, type Package, type PackageType } from '@/lib/mock-db'
import { listBackendPackages, readBackendPackage, scanBackendPackage } from './package-pool-backend'
import { isBackendQrToken, lookupOf } from './package-pool-dto'

const ON_BACKEND = usesBackend('packages')

/** Một kiện của màn Tra cứu kiện (FE-3b-06): kiện, loại kiện, và chuyến + điểm giao đang giữ kiện (nếu có). */
export type PackageLookup = {
  readonly package: Package
  readonly type: PackageType | undefined
  readonly trip: { readonly id: string; readonly name: string } | undefined
  readonly stop: { readonly number: number; readonly name: string } | undefined
}

/** Lỗi "không khớp kiện nào" — kho mẫu và backend cùng mã `QR_UNKNOWN`. */
export function isUnknownPackage(error: unknown): boolean {
  return (isMockDbError(error) || isApiError(error)) && error.code === 'QR_UNKNOWN'
}

async function withPlace(packages: readonly Package[]): Promise<PackageLookup[]> {
  const db = getMockDb()
  const tripIds = [...new Set(packages.flatMap((pkg) => pkg.tripId ?? []))]
  const [types, trips] = await Promise.all([db.listPackageTypes(), Promise.all(tripIds.map((id) => db.getTrip(id)))])
  const tripById = new Map(trips.map((trip) => [trip.id, trip]))
  return packages.map((pkg) => {
    const trip = pkg.tripId === undefined ? undefined : tripById.get(pkg.tripId)
    const stopIndex = trip?.stops.findIndex((stop) => stop.id === pkg.stopId) ?? -1
    const stop = trip?.stops[stopIndex]
    return {
      package: pkg,
      type: types.find((type) => type.id === pkg.packageTypeId),
      trip: trip ? { id: trip.id, name: trip.name } : undefined,
      stop: stop ? { number: stopIndex + 1, name: stop.name } : undefined,
    }
  })
}

/** Tra kiện theo mã QR vừa quét; không có, hoặc là kiện của công ty khác: `QR_UNKNOWN`. */
// GET /api/packages/scan/{qrToken}
export async function scanPackage(token: string): Promise<PackageLookup> {
  if (ON_BACKEND) {
    const found = lookupOf(await scanBackendPackage(token))
    if (found === null) throw new ApiError('QR_UNKNOWN', { status: 404, params: { token } })
    return found
  }
  const [found] = await withPlace([await getMockDb().findPackageByQr(token)])
  if (!found) throw new MockDbError('QR_UNKNOWN', { token })
  return found
}

/** Kiện không đọc được vì không có hoặc thuộc công ty khác (backend trả 404 / 403): không khớp, không lộ gì thêm. */
function missing(error: unknown): null {
  if (isUnknownPackage(error) || (isApiError(error) && (error.status === 404 || error.status === 403))) return null
  throw error
}

/** Backend: khớp mã QR, mã của bên gửi và mã của kho (số); mỗi kiện khớp đọc thêm một lượt quét để có điểm đến, chuyến, điểm giao. */
async function lookupOnBackend(code: string): Promise<PackageLookup[]> {
  const value = code.trim()
  const [byToken, byCode, byId] = await Promise.all([
    isBackendQrToken(value) ? scanBackendPackage(value).then(lookupOf, missing) : null,
    listBackendPackages(value),
    /^\d+$/.test(value) ? readBackendPackage(value).catch(missing) : null,
  ])
  const found = new Map<string, PackageLookup>()
  if (byToken) found.set(byToken.package.id, byToken)
  const others = [...byCode, ...(byId ? [byId] : [])].filter((pkg, index, all) => !found.has(pkg.id) && all.findIndex((item) => item.id === pkg.id) === index)
  const scanned = await Promise.all(others.map((pkg) => scanBackendPackage(pkg.qrToken).then(lookupOf, missing)))
  for (const item of scanned) if (item) found.set(item.package.id, item)
  if (found.size === 0) throw new ApiError('QR_UNKNOWN', { status: 404, params: { token: value } })
  return [...found.values()].toSorted((a, b) => Number(b.package.id) - Number(a.package.id))
}

/**
 * Tra kiện theo mã người dùng gõ: mã QR, mã của bên gửi hoặc mã của kho. Mã của bên gửi trùng nhau thì trả mọi kiện khớp, mới nhất
 * trước; không khớp kiện nào của công ty: `QR_UNKNOWN`.
 */
// GET /api/packages/scan/{qrToken} · GET /api/packages?packageCode= · GET /api/packages/{id}
export async function lookupPackages(code: string): Promise<PackageLookup[]> {
  if (ON_BACKEND) return lookupOnBackend(code)
  return withPlace(await getMockDb().lookupPackages(code))
}

/** Nhân viên kho quét thấy lại kiện mang cờ "Không tìm thấy" (D-92): gỡ cờ, kho ghi sự kiện để điều phối viên được báo. */
// chưa có ở BE
export function reportPackageFound(token: string): Promise<Package> {
  if (ON_BACKEND) return Promise.reject(new Error('Backend chưa có cờ kiện: màn không được gọi reportPackageFound khi nối backend.'))
  return getMockDb().reportPackageFound(token)
}
