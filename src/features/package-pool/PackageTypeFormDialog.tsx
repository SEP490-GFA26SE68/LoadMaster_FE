
import { zodResolver } from '@hookform/resolvers/zod'
import { Shapes } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '@/lib/api-client'

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

const schema = z.object({
  typeCode: z.string(),
  name: z.string().trim().min(1),

  lengthCm: z.number().int().positive(),
  widthCm: z.number().int().positive(),
  heightCm: z.number().int().positive(),

  weightKg: z.number().positive(),
  maxStackWeightKg: z.number().min(0),

  isFragile: z.boolean(),
  rotationAllowed: z.boolean(),
  allowRotateX: z.boolean(),
  allowRotateY: z.boolean(),
  allowRotateZ: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const DEFAULT_VALUES: FormValues = {
  typeCode: '',
  name: '',
  lengthCm: 1,
  widthCm: 1,
  heightCm: 1,
  weightKg: 1,
  maxStackWeightKg: 0,
  isFragile: false,
  rotationAllowed: true,
  allowRotateX: true,
  allowRotateY: true,
  allowRotateZ: true,
}

function toFormValues(type?: PackageType): FormValues {
  return type
    ? {
      typeCode: type.typeCode ?? '',
      name: type.name,
      lengthCm: type.lengthCm,
      widthCm: type.widthCm,
      heightCm: type.heightCm,
      weightKg: type.weightKg,
      maxStackWeightKg: type.maxStackWeightKg,
      isFragile: type.isFragile,
      rotationAllowed: type.rotationAllowed,
      allowRotateX: type.allowRotateX,
      allowRotateY: type.allowRotateY,
      allowRotateZ: type.allowRotateZ,
    }
    : DEFAULT_VALUES
}

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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(type),
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

  async function handleValid(values: FormValues) {
    setServerError(null)

    try {
      await onSubmit({
        ...values,
        typeCode: values.typeCode.trim() || null,
        name: values.name.trim(),
      })
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
              label="Mã loại kiện"
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
              'Tải trọng xếp chồng tối đa',
              'kg',
              '0.01',
            )}

            <Switch
              label="Kiện dễ vỡ"
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
                  label="Cho phép xoay trục X"
                  checked={allowRotateX}
                  onCheckedChange={(checked) =>
                    setValue('allowRotateX', checked, {
                      shouldDirty: true,
                    })
                  }
                />

                <Switch
                  label="Cho phép xoay trục Y"
                  checked={allowRotateY}
                  onCheckedChange={(checked) =>
                    setValue('allowRotateY', checked, {
                      shouldDirty: true,
                    })
                  }
                />

                <Switch
                  label="Cho phép xoay trục Z"
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
                {serverError instanceof ApiError
                  ? serverError.message
                  : dataErrorMessage(serverError, t)}
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
