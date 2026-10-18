
import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { CoordinatePicker, parseCoordinates } from '@/components/map'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import {
  REQUIREMENT_PRIORITIES,
  type DeliveryRequirement,
} from '@/lib/mock-db'

import {
  createCustomer,
  fetchCustomers,
  type CreateCustomerInput,
} from './customers-api'
import {
  updateRequirementCoordinates,
  type RequirementRow,
} from './requirements-api'

import {
  initialValues,
  MAX_ADDRESS,
  MAX_NAME,
  MAX_NOTE,
  toChanges,
  toInput,
  validateRequirement,
  type RequirementFieldError,
  type RequirementFormValues,
} from './requirement-form'
import { REQUIREMENT_PRIORITY_ORDER } from './requirement-list'
import {
  useCreateRequirementMutation,
  useUpdateRequirementMutation,
} from './useRequirementsQuery'

const MAX_OF: Partial<
  Record<keyof RequirementFormValues, number>
> = {
  destinationName: MAX_NAME,
  address: MAX_ADDRESS,
  note: MAX_NOTE,
}

function errorText(
  field: keyof RequirementFormValues,
  code: RequirementFieldError,
  t: TFunction,
): string {
  if (code === 'tooLong') {
    return t('requirements.form.errors.tooLong', {
      max: MAX_OF[field] ?? MAX_NOTE,
    })
  }

  if (code === 'invalidCount') {
    return t('requirements.form.errors.invalidCount')
  }

  if (code === 'coordinatesInvalid') {
    return t('requirements.form.errors.coordinatesInvalid')
  }

  if (code === 'deadlineInvalid' || code === 'deadlinePast') {
    return t(`requirements.form.errors.${code}`)
  }

  if (field === 'customerId') {
    return t('requirements.form.errors.customerRequired')
  }

  if (field === 'expectedPackageCount') {
    return t('requirements.form.errors.invalidCount')
  }

  if (field === 'destinationName') {
    return t('requirements.form.errors.destinationRequired')
  }

  if (field === 'address') {
    return t('requirements.form.errors.addressRequired')
  }

  if (field === 'deadlineDate') {
    return t('requirements.form.errors.deadlineDateRequired')
  }

  if (field === 'deadlineTime') {
    return t('requirements.form.errors.deadlineTimeRequired')
  }

  return t('requirements.form.errors.priorityRequired')
}

function requirementSchema(
  t: TFunction,
  original?: DeliveryRequirement,
) {
  return z.object({
    customerId: z.string(),
    expectedPackageCount: z.string(),
    destinationName: z.string(),
    address: z.string(),
    deadlineDate: z.string(),
    deadlineTime: z.string(),
    priority: z.enum(REQUIREMENT_PRIORITIES),
    packageIds: z.array(z.string()),
    note: z.string(),
    coordinates: z.object({
      lat: z.string(),
      lng: z.string(),
    }),
  }).superRefine((values, ctx) => {
    const errors = validateRequirement(values, new Date(), original)

    for (const field of Object.keys(errors) as
      (keyof RequirementFormValues)[]) {
      const code = errors[field]

      if (code) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: errorText(field, code, t),
        })
      }
    }
  })
}

