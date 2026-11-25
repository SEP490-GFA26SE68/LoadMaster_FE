import { api } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { ASSISTANT_ROUTES, type AssistantRouteStats, type RouteCounts } from './assistant-stats'
import type { AssistantRouteStatsDto, RouteCountsDto } from './assistant-stats-dto'

/**
 * Lớp mạng của màn số đếm xu hướng của trợ lý Lumo (`/nen-tang/tro-ly-lumo`).
 *
 * | Hàm                       | Endpoint                             |
 * |---------------------------|--------------------------------------|
 * | `fetchAssistantRouteStats` | `GET /api/assistant/route-stats`    |
 *
 * Chỉ có khi nhóm `assistant` nối máy chủ: kho mẫu không đếm gì, nên không có màn và hàm này không gọi mạng.
 */
export const ASSISTANT_STATS_ON_BACKEND = usesBackend('assistant')

export type RouteStatsRange = { readonly from: string; readonly to: string }

function countsOf(dto: RouteCountsDto | null): RouteCounts {
  const out: Record<string, number> = {}
  for (const route of ASSISTANT_ROUTES) out[route] = dto?.[route] ?? 0
  return out as RouteCounts
}

function statsFromDto(dto: AssistantRouteStatsDto): AssistantRouteStats {
  const byLocale: Record<string, number> = {}
  for (const [locale, count] of Object.entries(dto.byLocale ?? {})) {
    if (typeof count === 'number' && count > 0) byLocale[locale] = count
  }
  return {
    from: dto.from,
    to: dto.to,
    total: dto.total,
    byRoute: countsOf(dto.byRoute),
    byTopic: (dto.byTopic ?? []).map((topic) => ({ topicId: topic.topicId, total: topic.total, byRoute: countsOf(topic.byRoute) })),
    byLocale,
    partial: dto.partial,
  }
}

// GET /api/assistant/route-stats?from=&to=
export async function fetchAssistantRouteStats(range: RouteStatsRange): Promise<AssistantRouteStats> {
  if (!ASSISTANT_STATS_ON_BACKEND) throw new Error('Số đếm của trợ lý chỉ có khi nhóm assistant nối máy chủ')
  const dto = await api().get<AssistantRouteStatsDto>('/api/assistant/route-stats', { query: { from: range.from, to: range.to } })
  return statsFromDto(dto)
}
