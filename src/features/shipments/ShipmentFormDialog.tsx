import { zodResolver } from '@hookform/resolvers/zod'
import { PackageCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/Textarea'
import { useCompaniesQuery, usePackageTypesQuery } from '@/features/packages-source/usePackagesSourceQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { RegisteredPackage, Shipment } from '@/lib/mock-db'
import { groupByType, shipmentFormSchema, type ShipmentFormValues } from './shipment-form'
import { ShipmentPackagePicker } from './ShipmentPackagePicker'
import { useCreateShipmentMutation, useShippablePackagesQuery, useUpdateShipmentMutation } from './useShipmentsQuery'

/**
 * Tạo lô nháp hoặc sửa lô nháp (LM-104): công ty logistics nhận, kiện trong lô (chỉ kiện đã đăng ký chưa vào lô, cộng kiện đang ở
 * chính lô này khi sửa), ghi chú. `initialPackageIds`: kiện chọn sẵn từ màn Kiện hàng. Quản trị viên chọn thêm nhà sản xuất; danh
 * sách kiện lọc theo công ty đó. Kho từ chối thì câu lỗi hiện trong hộp thoại, dữ liệu đang nhập giữ nguyên.
 */
export function ShipmentFormDialog({ shipment, current = [], initialPackageIds = [], needManufacturer, onClose, onSaved }: {
  shipment?: Shipment
  /** Kiện đang ở lô (khi sửa) — vẫn chọn được dù không còn "chưa vào lô". */
  current?: readonly RegisteredPackage[]
  initialPackageIds?: readonly string[]
  needManufacturer: boolean
  onClose: () => void
  onSaved: (shipment: Shipment) => void
}) {
  const t = useT()
  const shippableQuery = useShippablePackagesQuery()
  const typesQuery = usePackageTypesQuery()
  const logisticsQuery = useCompaniesQuery('logistics')
  const manufacturersQuery = useCompaniesQuery('manufacturer')
  const create = useCreateShipmentMutation()
  const update = useUpdateShipmentMutation(shipment?.id ?? '')
  const mutation = shipment ? update : create
  const editable = useMemo(() => [...current, ...(shippableQuery.data ?? [])], [current, shippableQuery.data])

  const schema = useMemo(() => shipmentFormSchema(needManufacturer && !shipment, t), [needManufacturer, shipment, t])
  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      manufacturerId: shipment?.manufacturerId ?? '',
      logisticsCompanyId: shipment?.logisticsCompanyId ?? '',
      packageIds: shipment ? [...shipment.packageIds] : [...initialPackageIds],
      note: shipment?.note ?? '',
    },
  })
  const { control, register, setValue, formState: { errors } } = form
  const packageIds = useWatch({ control, name: 'packageIds' })
  const manufacturerId = useWatch({ control, name: 'manufacturerId' })

  // Nhà sản xuất chỉ thấy kiện của mình; quản trị viên thấy mọi kiện nên lọc theo công ty đã chọn
  const owner = shipment?.manufacturerId ?? (needManufacturer ? manufacturerId : undefined)
  const groups = useMemo(
    () => groupByType(owner === undefined ? editable : editable.filter((pkg) => pkg.ownerCompanyId === owner), typesQuery.data ?? []),
    [editable, owner, typesQuery.data],
  )
  const pending = mutation.isPending
  // Mã chọn sẵn từ đường dẫn mà không còn chọn được (đã vào lô khác, của công ty khác) không được gửi đi
  const available = useMemo(() => new Set(groups.flatMap((group) => group.packages.map((pkg) => pkg.id))), [groups])
  const picked = packageIds.filter((id) => available.has(id))

  function handleValid(values: ShipmentFormValues) {
    const note = values.note
    const ids = values.packageIds.filter((id) => available.has(id))
    if (ids.length === 0) {
      form.setError('packageIds', { message: t('sourcing.shipments.form.packagesRequired') })
      return
    }
    const onSuccess = (saved: Shipment) => onSaved(saved)
    if (shipment) {
      update.mutate({ logisticsCompanyId: values.logisticsCompanyId, packageIds: ids, note }, { onSuccess })
    } else {
      create.mutate({
        logisticsCompanyId: values.logisticsCompanyId,
        packageIds: ids,
        ...(note === '' ? {} : { note }),
        ...(needManufacturer ? { manufacturerId: values.manufacturerId } : {}),
      }, { onSuccess })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent className="w-160">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={PackageCheck}
            title={shipment ? t('sourcing.shipments.form.editTitle', { id: shipment.id }) : t('sourcing.shipments.form.createTitle')}
            description={t('sourcing.shipments.form.description')}
          />
          <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto px-7 pt-5 pb-6">
            {needManufacturer && !shipment ? (
              <SelectField
                control={control}
                name="manufacturerId"
                label={t('sourcing.shipments.form.manufacturer')}
                options={(manufacturersQuery.data ?? []).map((company) => ({ value: company.id, label: company.name }))}
              />
            ) : null}
            <SelectField
              control={control}
              name="logisticsCompanyId"
              label={t('sourcing.shipments.form.logistics')}
              options={(logisticsQuery.data ?? []).map((company) => ({ value: company.id, label: company.name }))}
            />
            <ShipmentPackagePicker
              groups={groups}
              value={picked}
              onChange={(ids) => setValue('packageIds', ids, { shouldValidate: form.formState.isSubmitted, shouldDirty: true })}
              error={errors.packageIds?.message}
            />
            <Textarea label={t('sourcing.shipments.form.note')} placeholder={t('sourcing.shipments.form.notePlaceholder')} rows={2} {...register('note')} />
            {mutation.error ? <Banner tone="danger">{dataErrorMessage(mutation.error, t)}</Banner> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{t('sourcing.shipments.form.cancel')}</Button>
            <Button type="submit" variant="primary" loading={pending}>
              {shipment ? t('sourcing.shipments.form.save') : t('sourcing.shipments.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
