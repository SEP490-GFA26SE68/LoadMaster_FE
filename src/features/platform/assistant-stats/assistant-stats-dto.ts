/**
 * Hợp đồng của `GET /api/assistant/route-stats` (`AssistantRouteStatsResponse` của backend). Chỉ `assistant-stats-api.ts` import file
 * này; kiểu của app nằm ở `assistant-stats.ts`.
 */
export type RouteCountsDto = Readonly<Record<string, number | null | undefined>>

export type TopicStatsDto = {
  readonly topicId: string | null
  readonly total: number
  readonly byRoute: RouteCountsDto | null
}

export type AssistantRouteStatsDto = {
  readonly from: string
  readonly to: string
  readonly total: number
  readonly byRoute: RouteCountsDto | null
  readonly byTopic: readonly TopicStatsDto[] | null
  readonly byLocale: Readonly<Record<string, number | null>> | null
  readonly partial: boolean
}