export function RequirementFormDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row?: RequirementRow
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-40px)]">
        {open ? (
          <RequirementForm
            row={row}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RequirementForm({
  row,
  onClose,
}: {
  row?: RequirementRow
  onClose: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const current = row?.requirement

  const customers = useQuery({
    queryKey: ['customers', 'list'],
    queryFn: fetchCustomers,
  })

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async (customer) => {
      form.setValue('customerId', String(customer.id), {
        shouldDirty: true,
        shouldValidate: true,
      })

      setAddingCustomer(false)
      setNewCustomer({
        name: '',
        contactPhone: '',
        address: '',
      })

      await queryClient.invalidateQueries({
        queryKey: ['customers'],
      })

      toast.success(t('requirements.customer.created'))
    },
  })

  const create = useCreateRequirementMutation()
  const update = useUpdateRequirementMutation(current?.id ?? '')
  const mutation = current ? update : create

  const updateCoordinates = useMutation({
    mutationFn: ({
      id,
      lat,
      lng,
    }: {
      id: string
      lat: number
      lng: number
    }) =>
      updateRequirementCoordinates(id, {
        destinationLat: lat,
        destinationLng: lng,
      }),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['requirements'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['trips'],
        }),
      ])

      toast.success(t('requirements.form.coordinatesSaved'))
      onClose()
    },

    onError: (error) => {
      toast.error(dataErrorMessage(error, t))
    },
  })


  const schema = useMemo(
    () => requirementSchema(t, current),
    [t, current],
  )

  const form = useForm<RequirementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(current),
  })

  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustomer, setNewCustomer] =
    useState<CreateCustomerInput>({
      name: '',
      contactPhone: '',
      address: '',
    })

  const locked =
    current !== undefined &&
    (current.status !== 'PENDING' ||
      current.tripId !== undefined)

  const hasReceivedPackages =
    current !== undefined &&
    (current.receivedPackageCount ?? current.packageIds.length) > 0

  const canChangeDestination =
    !locked && !hasReceivedPackages




  const hasCoordinates =
    current?.lat != null ||
    current?.lng != null

  const canAddCoordinates =
    current !== undefined &&
    !hasCoordinates &&
    (
      current.status === 'PENDING' ||
      current.tripId !== undefined
    )

  const canEditCoordinates =
    canChangeDestination || canAddCoordinates

  const { errors } = form.formState

  const customerOptions = (customers.data ?? []).map(
    (customer) => ({
      value: String(customer.id),
      label: customer.name,
    }),
  )

  // Nếu khách hàng cũ không còn trong danh sách,
  // vẫn cho hiển thị thông tin đang lưu.
  if (
    current?.customerId &&
    !customerOptions.some(
      (option) => option.value === current.customerId,
    )
  ) {
    customerOptions.unshift({
      value: current.customerId,
      label: current.customerName ?? current.customerId,
    })
  }

  function handleCreateCustomer() {
    const input = {
      name: newCustomer.name.trim(),
      contactPhone: newCustomer.contactPhone.trim(),
      address: newCustomer.address.trim(),
    }

    if (
      !input.name ||
      !input.contactPhone ||
      !input.address ||
      input.name.length > 150 ||
      input.contactPhone.length > 20 ||
      input.address.length > 255
    ) {
      toast.error(t('requirements.customer.invalid'))
      return
    }

    createCustomerMutation.mutate(input)
  }


  function handleSaveCoordinates() {
    if (!current || !canAddCoordinates) return

    const coordinates = form.getValues('coordinates')

    const parsed = parseCoordinates(
      coordinates.lat,
      coordinates.lng,
    )

    if (parsed.kind !== 'ok') {
      toast.error(
        t('requirements.form.errors.coordinatesInvalid'),
      )
      return
    }

    updateCoordinates.mutate({
      id: current.id,
      lat: parsed.lat,
      lng: parsed.lng,
    })
  }


  function handleSubmit(values: RequirementFormValues) {
    if (locked) return

    const done = (saved: DeliveryRequirement) => {
      toast.success(
        current
          ? t('requirements.form.saved', { id: saved.id })
          : t('requirements.form.created', { id: saved.id }),
      )

      onClose()
    }

    if (current) {
      update.mutate(
        toChanges(values, current),
        { onSuccess: done },
      )
    } else {
      create.mutate(
        toInput(values),
        { onSuccess: done },
      )
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogHeader
        icon={ClipboardList}
        title={
          current
            ? t('requirements.form.editTitle', { id: current.id })
            : t('requirements.form.createTitle')
        }
        description={t('requirements.form.description')}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 lg:grid-cols-2 lg:gap-6">
        {locked ? (
          <Banner tone="info" className="md:col-span-2">
            {t('requirements.form.lockedNote')}
          </Banner>
        ) : null}

        <div className="flex flex-col gap-3.5">
          {customers.isPending ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : customers.isError ? (
            <Banner tone="danger">
              {dataErrorMessage(customers.error, t)}
            </Banner>
          ) : (
            <SelectField
              control={form.control}
              name="customerId"
              label={t('requirements.form.customer')}
              options={customerOptions}
              disabled={!canChangeDestination}
            />
          )}

          {errors.customerId?.message ? (
            <p role="alert" className="text-caption text-danger">
              {errors.customerId.message}
            </p>
          ) : null}

          {!current && !addingCustomer ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddingCustomer(true)}
            >
              <Plus strokeWidth={1.5} />
              {t('requirements.customer.add')}
            </Button>
          ) : null}

          {!current && addingCustomer ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <Input
                label={t('requirements.customer.name')}
                value={newCustomer.name}
                onChange={(event) =>
                  setNewCustomer((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                maxLength={150}
              />

              <Input
                label={t('requirements.customer.phone')}
                value={newCustomer.contactPhone}
                onChange={(event) =>
                  setNewCustomer((previous) => ({
                    ...previous,
                    contactPhone: event.target.value,
                  }))
                }
                maxLength={20}
              />

              <Input
                label={t('requirements.customer.address')}
                value={newCustomer.address}
                onChange={(event) =>
                  setNewCustomer((previous) => ({
                    ...previous,
                    address: event.target.value,
                  }))
                }
                maxLength={255}
              />

              {createCustomerMutation.isError ? (
                <Banner tone="danger">
                  {dataErrorMessage(createCustomerMutation.error, t)}
                </Banner>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  loading={createCustomerMutation.isPending}
                  onClick={handleCreateCustomer}
                >
                  {t('requirements.customer.save')}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAddingCustomer(false)}
                >
                  {t('requirements.form.cancel')}
                </Button>
              </div>
            </div>
          ) : null}

          <Input
            type="number"
            min={1}
            step={1}
            label={t('requirements.form.expectedPackageCount')}
            required
            readOnly={locked}
            error={errors.expectedPackageCount?.message}
            {...form.register('expectedPackageCount')}
          />

          <Input
            label={t('requirements.form.destinationName')}
            required
            readOnly={!canChangeDestination}
            error={errors.destinationName?.message}
            {...form.register('destinationName')}
          />

          <Input
            label={t('requirements.form.address')}
            required
            readOnly={!canChangeDestination}
            error={errors.address?.message}
            {...form.register('address')}
          />

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
                  if (canChangeDestination) {
                    form.setValue('address', place.address, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                }}
              />
            )}
          />

          <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_132px]">
            <Input
              type="date"
              label={t('requirements.form.deadlineDate')}
              required
              readOnly={locked}
              error={errors.deadlineDate?.message}
              {...form.register('deadlineDate')}
            />

            <Input
              type="time"
              label={t('requirements.form.deadlineTime')}
              required
              readOnly={locked}
              error={errors.deadlineTime?.message}
              {...form.register('deadlineTime')}
            />
          </div>

          <SelectField
            control={form.control}
            name="priority"
            label={t('requirements.form.priority')}
            disabled={locked}
            options={REQUIREMENT_PRIORITY_ORDER.map(
              (value) => ({
                value,
                label: t(`requirements.priority.${value}`),
              }),
            )}
          />

          <Textarea
            label={t('requirements.form.note')}
            rows={3}
            readOnly={locked}
            error={errors.note?.message}
            {...form.register('note')}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Banner tone="info">
            {t('requirements.form.packagesAfterReceiving')}
          </Banner>

          {current ? (
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium">
                {t('requirements.form.receivingProgress')}
              </p>

              <p className="mt-2 text-small">
                {current.receivedPackageCount ??
                  current.packageIds.length}
                {' / '}
                {current.expectedPackageCount ?? '—'}
              </p>
            </div>
          ) : null}
        </div>

        {mutation.isError ? (
          <p
            role="alert"
            className="text-caption text-danger md:col-span-2"
          >
            {dataErrorMessage(mutation.error, t)}
          </p>
        ) : null}
      </div>

      <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          {t('requirements.form.cancel')}
        </Button>


        {locked && canAddCoordinates ? (
          <Button
            type="button"
            loading={updateCoordinates.isPending}
            disabled={updateCoordinates.isPending}
            onClick={handleSaveCoordinates}
          >
            {t('requirements.form.saveCoordinates')}
          </Button>
        ) : null}


        {!locked ? (
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={
              customers.isPending ||
              customers.isError ||
              addingCustomer ||
              createCustomerMutation.isPending
            }
          >
            {current
              ? t('requirements.form.save')
              : t('requirements.form.create')}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  )
}
