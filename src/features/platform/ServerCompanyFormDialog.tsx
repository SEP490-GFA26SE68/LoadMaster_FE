import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, UserPlus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { NewServerCompanyAdmin, ServerCompany } from './companies-server-api'
import {
  serverCompanyFormDefaults,
  serverCompanyFormSchema,
  serverErrorField,
  translateServerCompanyFormError,
  type ServerCompanyField,
  type ServerCompanyFormInput,
  type ServerCompanyFormMode,
  type ServerCompanyFormValues,
  type ServerCompanyTaken,
} from './server-company-form'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 p-0 font-display text-h3 leading-6 font-semibold text-ink-strong">{title}</legend>
      {children}
    </fieldset>
  )
}

/** Lần tạo công ty vừa rồi đã tạo được công ty nhưng hỏng ở bước tạo quản trị: lỗi đó và dữ liệu quản trị đã nhập. */
export type AdminFailure = { readonly error: unknown; readonly admin: NewServerCompanyAdmin }

/**
 * Tạo / sửa công ty khi nối backend, và tạo riêng quản trị cho công ty chưa có (`mode`). Chỉ có ô backend lưu: mã công ty (không đổi sau
 * khi tạo), tên, mã số thuế, email thanh toán — không có địa chỉ, số điện thoại, kho xuất phát. Lỗi máy chủ của một ô (mã, mã số thuế,
 * email trùng) hiện ở ô đó, lỗi khác ở cuối hộp thoại; dữ liệu đang nhập giữ nguyên. Nơi gọi chỉ gắn hộp thoại khi mở, kèm `key`.
 */
export function ServerCompanyFormDialog({ mode, company, taken, failure, onClose, onSubmit }: {
  mode: ServerCompanyFormMode
  company?: ServerCompany
  taken: ServerCompanyTaken
  failure?: AdminFailure
  onClose: () => void
  onSubmit: (values: ServerCompanyFormValues) => Promise<void>
}) {
  const t = useT()
  const [serverError, setServerError] = useState<unknown>(failure?.error ?? null)
  const schema = useMemo(() => serverCompanyFormSchema(mode, taken, company), [mode, taken, company])
  const form = useForm<ServerCompanyFormInput, unknown, ServerCompanyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: serverCompanyFormDefaults(company, failure?.admin),
  })
  const { errors, isSubmitting } = form.formState
  const serverField = serverErrorField(serverError)
  const text = (field: ServerCompanyField) =>
    translateServerCompanyFormError(t, field, errors[field]?.message) ?? (serverField?.field === field ? t(serverField.message) : undefined)
  const companyName = company?.name ?? ''

  async function handleValid(values: ServerCompanyFormValues) {
    setServerError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      setServerError(error)
    }
  }

  const copy = {
    create: { title: t('companies.form.createTitle'), description: t('companies.server.form.createDescription'), submit: t('companies.form.create') },
    edit: { title: t('companies.form.editTitle', { id: company?.code ?? '' }), description: t('companies.server.form.editDescription'), submit: t('companies.form.save') },
    admin: { title: t('companies.server.form.adminTitle', { name: companyName }), description: t('companies.server.form.adminDescription'), submit: t('companies.server.form.createAdmin') },
  }[mode]

  return (
    <Dialog open onOpenChange={(open) => (open || isSubmitting ? undefined : onClose())}>
      <DialogContent className="w-160">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader icon={mode === 'admin' ? UserPlus : Building2} title={copy.title} description={copy.description} />
          <div className="flex max-h-[62vh] flex-col gap-6 overflow-y-auto px-7 py-5">
            {failure ? <Banner tone="warning">{t('companies.server.form.adminFailed', { name: companyName })}</Banner> : null}

            {mode === 'admin' ? null : (
              <Section title={t('companies.form.companySection')}>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('companies.server.form.code')}
                    required={mode === 'create'}
                    readOnly={mode === 'edit'}
                    hint={t('companies.server.form.codeHint')}
                    className="font-mono"
                    error={mode === 'create' ? text('code') : undefined}
                    {...form.register('code')}
                  />
                  <Input label={t('companies.server.form.taxCode')} required className="font-mono" error={text('taxCode')} {...form.register('taxCode')} />
                  <div className="col-span-2">
                    <Input label={t('companies.form.name')} required error={text('name')} {...form.register('name')} />
                  </div>
                  <div className="col-span-2">
                    <Input label={t('companies.server.form.billingEmail')} type="email" required error={text('billingEmail')} {...form.register('billingEmail')} />
                  </div>
                </div>
              </Section>
            )}

            {mode === 'edit' ? null : (
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

            {serverError && serverField === null ? (
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
            <Button type="submit" variant="primary" loading={isSubmitting}>{copy.submit}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
