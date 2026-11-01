import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { useQuery } from '@tanstack/react-query'
import { listDeliveryRequirements } from '@/features/requirements/requirements-api'

import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { HANDLING_CLASSES } from '@/domain/models'
import { ApiError } from '@/lib/api-client'
import { dataErrorMessage, useT } from '@/lib/i18n'

import {
  type CargoPackage,
  type CargoPackageInput,
} from './packages-api'
import {
  useCreateCargoPackagesMutation,
  useUpdateCargoPackageMutation,
  usePackageTypesQuery,
} from './usePackagePoolQuery'

const NO_PACKAGE_TYPE = '__none__'
const ORIENTATION_OPTIONS = [
  { value: 0, dimensions: 'L × W × H' },
  { value: 1, dimensions: 'L × H × W' },
  { value: 2, dimensions: 'W × L × H' },
  { value: 3, dimensions: 'W × H × L' },
  { value: 4, dimensions: 'H × L × W' },
  { value: 5, dimensions: 'H × W × L' },
] as const

const optionalNumber = z.number().finite().optional()

function hasAtMostTwoDecimals(value: number | undefined): boolean {
  if (value === undefined) return true
  const [, fraction = ''] = String(value).split('.')
  return fraction.length <= 2
}

const DECIMAL_SCALE_ERROR_MSG = 'Giá trị số chỉ được phép tối đa 2 chữ số sau dấu phẩy'

const createSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    packageCode: z
      .string()
      .trim()
      .min(1, t('sourcing.form.packageCodeRequired'))
      .max(100, t('sourcing.form.packageCodeMaxLength')),
    packageName: z.string().max(150),
    quantity: z.number().int().min(1).max(1000),
    packageTypeId: z.string(),
    deliveryRequirementId: z.string(),

    lengthCm: z
      .number()
      .positive()
      .optional()
      .refine(hasAtMostTwoDecimals, DECIMAL_SCALE_ERROR_MSG),
    widthCm: z
      .number()
      .positive()
      .optional()
      .refine(hasAtMostTwoDecimals, DECIMAL_SCALE_ERROR_MSG),
    heightCm: z
      .number()
      .positive()
      .optional()
      .refine(hasAtMostTwoDecimals, DECIMAL_SCALE_ERROR_MSG),
    weightKg: z
      .number()
      .positive()
      .refine(hasAtMostTwoDecimals, DECIMAL_SCALE_ERROR_MSG),

    handlingClass: z.enum(HANDLING_CLASSES),
    destination: z
      .string()
      .trim()
      .min(1, t('sourcing.form.destinationRequired'))
      .max(255, t('sourcing.form.destinationMaxLength')),
    note: z.string(),

    orientation: z.string().max(100),
    uprightOnly: z.boolean(),
    fragilityLevel: optionalNumber.refine(
      (value) =>
        value === undefined ||
        (Number.isInteger(value) && value >= 0),
    ),
    stackable: z.boolean(),

    maxTopLoadKg: optionalNumber.refine(
      (value) => value === undefined || value >= 0,
    ),
    maxLayers: optionalNumber.refine(
      (value) =>
        value === undefined ||
        (Number.isInteger(value) && value >= 1),
    ),
    minSupportRatio: optionalNumber.refine(
      (value) =>
        value === undefined ||
        (value >= 0 && value <= 1),
    ),
    priority: optionalNumber.refine(
      (value) =>
        value === undefined || Number.isInteger(value),
    ),
    mustLoad: z.boolean(),
    packingGroup: z.string().max(100),
  })
    .superRefine((values, ctx) => {
      if (values.packageTypeId !== NO_PACKAGE_TYPE) return

      for (const field of [
        'lengthCm',
        'widthCm',
        'heightCm',
      ] as const) {
        if (values[field] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: t('sourcing.form.dimensionsRequired'),
          })
        }
      }

    })

