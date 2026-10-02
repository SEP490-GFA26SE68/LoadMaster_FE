import { zodResolver } from '@hookform/resolvers/zod'
import { Shapes } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { fieldLabelClass, FieldMessage } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { isUpright, ORIENTATION_CODES } from '@/domain/geometry'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { PackageType, PackageTypeInput } from '@/lib/mock-db'
import {
  EMPTY_PACKAGE_TYPE,
  packageTypeFieldError,
  packageTypeFormSchema,
  toPackageTypeForm,
  toPackageTypeInput,
  uprightOrientations,
  type PackageTypeFormInput,
  type PackageTypeFormValues,
} from './package-type-form'

const FRAGILITY = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const
type NumberField = 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'maxTopLoadKg' | 'maxStackCount'

/**
 * Thêm / sửa loại kiện (LM-104): tên; D × R × C; khối lượng; hướng đặt; giữ thẳng đứng; mức dễ vỡ; xếp chồng và hai giới hạn. Cùng
 * trường và cùng quy tắc D-25 với form kiện của chuyến (bật giữ thẳng đứng bỏ hướng nằm nghiêng; tắt xếp chồng khoá tải phía trên).
 * Nơi gọi chỉ gắn hộp thoại khi mở (kèm `key`), nên mỗi lần mở là form mới; kho từ chối thì câu lỗi hiện trong hộp thoại.
 */
export function PackageTypeFormDialog({ type, onClose, onSubmit }: {
  type?: PackageType
  onClose: () => void
  onSubmit: (input: PackageTypeInput) => Promise<void>
}) {
  const t = useT()
  const baseId = useId()
  const [serverError, setServerError] = useState<unknown>(null)
  const form = useForm<PackageTypeFormInput, unknown, PackageTypeFormValues>({
    resolver: zodResolver(packageTypeFormSchema),
    defaultValues: type ? toPackageTypeForm(type) : EMPTY_PACKAGE_TYPE,
  })
  const { control, register, setValue, formState: { errors, isSubmitting } } = form
  const allowed = useWatch({ control, name: 'allowedOrientations' })
  const keepUpright = useWatch({ control, name: 'keepUpright' })
  const fragility = useWatch({ control, name: 'fragilityLevel' })
  const stackable = useWatch({ control, name: 'stackable' })

  async function handleValid(values: PackageTypeFormValues) {
    setServerError(null)
    try {
      await onSubmit(toPackageTypeInput(values))
    } catch (error) {
      setServerError(error)
    }
  }

  const numeric = (field: NumberField, label: string, suffix: string | undefined, step: string, options: { required?: boolean; disabled?: boolean; hint?: string } = {}) => (
    <Input
      id={`${baseId}-${field}`}
      label={label}
      required={options.required}
      numeric
      suffix={suffix}
      type="number"
      step={step}
      min={0}
      hint={options.hint}
      disabled={options.disabled}
      className="text-left"
      error={packageTypeFieldError(errors[field]?.message, t)}
      {...register(field, { valueAsNumber: true })}
    />
  )

  const legend = (label: string): ReactNode => (
    <>{label}<span aria-hidden className="text-danger"> *</span></>
  )

  return (
    <Dialog open onOpenChange={(open) => (open || isSubmitting ? undefined : onClose())}>
      <DialogContent className="w-150">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={Shapes}
            title={type ? t('sourcing.packageTypes.form.editTitle', { id: type.id }) : t('sourcing.packageTypes.form.createTitle')}
            description={t('sourcing.packageTypes.form.description')}
          />
          <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 pt-5 pb-6">
            <Input
              label={t('sourcing.packageTypes.form.name')}
              required
              placeholder={t('sourcing.packageTypes.form.namePlaceholder')}
              error={packageTypeFieldError(errors.name?.message, t)}
              {...register('name')}
            />
            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
              {numeric('lengthCm', t('trips.form.length'), 'cm', '0.1', { required: true })}
              {numeric('widthCm', t('trips.form.width'), 'cm', '0.1', { required: true })}
              {numeric('heightCm', t('trips.form.height'), 'cm', '0.1', { required: true })}
              {numeric('weightKg', t('trips.form.weight'), 'kg', '0.01', { required: true })}
            </div>

            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-small font-semibold text-ink-2">{legend(t('trips.form.orientations'))}</legend>
              <div className="grid grid-cols-6 gap-x-3 gap-y-2.5 max-sm:grid-cols-3">
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
                error={packageTypeFieldError(errors.allowedOrientations?.message, t)}
                hint={keepUpright ? t('trips.form.uprightHint') : undefined}
              />
            </fieldset>

            <Switch
              label={t('trips.form.keepUpright')}
              checked={keepUpright}
              onCheckedChange={(checked) => {
                setValue('keepUpright', checked, { shouldDirty: true })
                if (checked) setValue('allowedOrientations', uprightOrientations(allowed), { shouldValidate: true, shouldDirty: true })
              }}
            />

            <div className="flex flex-col gap-1.5">
              <span aria-hidden className={fieldLabelClass}>{t('trips.form.fragility')}</span>
              <SegmentedControl
                ariaLabel={t('trips.form.fragility')}
                floating={false}
                className="w-full [&>button]:flex-1"
                value={fragility}
                onChange={(level) => setValue('fragilityLevel', level, { shouldDirty: true })}
                options={FRAGILITY.map((level) => ({ value: level, label: t(`trips.form.fragilityLevels.${level}`) }))}
              />
            </div>

            <Switch
              label={t('trips.form.stackable')}
              checked={stackable}
              onCheckedChange={(checked) => {
                setValue('stackable', checked, { shouldDirty: true })
                if (!checked) setValue('maxTopLoadKg', 0, { shouldValidate: true, shouldDirty: true })
              }}
            />
            <div className="grid grid-cols-2 items-start gap-3">
              {numeric('maxTopLoadKg', t('trips.form.maxTopLoad'), 'kg', '0.01', { disabled: !stackable })}
              {numeric('maxStackCount', t('trips.form.maxStackCount'), undefined, '1', { disabled: !stackable, hint: t('sourcing.packageTypes.form.stackHint') })}
            </div>

            {serverError ? <Banner tone="danger">{dataErrorMessage(serverError, t)}</Banner> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onClose}>
              {t('sourcing.packageTypes.form.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {type ? t('sourcing.packageTypes.form.save') : t('sourcing.packageTypes.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
