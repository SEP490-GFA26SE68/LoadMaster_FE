import { ArrowDown, ArrowUp, ListOrdered, Lock, PackagePlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { StopMarker } from '@/components/map'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { isMockDbError, type MockDbErrorParams } from '@/lib/mock-db'
import type { MonitoringStop, MonitoringTrip } from './monitoring-api'
import { fixedStopCount } from './monitoring-view'
import { useReorderStopsMutation } from './useMonitoringQuery'

/**
 * Hộp "Đổi thứ tự điểm giao" (FE-BL-03, D-87): điều phối viên đề xuất thứ tự mới cho các điểm chưa giao của chuyến đang chạy. Điểm đã
 * hoàn tất và điểm xe đã tới đứng nguyên (hiện khoá, không có nút dời). Kho kiểm lại khả năng dỡ của phương án như đã xếp: không đạt
 * thì không đổi gì và hộp nêu từng kiện bị chắn kèm điểm giao của nó, bằng chữ. Đạt thì đóng hộp; kiện bị che một phần chỉ là cảnh báo.
 * Mỗi lần mở bắt đầu từ thứ tự hiện tại.
 */
export function ReorderStopsDialog({ trip, open, onOpenChange }: { trip: MonitoringTrip; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="w-[min(36rem,calc(100vw-3rem))]">
          <ReorderBody trip={trip} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function ReorderBody({ trip, onDone }: { trip: MonitoringTrip; onDone: () => void }) {
  const t = useT()
  const reorder = useReorderStopsMutation(trip.tripId)
  const fixed = fixedStopCount(trip.stops)
  const [order, setOrder] = useState<readonly MonitoringStop[]>(trip.stops)
  const changed = order.some((stop, index) => stop.id !== trip.stops[index]?.id)

  function handleMove(index: number, by: -1 | 1) {
    setOrder((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(index + by, 0, moved)
      return next
    })
    reorder.reset()
  }

  function handleApply() {
    reorder.mutate(order.map((stop) => stop.id), {
      onSuccess: ({ partial }) => {
        toast.success(t('monitoring.reorder.done', { id: trip.tripId }))
        if (partial.length > 0) toast.warning(t('monitoring.reorder.partial', { count: partial.length }))
        onDone()
      },
    })
  }

  const failure = reorder.error
  const blocked = isMockDbError(failure) && failure.code === 'STOP_ORDER_BLOCKS_CARGO' ? (failure.params as MockDbErrorParams['STOP_ORDER_BLOCKS_CARGO']) : null
  const numberOf = (stopId: string) => trip.stops.findIndex((stop) => stop.id === stopId) + 1
  const nameOf = (stopId: string) => trip.stops.find((stop) => stop.id === stopId)?.name ?? stopId

  return (
    <>
      <DialogHeader icon={ListOrdered} title={t('monitoring.reorder.title', { id: trip.tripId })} description={t('monitoring.reorder.description')} />
      <div className="flex flex-col gap-3 px-7 py-5 max-sm:px-5">
        <ol aria-label={t('monitoring.reorder.list')} className="m-0 flex list-none flex-col gap-2 p-0">
          {order.map((stop, index) => {
            const locked = index < fixed
            return (
              <li key={stop.id} className="flex min-h-12 items-center gap-3 rounded-md border border-border px-3 py-2">
                <span aria-hidden className="flex-none"><StopMarker number={index + 1} /></span>
                <span className="min-w-0 flex-1 text-body text-ink-1">
                  <span className="sr-only">{t('common.stop', { number: index + 1 })} · </span>{stop.name}
                  {stop.kind === 'PICKUP' ? (
                    <Badge shape="tag" tone="azure" className="ml-2 align-middle">
                      <PackagePlus aria-hidden className="size-3" strokeWidth={2} />
                      {t('trips.route.pickupTag')}
                    </Badge>
                  ) : null}
                </span>
                {locked ? (
                  <span className="flex flex-none items-center gap-1.5 text-small text-ink-3">
                    <Lock aria-hidden className="size-3.5" strokeWidth={1.75} />
                    {t(stop.completedAt === undefined ? 'monitoring.reorder.arrived' : 'monitoring.reorder.completed')}
                  </span>
                ) : (
                  <span className="flex flex-none gap-1">
                    <Button type="button" variant="secondary" size="icon" disabled={index <= fixed} aria-label={t('monitoring.reorder.up', { name: stop.name })} onClick={() => handleMove(index, -1)}>
                      <ArrowUp strokeWidth={1.5} />
                    </Button>
                    <Button type="button" variant="secondary" size="icon" disabled={index === order.length - 1} aria-label={t('monitoring.reorder.down', { name: stop.name })} onClick={() => handleMove(index, 1)}>
                      <ArrowDown strokeWidth={1.5} />
                    </Button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <p className="m-0 text-note text-ink-3">{t('monitoring.reorder.note')}</p>
        {blocked ? (
          <Banner tone="danger">
            <p className="m-0 font-semibold">{t('monitoring.reorder.blocked.title')}</p>
            <ul aria-label={t('monitoring.reorder.blocked.list')} className="m-0 mt-1.5 flex list-disc flex-col gap-0.5 pl-5 text-small">
              {blocked.packages.map((packageId, index) => {
                const stopId = blocked.stopIds[index] ?? ''
                return (
                  <li key={packageId}>
                    <span className="font-mono tabular-nums">{packageId}</span> — {t('monitoring.reorder.blocked.item', { number: numberOf(stopId), name: nameOf(stopId) })}
                  </li>
                )
              })}
            </ul>
            <p className="m-0 mt-1.5 text-small">{t('monitoring.reorder.blocked.unchanged')}</p>
          </Banner>
        ) : failure ? (
          <Banner tone="warning">{dataErrorMessage(failure, t)}</Banner>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">{t('monitoring.reorder.close')}</Button>
        </DialogClose>
        <Button type="button" disabled={!changed} loading={reorder.isPending} onClick={handleApply}>
          {t('monitoring.reorder.apply')}
        </Button>
      </DialogFooter>
    </>
  )
}
