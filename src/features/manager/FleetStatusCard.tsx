import { ArrowRight, CircleCheck, Truck, Wrench, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { VEHICLE_STATUSES } from '@/features/fleet/vehicle-status'
import { useFormat, useT } from '@/lib/i18n'
import type { VehicleStatus } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { DashboardSummary } from './dashboard-summary'

/** Icon và tint như ô trạng thái ở màn Đội xe (mục 4): sẵn sàng → xanh lá, vận hành → xanh dương, cần chú ý → hổ phách. */
const STATUS_GLYPH: Record<VehicleStatus, { icon: LucideIcon; tint: string }> = {
  available: { icon: CircleCheck, tint: 'bg-tint-green text-tint-green-fg' },
  in_use: { icon: Truck, tint: 'bg-tint-blue text-tint-blue-fg' },
  maintenance: { icon: Wrench, tint: 'bg-tint-amber text-tint-amber-fg' },
}

/**
 * Thẻ đội xe (V2): số xe đang phục vụ chuyến trên tổng, rồi ba trạng thái theo thứ tự và nhãn của màn Đội xe. Đếm trên cả đội lúc
 * đọc kho (`summary.vehicles`), không theo kỳ — thẻ nói rõ điều đó. Lối sang Đội xe chỉ hiện khi người dùng được xem đội xe.
 */
export function FleetStatusCard({ vehicles, className }: { vehicles: DashboardSummary['vehicles']; className?: string }) {
  const t = useT()
  const format = useFormat()
  const canViewFleet = useCan()('fleet.view')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={cn('flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-bg p-5', className)}>
      <h2 id={titleId} className="text-h3 font-semibold text-ink-strong">{t('manager.fleet.title')}</h2>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[26px] leading-[1.1] font-semibold text-ink-strong tabular-nums">{format.integer(vehicles.inUse)}</span>
        <span className="text-body text-ink-2">{t('manager.fleet.ratio', { total: format.integer(vehicles.total) })}</span>
      </p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {VEHICLE_STATUSES.map((status) => {
          const { icon: Icon, tint } = STATUS_GLYPH[status]
          return (
            <li key={status} className="flex items-center gap-3 text-body text-ink-2">
              <span aria-hidden className={cn('grid size-7 flex-none place-items-center rounded-md', tint)}>
                <Icon className="size-4" strokeWidth={1.5} />
              </span>
              <span className="min-w-6 font-semibold text-ink-strong tabular-nums">{format.integer(vehicles.byStatus[status])}</span>
              <span>{t(`fleet.status.${status}`)}</span>
            </li>
          )
        })}
      </ul>
      <p className="m-0 text-caption text-ink-3">{t('manager.fleet.note')}</p>
      {canViewFleet ? (
        <Button variant="secondary" asChild className="mt-auto self-start">
          <Link to="/doi-xe">
            {t('manager.fleet.open')}
            <ArrowRight strokeWidth={1.5} aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