type FormValues = z.infer<ReturnType<typeof createSchema>>

const DEFAULT_VALUES: FormValues = {
  deliveryRequirementId: '',
  packageCode: '',
  packageName: '',
  quantity: 1,
  packageTypeId: NO_PACKAGE_TYPE,
  lengthCm: undefined,
  widthCm: undefined,
  heightCm: undefined,
  weightKg: 1,
  handlingClass: 'STANDARD',
  destination: '',
  note: '',
  orientation: '',
  uprightOnly: false,
  fragilityLevel: undefined,
  stackable: false,
  maxTopLoadKg: undefined,
  maxLayers: undefined,
  minSupportRatio: undefined,
  priority: undefined,
  mustLoad: false,
  packingGroup: '',
}

type NumberField =
  | 'quantity'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'weightKg'
  | 'fragilityLevel'
  | 'maxTopLoadKg'
  | 'maxLayers'
  | 'minSupportRatio'
  | 'priority'

type PackageFormDialogProps = {
  onClose: () => void
  onDone: (created: CargoPackage[]) => void

  // Có giá trị khi chỉnh sửa một kiện.
  editPackage?: CargoPackage
  onUpdated?: (updated: CargoPackage) => void
}

export function PackageFormDialog({
  onClose,
  onDone,
  editPackage,
  onUpdated,
}: PackageFormDialogProps) {
  const t = useT()
  const [orientationOpen, setOrientationOpen] = useState(false)
  const schema = useMemo(() => createSchema(t), [t])
  const typesQuery = usePackageTypesQuery(0, 100)
  const create = useCreateCargoPackagesMutation()
  const update = useUpdateCargoPackageMutation()

  const isEditing = editPackage !== undefined
  const requirementsQuery = useQuery({
    queryKey: ['requirements', 'warehouse', 'manual-create'],
    queryFn: () => listDeliveryRequirements(),
    enabled: !isEditing,
  })

  const availableRequirements = (requirementsQuery.data ?? []).filter(
    (row) =>
      row.requirement.status === 'PENDING' &&
      !row.requirement.tripId,
  )

  const requirementOptions = [
    {
      value: '',
      label: 'Chọn yêu cầu giao',
    },
    ...availableRequirements.map((row) => ({
      value: row.requirement.id,
      label: [
        `#${row.requirement.id}`,
        row.requirement.customerName ?? 'Chưa có tên khách hàng',
        row.requirement.destinationName,
        `${row.requirement.receivedPackageCount ?? 0}/${row.requirement.expectedPackageCount ?? '—'} kiện`,
      ].join(' · '),
    })),
  ]
  const isSaving = create.isPending || update.isPending


  const form = useForm<FormValues>({
    resolver: zodResolver(schema),

    defaultValues: editPackage
      ? {
        packageCode: editPackage.packageCode ?? '',
        packageName: editPackage.packageName ?? '',
        quantity: 1,

        packageTypeId:
          editPackage.packageTypeId ?? NO_PACKAGE_TYPE,

        lengthCm: editPackage.lengthCm,
        widthCm: editPackage.widthCm,
        heightCm: editPackage.heightCm,
        weightKg: editPackage.weightKg,

        handlingClass: editPackage.handlingClass,
        destination: editPackage.destination ?? '',
        note: editPackage.note ?? '',

        orientation: editPackage.orientation ?? '',
        uprightOnly: editPackage.uprightOnly ?? false,
        fragilityLevel:
          editPackage.fragilityLevel ?? undefined,
        stackable: editPackage.stackable ?? false,

        maxTopLoadKg:
          editPackage.maxTopLoadKg ?? undefined,
        maxLayers: editPackage.maxLayers ?? undefined,
        minSupportRatio:
          editPackage.minSupportRatio ?? undefined,

        priority: editPackage.priority ?? undefined,
        mustLoad: editPackage.mustLoad ?? false,
        packingGroup: editPackage.packingGroup ?? '',
      }
      : DEFAULT_VALUES,
  })


  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = form

  // Phải khai báo sau khi đã lấy control từ useForm().
  const selectedOrientations = useWatch({
    control,
    name: 'orientation',
  })

  const uprightOnly = useWatch({
    control,
    name: 'uprightOnly',
  })

  const orientationValues = selectedOrientations
    ? selectedOrientations
      .split(',')
      .map(Number)
      .filter((value) =>
        Number.isInteger(value) && value >= 0 && value <= 5,
      )
    : []

  function updateOrientations(values: number[]) {
    const sorted = [...new Set(values)].sort((a, b) => a - b)

    setValue('orientation', sorted.join(','), {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  function toggleOrientation(value: number) {
    if (uprightOnly) return

    if (orientationValues.includes(value)) {
      updateOrientations(
        orientationValues.filter((item) => item !== value),
      )
    } else {
      updateOrientations([...orientationValues, value])
    }
  }


  const selectedTypeId = useWatch({
    control,
    name: 'packageTypeId',
  })

  const selectedRequirementId = useWatch({
    control,
    name: 'deliveryRequirementId',
  })
  useEffect(() => {
    if (isEditing || !selectedRequirementId) return

    const selected = availableRequirements.find(
      (row) => row.requirement.id === selectedRequirementId,
    )

    if (!selected) return

    setValue('destination', selected.requirement.address, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }, [isEditing, selectedRequirementId, requirementsQuery.data, setValue])
  const types = typesQuery.data?.data ?? []

  const selectedType = useMemo(
    () => types.find((type) => type.id === selectedTypeId),
    [types, selectedTypeId],
  )

  const hasPackageType = selectedTypeId !== NO_PACKAGE_TYPE

  useEffect(() => {
    if (!selectedType) return

    setValue('lengthCm', selectedType.lengthCm, {
      shouldValidate: true,
    })
    setValue('widthCm', selectedType.widthCm, {
      shouldValidate: true,
    })
    setValue('heightCm', selectedType.heightCm, {
      shouldValidate: true,
    })
  }, [selectedType, setValue])

  const typeOptions = [
    {
      value: NO_PACKAGE_TYPE,
      label: t('sourcing.form.packageTypeNone'),
    },
    ...types.map((type) => ({
      value: type.id,
      label: `${type.name} · ${type.typeCode ?? type.id}`,
    })),
  ]

  const numeric = (
    field: NumberField,
    label: string,
    suffix = '',
    step = '1',
    disabled = false,
  ) => (
    <Input
      label={label}
      numeric
      suffix={suffix}
      type="number"
      step={step}
      min={0}
      disabled={disabled}
      className="text-left"
      error={errors[field]?.message}
      {...register(field, {
        setValueAs: (value: string) =>
          value === '' || value == null
            ? undefined
            : Number(value),
      })}
    />
  )

  async function handleValid(values: FormValues) {
    if (!isEditing && !values.deliveryRequirementId) {
      form.setError('deliveryRequirementId', {
        type: 'manual',
        message: 'Vui lòng chọn yêu cầu giao',
      })
      return
    }
    if (hasPackageType && !selectedType) {
      form.setError('packageTypeId', {
        type: 'manual',
        message: 'Loại kiện đã chọn không tồn tại',
      })
      return
    }

    const input: CargoPackageInput = {
      packageCode: values.packageCode.trim(),
      packageName: values.packageName.trim(),
      quantity: isEditing ? 1 : values.quantity,

      packageTypeId:
        values.packageTypeId === NO_PACKAGE_TYPE
          ? undefined
          : values.packageTypeId,

      ...(!isEditing
        ? { deliveryRequirementId: values.deliveryRequirementId }
        : {}),

      lengthCm: hasPackageType
        ? undefined
        : values.lengthCm,
      widthCm: hasPackageType
        ? undefined
        : values.widthCm,
      heightCm: hasPackageType
        ? undefined
        : values.heightCm,

      weightKg: values.weightKg,
      handlingClass: values.handlingClass,
      destination: values.destination.trim(),
      note: values.note,

      orientation: values.orientation.trim() || undefined,
      uprightOnly: values.uprightOnly,
      fragilityLevel: values.fragilityLevel,
      stackable: values.stackable,
      maxTopLoadKg: values.maxTopLoadKg,
      maxLayers: values.maxLayers,
      minSupportRatio: values.minSupportRatio,
      priority: values.priority,
      mustLoad: values.mustLoad,
      packingGroup: values.packingGroup.trim(),
    }


    try {
      if (editPackage) {
        const updated = await update.mutateAsync({
          id: editPackage.id,
          input,
        })

        onUpdated?.(updated)
        return
      }

      const created = await create.mutateAsync(input)
      onDone(created)
    } catch {
      // Lỗi create/update được hiển thị trong form.
    }

  }

  useEffect(() => {
    if (uprightOnly) {
      setValue('orientation', '0,2', {
        shouldValidate: true,
        shouldDirty: true,
      })
    }
  }, [uprightOnly, setValue])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose()
      }}
    >
      <DialogContent className="w-160">
        <form
          noValidate
          onSubmit={handleSubmit(handleValid)}
        >
          <DialogHeader
            icon={PackagePlus}
            title={
              isEditing
                ? t('sourcing.form.editTitle')
                : t('sourcing.form.title')
            }
            description={
              isEditing
                ? t('sourcing.form.editDescription')
                : t('sourcing.form.description')
            }
          />

          <div className="flex max-h-[64vh] flex-col gap-5 overflow-y-auto px-7 pt-5 pb-6">

            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">
                {t('sourcing.form.basicInformation')}
              </h3>

              {!isEditing && (
                <div className="flex flex-col gap-2">
                  <SelectField
                    control={control}
                    name="deliveryRequirementId"
                    label="Yêu cầu giao"
                    options={requirementOptions}
                    disabled={requirementsQuery.isPending}
                  />

                  {requirementsQuery.error && (
                    <Banner tone="danger">
                      {dataErrorMessage(requirementsQuery.error, t)}
                    </Banner>
                  )}
                </div>
              )}

              <Input
                label={t('sourcing.form.packageCode')}
                required
                className="font-mono"
                error={errors.packageCode?.message}
                {...register('packageCode')}
              />

              <Input
                label={t('sourcing.form.packageName')}
                error={errors.packageName?.message}
                {...register('packageName')}
              />

              {!isEditing && numeric(
                'quantity',
                t('sourcing.form.quantity'),
              )}

              <SelectField
                control={control}
                name="packageTypeId"
                label={t('sourcing.form.packageType')}
                options={typeOptions}
              />

              {errors.packageTypeId?.message && (
                <p role="alert" className="text-sm text-red-500">
                  {errors.packageTypeId.message}
                </p>
              )}

              {typesQuery.error && (
                <Banner tone="danger">
                  {dataErrorMessage(typesQuery.error, t)}
                </Banner>
              )}

              <SelectField
                control={control}
                name="handlingClass"
                label={t('sourcing.form.handlingClass')}
                options={HANDLING_CLASSES.map((value) => ({
                  value,
                  label: t(`common.handlingClasses.${value}`),
                }))}
              />

              <Input
                label={t('sourcing.form.destination')}
                required
                error={errors.destination?.message}
                {...register('destination')}
              />

              <Input
                label={t('sourcing.form.note')}
                {...register('note')}
              />
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">
                {t('sourcing.form.dimensions')}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {numeric(
                  'lengthCm',
                  t('trips.form.length'),
                  'cm',
                  '0.01',
                  hasPackageType,
                )}
                {numeric(
                  'widthCm',
                  t('trips.form.width'),
                  'cm',
                  '0.01',
                  hasPackageType,
                )}
                {numeric(
                  'heightCm',
                  t('trips.form.height'),
                  'cm',
                  '0.01',
                  hasPackageType,
                )}
                {numeric(
                  'weightKg',
                  t('trips.form.weight'),
                  'kg',
                  '0.01',
                )}
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

            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">
                {t('sourcing.form.packingRules')}
              </h3>


              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  {t('sourcing.form.orientation')}
                </label>

                <div className="relative">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setOrientationOpen((open) => !open)}
                    className="w-full justify-between"
                  >
                    {orientationValues.length > 0
                      ? orientationValues
                        .map((value) => `${value}`)
                        .join(', ')
                      : t('sourcing.form.orientationSelect')}
                    <span aria-hidden="true">▾</span>
                  </Button>

                  {orientationOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-bg p-3 shadow-lg">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {t('sourcing.form.orientation')}
                        </span>

                        <button
                          type="button"
                          className="text-sm text-primary hover:underline"
                          onClick={() => {
                            updateOrientations(
                              uprightOnly ? [0, 2] : [0, 1, 2, 3, 4, 5],
                            )
                          }}
                        >
                          {t('sourcing.form.orientationSelectAll')}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {ORIENTATION_OPTIONS.map((option) => {
                          const disabled =
                            uprightOnly &&
                            option.value !== 0 &&
                            option.value !== 2

                          return (
                            <label
                              key={option.value}
                              className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-40' : 'cursor-pointer'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={orientationValues.includes(option.value)}
                                disabled={uprightOnly}
                                onChange={() => toggleOrientation(option.value)}
                              />

                              <span>
                                <span className="font-medium">
                                  {t('sourcing.form.orientationDirection', {
                                    number: option.value,
                                  })}
                                </span>
                                <span className="block text-ink-3">
                                  {option.dimensions}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {errors.orientation?.message && (
                  <p role="alert" className="text-sm text-red-500">
                    {errors.orientation.message}
                  </p>
                )}
              </div>


              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('uprightOnly')}
                />
                {t('sourcing.form.uprightOnly')}
              </label>

              {numeric(
                'fragilityLevel',
                t('sourcing.form.fragilityLevel'),
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('stackable')}
                />
                {t('sourcing.form.stackable')}
              </label>

              <div className="grid grid-cols-2 gap-3">
                {numeric(
                  'maxTopLoadKg',
                  t('sourcing.form.maxTopLoad'),
                  'kg',
                  '0.01',
                )}
                {numeric(
                  'maxLayers',
                  t('sourcing.form.maxLayers'),
                )}
                {numeric(
                  'minSupportRatio',
                  t('sourcing.form.minSupportRatio'),
                  '',
                  '0.01',
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">
                {t('sourcing.form.optimization')}
              </h3>

              {numeric(
                'priority',
                t('sourcing.form.priority'),
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('mustLoad')}
                />
                {t('sourcing.form.mustLoad')}
              </label>

              <Input
                label={t('sourcing.form.packingGroup')}
                error={errors.packingGroup?.message}
                {...register('packingGroup')}
              />
            </section>

            {(create.error ?? update.error) && (
              <Banner tone="danger">
                {(create.error ?? update.error) instanceof ApiError
                  ? (create.error ?? update.error)?.message
                  : dataErrorMessage(create.error ?? update.error, t)}
              </Banner>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={onClose}
            >
              {t('sourcing.form.cancel')}
            </Button>

            <Button
              type="submit"
              variant="primary"
              loading={isSaving}
              disabled={
                typesQuery.isPending ||
                Boolean(typesQuery.error) ||
                (!isEditing &&
                  (requirementsQuery.isPending ||
                    Boolean(requirementsQuery.error)))
              }
            >
              {isEditing
                ? t('sourcing.form.saveChanges')
                : t('sourcing.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
