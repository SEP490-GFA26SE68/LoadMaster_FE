import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { HANDLING_CLASSES } from '@/domain/models'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Package } from '@/lib/mock-db'
import { EMPTY_PACKAGE, isPackageFormError, NO_PACKAGE_TYPE, packageFormSchema, toPackageInput, type PackageFormValues } from './package-form'
import { useCreatePackageMutation, usePackageTypesQuery } from './usePackagePoolQuery'

type NumberField = 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg'

/**
 * "Thêm kiện" (FE-3b-03): một kiện với cùng trường của file nhập — mã của bên gửi, D × R × C (cm), khối lượng (kg), loại hàng, điểm
 * đến, loại kiện (không bắt buộc). Kiện thuộc công ty của người thêm (kho lấy từ phiên) nên không có ô chọn công ty. Lưu xong kho đã
 * cấp mã QR: `onDone` nhận kiện vừa tạo để màn mở chi tiết có mã QR. Kho từ chối thì câu lỗi hiện trong hộp thoại.
 */
export function PackageFormDialog({ onClose, onDone }: {
  onClose: () => void
  onDone: (created: Package) => void
}) {
  const t = useT()
  const typesQuery = usePackageTypesQuery()
  const create = useCreatePackageMutation()
  const form = useForm<PackageFormValues>({ resolver: zodResolver(packageFormSchema), defaultValues: EMPTY_PACKAGE })
  const { control, register, formState: { errors } } = form
  const pending = create.isPending

  const errorText = (message: string | undefined) => (isPackageFormError(message) ? t(`sourcing.form.errors.${message}`) : message)
  const numeric = (field: NumberField, label: string, suffix: string, step: string) => (
    <Input
      label={label}
      required
      numeric
      suffix={suffix}
      type="number"
      step={step}
      min={0}
      className="text-left"
      error={errorText(errors[field]?.message)}
      {...register(field, { valueAsNumber: true })}
    />
  )

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent className="w-160">
        <form noValidate onSubmit={form.handleSubmit((values) => create.mutate(toPackageInput(values), { onSuccess: onDone }))}>
          <DialogHeader icon={PackagePlus} title={t('sourcing.form.title')} description={t('sourcing.form.description')} />
          <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto px-7 pt-5 pb-6">
            <Input
              label={t('sourcing.form.packageCode')}
              placeholder={t('sourcing.form.packageCodePlaceholder')}
              hint={t('sourcing.form.packageCodeHint')}
              className="font-mono"
              error={errorText(errors.packageCode?.message)}
              {...register('packageCode')}
            />
            <div className="grid grid-cols-4 items-start gap-3 max-sm:grid-cols-2">
              {numeric('lengthCm', t('trips.form.length'), 'cm', '0.1')}
              {numeric('widthCm', t('trips.form.width'), 'cm', '0.1')}
              {numeric('heightCm', t('trips.form.height'), 'cm', '0.1')}
              {numeric('weightKg', t('trips.form.weight'), 'kg', '0.01')}
            </div>
            <SelectField
              control={control}
              name="handlingClass"
              label={t('sourcing.form.handlingClass')}
              options={HANDLING_CLASSES.map((value) => ({ value, label: t(`common.handlingClasses.${value}`) }))}
            />
            <Input
              label={t('sourcing.form.destination')}
              placeholder={t('sourcing.form.destinationPlaceholder')}
              required
              error={errorText(errors.destination?.message)}
              {...register('destination')}
            />
            <SelectField
              control={control}
              name="packageTypeId"
              label={t('sourcing.form.packageType')}
              hint={t('sourcing.form.packageTypeHint')}
              options={[
                { value: NO_PACKAGE_TYPE, label: t('sourcing.form.packageTypeNone') },
                ...(typesQuery.data ?? []).map((type) => ({ value: type.id, label: `${type.name} · ${type.id}` })),
              ]}
            />
            {create.error ? <Banner tone="danger">{dataErrorMessage(create.error, t)}</Banner> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{t('sourcing.form.cancel')}</Button>
            <Button type="submit" variant="primary" loading={pending}>{t('sourcing.form.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
