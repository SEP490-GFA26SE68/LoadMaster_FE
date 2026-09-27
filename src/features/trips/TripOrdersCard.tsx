import { Link2, Link2Off } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { OrderStatusBadge } from '@/features/orders/OrderStatusBadge'
import { useUnassignOrderMutation } from '@/features/orders/useOrdersQuery'
import type { Trip } from '@/lib/mock-db'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useTripOrdersQuery } from './useTripExtrasQuery'

/**
 * "Đơn hàng trên chuyến" (luồng 2, LM-104) — dưới bảng kiện của Chi tiết chuyến: đơn đã gán vào chuyến kèm điểm giao và số kiện. Chuyến còn lập
 * kế hoạch và có quyền ghi đơn thì có "Gán đơn hàng" (hộp thoại chọn đơn chờ + điểm giao) và nút bỏ gán từng đơn; bỏ gán gỡ các dòng
 * kiện của đơn khỏi chuyến. `onAssign` vắng là chỉ xem.
 */
export function TripOrdersCard({ trip, onAssign }: { trip: Trip; onAssign?: () => void }) {
  const t = useT()
  const can = useCan()
  const titleId = useId()
  const query = useTripOrdersQuery(trip.id)
  const unassign = useUnassignOrderMutation()
  const orders = query.data ?? []

  // Chỉ xem mà chuyến không có đơn nào (chuyến nhập kiện tay, hoặc đã qua lập kế hoạch): không chiếm chỗ cột phải
  if (!onAssign && query.isSuccess && orders.length === 0) return null

  function handleUnassign(orderId: string) {
    unassign.mutate(orderId, {
      onSuccess: () => toast.success(t('orders.assign.unassigned', { id: orderId })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>{t('orders.trip.title')}</CardTitle>
        {query.isSuccess ? <CardMeta>{t('orders.count', { count: orders.length })}</CardMeta> : null}
        {onAssign ? (
          <CardActions>
            <Button variant="secondary" size="sm" onClick={onAssign}>
              <Link2 strokeWidth={1.5} />
              {t('orders.trip.assign')}
            </Button>
          </CardActions>
        ) : null}
      </CardHeader>
      {query.isPending ? (
        <div className="grid place-items-center py-5"><Spinner /></div>
      ) : query.isError ? (
        <p role="alert" className="p-4.5 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : orders.length === 0 ? (
        <p className="p-4.5 text-small text-ink-3">{t('orders.trip.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {orders.map((order) => {
            const stopIndex = trip.stops.findIndex((stop) => stop.id === order.assignment?.stopId)
            const stop = trip.stops[stopIndex]
            return (
              <li key={order.id} className="flex items-start gap-2 px-4.5 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-caption font-medium text-ink-strong">{order.id}</span>
                    <span className="truncate text-small font-medium text-ink-1">{order.customerName}</span>
                  </span>
                  <span className="text-note text-ink-3">
                    {stop ? `${t('orders.stop', { number: stopIndex + 1 })} · ${stop.name} · ` : ''}
                    {t('orders.packageCount', { count: order.packageIds.length })}
                  </span>
                  {order.status === 'assigned' ? null : <span className="mt-1"><OrderStatusBadge status={order.status} /></span>}
                </div>
                {onAssign && order.status === 'assigned' ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('orders.trip.unassign', { id: order.id })}
                    title={t('orders.trip.unassign', { id: order.id })}
                    disabled={unassign.isPending}
                    onClick={() => handleUnassign(order.id)}
                  >
                    <Link2Off strokeWidth={1.5} />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {can('orders.view') ? (
        <div className="border-t border-line-soft px-4.5 py-2.5">
          <Link to="/don-hang" className="rounded-sm text-small font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t('orders.trip.list')}
          </Link>
        </div>
      ) : null}
    </Card>
  )
}
