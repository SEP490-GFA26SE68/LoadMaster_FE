import { zodResolver } from '@hookform/resolvers/zod'
import { Link2 } from 'lucide-react'
import { useId, useMemo } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldLabel, FieldMessage } from '@/components/ui/field-styles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { matchingStopId } from './order-list'
import { useAssignableTripsQuery, useAssignOrderMutation, useOrdersQuery } from './useOrdersQuery'

type AssignValues = { orderId: string; tripId: string; stopId: string }

/**
 * Gán một đơn chờ vào điểm giao của một chuyến đang lập kế hoạch (luồng 2, LM-104). Hai lối vào: từ màn Đơn hàng (đơn đã biết — chọn
 * chuyến rồi điểm giao) và từ Chi tiết chuyến (chuyến đã biết — chọn đơn rồi điểm giao). Chọn đơn hoặc chuyến thì điểm giao trùng tên
 * khách hàng được chọn sẵn. Kho từ chối (chuyến vừa sang vận hành, đơn vừa bị gán) thì câu lỗi hiện trong hộp thoại.
 */
export function OrderAssignDialog({ open, onOpenChange, orderId, tripId }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId?: string
  tripId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140">
        {open ? <AssignForm fixedOrderId={orderId} fixedTripId={tripId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ fixedOrderId, fixedTripId, onClose }: { fixedOrderId?: string; fixedTripId?: string; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const tripsQuery = useAssignableTripsQuery()
  const ordersQuery = useOrdersQuery()
  const assign = useAssignOrderMutation()
  const schema = useMemo(() => z.object({
    orderId: z.string().min(1, t('orders.assign.orderRequired')),
    tripId: z.string().min(1, t('orders.assign.tripRequired')),
    stopId: z.string().min(1, t('orders.assign.stopRequired')),
  }), [t])
  const trips = tripsQuery.data ?? []
  const pendingOrders = (ordersQuery.data ?? []).filter((row) => row.order.status === 'pending')
  const customerOf = (id: string) => pendingOrders.find((row) => row.order.id === id)?.order.customerName ?? ''
  const stopsOf = (id: string) => trips.find((trip) => trip.id === id)?.stops ?? []
  const form = useForm<AssignValues>({
    resolver: zodResolver(schema),
    defaultValues: { orderId: fixedOrderId ?? '', tripId: fixedTripId ?? '', stopId: '' },
  })
  const [orderId, tripId, stopId] = useWatch({ control: form.control, name: ['orderId', 'tripId', 'stopId'] })
  const stops = stopsOf(tripId)
  const suggested = matchingStopId(customerOf(orderId), stops)

  // Đổi đơn hoặc chuyến thì chọn lại điểm giao: điểm trùng tên khách hàng, không có thì để trống
  function suggestStop(nextOrderId: string, nextTripId: string) {
    form.setValue('stopId', matchingStopId(customerOf(nextOrderId), stopsOf(nextTripId)) ?? '', { shouldValidate: form.formState.isSubmitted })
  }

  function handleSubmit(values: AssignValues) {
    assign.mutate(values, {
      onSuccess: ({ order, trip }) => {
        const number = trip.stops.findIndex((stop) => stop.id === values.stopId) + 1
        toast.success(t('orders.assign.done', { id: order.id, trip: trip.name, number }))
        onClose()
      },
    })
  }

  const tripOptions: SelectOption[] = trips.map((trip) => ({ value: trip.id, label: t('orders.assign.tripOption', { id: trip.id, name: trip.name, date: format.date(trip.scheduledDate) }) }))
  const orderOptions: SelectOption[] = pendingOrders.map((row) => ({
    value: row.order.id,
    label: t('orders.assign.orderOption', { id: row.order.id, customer: row.order.customerName, count: format.integer(row.packages.length) }),
  }))
  const stopOptions: SelectOption[] = stops.map((stop, index) => ({ value: stop.id, label: t('orders.assign.stopOption', { number: index + 1, name: stop.name }) }))
  const loading = tripsQuery.isPending || ordersQuery.isPending
  const fixedTrip = fixedTripId ? trips.find((trip) => trip.id === fixedTripId) : undefined
  const empty = !loading && (fixedTripId ? pendingOrders.length === 0 : trips.length === 0)

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader
        icon={Link2}
        title={fixedOrderId ? t('orders.assign.titleFor', { id: fixedOrderId }) : fixedTrip ? t('orders.assign.titleTrip', { trip: fixedTrip.name }) : t('orders.assign.title')}
        description={t('orders.assign.description')}
      />
      <div className="flex flex-col gap-4 px-7 py-5">
        {loading ? (
          <div className="grid place-items-center py-6"><Spinner /></div>
        ) : empty ? (
          <p className="text-body text-ink-2">{fixedTripId ? t('orders.assign.noOrders') : t('orders.assign.noTrips')}</p>
        ) : (
          <>
            {fixedOrderId ? null : (
              <ChoiceField control={form.control} name="orderId" label={t('orders.assign.order')} options={orderOptions}
                onPicked={(value) => suggestStop(value, tripId)} />
            )}
            {fixedTripId ? null : (
              <ChoiceField control={form.control} name="tripId" label={t('orders.assign.trip')} options={tripOptions}
                onPicked={(value) => suggestStop(orderId, value)} />
            )}
            {tripId !== '' && stops.length === 0 ? (
              <p className="text-small text-warning">{t('orders.assign.noStops')}</p>
            ) : (
              <ChoiceField control={form.control} name="stopId" label={t('orders.assign.stop')} options={stopOptions}
                disabled={tripId === ''} hint={suggested !== undefined && suggested === stopId ? t('orders.assign.matchHint') : undefined} />
            )}
          </>
        )}
        {assign.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(assign.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('orders.assign.cancel')}</Button>
        <Button type="submit" loading={assign.isPending} disabled={loading || empty}>{t('orders.assign.submit')}</Button>
      </DialogFooter>
    </form>
  )
}

/** Select Radix nối RHF, báo lại giá trị vừa chọn để form chọn sẵn điểm giao. */
function ChoiceField({ control, name, label, options, onPicked, disabled = false, hint }: {
  control: Control<AssignValues>
  name: keyof AssignValues
  label: string
  options: readonly SelectOption[]
  onPicked?: (value: string) => void
  disabled?: boolean
  hint?: string
}) {
  const t = useT()
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {/*
            Bỏ qua giá trị rỗng: mục chọn không bao giờ mang '' — Radix chỉ báo '' từ ô <select> ẩn khi giá trị vừa đặt sẵn (điểm giao
            gợi ý) đến trước danh sách mục mới, và báo lại thì mất lựa chọn gợi ý.
          */}
          <Select value={field.value} disabled={disabled} onValueChange={(value) => { if (value === '') return; field.onChange(value); onPicked?.(value) }}>
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.error ? true : undefined}>
              <SelectValue placeholder={t('common.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldMessage error={fieldState.error?.message} hint={hint} />
        </div>
      )}
    />
  )
}
