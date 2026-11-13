import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { CoordinatePicker } from '@/components/map'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { DeliveryRequirement } from '@/lib/mock-db'

import type { CreateCustomerInput } from './customers-api'
import { NewCustomerFields } from './NewCustomerFields'
import type { RequirementRow } from './requirements-api'
import { useCreateCustomerMutation, useCustomersQuery, useRequirementTripQuery } from './useRequirementFormQuery'
import { REQUIREMENT_SERVER_SUPPORT } from './requirements-capabilities'
import { initialValues, toChanges, toInput, type RequirementFormValues } from './requirement-form'
import { requirementSchema } from './requirement-form-schema'
import { REQUIREMENT_PRIORITY_ORDER } from './requirement-list'
import { RequirementPoolField } from './RequirementPoolField'
import { useCreateRequirementMutation, useUpdateRequirementMutation } from './useRequirementsQuery'
import { useRequirementSideSaves } from './useRequirementSideSaves'

export function RequirementFormDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row?: RequirementRow }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-40px)]">
        {open ? <RequirementForm row={row} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

const NO_CUSTOMER: CreateCustomerInput = { name: '', contactPhone: '', address: '' }

function RequirementForm({ row, onClose }: { row?: RequirementRow; onClose: () => void }) {
  const t = useT()
  const current = row?.requirement
  const [extensionReason, setExtensionReason] = useState('')

  const tripQuery = useRequirementTripQuery(current?.tripId)
  const tripStatus = current?.tripId ? tripQuery.data?.status : undefined

  // Hạn, ưu tiên và gia hạn: quyền `DELIVERY_DEMAND_MANAGE` của điều phối viên (`REQUIREMENT_SERVER_SUPPORT.manage`)
  const canEditSchedule = REQUIREMENT_SERVER_SUPPORT.manage && current !== undefined && current.tripId !== undefined && (tripStatus === 'DRAFT' || tripStatus === 'PLANNED')
  const canExtendDeadline = REQUIREMENT_SERVER_SUPPORT.manage && current !== undefined && current.tripId !== undefined && tripStatus === 'IN_TRANSIT'

  const customers = useCustomersQuery()
  const createCustomerMutation = useCreateCustomerMutation()

  const create = useCreateRequirementMutation()
  const update = useUpdateRequirementMutation(current?.id ?? '')
  const mutation = current ? update : create

  const schema = useMemo(() => requirementSchema(t, current), [t, current])
  const form = useForm<RequirementFormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(current) })

  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState<CreateCustomerInput>(NO_CUSTOMER)

  const locked = !REQUIREMENT_SERVER_SUPPORT.manage || (current !== undefined && (current.status !== 'PENDING' || current.tripId !== undefined))
  const hasReceivedPackages = current !== undefined && (current.receivedPackageCount ?? current.packageIds.length) > 0
  const canChangeDestination = !locked && !hasReceivedPackages
  const hasCoordinates = current?.lat != null || current?.lng != null
  const canAddCoordinates = current !== undefined && !hasCoordinates && (current.status === 'PENDING' || current.tripId !== undefined)
  const canEditCoordinates = canChangeDestination || canAddCoordinates

  const side = useRequirementSideSaves({ current, form, canAddCoordinates, canEditSchedule, canExtendDeadline, extensionReason, onClose })

  const { errors } = form.formState

  const customerOptions = (customers.data ?? []).map((customer) => ({ value: String(customer.id), label: customer.name }))

  // Nếu khách hàng cũ không còn trong danh sách, vẫn cho hiển thị thông tin đang lưu.
  if (current?.customerId && !customerOptions.some((option) => option.value === current.customerId)) {
    customerOptions.unshift({ value: current.customerId, label: current.customerName ?? current.customerId })
  }

  function handleCreateCustomer() {
    const input = { name: newCustomer.name.trim(), contactPhone: newCustomer.contactPhone.trim(), address: newCustomer.address.trim() }
    if (!input.name || !input.contactPhone || !input.address || input.name.length > 150 || input.contactPhone.length > 20 || input.address.length > 255) {
      toast.error(t('requirements.customer.invalid'))
      return
    }
    createCustomerMutation.mutate(input, {
      onSuccess: (customer) => {
        form.setValue('customerId', String(customer.id), { shouldDirty: true, shouldValidate: true })
        setAddingCustomer(false)
        setNewCustomer(NO_CUSTOMER)
        toast.success(t('requirements.customer.created'))
      },
    })
  }

  function handleSubmit(values: RequirementFormValues) {
    if (locked) return
    const done = (saved: DeliveryRequirement) => {
      toast.success(current ? t('requirements.form.saved', { id: saved.id }) : t('requirements.form.created', { id: saved.id }))
      onClose()
    }
    if (current) update.mutate(toChanges(values, current), { onSuccess: done })
    else create.mutate(toInput(values), { onSuccess: done })
  }

  const scheduleReadOnly = locked && !canEditSchedule && !canExtendDeadline

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DialogHeader icon={ClipboardList} title={current ? t('requirements.form.editTitle', { id: current.id }) : t('requirements.form.createTitle')}
        description={t('requirements.form.description')} />

      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 lg:grid-cols-2 lg:gap-6">
        {locked ? <Banner tone="info" className="md:col-span-2">{t('requirements.form.lockedNote')}</Banner> : null}

        <div className="flex flex-col gap-3.5">
          {customers.isPending ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : customers.isError ? (
            <Banner tone="danger">{dataErrorMessage(customers.error, t)}</Banner>
          ) : (
            <SelectField control={form.control} name="customerId" label={t('requirements.form.customer')} options={customerOptions} disabled={!canChangeDestination} />
          )}

          {errors.customerId?.message ? <p role="alert" className="text-caption text-danger">{errors.customerId.message}</p> : null}

          {!current && !addingCustomer ? (
            <Button type="button" variant="secondary" onClick={() => setAddingCustomer(true)}>
              <Plus strokeWidth={1.5} />
              {t('requirements.customer.add')}
            </Button>
          ) : null}

          {!current && addingCustomer ? (
            <NewCustomerFields value={newCustomer} onChange={setNewCustomer} onSave={handleCreateCustomer} onCancel={() => setAddingCustomer(false)}
              pending={createCustomerMutation.isPending} error={createCustomerMutation.isError ? createCustomerMutation.error : null} />
          ) : null}

          <Input type="number" min={1} step={1} label={t('requirements.form.expectedPackageCount')} required readOnly={locked}
            error={errors.expectedPackageCount?.message} {...form.register('expectedPackageCount')} />
          <Input label={t('requirements.form.destinationName')} required readOnly={!canChangeDestination} error={errors.destinationName?.message} {...form.register('destinationName')} />
          <Input label={t('requirements.form.address')} required readOnly={!canChangeDestination} error={errors.address?.message} {...form.register('address')} />

          <Controller
            control={form.control}
            name="coordinates"
            render={({ field }) => (
              <CoordinatePicker
                label={t('requirements.form.coordinates')}
                value={field.value}
                onChange={(next) => {
                  field.onChange(next)
                  field.onBlur()
                }}
                disabled={!canEditCoordinates}
                showErrors={form.formState.isSubmitted}
                onPlacePicked={(place) => {
                  if (canChangeDestination) form.setValue('address', place.address, { shouldDirty: true, shouldValidate: true })
                }}
              />
            )}
          />

          <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_132px]">
            <Input type="date" label={t('requirements.form.deadlineDate')} required readOnly={scheduleReadOnly} error={errors.deadlineDate?.message} {...form.register('deadlineDate')} />
            <Input type="time" label={t('requirements.form.deadlineTime')} required readOnly={scheduleReadOnly} error={errors.deadlineTime?.message} {...form.register('deadlineTime')} />
          </div>

          <SelectField control={form.control} name="priority" label={t('requirements.form.priority')} disabled={locked && !canEditSchedule}
            options={REQUIREMENT_PRIORITY_ORDER.map((value) => ({ value, label: t(`requirements.priority.${value}`) }))} />

          {canExtendDeadline ? (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 font-semibold">{t('requirements.form.extendDeadline')}</h3>
              <p className="mb-3 text-sm text-text-2">{t('requirements.form.extensionHint')}</p>
              <Textarea label={t('requirements.form.extensionReason')} rows={3} required maxLength={500} value={extensionReason}
                onChange={(event) => setExtensionReason(event.target.value)} />
              <p className="mt-1 text-xs text-text-2">{extensionReason.length}/500</p>
            </div>
          ) : null}

          <Textarea label={t('requirements.form.note')} rows={3} readOnly={locked} error={errors.note?.message} {...form.register('note')} />
        </div>

        <div className="flex flex-col gap-3">
          {locked ? null : (
            <>
              <RequirementPoolField control={form.control} requirementId={current?.id} />
              <p className="text-small text-ink-3">{t('requirements.form.packagesAfterReceiving')}</p>
            </>
          )}

          {current ? (
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium">{t('requirements.form.receivingProgress')}</p>
              <p className="mt-2 text-small">{current.receivedPackageCount ?? current.packageIds.length}{' / '}{current.expectedPackageCount ?? '—'}</p>
            </div>
          ) : null}
        </div>

        {mutation.isError ? <p role="alert" className="text-caption text-danger md:col-span-2">{dataErrorMessage(mutation.error, t)}</p> : null}
      </div>

      <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
        <Button type="button" variant="secondary" onClick={onClose}>{t('requirements.form.cancel')}</Button>

        {locked && canAddCoordinates ? (
          <Button type="button" loading={side.updateCoordinates.isPending} disabled={side.updateCoordinates.isPending} onClick={side.saveCoordinates}>
            {t('requirements.form.saveCoordinates')}
          </Button>
        ) : null}

        {canEditSchedule ? (
          <Button type="button" loading={side.updateSchedule.isPending} disabled={side.updateSchedule.isPending} onClick={side.saveSchedule}>
            {t('requirements.form.saveSchedule')}
          </Button>
        ) : null}

        {canExtendDeadline ? (
          <Button type="button" loading={side.extendDeadline.isPending} disabled={side.extendDeadline.isPending || extensionReason.trim().length === 0} onClick={side.extend}>
            {t('requirements.form.extendDeadline')}
          </Button>
        ) : null}

        {!locked ? (
          <Button type="submit" loading={mutation.isPending} disabled={customers.isPending || customers.isError || addingCustomer || createCustomerMutation.isPending}>
            {current ? t('requirements.form.save') : t('requirements.form.create')}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  )
}
