import { zodResolver } from '@hookform/resolvers/zod'
import { Send } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { CONTACT_REQUEST_TYPES, type GuestContact, type SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { contactFormSchema, NO_PLAN, toNewContact, translateContactError, type ContactFormValues } from './contact-form'
import { ConsentField, DemoContactNote, useContactGuard } from './ContactFormParts'
import { PUBLIC_TOUCH } from './public-chrome'
import { useSendContactMutation } from './useMarketingQuery'

/** Select của Radix là nút: cao 56px, chữ 16px trên máy cảm ứng như ô nhập. */
const TOUCH_SELECT = 'pointer-coarse:[&_button]:h-14 pointer-coarse:[&_button]:text-body-lg'

/**
 * Form liên hệ của khách chưa có tài khoản (`POST /api/contact-guests`): họ tên, email, loại yêu cầu bắt buộc; số điện thoại, công ty,
 * gói quan tâm (gói đang bán) và nội dung tuỳ chọn; ô đồng ý bắt buộc. Chống gửi tự động ngay ở form: ô bẫy ẩn và thời gian điền tối thiểu
 * — bị chặn thì không lưu, không báo thành công giả, chỉ mời thử lại. Lỗi của kho (mất mạng, dữ liệu sai) hiện bằng banner ngay trên nút
 * gửi, dữ liệu đang nhập giữ nguyên. Nút gửi là nút phụ (rộng hết dòng trên điện thoại): nút chính duy nhất của trang là "Nhận tư vấn" ở
 * phần mở đầu (AGENTS mục 5).
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
  const trapId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const checkGuard = useContactGuard(formRef)
  const [serverError, setServerError] = useState<unknown>(null)
  const [blocked, setBlocked] = useState(false)
  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: initial })
  const { errors } = form.formState
  useEffect(() => {
    if (focusFirst) form.setFocus('fullName')
  }, [focusFirst, form])
  // Liên kết trong trang (nút "Nhận tư vấn", thẻ gói) đổi `?loai=` / `?goi=` khi form đã dựng: chọn lại theo URL, trừ ô khách đã tự chọn
  useEffect(() => {
    const { dirtyFields } = form.formState
    if (!dirtyFields.requestType) form.setValue('requestType', initial.requestType)
    if (!dirtyFields.planId) form.setValue('planId', initial.planId)
  }, [initial.requestType, initial.planId, form])

  async function handleValid(values: ContactFormValues) {
    setServerError(null)
    const guard = checkGuard(values.website)
    setBlocked(guard !== null)
    if (guard !== null) return
    try {
      onSent(await send.mutateAsync(toNewContact(values)))
    } catch (error) {
      setServerError(error)
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={form.handleSubmit(handleValid)} className="relative grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <DemoContactNote kind="note" />
      </div>
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

      {/* Ô bẫy: ngoài khung nhìn, không nhận Tab, ẩn với trình đọc màn hình; chỉ trình gửi tự động điền vào */}
      <div aria-hidden className="sr-only">
        <label htmlFor={trapId}>{t('landingContact.trap')}</label>
        <input id={trapId} type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
      </div>

      <ConsentField control={form.control} />

      {serverError ? (
        <Banner tone="danger" role="alert" className="sm:col-span-2 pointer-coarse:text-body-lg">
          {dataErrorMessage(serverError, t)}
        </Banner>
      ) : null}
      {blocked ? (
        <Banner tone="neutral" className="sm:col-span-2 pointer-coarse:text-body-lg">{t('landingContact.retry')}</Banner>
      ) : null}

      <div className="flex sm:col-span-2 sm:justify-end">
        <Button type="submit" variant="secondary" loading={send.isPending} className={cn('w-full sm:w-auto', PUBLIC_TOUCH)}>
          {send.isPending ? null : <Send aria-hidden strokeWidth={1.5} />}
          {t('landing.contact.form.submit')}
        </Button>
      </div>
    </form>
  )
}
