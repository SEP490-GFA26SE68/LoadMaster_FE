import { zodResolver } from '@hookform/resolvers/zod'
import { Send } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FieldMessage } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/Textarea'
import { PUBLIC_PRIVACY } from '@/features/auth/landing'
import { dataErrorMessage, useLocale, useT } from '@/lib/i18n'
import { CONTACT_REQUEST_TYPES, type GuestContact, type SubscriptionPlan } from '@/lib/mock-db'
import { contactFormSchema, looksAutomated, NO_PLAN, toNewContact, translateContactError, type ContactFormValues } from './contact-form'
import { PUBLIC_TOUCH } from './public-chrome'
import { useSendContactMutation } from './useMarketingQuery'

/** Select của Radix là nút: cao 56px, chữ 16px trên máy cảm ứng như ô nhập. */
const TOUCH_SELECT = 'pointer-coarse:[&_button]:h-14 pointer-coarse:[&_button]:text-body-lg'

/**
 * Ô bẫy: người thật không thấy (đẩy ra ngoài khung nhìn — không `display: none`, vì chương trình gửi tự động bỏ qua ô bị ẩn hẳn), trình đọc
 * màn hình không đọc (`aria-hidden`), phím Tab không tới (`tabIndex -1`), trình duyệt không tự điền (`autoComplete="off"`). Không nằm
 * trong react-hook-form: giá trị của nó không bao giờ vào yêu cầu gửi đi.
 */
function TrapField({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const t = useT()
  const id = useId()
  return (
    <div aria-hidden className="absolute top-0 -left-[10000px] flex w-60 flex-col">
      <label htmlFor={id}>{t('landing.contact.form.trap')}</label>
      <input ref={inputRef} id={id} name="website" type="text" aria-hidden tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  )
}

/**
 * Form liên hệ của khách chưa có tài khoản (`POST /api/contact-guests`): họ tên, email, loại yêu cầu bắt buộc; số điện thoại, công ty,
 * gói quan tâm (gói đang bán) và nội dung tuỳ chọn; ô đồng ý với chính sách bảo mật bắt buộc nhưng không gửi đi. Chặn chương trình gửi
 * tự động bằng ô bẫy và thời gian điền tối thiểu (`looksAutomated`, tính từ lúc form hiện ra): lần gửi bị chặn không gọi kho hay máy chủ,
 * chỉ hiện banner ngay trên nút gửi, dữ liệu đang nhập giữ nguyên để người thật gửi lại. Lỗi của kho (mất mạng, dữ liệu sai) cũng hiện bằng
 * banner ở đó. Nút gửi là nút phụ: nút chính duy nhất của trang nằm ở phần mở đầu (AGENTS mục 5).
 */
export function ContactForm({ plans, initial, focusFirst = false, onSent }: {
  plans: readonly SubscriptionPlan[]
  initial: ContactFormValues
  /** Đặt con trỏ vào ô Họ tên khi form hiện ra — sau "Gửi yêu cầu khác", không phải lúc mở trang. */
  focusFirst?: boolean
  onSent: (contact: GuestContact) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const send = useSendContactMutation()
  const [serverError, setServerError] = useState<unknown>(null)
  const [blocked, setBlocked] = useState(false)
  const trapRef = useRef<HTMLInputElement>(null)
  // Lúc form hiện ra — mốc của thời gian điền tối thiểu
  const shownAt = useRef<number | null>(null)
  const consentErrorId = useId()
  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: initial })
  const { errors } = form.formState
  const consentError = translateContactError(t, errors.consent?.message)
  useEffect(() => {
    shownAt.current = Date.now()
  }, [])
  useEffect(() => {
    if (focusFirst) form.setFocus('fullName')
  }, [focusFirst, form])

  async function handleValid(values: ContactFormValues, automated: boolean) {
    setServerError(null)
    if (automated) {
      setBlocked(true)
      // Trình duyệt lỡ điền ô bẫy cho người thật: xoá để lần gửi sau đi được
      if (trapRef.current) trapRef.current.value = ''
      return
    }
    setBlocked(false)
    try {
      onSent(await send.mutateAsync(toNewContact(values)))
    } catch (error) {
      setServerError(error)
    }
  }

  // Đọc ô bẫy và thời gian điền ngay lúc bấm gửi, rồi mới để react-hook-form kiểm các ô
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const now = Date.now()
    const automated = looksAutomated({ trap: trapRef.current?.value ?? '', elapsedMs: now - (shownAt.current ?? now) })
    void form.handleSubmit((values) => handleValid(values, automated))(event)
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="relative grid gap-4 sm:grid-cols-2">
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
      <TrapField inputRef={trapRef} />

      <div className="flex flex-col gap-1 sm:col-span-2">
        <Controller
          control={form.control}
          name="consent"
          render={({ field }) => (
            <Checkbox
              ref={field.ref}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              aria-required
              aria-invalid={consentError ? true : undefined}
              aria-describedby={consentError ? consentErrorId : undefined}
              label={
                <span className="block py-2 text-body-lg text-ink-1">
                  {t('landing.contact.form.consent.before')}
                  <Link
                    to={`${PUBLIC_PRIVACY}?lang=${locale}`}
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                  >
                    {t('landing.contact.form.consent.link')}
                    <span className="sr-only"> {t('landing.contact.form.consent.newTab')}</span>
                  </Link>
                  {t('landing.contact.form.consent.after')}
                </span>
              }
            />
          )}
        />
        {consentError ? <FieldMessage id={consentErrorId} error={consentError} /> : null}
      </div>

      {blocked || serverError ? (
        <Banner tone="danger" role="alert" className="sm:col-span-2 pointer-coarse:text-body-lg">
          {blocked ? t('landing.contact.form.blocked') : dataErrorMessage(serverError, t)}
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
