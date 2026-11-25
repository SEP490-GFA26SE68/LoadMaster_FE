import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { fetchAssistantRouteStats, type RouteStatsRange } from './assistant-stats-api'

/**
 * Số đếm xu hướng của trợ lý Lumo trong một khoảng ngày; `null` (khoảng ngày máy chủ không nhận) thì không đọc. `staleTime: 0`: khách
 * hỏi Lumo suốt, mở lại màn là đọc lại. Đổi khoảng ngày thì giữ số cũ (mờ đi) tới khi số mới về, màn không nháy về vòng quay.
 */
export function useAssistantStatsQuery(range: RouteStatsRange | null) {
  return useQuery({
    queryKey: ['assistant', 'route-stats', range?.from ?? '', range?.to ?? ''],
    queryFn: range === null ? skipToken : () => fetchAssistantRouteStats(range),
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}
