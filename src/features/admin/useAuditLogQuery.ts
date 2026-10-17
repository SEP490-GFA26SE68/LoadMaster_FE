import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AUDIT_LOG_AVAILABLE, fetchAuditDirectory, fetchAuditEvents, type AuditLogFilter } from './audit-api'
import { summarizeAuditLog } from './audit-summary'

/** Có nhật ký để đọc không (`false` khi người dùng đã nối backend mà backend chưa có nhật ký) — chọn một lần lúc tải app. */
export const auditLogAvailable = AUDIT_LOG_AVAILABLE

/**
 * Nhật ký qua TanStack Query (mục 9). Đổi bộ lọc giữ bảng cũ trong lúc đọc lại (`keepPreviousData`) nên không nhấp nháy.
 * Mọi thao tác ghi đều thêm sự kiện: mở màn là đọc lại.
 */
export function useAuditEventsQuery(filter: AuditLogFilter) {
  return useQuery({
    queryKey: ['audit', 'events', filter],
    queryFn: () => fetchAuditEvents(filter),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

const WHOLE_LOG: AuditLogFilter = {}

/**
 * Ba ô số liệu đếm trên cả nhật ký: cùng khoá với bảng khi chưa lọc gì, nên màn mở không lọc chỉ đọc kho một lần.
 * Backend thật nên có điểm tóm tắt riêng thay vì trả cả nhật ký — lúc đó chỉ thay `queryFn`.
 */
export function useAuditSummaryQuery() {
  return useQuery({
    queryKey: ['audit', 'events', WHOLE_LOG],
    queryFn: () => fetchAuditEvents(WHOLE_LOG),
    select: summarizeAuditLog,
    staleTime: 0,
  })
}

export function useAuditDirectoryQuery() {
  return useQuery({ queryKey: ['audit', 'directory'], queryFn: fetchAuditDirectory, staleTime: 0 })
}
