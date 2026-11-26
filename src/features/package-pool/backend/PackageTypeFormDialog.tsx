
import { zodResolver } from '@hookform/resolvers/zod'
import { Shapes } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { dataErrorMessage, useT } from '@/lib/i18n'

import type {
  PackageType,
  PackageTypeInput,
} from './package-types-api'
import {
  CANNOT_CLEAR,
  clearsSavedValue,
  packageTypeFormSchema,
  toPackageTypeForm,
  toPackageTypeInput,
  type PackageTypeFormInput,
  type PackageTypeFormValues,
} from './package-type-form'
import { TopLoadCapacityField } from './TopLoadCapacityField'

export function PackageTypeFormDialog({
  type,
  onClose,
  onSubmit,
}: {
  type?: PackageType
  onClose: () => void
  onSubmit: (input: PackageTypeInput) => Promise<void>
}) {
  const t = useT()
  const baseId = useId()
  const [serverError, setServerError] = useState<unknown>(null)

  const form = useForm<PackageTypeFormInput, unknown, PackageTypeFormValues>({
    resolver: zodResolver(packageTypeFormSchema),
    defaultValues: toPackageTypeForm(type),
  })

  const {
    control,
    register,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const rotationAllowed = useWatch({
    control,
    name: 'rotationAllowed',
  })

  const isFragile = useWatch({
    control,
    name: 'isFragile',
  })

  const allowRotateX = useWatch({
    control,
    name: 'allowRotateX',
  })

  const allowRotateY = useWatch({
    control,
    name: 'allowRotateY',
  })

  const allowRotateZ = useWatch({
    control,
    name: 'allowRotateZ',
  })

  const numeric = (
    field: 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'maxStackWeightKg',
    label: string,
    suffix: string,
    step: string,
  ) => (
    <Input
      id={`${baseId}-${field}`}
      label={label}
      required
      numeric
      suffix={suffix}
      type="number"
      step={step}
      min={0}
      className="text-left"
      error={errors[field]?.message}
      {...register(field, { valueAsNumber: true })}
    />
  )

  async function handleValid(values: PackageTypeFormValues) {
    setServerError(null)

    if (clearsSavedValue(type?.topLoadCapacityKgM2, values.topLoadCapacityKgM2)) {
      form.setError('topLoadCapacityKgM2', { message: CANNOT_CLEAR }, { shouldFocus: true })
      return
    }

    try {
      await onSubmit(toPackageTypeInput(values))
    } catch (error) {
      setServerError(error)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose()
      }}
    >
      <DialogContent className="w-150">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={Shapes}
            title={
              type
                ? t('sourcing.packageTypes.form.editTitle', { id: type.id })
                : t('sourcing.packageTypes.form.createTitle')
            }
            description={t('sourcing.packageTypes.form.description')}
          />

          <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 pt-5 pb-6">
            <Input
              label={t('sourcing.server.packageType.typeCode')}
              placeholder="BOX-001"
              error={errors.typeCode?.message}
              {...register('typeCode')}
            />

            <Input
              label={t('sourcing.packageTypes.form.name')}
              required
              placeholder={t('sourcing.packageTypes.form.namePlaceholder')}
              error={errors.name?.message}
              {...register('name')}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {numeric('lengthCm', t('trips.form.length'), 'cm', '1')}
              {numeric('widthCm', t('trips.form.width'), 'cm', '1')}
              {numeric('heightCm', t('trips.form.height'), 'cm', '1')}
              {numeric('weightKg', t('trips.form.weight'), 'kg', '0.01')}
            </div>

            {numeric(
              'maxStackWeightKg',
              t('sourcing.server.packageType.maxStackWeight'),
              'kg',
              '0.01',
            )}

            <TopLoadCapacityField form={form} />

            <Switch
              label={t('sourcing.server.packageType.fragile')}
              checked={isFragile}
              onCheckedChange={(checked) =>
                setValue('isFragile', checked, { shouldDirty: true })
              }
            />

            <Switch
              label={t('sourcing.packageTypes.form.rotationAllowed')}
              checked={rotationAllowed}
              onCheckedChange={(checked) =>
                setValue('rotationAllowed', checked, { shouldDirty: true })
              }
            />

            {rotationAllowed ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Switch
                  label={t('sourcing.server.packageType.rotateX')}
                  checked={allowRotateX}
                  onCheckedChange={(checked) =>
                    setValue('allowRotateX', checked, {
                      shouldDirty: true,
                    })
                  }
                />

                <Switch
                  label={t('sourcing.server.packageType.rotateY')}
                  checked={allowRotateY}
                  onCheckedChange={(checked) =>
                    setValue('allowRotateY', checked, {
                      shouldDirty: true,
                    })
                  }
                />

                <Switch
                  label={t('sourcing.server.packageType.rotateZ')}
                  checked={allowRotateZ}
                  onCheckedChange={(checked) =>
                    setValue('allowRotateZ', checked, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
            ) : null}

            {serverError ? (
              <Banner tone="danger">
                {dataErrorMessage(serverError, t)}
              </Banner>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={onClose}
            >
              {t('sourcing.packageTypes.form.cancel')}
            </Button>

            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
            >
              {type
                ? t('sourcing.packageTypes.form.save')
                : t('sourcing.packageTypes.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
