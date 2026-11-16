import { useEffect } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import { orientationValuesOf, type PackageFormValues, type PackageNumberField } from './package-form-schema'
import { PackageOrientationPicker } from './PackageOrientationPicker'

type PackageForm = UseFormReturn<PackageFormValues>

/** Ô số của form kiện (máy chủ): để trống là không có giá trị, không phải 0. */
export function PackageNumberInput({ form, field, label, suffix = '', step = '1', disabled = false }: {
  form: PackageForm
  field: PackageNumberField
  label: string
  suffix?: string
  step?: string
  disabled?: boolean
}) {
  return (
    <Input
      label={label}
      numeric
      suffix={suffix}
      type="number"
      step={step}
      min={0}
      disabled={disabled}
      className="text-left"
      error={form.formState.errors[field]?.message}
      {...form.register(field, { setValueAs: (value: string) => (value === '' || value == null ? undefined : Number(value)) })}
    />
  )
}

/**
 * Hai phần cuối của form kiện (máy chủ): luật xếp (hướng đặt, chỉ đứng thẳng, độ dễ vỡ, xếp chồng, tải đè, số tầng, diện tích tựa) và
 * tối ưu (ưu tiên, bắt buộc xếp, nhóm xếp). Theo dõi hướng đặt ở đây nên chọn hướng không vẽ lại cả hộp thoại.
 */
export function PackageRuleSections({ form }: { form: PackageForm }) {
  const t = useT()
  const { control, register, setValue, formState: { errors } } = form
  const selectedOrientations = useWatch({ control, name: 'orientation' })
  const uprightOnly = useWatch({ control, name: 'uprightOnly' })
  const orientationValues = orientationValuesOf(selectedOrientations)

  function updateOrientations(values: number[]) {
    const sorted = [...new Set(values)].sort((a, b) => a - b)
    setValue('orientation', sorted.join(','), { shouldValidate: true, shouldDirty: true })
  }

  function toggleOrientation(value: number) {
    if (uprightOnly) return
    if (orientationValues.includes(value)) updateOrientations(orientationValues.filter((item) => item !== value))
    else updateOrientations([...orientationValues, value])
  }

  useEffect(() => {
    if (uprightOnly) setValue('orientation', '0,2', { shouldValidate: true, shouldDirty: true })
  }, [uprightOnly, setValue])

  return (
    <>
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">{t('sourcing.form.packingRules')}</h3>
        <PackageOrientationPicker
          values={orientationValues}
          uprightOnly={uprightOnly}
          error={errors.orientation?.message}
          onToggle={toggleOrientation}
          onSelect={updateOrientations}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('uprightOnly')} />
          {t('sourcing.form.uprightOnly')}
        </label>
        <PackageNumberInput form={form} field="fragilityLevel" label={t('sourcing.form.fragilityLevel')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('stackable')} />
          {t('sourcing.form.stackable')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <PackageNumberInput form={form} field="maxTopLoadKg" label={t('sourcing.form.maxTopLoad')} suffix="kg" step="0.01" />
          <PackageNumberInput form={form} field="maxLayers" label={t('sourcing.form.maxLayers')} />
          <PackageNumberInput form={form} field="minSupportRatio" label={t('sourcing.form.minSupportRatio')} step="0.01" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">{t('sourcing.form.optimization')}</h3>
        <PackageNumberInput form={form} field="priority" label={t('sourcing.form.priority')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('mustLoad')} />
          {t('sourcing.form.mustLoad')}
        </label>
        <Input label={t('sourcing.form.packingGroup')} error={errors.packingGroup?.message} {...register('packingGroup')} />
      </section>
    </>
  )
}
