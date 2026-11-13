import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useRequirementsQuery } from '@/features/requirements/backend/useRequirementsQuery'

import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { HANDLING_CLASSES } from '@/domain/models'
import { dataErrorMessage, useT } from '@/lib/i18n'

import {
  createPackageSchema,
  NO_PACKAGE_TYPE,
  packageFormDefaults,
  packageInputOf,
  type PackageFormValues,
  type PackageNumberField,
} from './package-form-schema'
import type { CargoPackage } from './packages-api'
import { PackageNumberInput, PackageRuleSections } from './PackageRuleSections'
import { useCreateCargoPackagesMutation, useUpdateCargoPackageMutation, usePackageTypesQuery } from './usePackagePoolQuery'

type PackageFormDialogProps = {
  onClose: () => void
  onDone: (created: CargoPackage[]) => void

  // Có giá trị khi chỉnh sửa một kiện.
  editPackage?: CargoPackage
  onUpdated?: (updated: CargoPackage) => void
}

export function PackageFormDialog({ onClose, onDone, editPackage, onUpdated }: PackageFormDialogProps) {
  const t = useT()
  const schema = useMemo(() => createPackageSchema(t), [t])

  const typesQuery = usePackageTypesQuery(0, 100)
  const create = useCreateCargoPackagesMutation()
  const update = useUpdateCargoPackageMutation()

  const isEditing = editPackage !== undefined
  const requirementsQuery = useRequirementsQuery({ enabled: !isEditing })

  const availableRequirements = (requirementsQuery.data ?? []).filter((row) => row.requirement.status === 'PENDING' && !row.requirement.tripId)

  const requirementOptions = [
    { value: '', label: t('sourcing.server.form.chooseRequirement') },
    ...availableRequirements.map((row) => ({
      value: row.requirement.id,
      label: [
        `#${row.requirement.id}`,
        row.requirement.customerName ?? t('sourcing.server.noCustomerName'),
        row.requirement.destinationName,
        t('sourcing.server.packageCount', { received: row.requirement.receivedPackageCount ?? 0, expected: row.requirement.expectedPackageCount ?? '—' }),
      ].join(' · '),
    })),
  ]
  const isSaving = create.isPending || update.isPending

  const form = useForm<PackageFormValues>({ resolver: zodResolver(schema), defaultValues: packageFormDefaults(editPackage) })

  const { control, register, setValue, handleSubmit, formState: { errors } } = form

  const selectedTypeId = useWatch({ control, name: 'packageTypeId' })
  const selectedRequirementId = useWatch({ control, name: 'deliveryRequirementId' })
  useEffect(() => {
    if (isEditing || !selectedRequirementId) return
    const selected = availableRequirements.find((row) => row.requirement.id === selectedRequirementId)
    if (!selected) return
    setValue('destination', selected.requirement.address, { shouldValidate: true, shouldDirty: true })
  }, [isEditing, selectedRequirementId, requirementsQuery.data, setValue])
  const types = useMemo(() => typesQuery.data?.data ?? [], [typesQuery.data])

  const selectedType = useMemo(() => types.find((type) => type.id === selectedTypeId), [types, selectedTypeId])

  const hasPackageType = selectedTypeId !== NO_PACKAGE_TYPE

  useEffect(() => {
    if (!selectedType) return
    setValue('lengthCm', selectedType.lengthCm, { shouldValidate: true })
    setValue('widthCm', selectedType.widthCm, { shouldValidate: true })
    setValue('heightCm', selectedType.heightCm, { shouldValidate: true })
  }, [selectedType, setValue])

  const typeOptions = [
    { value: NO_PACKAGE_TYPE, label: t('sourcing.form.packageTypeNone') },
    ...types.map((type) => ({ value: type.id, label: `${type.name} · ${type.typeCode ?? type.id}` })),
  ]

  const numeric = (field: PackageNumberField, label: string, suffix = '', step = '1', disabled = false) => (
    <PackageNumberInput form={form} field={field} label={label} suffix={suffix} step={step} disabled={disabled} />
  )

  async function handleValid(values: PackageFormValues) {
    if (!isEditing && !values.deliveryRequirementId) {
      form.setError('deliveryRequirementId', { type: 'manual', message: t('sourcing.server.form.requirementRequired') })
      return
    }
    if (hasPackageType && !selectedType) {
      form.setError('packageTypeId', { type: 'manual', message: t('sourcing.server.form.packageTypeMissing') })
      return
    }

    const input = packageInputOf(values, { isEditing, hasPackageType, orderId: editPackage?.orderId })

    try {
      if (editPackage) {
        const updated = await update.mutateAsync({ id: editPackage.id, input })
        onUpdated?.(updated)
        return
      }
      const created = await create.mutateAsync(input)
      onDone(created)
    } catch {
      // Lỗi create/update được hiển thị trong form.
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose()
      }}
    >
      <DialogContent className="w-160">
        <form noValidate onSubmit={handleSubmit(handleValid)}>
          <DialogHeader
            icon={PackagePlus}
            title={isEditing ? t('sourcing.form.editTitle') : t('sourcing.form.title')}
            description={isEditing ? t('sourcing.form.editDescription') : t('sourcing.form.description')}
          />

          <div className="flex max-h-[64vh] flex-col gap-5 overflow-y-auto px-7 pt-5 pb-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">{t('sourcing.form.basicInformation')}</h3>

              {!isEditing && (
                <div className="flex flex-col gap-2">
                  <SelectField
                    control={control}
                    name="deliveryRequirementId"
                    label={t('sourcing.server.form.requirement')}
                    options={requirementOptions}
                    disabled={requirementsQuery.isPending}
                  />
                  {requirementsQuery.error && <Banner tone="danger">{dataErrorMessage(requirementsQuery.error, t)}</Banner>}
                </div>
              )}

              <Input label={t('sourcing.form.packageCode')} required className="font-mono" error={errors.packageCode?.message} {...register('packageCode')} />
              <Input label={t('sourcing.form.packageName')} error={errors.packageName?.message} {...register('packageName')} />
              {!isEditing && numeric('quantity', t('sourcing.form.quantity'))}
              <SelectField control={control} name="packageTypeId" label={t('sourcing.form.packageType')} options={typeOptions} />
              {errors.packageTypeId?.message && (
                <p role="alert" className="text-sm text-red-500">{errors.packageTypeId.message}</p>
              )}
              {typesQuery.error && <Banner tone="danger">{dataErrorMessage(typesQuery.error, t)}</Banner>}
              <SelectField
                control={control}
                name="handlingClass"
                label={t('sourcing.form.handlingClass')}
                options={HANDLING_CLASSES.map((value) => ({ value, label: t(`common.handlingClasses.${value}`) }))}
              />
              <Input label={t('sourcing.form.destination')} required error={errors.destination?.message} {...register('destination')} />
              <Input label={t('sourcing.form.note')} {...register('note')} />
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">{t('sourcing.form.dimensions')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {numeric('lengthCm', t('trips.form.length'), 'cm', '0.01', hasPackageType)}
                {numeric('widthCm', t('trips.form.width'), 'cm', '0.01', hasPackageType)}
                {numeric('heightCm', t('trips.form.height'), 'cm', '0.01', hasPackageType)}
                {numeric('weightKg', t('trips.form.weight'), 'kg', '0.01')}
              </div>
              {selectedType && (
                <p className="text-sm text-ink-3">
                  {t('sourcing.form.fixedDimensions')}:{' '}
                  {selectedType.lengthCm} ×{' '}
                  {selectedType.widthCm} ×{' '}
                  {selectedType.heightCm} cm
                </p>
              )}
            </section>

            <PackageRuleSections form={form} />

            {(create.error ?? update.error) && <Banner tone="danger">{dataErrorMessage(create.error ?? update.error, t)}</Banner>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>
              {t('sourcing.form.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSaving}
              disabled={typesQuery.isPending || Boolean(typesQuery.error) || (!isEditing && (requirementsQuery.isPending || Boolean(requirementsQuery.error)))}
            >
              {isEditing ? t('sourcing.form.saveChanges') : t('sourcing.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
