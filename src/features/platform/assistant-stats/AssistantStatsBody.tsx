import { Bot, Gauge, MessagesSquare, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { Banner } from '@/components/Banner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { KpiTile } from '@/components/KpiTile'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import {
  answeredWithoutModel,
  escalationRate,
  ratioOf,
  REVIEW_ESCALATION_RATIO,
  REVIEW_MIN_PREPARED,
  type AssistantRouteStats,
} from './assistant-stats'
import { Meter, routeColumns, routeRows, topicColumns, topicRows } from './assistant-stats-tables'

const KNOWN_LOCALES = ['vi', 'en'] as const

/**
 * Nội dung của màn số đếm xu hướng: bốn ô số, bảng năm đường trả lời, tỉ lệ ngôn ngữ và bảng chủ đề. Mọi số đọc thẳng từ máy chủ hoặc
 * chia từ đó (`assistant-stats.ts`); mẫu số 0 là "—" kèm lý do. Không có chuỗi theo ngày nên không có biểu đồ theo thời gian.
 */
export function AssistantStatsBody({ stats }: { stats: AssistantRouteStats }) {
  const t = useT()
  const format = useFormat()
  const day = (value: string) => format.date(new Date(`${value}T00:00:00`))
  const partial = stats.partial ? <Banner tone="warning">{t('assistantStats.partial')}</Banner> : null

  if (stats.total === 0) {
    return (
      <>
        {partial}
        <EmptyState
          mascot="empty"
          title={t('assistantStats.emptyTitle')}
          description={t('assistantStats.emptyDescription', { from: day(stats.from), to: day(stats.to) })}
        />
      </>
    )
  }

  const instant = ratioOf(answeredWithoutModel(stats.byRoute), stats.total)
  const escalation = escalationRate(stats.byRoute)
  const percent = (ratio: number | null) => (ratio === null ? '—' : format.percent(ratio * 100))

  return (
    <>
      {partial}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={MessagesSquare} tone="blue" label={t('assistantStats.kpi.total')} value={format.integer(stats.total)} note={t('assistantStats.kpi.totalNote')} />
        <KpiTile
          icon={Zap}
          tone="green"
          label={t('assistantStats.kpi.instant')}
          value={percent(instant)}
          note={instant === null ? t('assistantStats.kpi.noTotal') : t('assistantStats.kpi.instantNote')}
        />
        <KpiTile icon={Bot} tone="azure" label={t('assistantStats.kpi.model')} value={format.integer(stats.byRoute.MODEL)} note={t('assistantStats.kpi.modelNote')} />
        <KpiTile
          icon={Gauge}
          tone="amber"
          label={t('assistantStats.kpi.escalation')}
          value={percent(escalation)}
          note={escalation === null ? t('assistantStats.kpi.noPrepared') : t('assistantStats.kpi.escalationNote')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RoutesCard stats={stats} />
        <LocalesCard stats={stats} />
      </div>
      <TopicsCard stats={stats} />
    </>
  )
}

function RoutesCard({ stats }: { stats: AssistantRouteStats }) {
  const t = useT()
  const columns = useMemo(() => routeColumns(t), [t])
  const rows = useMemo(() => routeRows(stats), [stats])
  return (
    <section aria-labelledby="assistant-stats-routes" className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
      <h2 id="assistant-stats-routes" className="border-b border-border px-4 py-3 font-display text-h3 font-bold text-ink-strong">
        {t('assistantStats.routes.title')}
      </h2>
      <DataTable data={rows} columns={columns} getRowId={(row) => row.route} density="roomy" appearance="paper" />
    </section>
  )
}

function LocalesCard({ stats }: { stats: AssistantRouteStats }) {
  const t = useT()
  const format = useFormat()
  const entries = Object.entries(stats.byLocale).toSorted(([a], [b]) => localeRank(a) - localeRank(b) || a.localeCompare(b))
  return (
    <Card className="flex-none">
      <CardHeader>
        <CardTitle as="h2">{t('assistantStats.locales.title')}</CardTitle>
      </CardHeader>
      <ul className="flex flex-col gap-3 px-4.5 py-3.5">
        {entries.map(([locale, count]) => {
          const share = ratioOf(count, stats.total)
          return (
            <li key={locale} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-ink-1">{localeName(locale, t)}</span>
                <span className="font-mono text-small tabular-nums text-ink-2">
                  {format.integer(count)} · {share === null ? '—' : format.percent(share * 100)}
                </span>
              </span>
              {share === null ? null : <Meter ratio={share} />}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

const localeRank = (locale: string) => {
  const index = KNOWN_LOCALES.findIndex((known) => known === locale)
  return index === -1 ? KNOWN_LOCALES.length : index
}

/** Tên ngôn ngữ đã biết; mã khác (máy chủ đếm theo mã khách gửi) hiện nguyên mã. */
function localeName(locale: string, t: TFunction): string {
  if (locale === 'vi') return t('assistantStats.locales.names.vi')
  if (locale === 'en') return t('assistantStats.locales.names.en')
  return locale
}

function TopicsCard({ stats }: { stats: AssistantRouteStats }) {
  const t = useT()
  const format = useFormat()
  const columns = useMemo(() => topicColumns(t), [t])
  const rows = useMemo(() => topicRows(stats.byTopic, t), [stats.byTopic, t])
  return (
    <section aria-labelledby="assistant-stats-topics" className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
        <h2 id="assistant-stats-topics" className="font-display text-h3 font-bold text-ink-strong">{t('assistantStats.topics.title')}</h2>
        <CardMeta>{t('assistantStats.topics.description')}</CardMeta>
        <CardMeta>
          {t('assistantStats.topics.reviewRule', { percent: format.percent(REVIEW_ESCALATION_RATIO * 100), min: format.integer(REVIEW_MIN_PREPARED) })}
        </CardMeta>
      </div>
      <div className="relative overflow-x-auto">
        <div className="min-w-180">
          <DataTable
            data={rows}
            columns={columns}
            getRowId={(row) => row.id}
            density="spacious"
            appearance="paper"
            emptyMessage={t('assistantStats.topics.empty')}
          />
        </div>
      </div>
    </section>
  )
}
