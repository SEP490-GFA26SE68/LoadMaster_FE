import { ChevronDown, Plus } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { DeliveryProgress } from '@/lib/mock-db'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { StopState } from './StopCard'
import { StopList } from './StopList'
import { routeProgress, type RouteProgress } from './trip-detail'
import type { StopRow } from './trip-summary'

type StopListProps = ComponentProps<typeof StopList>

/** Trạng thái giao từng điểm: điểm đã hoàn tất, điểm chưa hoàn tất đầu tiên là điểm đang giao (khi chuyến chưa xong). */
function stopStates(stops: readonly StopRow[], delivery: DeliveryProgress, progress: RouteProgress): StopState[] {
  const done = new Map(delivery.stops.map((stop) => [stop.number, stop.completedAt]))
  const current = delivery.completedAt === undefined ? delivery.stops.find((stop) => stop.completedAt === undefined)?.number : undefined
  return stops.map(({ number }) => {
    const { unloaded = 0, issues = 0 } = progress.byStop.get(number) ?? {}
    const completedAt = done.get(number)
    if (completedAt !== undefined) return { kind: 'done', at: completedAt, issues }
    return number === current ? { kind: 'current', unloaded, issues } : { kind: 'pending', issues }
  })
}

/**
 * Sơ đồ tuyến ở Chi tiết chuyến (LM-097, D-50; V2.3): card đè lên đáy dải trời, kho xuất phát → các điểm theo thứ tự giao, mỗi điểm
 * một mốc màu định danh luôn kèm số, tên, địa chỉ, số kiện và khối lượng. `delivery` chỉ truyền khi chuyến đang giao hoặc đã hoàn
 * thành: card có đầu "Sơ đồ tuyến" gập được với số tổng hợp (điểm đã giao, kiện đã dỡ, sự cố, giờ xuất phát / khoảng thời gian), mỗi
 * điểm có trạng thái giao và đoạn đường nối. Không địa lý, không thư viện bản đồ. `onAddStop` có khi chuyến còn sửa được: chân card
 * nói điểm giao đến từ đâu (tự sinh từ yêu cầu giao, D-73) và có nút thêm điểm giao tay (FE-4b-04).
 */
export function RouteDiagram({ stops, delivery, onAddStop, ...list }: {
  stops: readonly StopRow[]
  delivery?: DeliveryProgress
  onAddStop?: () => void
} & Omit<StopListProps, 'stops' | 'states' | 'departedAt'>) {
  const t = useT()
  const titleId = useId()
  if (!delivery) {
    return (
      <Card>
        <section aria-label={t('trips.route.title')}>
          <StopList stops={stops} {...list} />
          {onAddStop ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft px-4.5 py-2.5">
              <p className="min-w-0 flex-1 basis-80 text-small text-ink-3">{t(stops.length === 0 ? 'trips.stops.sourceEmpty' : 'trips.stops.source')}</p>
              <Button variant="secondary" size="sm" onClick={onAddStop}>
                <Plus strokeWidth={1.75} />
                {t('trips.stops.add.open')}
              </Button>
            </div>
          ) : null}
        </section>
      </Card>
    )
  }

  const progress = routeProgress(stops, delivery)
  return (
    <Card className="overflow-hidden">
      <details open className="group">
        <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft py-3 pr-4.5 pl-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="grid size-7.5 flex-none place-items-center rounded-sm text-ink-3">
            <ChevronDown className="size-4 -rotate-90 transition-transform duration-(--dur-fast) group-open:rotate-0" strokeWidth={1.75} />
          </span>
          <h2 id={titleId} className="font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t('trips.route.title')}</h2>
          <span className="text-small text-ink-3">{t('trips.route.count', { count: stops.length })}</span>
          <RouteSummary progress={progress} />
        </summary>
        <StopList stops={stops} states={stopStates(stops, delivery, progress)} departedAt={delivery.startedAt} {...list} />
      </details>
    </Card>
  )
}

function RouteSummary({ progress }: { progress: RouteProgress }) {
  const t = useT()
  const format = useFormat()
  const n = format.integer
  const bold = (value: string, tone?: 'ok' | 'warn') => (
    <b className={cn('font-display text-body-lg font-[650] text-ink-strong tabular-nums', tone === 'ok' && 'text-green-700', tone === 'warn' && 'text-amber-700')}>{value}</b>
  )
  const { stops, packages, issues, departedAt, completedAt } = progress
  const ratio = (done: number, total: number) => t('trips.route.summary.ratio', { done: n(done), total: n(total) })
  const items: { label: string; value: ReactNode }[] = [
    {
      label: t('trips.route.summary.stops'),
      value: <>{bold(ratio(stops.done, stops.total), stops.done === stops.total ? 'ok' : undefined)} {t('trips.route.summary.stopsUnit')}</>,
    },
    { label: t('trips.route.summary.packages'), value: <>{bold(ratio(packages.done, packages.total))} {t('trips.route.summary.packagesUnit')}</> },
    { label: t('trips.route.summary.issues'), value: bold(n(issues), issues > 0 ? 'warn' : undefined) },
    completedAt
      ? { label: t('trips.route.summary.window'), value: bold(t('trips.route.summary.windowValue', { from: format.time(departedAt), to: format.time(completedAt) })) }
      : { label: t('trips.route.summary.departed'), value: bold(format.time(departedAt)) },
  ]
  return (
    <dl className="m-0 ml-auto flex items-center">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2 border-l border-border px-4 whitespace-nowrap first:border-l-0 first:pl-0 last:pr-0">
          <dt className="text-small text-ink-3">{item.label}</dt>
          <dd className="m-0 text-small text-ink-2">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
