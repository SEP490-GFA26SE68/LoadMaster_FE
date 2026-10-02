import { PackageMinus, PackagePlus } from 'lucide-react'
import { useId } from 'react'
import { toast } from 'sonner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { Trip } from '@/lib/mock-db'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { useRemoveTripPackageMutation, useTripPoolPackagesQuery } from './useTripPoolQuery'

/**
 * "Kiện đưa thẳng từ kho kiện" (FE-4b-05, D-68 đường 2) — dưới thẻ yêu cầu giao của Chi tiết chuyến: từng kiện kho kiện điều phối
 * viên đã đưa thẳng vào chuyến (không qua yêu cầu giao, không có hạn) với mốc điểm giao (màu định danh kèm số), mã kiện của kho và
 * của bên gửi, kích thước · khối lượng, loại hàng. Chuyến còn lập kế hoạch và người xem sửa được chuyến (`onAdd` có) thì có "Thêm
 * kiện từ kho kiện" và nút bỏ từng kiện — kiện bỏ khỏi chuyến về "Đã nhập". Chỉ xem mà không có kiện nào thì thẻ không hiện.
 */
export function TripPoolPackagesCard({ trip, onAdd }: { trip: Trip; onAdd?: () => void }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const query = useTripPoolPackagesQuery(trip.id)
  const remove = useRemoveTripPackageMutation(trip.id)
  const rows = query.data ?? []
  if (!onAdd && (!query.isSuccess || rows.length === 0)) return null

  function handleRemove(packageId: string) {
    remove.mutate(packageId, {
      onSuccess: () => toast.success(t('trips.pool.removed', { id: packageId })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>{t('trips.pool.title')}</CardTitle>
        {query.isSuccess ? <CardMeta>{t('common.packageCount', { count: rows.length })}</CardMeta> : null}
        {onAdd ? (
          <CardActions>
            <Button variant="secondary" size="sm" onClick={onAdd}>
              <PackagePlus strokeWidth={1.5} />
              {t('trips.pool.add')}
            </Button>
          </CardActions>
        ) : null}
      </CardHeader>
      {query.isPending ? (
        <div className="grid place-items-center py-5"><Spinner /></div>
      ) : query.isError ? (
        <p role="alert" className="p-4.5 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : rows.length === 0 ? (
        <p className="p-4.5 text-small text-ink-3">{t('trips.pool.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {rows.map(({ package: pkg, deliveryStop }) => {
            const stop = trip.stops[deliveryStop - 1]
            return (
              <li key={pkg.id} className="flex items-center gap-3 px-4.5 py-2.5">
                <span
                  aria-hidden
                  className="grid size-6.5 flex-none place-items-center rounded-sm font-mono text-small font-semibold"
                  style={{ background: stopColor(deliveryStop), color: stopForeground(deliveryStop) }}
                >
                  {deliveryStop}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-caption font-medium text-ink-strong">{pkg.id}</span>
                    {pkg.packageCode === pkg.id ? null : <span className="font-mono text-caption text-ink-3">{pkg.packageCode}</span>}
                    <span className="text-small text-ink-2 tabular-nums">{format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)} · {format.weight(pkg.weightKg)}</span>
                  </span>
                  <span className="truncate text-note text-ink-3">{t('requirements.trip.stop', { number: deliveryStop, name: stop?.name ?? '' })}</span>
                </div>
                <HandlingClassChip handlingClass={pkg.handlingClass} />
                {onAdd ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('trips.pool.remove', { id: pkg.id })}
                    title={t('trips.pool.remove', { id: pkg.id })}
                    disabled={remove.isPending}
                    onClick={() => handleRemove(pkg.id)}
                  >
                    <PackageMinus strokeWidth={1.5} />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {onAdd && query.isSuccess ? <p className="border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('trips.pool.note')}</p> : null}
    </Card>
  )
}
