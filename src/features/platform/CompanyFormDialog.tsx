import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { CoordinatePicker, placeAddress } from '@/components/map'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldMessage } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Company } from '@/lib/mock-db'
import {
  companyFormDefaults,
  companyFormSchema,
  translateCompanyFormError,
  type CompanyFormInput,
  type CompanyFormValues,
} from './company-form'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 p-0 font-display text-h3 leading-6 font-semibold text-ink-strong">{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * Tạo / sửa công ty (FE-8-06, D-65). Truyền `company` để sửa (thông tin công ty và kho xuất phát), bỏ trống để tạo: form tạo có thêm mục
 * Quản trị công ty đầu tiên, và công ty mới chưa có gói. Nơi gọi chỉ gắn hộp thoại khi mở (kèm `key` theo công ty). Kho từ chối (email
 * trùng, dữ liệu sai…) thì câu lỗi hiện ngay trong hộp thoại và dữ liệu đang nhập giữ nguyên.
 */
export function CompanyFormDialog({ company, onClose, onSubmit }: {
  company?: Company
  onClose: () => void
  onSubmit: (values: CompanyFormValues) => Promise<void>
}) {
  const t = useT()
  const isEdit = company !== undefined
  const [serverError, setServerError] = useState<unknown>(null)
  const schema = useMemo(() => companyFormSchema(!isEdit), [isEdit])
  const form = useForm<CompanyFormInput, unknown, CompanyFormValues>({ resolver: zodResolver(schema), defaultValues: companyFormDefaults(company) })
  const { errors, isSubmitted, isSubmitting } = form.formState
  const text = (field: keyof CompanyFormInput) => translateCompanyFormError(t, field, errors[field]?.message)

  async function handleValid(values: CompanyFormValues) {
    setServerError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      setServerError(error)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open || isSubmitting ? undefined : onClose())}>
      <DialogContent className="w-160">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={Building2}
            title={isEdit ? t('companies.form.editTitle', { id: company.id }) : t('companies.form.createTitle')}
            description={isEdit ? t('companies.form.editDescription') : t('companies.form.createDescription')}
          />
          <div className="flex max-h-[62vh] flex-col gap-6 overflow-y-auto px-7 py-5">
            <Section title={t('companies.form.companySection')}>
              <Input label={t('companies.form.name')} required error={text('name')} {...form.register('name')} />
              <Input label={t('companies.form.address')} required error={text('address')} {...form.register('address')} />
              <Input label={t('companies.form.phone')} required className="font-mono" error={text('phone')} {...form.register('phone')} />
            </Section>

            <Section title={t('companies.form.depotSection')}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('companies.form.depotName')} required error={text('depotName')} {...form.register('depotName')} />
                <Input label={t('companies.form.depotAddress')} error={text('depotAddress')} {...form.register('depotAddress')} />
              </div>
              <Controller
                control={form.control}
                name="coordinates"
                render={({ field, fieldState }) => (
                  <div className="flex flex-col gap-1.5">
                    <CoordinatePicker
                      label={t('companies.form.depotCoordinates')}
                      value={field.value}
                      onChange={(next) => { field.onChange(next); field.onBlur() }}
                      showErrors={isSubmitted}
                      onPlacePicked={(place) => {
                        if (form.getValues('depotAddress').trim() === '') form.setValue('depotAddress', placeAddress(place), { shouldDirty: true })
                      }}
                    />
                    {/* Hai ô đều trống: không ô nào sai, lỗi "chưa chọn toạ độ" nằm ở cả nhóm */}
                    {fieldState.error && field.value.lat === '' && field.value.lng === '' ? <FieldMessage error={translateCompanyFormError(t, 'coordinates', fieldState.error.message)} /> : null}
                  </div>
                )}
              />
            </Section>

            {isEdit ? null : (
              <Section title={t('companies.form.adminSection')}>
                <p className="m-0 text-small text-ink-3">{t('companies.form.adminHint')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t('companies.form.adminName')} required error={text('adminName')} {...form.register('adminName')} />
                  <Input label={t('companies.form.adminPhone')} required className="font-mono" error={text('adminPhone')} {...form.register('adminPhone')} />
                  <div className="col-span-2">
                    <Input label={t('companies.form.adminEmail')} type="email" required error={text('adminEmail')} {...form.register('adminEmail')} />
                  </div>
                </div>
              </Section>
            )}

            {serverError ? (
              <p role="alert" className="m-0 rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg">
                {dataErrorMessage(serverError, t)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              {/* Đang lưu thì không huỷ được: thao tác không dừng giữa chừng */}
              <Button type="button" variant="secondary" disabled={isSubmitting}>{t('companies.form.cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isEdit ? t('companies.form.save') : t('companies.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
