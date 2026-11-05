/**
 * Hàm → endpoint backend của Nhật ký khi nhóm `users` nối backend.
 *   fetchServerAuditLog → GET /api/audit-logs
 */

import { api } from '@/lib/api-client'
import { auditPageOf, type AuditLogPageDto, type ServerAuditPage } from './audit-dto'

export type { ServerAuditEntry, ServerAuditPage } from './audit-dto'

/**
 * Bộ lọc của nhật ký máy chủ. Phạm vi do máy chủ quyết: quản trị công ty luôn đọc công ty mình, quản trị hệ thống lọc theo
 * `companyId` (mã công ty, hoặc `platform` cho bản ghi không thuộc công ty nào). `from`, `to` là ngày theo giờ Việt Nam.
 */
export type ServerAuditFilter = {
  /** Trang đếm từ 0 (như máy chủ). */
  readonly page: number
  readonly size: number
  readonly from?: string
  readonly to?: string
  readonly actionType?: string
  readonly userId?: string
  readonly companyId?: string
  readonly q?: string
}

/** Một trang nhật ký, mới nhất trước; máy chủ phân trang, không đọc hết mọi trang. */
// GET /api/audit-logs
export async function fetchServerAuditLog(filter: ServerAuditFilter): Promise<ServerAuditPage> {
  const payload = await api().getRaw('/api/audit-logs', { query: { ...filter } })
  return auditPageOf(payload as AuditLogPageDto | null)
}
