/**
 * Bảng điều khiển khi nhóm `monitoring` nối backend. Hàm → endpoint:
 *   fetchServerDashboard → GET /api/manager/dashboard?from=&to=
 * Máy chủ tính số theo kỳ (ngày theo giờ Việt Nam, khoảng đóng, tối đa 366 ngày) cho công ty của phiên; đổi kỳ là đọc lại.
 */

import { api } from '@/lib/api-client'
import { dashboardSummaryOf, type DashboardDto } from './dashboard-dto'
import type { DateRange } from './dashboard-period'
import type { DashboardSummary } from './dashboard-summary'

// GET /api/manager/dashboard
export async function fetchServerDashboard({ from, to }: DateRange): Promise<DashboardSummary> {
  return dashboardSummaryOf(await api().get<DashboardDto>('/api/manager/dashboard', { query: { from, to } }))
}
