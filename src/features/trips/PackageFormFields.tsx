import { useId, type ReactNode } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { FieldLabel, FieldMessage } from '@/components/ui/field-styles'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { ORIENTATION_CODES, isUpright } from '@/domain/geometry'
import type { CargoPackage } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { packageFieldError } from './package-form-errors'
import { PackageStopSelect } from './PackageStopSelect'
import type { StopRow } from './trip-summary'

const FRAGILITY = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const
type NumericField = 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'quantity' | 'maxTopLoadKg' | 'maxStackCount' | 'minSupportRatio' | 'priority'

/** Dấu * của trường bắt buộc (V2.3 `.rq`), chỉ để nhìn: ô nhập mang `aria-required` thay cho nó. */
const REQUIRED_MARK = <span aria-hidden className="text-small font-semibold text-danger"> *</span>

/** Legend có dấu * (hướng đặt). */
function required(label: string): ReactNode {
  return <>{label}{REQUIRED_MARK}</>
}

/**
 * Các trường của form kiện (LM-045, V2.3 `ChiTietChuyenKienDayDu`): tên; D/R/C; khối lượng, số lượng; hướng đặt; giữ thẳng đứng; mức
 * dễ vỡ dạng nhóm nút; xếp chồng và hai giới hạn; tỷ lệ đỡ đáy; điểm giao có mốc màu; độ ưu tiên, bắt buộc xếp; ghi chú. Quy tắc tự
 * đồng bộ D-25 nằm ở `PackageFormPanel`. Giá trị đọc bằng `useWatch`.
 */
export function PackageFormFields({ form, stops, onKeepUprightChange, onStackableChange }: {
  form: UseFormReturn<CargoPackage>
  stops: readonly StopRow[]
  /** D-25: bật giữ thẳng đứng bỏ các hướng nằm nghiêng; tắt xếp chồng đưa tải trên về 0 (panel xử lý). */
  onKeepUprightChange: (checked: boolean) => void
  onStackableChange: (checked: boolean) => void
}) {
  const t = useT()
  const { control, register, setValue, formState: { errors } } = form
  const allowed = useWatch({ control, name: 'allowedOrientations' })
  const keepUpright = useWatch({ control, name: 'keepUpright' })
  const fragility = useWatch({ control, name: 'fragilityLevel' })
  const stackable = useWatch({ control, name: 'stackable' })
  const mustLoad = useWatch({ control, name: 'mustLoad' })

  const baseId = useId()

  const numeric = (field: NumericField, label: string, suffix: string, step: string,
    options: { disabled?: boolean; isRequired?: boolean; hint?: string } = {}) => {
    const input = (
    <Input
      id={`${baseId}-${field}`}
      label={options.isRequired ? undefined : label}
      aria-required={options.isRequired || undefined}
      numeric
      suffix={suffix || undefined}
      type="number"
      step={step}
      hint={options.hint}
      error={packageFieldError(errors[field]?.message, t)}
      disabled={options.disabled}
      // V2.3: số trong form canh trái như ô chữ; vẫn mono cho số đo (AGENTS mục 4)
      className="text-left"
      {...register(field, { valueAsNumber: true })}
    />
    )
    if (!options.isRequired) return input
    // Dấu * nằm ngoài <label>: tên của ô là đúng chữ nhãn ("Dài", không phải "Dài *") với mọi cách tính nhãn
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex gap-1">
          <FieldLabel htmlFor={`${baseId}-${field}`}>{label}</FieldLabel>
          {REQUIRED_MARK}
        </span>
        {input}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Input label={t('trips.form.name')} error={packageFieldError(errors.name?.message, t)} {...register('name')} />

      <div className="grid grid-cols-3 gap-2.5">
        {numeric('lengthCm', t('trips.form.length'), 'cm', '0.1', { isRequired: true })}
        {numeric('widthCm', t('trips.form.width'), 'cm', '0.1', { isRequired: true })}
        {numeric('heightCm', t('trips.form.height'), 'cm', '0.1', { isRequired: true })}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {numeric('weightKg', t('trips.form.weight'), 'kg', '0.01', { isRequired: true })}
        {numeric('quantity', t('trips.form.quantity'), '', '1', { isRequired: true })}
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-small font-semibold text-ink-2">{required(t('trips.form.orientations'))}</legend>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
          {ORIENTATION_CODES.map((code) => (
            <Checkbox
              key={code}
              label={<span className="font-mono text-small">{code}</span>}
              disabled={keepUpright && !isUpright(code)}
              checked={allowed.includes(code)}
              onCheckedChange={(checked) => setValue(
                'allowedOrientations',
                checked === true ? [...allowed, code] : allowed.filter((item) => item !== code),
                { shouldValidate: true, shouldDirty: true },
              )}
            />
          ))}
        </div>
        <FieldMessage
          error={packageFieldError(errors.allowedOrientations?.message, t)}
          hint={keepUpright ? t('trips.form.uprightHint') : undefined}
        />
      </fieldset>

      <Switch label={t('trips.form.keepUpright')} checked={keepUpright} onCheckedChange={onKeepUprightChange} />

      <div className="flex flex-col gap-1.5">
        <span aria-hidden className="text-small font-semibold text-ink-2">{t('trips.form.fragility')}</span>
        <SegmentedControl
          ariaLabel={t('trips.form.fragility')}
          floating={false}
          className="w-full [&>button]:flex-1"
          value={fragility}
          onChange={(level) => setValue('fragilityLevel', level, { shouldValidate: true, shouldDirty: true })}
          options={FRAGILITY.map((level) => ({ value: level, label: t(`trips.form.fragilityLevels.${level}`) }))}
        />
      </div>

      <Switch label={t('trips.form.stackable')} checked={stackable} onCheckedChange={onStackableChange} />

      <div className="grid grid-cols-2 items-start gap-2.5">
        {numeric('maxTopLoadKg', t('trips.form.maxTopLoad'), 'kg', '0.01', { disabled: !stackable })}
        {numeric('maxStackCount', t('trips.form.maxStackCount'), '', '1', { disabled: !stackable })}
      </div>

      {numeric('minSupportRatio', t('trips.form.minSupportRatio'), '', '0.05', { hint: t('trips.form.minSupportRatioHint') })}

      <PackageStopSelect control={control} stops={stops} label={t('trips.form.deliveryStop')} />

      <div className="grid grid-cols-2 items-end gap-2.5">
        {numeric('priority', t('trips.form.priority'), '', '1')}
        <div className="flex h-10 items-center">
          <Switch
            label={t('trips.form.mustLoad')}
            checked={mustLoad}
            onCheckedChange={(checked) => setValue('mustLoad', checked, { shouldDirty: true })}
          />
        </div>
      </div>

      <Textarea
        label={<>{t('trips.form.notes')} <span className="font-normal text-ink-3">{t('trips.form.optional')}</span></>}
        rows={3}
        {...register('notes')}
      />
    </div>
  )
}
