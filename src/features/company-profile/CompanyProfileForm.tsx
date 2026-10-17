import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { CompanyProfile } from './company-profile-api'
import {
  companyProfileDefaults,
  companyProfileSchema,
  PROFILE_FIELDS,
  toCompanyProfileSave,
  translateCompanyProfileError,
  type CompanyProfileField,
  type CompanyProfileInput,
  type CompanyProfileValues,
} from './company-profile-form'
import { useSaveCompanyProfileMutation } from './useCompanyProfileQuery'

/** Ô của từng trường: nhãn, kiểu nhập; `wide` chiếm cả hàng. */
const INPUTS: Readonly<Record<CompanyProfileField, { label: MessageKey; wide?: boolean } & Pick<ComponentProps<'input'>, 'type' | 'inputMode' | 'autoComplete'>>> = {
  name: { label: 'companyProfile.form.name', autoComplete: 'organization', wide: true },
  billingEmail: { label: 'companyProfile.form.billingEmail', type: 'email', inputMode: 'email', autoComplete: 'email' },
  address: { label: 'companyProfile.form.address', autoComplete: 'street-address', wide: true },
  phone: { label: 'companyProfile.form.phone', type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
}

/**
 * Thông tin chung của công ty: chỉ ô của trường nơi lưu thật sự lưu (`company-profile-form.ts`). "Lưu thay đổi" là nút chính duy nhất
 * của màn, tắt khi chưa sửa gì. Lưu xong form lấy bản nơi lưu trả về làm mốc; nơi lưu từ chối thì câu lỗi hiện dưới form, chữ đang nhập
 * giữ nguyên.
 */
export function CompanyProfileForm({ profile }: { profile: CompanyProfile }) {
  const t = useT()
  const titleId = useId()
  const save = useSaveCompanyProfileMutation()
  const { source } = profile
  const form = useForm<CompanyProfileInput, unknown, CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema(source)),
    defaultValues: companyProfileDefaults(profile),
  })
  const { errors, isDirty, isSubmitting } = form.formState

  // Bản mới từ nơi lưu (người khác vừa sửa, đọc lại khi quay về tab): ô chưa sửa theo bản đó, ô đang sửa giữ chữ đang nhập
  useEffect(() => {
    form.reset(companyProfileDefaults(profile), { keepDirtyValues: true })
  }, [form, profile])

  async function handleValid(values: CompanyProfileValues) {
    try {
      const saved = await save.mutateAsync(toCompanyProfileSave(source, values))
      form.reset(companyProfileDefaults(saved))
      toast.success(t('companyProfile.form.saved'))
    } catch {
      // Câu lỗi hiện dưới form từ `save.error`
    }
  }

  return (
    <section aria-labelledby={titleId}>
      <Card>
        <CardHeader>
          <CardTitle as="h2" id={titleId}>{t('companyProfile.form.title')}</CardTitle>
          <CardMeta className="text-ink-3">{t(source === 'server' ? 'companyProfile.form.serverDescription' : 'companyProfile.form.description')}</CardMeta>
        </CardHeader>

        <CardBody className="p-5">
          <form noValidate onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {PROFILE_FIELDS[source].map((field) => {
                const { label, wide, ...input } = INPUTS[field]
                return (
                  // `Input` đặt `className` lên ô nhập; ô rộng cả hàng thì vỏ ngoài mới là phần tử của lưới
                  <div key={field} className={cn('min-w-0', wide && 'sm:col-span-2')}>
                    <Input
                      label={t(label)}
                      required
                      {...input}
                      className={cn(field === 'phone' && 'font-mono')}
                      error={translateCompanyProfileError(t, source, field, errors[field]?.message)}
                      {...form.register(field)}
                    />
                  </div>
                )
              })}
            </div>

            {save.isError ? (
              <p role="alert" className="rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-badge-danger-fg">
                {dataErrorMessage(save.error, t)}
              </p>
            ) : null}

            <div>
              <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting}>
                {t('companyProfile.form.save')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </section>
  )
}
