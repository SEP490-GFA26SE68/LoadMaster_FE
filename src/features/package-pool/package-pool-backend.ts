/**
 * Lượt đọc backend dùng chung của kho kiện (FE-0-09) — chỉ các file `-api` của kho kiện gọi:
 *   listBackendPackages → GET /api/packages (đọc hết các trang)
 *   readBackendPackage  → GET /api/packages/{id}
 *   scanBackendPackage  → GET /api/packages/scan/{qrToken}
 *   withDestinations    → GET /api/packages/scan/{qrToken} (mỗi kiện một lượt: danh sách không trả điểm đến)
 */

import { api, ApiError, isApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import type { Package } from '@/lib/mock-db'
import { packageOf, toBackendToken, type BackendPackage, type BackendPackageScan } from './package-pool-dto'

/** Số lượt quét chạy cùng lúc khi lấy điểm đến cho nhiều kiện — đủ nhanh mà không dồn cả trăm lượt vào backend một lúc. */
const SCAN_BATCH = 6

/** Mọi kiện của công ty theo phiên, cũ trước (mã tăng dần); kiện đã huỷ bị bỏ. `packageCode` lọc đúng mã, không kể hoa thường. */
// GET /api/packages
export async function listBackendPackages(packageCode?: string): Promise<Package[]> {
  const rows = await fetchAllPages<BackendPackage>('/api/packages', { query: { sort: 'id,asc', packageCode } })
  return rows.flatMap((dto) => packageOf(dto) ?? [])
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

/** Kiện kèm điểm đến đọc từ lượt quét của từng kiện, giữ thứ tự; mỗi đợt `SCAN_BATCH` lượt. */
// GET /api/packages/scan/{qrToken}
export async function withDestinations(packages: readonly Package[]): Promise<Package[]> {
  const batches = Array.from({ length: Math.ceil(packages.length / SCAN_BATCH) }, (_, index) => packages.slice(index * SCAN_BATCH, (index + 1) * SCAN_BATCH))
  const done: Package[] = []
  for (const batch of batches) {
    // Từng đợt nối tiếp nhau để không gửi một lúc mọi lượt quét.
    const scanned = await Promise.all(batch.map(async (pkg) => ({ ...pkg, destination: (await scanBackendPackage(pkg.qrToken)).destination?.trim() ?? '' })))
    done.push(...scanned)
  }
  return done
}
