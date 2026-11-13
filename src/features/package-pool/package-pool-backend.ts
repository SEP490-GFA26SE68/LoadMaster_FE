/**
 * Lượt đọc backend dùng chung của kho kiện (FE-0-09) — chỉ các file `-api` của kho kiện gọi:
 *   listBackendPackages → GET /api/packages (đọc hết các trang)
 *   readBackendPackage  → GET /api/packages/{id}
 *   scanBackendPackage  → GET /api/packages/scan/{qrToken}
 */

import { api, ApiError, isApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import type { Package } from '@/lib/mock-db'
import { packageOf, toBackendToken, type BackendPackage, type BackendPackageScan } from './package-pool-dto'

/** Mọi kiện của công ty theo phiên, cũ trước (mã tăng dần); kiện đã huỷ bị bỏ. `packageCode` lọc đúng mã, không kể hoa thường. */
// GET /api/packages
export async function listBackendPackages(packageCode?: string): Promise<Package[]> {
  const rows = await fetchAllPages<BackendPackage>('/api/packages', { query: { sort: 'id,asc' } })
  const all = rows.flatMap((dto) => packageOf(dto) ?? [])
  // Máy chủ không lọc theo mã của bên gửi (chỉ `orderId`, `packageTypeId`): app lọc, không phân biệt hoa thường
  if (packageCode === undefined) return all
  const wanted = packageCode.trim().toLowerCase()
  return all.filter((pkg) => pkg.packageCode.trim().toLowerCase() === wanted)
}

/** Một kiện theo mã của kho; kiện đã huỷ (không có ở app) là `NOT_FOUND`. */
// GET /api/packages/{id}
export async function readBackendPackage(id: string): Promise<Package> {
  const pkg = packageOf(await api().get<BackendPackage>(`/api/packages/${encodeURIComponent(id)}`))
  if (pkg === null) throw new ApiError('NOT_FOUND', { status: 404 })
  return pkg
}

/** Tra theo mã QR; không có, hoặc là kiện của công ty khác: `QR_UNKNOWN` như kho mẫu. */
// GET /api/packages/scan/{qrToken}
export async function scanBackendPackage(token: string): Promise<BackendPackageScan> {
  const value = toBackendToken(token)
  try {
    return await api().get<BackendPackageScan>(`/api/packages/scan/${encodeURIComponent(value)}`)
  } catch (error) {
    if (isApiError(error) && error.status === 404) throw new ApiError('QR_UNKNOWN', { status: 404, params: { token } })
    throw error
  }
}
