import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { vnDate } from '@/lib/mock-db'
import { fetchDashboardData } from './dashboard-api'
import { fetchServerDashboard } from './dashboard-backend-api'
import { DASHBOARD_CAPABILITIES } from './dashboard-capabilities'
import { resolvePeriod, type PeriodSelection } from './dashboard-period'
import { summarizeDashboard, type DashboardData } from './dashboard-summary'

/**
 * Số liệu bảng điều khiển của kỳ đang chọn qua TanStack Query; component không gọi `-api.ts` trực tiếp (mục 9).
 * Kho mẫu: dữ liệu kho nằm ở một khoá `['dashboard']` (mutation của chuyến làm mới khoá này); kỳ chỉ đổi phần `select`, nên đổi kỳ
 * tính lại ngay trên máy, không nhấp nháy trạng thái đang tải. Đọc lại mỗi lần mở màn: tiến độ kho và giao hàng đổi liên tục.
 */
function useStoreDashboardQuery({ preset, from, to }: PeriodSelection) {
  const select = useCallback(
    (data: DashboardData) => summarizeDashboard(data, resolvePeriod({ preset, from, to }, data.today)),
    [preset, from, to],
  )
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardData, select, staleTime: 0 })
}

/**
 * Máy chủ tính số theo kỳ: mỗi kỳ một khoá dưới `['dashboard']` (mutation của chuyến vẫn làm mới), kỳ tính từ hôm nay giờ Việt Nam
 * như kho mẫu. Đổi kỳ là đọc lại máy chủ.
 */
function useServerDashboardQuery({ preset, from, to }: PeriodSelection) {
  const range = useMemo(() => resolvePeriod({ preset, from, to }, vnDate(new Date())), [preset, from, to])
  return useQuery({
    queryKey: ['dashboard', 'server', range.from, range.to],
    queryFn: () => fetchServerDashboard(range),
    staleTime: 0,
  })
}

/** Nguồn chọn một lần lúc tải app (`DASHBOARD_CAPABILITIES`), nên thứ tự hook không đổi giữa các lần vẽ. */
export const useDashboardQuery = DASHBOARD_CAPABILITIES.backend ? useServerDashboardQuery : useStoreDashboardQuery
