import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchServerAuditLog, type ServerAuditFilter } from './audit-backend-api'

/**
 * Một trang nhật ký máy chủ qua TanStack Query (mục 9). Khoá dưới `['audit']` như bản kho mẫu; đổi trang hay bộ lọc giữ bảng cũ trong
 * lúc đọc (`keepPreviousData`) nên không nhấp nháy. Mọi thao tác ghi ở máy chủ đều có thể thêm bản ghi: mở màn là đọc lại.
 */
export function useServerAuditLogQuery(filter: ServerAuditFilter) {
  return useQuery({
    queryKey: ['audit', 'server', filter],
    queryFn: () => fetchServerAuditLog(filter),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}
