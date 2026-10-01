import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { UserStatusBadge } from '@/features/admin/user-look'
import { VehicleStatusBadge } from '@/features/fleet/VehicleStatusBadge'
import { useTripsQuery } from '@/features/trips/useTripsQuery'
import { useT } from '@/lib/i18n'
import { STOP_COUNT, stopColor, stopForeground } from '@/lib/stops'
import { TRIP_STATUSES, type TripSubStatus } from '@/types/trip'
import { SheetCard } from '../SheetLayout'

/** Dòng phụ theo thứ tự vòng đời; mỗi loại lấy từ chuyến đầu tiên của kho đang có nó (số kho đang xếp là số thật). */
const SUB_ORDER: readonly TripSubStatus['kind'][] = ['awaitingApproval', 'approved', 'stale', 'loading', 'loaded']

const STOPS = Array.from({ length: STOP_COUNT }, (_, index) => index + 1)

/**
 * Chip trạng thái thật của app: chuyến (`StatusBadge` — sáu trạng thái của backend theo vòng đời, FE-0-05; hai cột đọc theo hàng:
 * nháp · đã lập kế hoạch, đang xếp hàng · đang vận chuyển…) và dòng phụ của nó (`TripSubStatusTag`), xe (`VehicleStatusBadge`), tài
 * khoản (`UserStatusBadge`), rồi tám mốc điểm giao tô bằng `lib/stops` — đúng màu nền và màu chữ các màn đang dùng.
 */
export function LifecycleCard() {
  const t = useT()
  const rows = useTripsQuery().data
  const subs = SUB_ORDER.flatMap((kind) => {
    const sub = rows?.find((row) => row.sub?.kind === kind)?.sub
    return sub ? [sub] : []
  })
  return (
    <SheetCard title={t('designSystem.style.lifecycle.title')} meta={t('designSystem.style.lifecycle.meta')} className="col-span-12 lg:col-span-6">
      <dl className="m-0 grid grid-cols-1 gap-x-4.5 gap-y-2.5 sm:grid-cols-2">
        {TRIP_STATUSES.map((status) => (
          <div key={status} className="flex min-w-0 items-center gap-3">
            <dt><StatusBadge status={status} /></dt>
            <dd className="m-0 truncate text-small text-ink-3">{t(`designSystem.style.lifecycle.notes.${status}`)}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-small text-ink-2">{t('designSystem.style.lifecycle.legend')}</p>
      {subs.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {subs.map((sub) => <TripSubStatusTag key={sub.kind} sub={sub} />)}
          <span className="text-small text-ink-3">{t('designSystem.style.lifecycle.sub')}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 border-t border-line-soft pt-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <VehicleStatusBadge status="available" />
          <VehicleStatusBadge status="in_use" />
          <VehicleStatusBadge status="maintenance" />
          <span className="text-small text-ink-3">{t('designSystem.style.lifecycle.vehicles')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <UserStatusBadge status="active" />
          <UserStatusBadge status="suspended" />
          <span className="text-small text-ink-3">{t('designSystem.style.lifecycle.accounts')}</span>
        </div>
      </div>

      <p className="m-0 text-small text-ink-2">{t('designSystem.style.lifecycle.stops')}</p>
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
        {STOPS.map((number) => (
          <li
            key={number}
            className="grid size-7.5 place-items-center rounded-md font-display text-body font-bold tabular-nums"
            style={{ background: stopColor(number), color: stopForeground(number) }}
          >
            <span aria-hidden>{number}</span>
            <span className="sr-only">{t('common.stop', { number })}</span>
          </li>
        ))}
      </ol>
    </SheetCard>
  )
}
