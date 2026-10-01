import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import type { OrderRow } from './orders-api'
import { OrderPackagePicker } from './OrderPackagePicker'
import { useCreateOrderMutation, useOrderablePackagesQuery, useUpdateOrderMutation } from './useOrdersQuery'

const MAX_NAME = 120
const MAX_ADDRESS = 200
const MAX_SHORT = 60
const MAX_NOTE = 300

function orderSchema(t: TFunction) {
  const optional = (max: number) => z.string().trim().max(max, t('orders.form.tooLong', { max }))
  return z.object({
    customerName: z.string().trim().min(1, t('orders.form.customerRequired')).max(MAX_NAME, t('orders.form.tooLong', { max: MAX_NAME })),
    deliveryAddress: z.string().trim().min(1, t('orders.form.addressRequired')).max(MAX_ADDRESS, t('orders.form.tooLong', { max: MAX_ADDRESS })),
    contactName: optional(MAX_SHORT),
    phone: optional(MAX_SHORT),
    note: optional(MAX_NOTE),
    packageIds: z.array(z.string()).min(1, t('orders.form.packagesRequired')),
  })
}

type OrderValues = z.infer<ReturnType<typeof orderSchema>>

/**
 * Tạo / sửa đơn hàng (LM-104). Trái: khách hàng, địa chỉ giao, người nhận, điện thoại, ghi chú; phải: chọn kiện đã nhận ở kho
 * (sửa đơn thì kiện của chính đơn vẫn nằm trong danh sách). Kho từ chối (kiện vừa bị đơn khác lấy, đơn đã gán) thì câu lỗi hiện
 * trong hộp thoại, không đóng. Thân form gắn theo lúc mở nên mỗi lần mở là giá trị của đơn đang sửa.
 */
export function OrderFormDialog({ open, onOpenChange, order }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Vắng là tạo đơn mới. */
  order?: OrderRow
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-200">
        {open ? <OrderForm order={order} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function OrderForm({ order, onClose }: { order?: OrderRow; onClose: () => void }) {
  const t = useT()
  const orderable = useOrderablePackagesQuery()
  const create = useCreateOrderMutation()
  const update = useUpdateOrderMutation(order?.order.id ?? '')
  const mutation = order ? update : create
  const schema = useMemo(() => orderSchema(t), [t])
  const form = useForm<OrderValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: order?.order.customerName ?? '',
      deliveryAddress: order?.order.deliveryAddress ?? '',
      contactName: order?.order.contactName ?? '',
      phone: order?.order.phone ?? '',
      note: order?.order.note ?? '',
      packageIds: order?.order.packageIds ?? [],
    },
  })
  const packages = useMemo(
    () => [...(order?.packages ?? []), ...(orderable.data ?? []).filter((item) => !order?.order.packageIds.includes(item.package.id))],
    [order, orderable.data],
  )
  const { errors } = form.formState

  function handleSubmit(values: OrderValues) {
    mutation.mutate(values, {
      onSuccess: (saved) => {
        toast.success(order ? t('orders.form.saved', { id: saved.id }) : t('orders.form.created', { id: saved.id }))
        onClose()
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader
        icon={ClipboardList}
        title={order ? t('orders.form.editTitle', { id: order.order.id }) : t('orders.form.createTitle')}
        description={t('orders.form.description')}
      />
      <div className="grid gap-5 px-7 py-5 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <Input label={t('orders.form.customer')} required error={errors.customerName?.message} {...form.register('customerName')} />
          <Input label={t('orders.form.address')} required error={errors.deliveryAddress?.message} {...form.register('deliveryAddress')} />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label={t('orders.form.contact')} error={errors.contactName?.message} {...form.register('contactName')} />
            <Input label={t('orders.form.phone')} type="tel" error={errors.phone?.message} {...form.register('phone')} />
          </div>
          <Textarea label={t('orders.form.note')} rows={3} error={errors.note?.message} {...form.register('note')} />
        </div>
        {orderable.isPending ? (
          <div className="grid place-items-center py-8"><Spinner /></div>
        ) : (
          <Controller
            control={form.control}
            name="packageIds"
            render={({ field, fieldState }) => (
              <OrderPackagePicker packages={packages} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
        )}
        {mutation.isError ? <p role="alert" className="text-caption text-danger md:col-span-2">{dataErrorMessage(mutation.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('orders.form.cancel')}</Button>
        <Button type="submit" loading={mutation.isPending}>{order ? t('orders.form.save') : t('orders.form.create')}</Button>
      </DialogFooter>
    </form>
  )
}
