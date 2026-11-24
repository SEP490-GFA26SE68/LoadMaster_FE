import { createColumnHelper } from '@tanstack/react-table'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { TOPIC_IDS, type TopicId } from '@/features/marketing/assistant/assistant-kb'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { ASSISTANT_ROUTES, escalationRate, needsReview, ratioOf, type AssistantRoute, type AssistantRouteStats, type TopicStats } from './assistant-stats'

/**
 * Hai bảng của màn số đếm xu hướng của trợ lý Lumo: năm đường trả lời và các chủ đề. Ô là component khai một lần ở cấp module; cột chỉ
 * dựng lại khi đổi ngôn ngữ (AGENTS mục 5, Bảng dữ liệu).
 */

/** Thanh tỉ lệ nhỏ cạnh số phần trăm; số đã có ở chữ bên cạnh nên thanh chỉ để nhìn. */
export function Meter({ ratio }: { ratio: number }) {
  const width = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <span aria-hidden className="block h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-n-100">
      <span className="block h-full rounded-full bg-(image:--meter-fill)" style={{ width: `${width}%` }} />
    </span>
  )
}

export type RouteRow = { readonly route: AssistantRoute; readonly count: number; readonly share: number | null }

export function routeRows(stats: AssistantRouteStats): RouteRow[] {
  return ASSISTANT_ROUTES.map((route) => ({ route, count: stats.byRoute[route], share: ratioOf(stats.byRoute[route], stats.total) }))
}

function RouteCell({ row }: { row: RouteRow }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal">
      <span className="font-medium text-ink-strong">{t(`assistantStats.routes.labels.${row.route}`)}</span>
      <span className="text-caption text-ink-3">{t(`assistantStats.routes.hints.${row.route}`)}</span>
    </span>
  )
}

function CountCell({ value }: { value: number }) {
  const format = useFormat()
  return <span className="font-mono tabular-nums">{format.integer(value)}</span>
}

function ShareCell({ share }: { share: number | null }) {
  const format = useFormat()
  if (share === null) return <span className="text-ink-3">—</span>
  return (
    <span className="flex items-center justify-end gap-3">
      <Meter ratio={share} />
      <span className="w-16 flex-none text-right font-mono tabular-nums">{format.percent(share * 100)}</span>
    </span>
  )
}

const routeHelper = createColumnHelper<BaseTableFeatures, RouteRow>()

export function routeColumns(t: TFunction) {
  return routeHelper.columns([
    routeHelper.display({ id: 'route', header: t('assistantStats.routes.route'), cell: (info) => <RouteCell row={info.row.original} /> }),
    routeHelper.accessor('count', {
      header: t('assistantStats.routes.count'),
      meta: { align: 'right', width: '96px' } satisfies ColumnMeta,
      cell: (info) => <CountCell value={info.row.original.count} />,
    }),
    routeHelper.accessor('share', {
      header: t('assistantStats.routes.share'),
      meta: { align: 'right', width: '36%' } satisfies ColumnMeta,
      cell: (info) => <ShareCell share={info.row.original.share} />,
    }),
  ])
}

export type TopicRow = {
  /** Khoá dòng: mã chủ đề, hoặc một khoá riêng cho "không rõ chủ đề" — máy chủ gộp mọi lượt không rõ chủ đề vào một dòng. */
  readonly id: string
  readonly topicId: string | null
  readonly name: string
  readonly total: number
  readonly prepared: number
  readonly escalated: number
  readonly rate: number | null
  readonly review: boolean
}

export const UNKNOWN_TOPIC_ROW = '__unknown'

const isKnownTopic = (id: string): id is TopicId => TOPIC_IDS.some((known) => known === id)

/** Tên chủ đề là câu hỏi trên nút gợi ý của khung chat (`assistant.topics.<id>.chip`); mã lạ hiện nguyên mã. */
export function topicName(topicId: string | null, t: TFunction): string {
  if (topicId === null) return t('assistantStats.topics.unknown')
  return isKnownTopic(topicId) ? t(`assistant.topics.${topicId}.chip`) : topicId
}

export function topicRows(topics: readonly TopicStats[], t: TFunction): TopicRow[] {
  return topics.map((topic) => ({
    id: topic.topicId ?? UNKNOWN_TOPIC_ROW,
    topicId: topic.topicId,
    name: topicName(topic.topicId, t),
    total: topic.total,
    prepared: topic.byRoute.PREPARED,
    escalated: topic.byRoute.ESCALATED,
    rate: escalationRate(topic.byRoute),
    review: needsReview(topic.byRoute),
  }))
}

function TopicCell({ row }: { row: TopicRow }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">{row.name}</span>
      {row.topicId === null && !row.review ? null : (
        <span className="flex flex-wrap items-center gap-2">
          {row.topicId === null ? null : <span className="font-mono text-caption text-ink-3">{row.topicId}</span>}
          {row.review ? <Badge tone="warning" shape="tag">{t('assistantStats.topics.review')}</Badge> : null}
        </span>
      )}
    </span>
  )
}

function RateCell({ rate }: { rate: number | null }) {
  const format = useFormat()
  return rate === null
    ? <span className="text-ink-3">—</span>
    : <span className="font-mono tabular-nums">{format.percent(rate * 100)}</span>
}

const topicHelper = createColumnHelper<BaseTableFeatures, TopicRow>()

export function topicColumns(t: TFunction) {
  return topicHelper.columns([
    topicHelper.accessor('name', {
      header: t('assistantStats.topics.topic'),
      enableSorting: true,
      cell: (info) => <TopicCell row={info.row.original} />,
    }),
    topicHelper.accessor('total', {
      header: t('assistantStats.topics.total'),
      enableSorting: true,
      meta: { align: 'right', width: '96px' } satisfies ColumnMeta,
      cell: (info) => <CountCell value={info.row.original.total} />,
    }),
    topicHelper.accessor('prepared', {
      header: t('assistantStats.topics.prepared'),
      enableSorting: true,
      meta: { align: 'right', width: '112px' } satisfies ColumnMeta,
      cell: (info) => <CountCell value={info.row.original.prepared} />,
    }),
    topicHelper.accessor('escalated', {
      header: t('assistantStats.topics.escalated'),
      enableSorting: true,
      meta: { align: 'right', width: '120px' } satisfies ColumnMeta,
      cell: (info) => <CountCell value={info.row.original.escalated} />,
    }),
    // Chủ đề chưa có lượt soạn sẵn nào không có tỉ lệ: xếp sau mọi tỉ lệ có thật
    topicHelper.accessor((row) => row.rate ?? -1, {
      id: 'rate',
      header: t('assistantStats.topics.escalationRate'),
      enableSorting: true,
      meta: { align: 'right', width: '136px' } satisfies ColumnMeta,
      cell: (info) => <RateCell rate={info.row.original.rate} />,
    }),
  ])
}
