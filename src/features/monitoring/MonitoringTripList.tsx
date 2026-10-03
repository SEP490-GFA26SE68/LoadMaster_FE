import { TriangleAlert } from 'lucide-react'
import { memo } from 'react'
import { VehicleName } from '@/components/VehicleName'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { TripMonitoring } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { MonitoringTrip } from './monitoring-api'
import { DeadlineChip, SourceTag } from './monitoring-chips'
import { tripSummary, type MonitoringFilter } from './monitoring-view'

/**
 * Danh sách chuyến Đang vận chuyển cạnh bản đồ (FE-6-10): xe, tài xế, điểm tiếp, giờ đến dự kiến, mức hạn, sự cố — và là **bản thay
 * thế bản đồ** cho trình đọc màn hình (bản đồ là hình `aria-hidden`). Hai công tắc lọc "Có nguy cơ trễ" và "Có sự cố" kèm số chuyến
 * của từng loại. Chọn một dòng là chọn chuyến của bản đồ và của phần chi tiết bên dưới.
 */
export function MonitoringTripList({ liveOf, visible, counts, filter, onToggle, onClear, selectedId, onSelect }: {
  liveOf: (tripId: string) => TripMonitoring | undefined
  /** Chuyến qua bộ lọc, theo thứ tự của bảng giám sát. */
  visible: readonly MonitoringTrip[]
  counts: { late: number; incidents: number }
  filter: MonitoringFilter
  onToggle: (name: keyof MonitoringFilter) => void
  onClear: () => void
  selectedId: string | null
  onSelect: (tripId: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const chips = [
    { name: 'late' as const, label: t('monitoring.list.filters.late'), count: counts.late },
    { name: 'incidents' as const, label: t('monitoring.list.filters.incidents'), count: counts.incidents },
  ]
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader>
        <CardTitle as="h2">{t('monitoring.list.title')}</CardTitle>
        <div role="group" aria-label={t('monitoring.list.filters.label')} className="flex basis-full flex-wrap gap-2">
          {chips.map(({ name, label, count }) => (
            <button
              key={name}
              type="button"
              aria-pressed={filter[name]}
              onClick={() => onToggle(name)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium transition-colors duration-(--dur-fast) ease-standard',
                'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                filter[name] ? 'border-primary bg-primary-bg text-primary' : 'border-border bg-bg text-ink-2 hover:bg-surface',
              )}
            >
              {label}{' '}
              <span className="font-semibold tabular-nums">{format.integer(count)}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-2 p-4.5">
          <p className="m-0 text-small text-ink-2">{t('monitoring.list.noMatch')}</p>
          <Button variant="secondary" size="sm" onClick={onClear}>{t('monitoring.list.clear')}</Button>
        </div>
      ) : (
        <ul aria-label={t('monitoring.list.title')} className="m-0 flex list-none flex-col p-0">
          {visible.map((trip) => (
            <TripRow key={trip.tripId} trip={trip} live={liveOf(trip.tripId)} selected={trip.tripId === selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Một chuyến của danh sách. `memo`: lần đọc giám sát mới chỉ vẽ lại dòng của chuyến có điều gì đổi. */
const TripRow = memo(function TripRow({ trip, live, selected, onSelect }: {
  trip: MonitoringTrip
  live: TripMonitoring | undefined
  selected: boolean
  onSelect: (tripId: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const { next, worst, activeExceptions } = tripSummary(trip, live)
  const stopLine = next === null
    ? t('monitoring.list.noStop')
    : t(next.arrived ? 'monitoring.list.atStop' : 'monitoring.list.nextStop', { number: format.integer(next.number), name: next.name })
  return (
    <li className="border-b border-line-soft last:border-b-0">
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(trip.tripId)}
        className={cn(
          'flex w-full flex-col gap-1.5 px-4.5 py-3 text-left transition-colors duration-(--dur-fast) ease-standard',
          'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
          selected ? 'bg-primary-bg shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-surface',
        )}
      >
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-small font-medium text-ink-2 tabular-nums">{trip.tripId}</span>
          <span className="font-semibold text-ink-strong">{trip.name}</span>
        </span>
        <span className="text-small text-ink-2">
          <VehicleName name={trip.vehicleName} />
          {' · '}
          {trip.driverName === null ? t('monitoring.list.noDriver') : t('monitoring.list.driver', { name: trip.driverName })}
        </span>
        <span className="text-small text-ink-1">
          {stopLine}
          {next === null ? null : (
            <>
              {' · '}
              <span className="tabular-nums">{t(next.arrived ? 'monitoring.list.arrived' : 'monitoring.list.eta', { time: format.time(next.eta) })}</span>
            </>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <DeadlineChip status={worst} />
          {activeExceptions > 0 ? (
            <Badge tone="warning">
              <TriangleAlert aria-hidden className="size-3.5" strokeWidth={1.75} />
              {t('monitoring.list.incidents', { count: activeExceptions })}
            </Badge>
          ) : null}
          {live?.location ? <SourceTag source={live.location.source} /> : null}
        </span>
      </button>
    </li>
  )
})
