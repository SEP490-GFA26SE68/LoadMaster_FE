/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Dòng kiện gõ / nhập ngay trong chuyến.
 *   savePackage, importPackages → POST /api/trips/{id}/packages (sửa kiện đang có: chưa có ở BE); nhận thêm `overrideReason` của luật
 *                                 phân tách hàng (cùng endpoint: `override`, `overrideReason`)
 *   deletePackage               → DELETE /api/trips/{id}/packages/{packageId} — bỏ cả một dòng kiện
 *   chưa có ở BE: fetchPackages, duplicateTripPackage
 * Nhóm `trips` nối backend thì mọi hàm từ chối `NOT_SUPPORTED`: backend chưa trả dòng kiện của chuyến, màn đã ẩn bảng kiện.
 */
import type { CargoPackage } from '@/domain/models'
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type Trip } from '@/lib/mock-db'
import { duplicatePackage } from './trip-packages'

const ON_BACKEND = usesBackend('trips')

/** Không bao giờ đọc hay ghi kho mẫu bằng mã chuyến của máy chủ. */
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

// chưa có ở BE
export async function fetchPackages(tripId: string): Promise<CargoPackage[]> {
  if (ON_BACKEND) return unsupported()
  return (await getMockDb().getTrip(tripId)).packages
}

/** Thêm kiện mới hoặc thay kiện cùng mã; kiện đổi thì `inputVersion` tăng và revision cũ thành lỗi thời (D-31). */
// POST /api/trips/{id}/packages (sửa kiện đang có: chưa có ở BE)
export async function savePackage(tripId: string, pkg: CargoPackage, overrideReason?: string): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  const index = packages.findIndex((item) => item.id === pkg.id)
  const next = index === -1 ? [...packages, pkg] : packages.with(index, pkg)
  return db.updateTrip(tripId, { packages: next, ...(overrideReason === undefined ? {} : { overrideReason }) })
}

/**
 * Nhập kiện từ file (LM-093, D-49): thêm sau các kiện đang có trong **một** lần ghi — `inputVersion` tăng một lần, kho ghi một sự kiện
 * nhật ký. Dòng lỗi đã bị bỏ ở bước xem trước; nơi gọi chỉ đưa kiện hợp lệ.
 */
// POST /api/trips/{id}/packages
export async function importPackages(tripId: string, imported: readonly CargoPackage[], overrideReason?: string): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  return db.updateTrip(tripId, { packages: [...packages, ...imported], ...(overrideReason === undefined ? {} : { overrideReason }) })
}

// DELETE /api/trips/{id}/packages/{packageId}
export async function deletePackage(tripId: string, packageId: string): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  return db.updateTrip(tripId, { packages: packages.filter((item) => item.id !== packageId) })
}

/** Nhân bản kiện (D-33): mã mới lấy theo mã lớn nhất đang có, bản sao nằm ngay sau bản gốc. */
// chưa có ở BE
export async function duplicateTripPackage(tripId: string, packageId: string): Promise<CargoPackage> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  const index = packages.findIndex((item) => item.id === packageId)
  const source = packages[index]
  if (!source) throw new Error(`Chuyến ${tripId} không có kiện ${packageId}`)
  const copy = duplicatePackage(source, packages.map((item) => item.id))
  await db.updateTrip(tripId, { packages: packages.toSpliced(index + 1, 0, copy) })
  return copy
}
