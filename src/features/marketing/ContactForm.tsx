import { zodResolver } from '@hookform/resolvers/zod'
import { Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { CONTACT_REQUEST_TYPES, type GuestContact, type SubscriptionPlan } from '@/lib/mock-db'
import { contactFormSchema, NO_PLAN, toNewContact, translateContactError, type ContactFormValues } from './contact-form'
import { PUBLIC_TOUCH } from './public-chrome'
import { useSendContactMutation } from './useMarketingQuery'

/** Select của Radix là nút: cao 56px, chữ 16px trên máy cảm ứng như ô nhập. */
const TOUCH_SELECT = 'pointer-coarse:[&_button]:h-14 pointer-coarse:[&_button]:text-body-lg'

/**
 * Form liên hệ của khách chưa có tài khoản (`POST /api/contact-guests`): họ tên, email, loại yêu cầu bắt buộc; số điện thoại, công ty,
 * gói quan tâm (gói đang bán) và nội dung tuỳ chọn. Lỗi của kho (mất mạng, dữ liệu sai) hiện bằng banner ngay trên nút gửi, dữ liệu đang
 * nhập giữ nguyên. Nút gửi là nút phụ: nút chính duy nhất của trang là "Nhận tư vấn" ở phần mở đầu (AGENTS mục 5).
 */
export function ContactForm({ plans, initial, focusFirst = false, onSent }: {
  plans: readonly SubscriptionPlan[]
  initial: ContactFormValues
  /** Đặt con trỏ vào ô Họ tên khi form hiện ra — sau "Gửi yêu cầu khác", không phải lúc mở trang. */
  focusFirst?: boolean
  onSent: (contact: GuestContact) => void
}) {
  const t = useT()
  const send = useSendContactMutation()
  const [serverError, setServerError] = useState<unknown>(null)
  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: initial })
  const { errors } = form.formState
  useEffect(() => {
    if (focusFirst) form.setFocus('fullName')
  }, [focusFirst, form])

  async function handleValid(values: ContactFormValues) {
    setServerError(null)
    try {
      onSent(await send.mutateAsync(toNewContact(values)))
    } catch (error) {
      setServerError(error)
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleValid)} className="grid gap-4 sm:grid-cols-2">
      <Input
        label={t('landing.contact.form.fullName')}
        autoComplete="name"
        required
        className={PUBLIC_TOUCH}
        error={translateContactError(t, errors.fullName?.message)}
        {...form.register('fullName')}
      />
      <Input
        label={t('landing.contact.form.email')}
        type="email"
        autoComplete="email"
        placeholder={t('landing.contact.form.emailPlaceholder')}
        required
        className={PUBLIC_TOUCH}
        error={translateContactError(t, errors.email?.message)}
        {...form.register('email')}
      />
      <Input
        label={t('landing.contact.form.phone')}
        type="tel"
        autoComplete="tel"
        className={PUBLIC_TOUCH}
        error={translateContactError(t, errors.phoneNumber?.message)}
        {...form.register('phoneNumber')}
      />
      <Input
        label={t('landing.contact.form.company')}
        autoComplete="organization"
        className={PUBLIC_TOUCH}
        error={translateContactError(t, errors.companyName?.message)}
        {...form.register('companyName')}
      />
      <SelectField
        control={form.control}
        name="requestType"
        label={t('landing.contact.form.type')}
        required
        options={CONTACT_REQUEST_TYPES.map((type) => ({ value: type, label: t(`contacts.types.${type}`) }))}
        className={TOUCH_SELECT}
      />
      <SelectField
        control={form.control}
        name="planId"
        label={t('landing.contact.form.plan')}
        options={[
          { value: NO_PLAN, label: t('landing.contact.form.noPlan') },
          ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
        ]}
        className={TOUCH_SELECT}
      />
      <div className="sm:col-span-2">
        <Textarea
          label={t('landing.contact.form.message')}
          placeholder={t('landing.contact.form.messagePlaceholder')}
          rows={5}
          className="pointer-coarse:text-body-lg"
          error={translateContactError(t, errors.message?.message)}
          {...form.register('message')}
        />
      </div>

      {serverError ? (
        <Banner tone="danger" role="alert" className="sm:col-span-2 pointer-coarse:text-body-lg">
          {dataErrorMessage(serverError, t)}
        </Banner>
      ) : null}

      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" variant="secondary" loading={send.isPending} className={PUBLIC_TOUCH}>
          {send.isPending ? null : <Send aria-hidden strokeWidth={1.5} />}
          {t('landing.contact.form.submit')}
        </Button>
      </div>
    </form>
  )
}
