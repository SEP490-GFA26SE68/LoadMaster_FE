/**
 * Hàm → endpoint backend (FE-0-09) của Tra cứu kiện:
 *   scanPackage        → GET /api/packages/scan/{qrToken}
 *   lookupPackages     → GET /api/packages/scan/{qrToken} · GET /api/packages (lọc mã ở app) · GET /api/packages/{id}
 *   reportPackageFound → POST /api/packages/{id}/found
 */

import { api, ApiError, isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, isMockDbError, MockDbError, type Package, type PackageType } from '@/lib/mock-db'
import { listBackendPackages, readBackendPackage, scanBackendPackage } from './package-pool-backend'
import { isBackendQrToken, lookupOf, packageOf, type BackendPackage } from './package-pool-dto'

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
    const scan = await scanBackendPackage(token)
    if (!scan.qrToken || scan.qrToken.trim().toLowerCase() !== token.trim().toLowerCase()) unknown(token)
    const found = lookupOf(scan)
    if (found === null) throw new ApiError('QR_UNKNOWN', { status: 404, params: { token } })
    return found
  }
  const [found] = await withPlace([await getMockDb().findPackageByQr(token)])
  if (!found) throw new MockDbError('QR_UNKNOWN', { token })
  return found
}

/** Không khớp định danh: không được mở một kiện khác do response sai contract. */
function unknown(code: string): never {
  throw new ApiError('QR_UNKNOWN', { status: 404, params: { token: code } })
}

const exactCode = (value: string) => value.trim().toLowerCase()

/** Đọc chi tiết chỉ sau khi đã kiểm chứng loại mã; chi tiết phải giữ nguyên identity. */
async function detailOf(pkg: Package, requireBusinessCode = false): Promise<PackageLookup> {
  const scan = await scanBackendPackage(pkg.qrToken)
  if (String(scan.id) !== pkg.id
    || !scan.qrToken || exactCode(scan.qrToken) !== exactCode(pkg.qrToken)
    || (requireBusinessCode && (typeof scan.packageCode !== 'string'
      || exactCode(scan.packageCode) !== exactCode(pkg.packageCode ?? '')))) unknown(pkg.packageCode ?? pkg.id)
  const found = lookupOf(scan)
  return found ?? unknown(pkg.packageCode ?? pkg.id)
}

/**
 * Backend: mã thường là exact Package Code (kể cả chuỗi số).
 * id:123 là nhánh ID nội bộ tường minh. UUID chỉ dùng QR nếu không có business code khớp.
 * Không union các nhánh, không fallback khi server lỗi.
 */
async function lookupOnBackend(code: string): Promise<PackageLookup[]> {
  const value = code.trim()
  if (!value) unknown(value)
  const id = /^id:([1-9]\d*)$/i.exec(value)?.[1]
  if (id) {
    const pkg = await readBackendPackage(id)
    if (pkg.id !== id) unknown(value)
    return [await detailOf(pkg)]
  }

  const rows = await listBackendPackages(value)
  const matching = new Map(rows
    .filter(pkg => exactCode(pkg.packageCode ?? '') === exactCode(value))
    .map(pkg => [pkg.id, pkg]))
  if (matching.size > 0) {
    const found = await Promise.all([...matching.values()].map(pkg => detailOf(pkg, true)))
    return found.toSorted((a, b) => Number(b.package.id) - Number(a.package.id))
  }
  if (isBackendQrToken(value)) return [await scanPackage(value)]
  return unknown(value)
}

/** Exact Package Code; backend hỗ trợ QR UUID và ID nội bộ tường minh id:123.
 * Không có nhánh tracking barcode trong API hiện hành; không suy diễn barcode thành ID.
 */
// GET /api/packages?packageCode= · GET /api/packages/scan/{qrToken} · GET /api/packages/{id}
export async function lookupPackages(code: string): Promise<PackageLookup[]> {
  if (ON_BACKEND) return lookupOnBackend(code)
  return withPlace(await getMockDb().lookupPackages(code))
}

/**
 * Nhân viên kho quét thấy lại kiện mang cờ "Không tìm thấy" (D-92): gỡ cờ, kho ghi sự kiện để điều phối viên được báo. Kho mẫu tìm kiện
 * theo mã QR, máy chủ theo mã của kho; kiện không mang cờ đó: `PACKAGE_FLAG_NOT_SET` / 409 `PACKAGE_NOT_FLAGGED`.
 */
// POST /api/packages/{id}/found
export async function reportPackageFound(pkg: Pick<Package, 'id' | 'qrToken'>): Promise<Package> {
  if (!ON_BACKEND) return getMockDb().reportPackageFound(pkg.qrToken)
  const found = packageOf(await api().post<BackendPackage>(`/api/packages/${encodeURIComponent(pkg.id)}/found`))
  if (found === null) throw new ApiError('NOT_FOUND', { status: 404 })
  return found
}
