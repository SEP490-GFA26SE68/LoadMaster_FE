import { ExternalLink, Info } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, type RefObject } from 'react'
import { useController, type Control } from 'react-hook-form'
import { Checkbox } from '@/components/ui/Checkbox'
import { FieldMessage } from '@/components/ui/field-styles'
import { PUBLIC_PRIVACY } from '@/features/auth/landing'
import { useLocale, useT } from '@/lib/i18n'
import { SITE_INFO } from '@/lib/site-info'
import { cn } from '@/lib/utils'
import { GUEST_CONTACT_SOURCE } from './contact-api'
import { contactGuard, translateContactError, type ContactFormValues, type ContactGuard } from './contact-form'

/* Phần của form liên hệ tách khỏi `ContactForm.tsx`: câu nói thật của bản demo, ô đồng ý, mốc form hiện ra. */

/**
 * Bản demo (kho mẫu) nói thật: yêu cầu chỉ nằm trong trình duyệt này, cách nhanh nhất để gặp đội là email hỗ trợ (`SITE_INFO`). `note`
 * đứng đầu form, `sent` thay câu "sẽ liên hệ lại" ở vùng đã gửi. Nối backend (`GUEST_CONTACT_SOURCE`) thì không vẽ gì.
 */
export function DemoContactNote({ kind }: { kind: 'note' | 'sent' }) {
  const t = useT()
  if (!GUEST_CONTACT_SOURCE.storedInBrowser) return null
  return (
    <p className="m-0 flex items-start gap-2.5 rounded-md border border-border bg-n-50 px-3.5 py-3 text-small text-ink-2 pointer-coarse:text-body-lg">
      <Info aria-hidden className="mt-0.5 size-4 flex-none text-ink-3 pointer-coarse:mt-1" strokeWidth={1.5} />
      <span className="min-w-0 text-pretty">
        {kind === 'note' ? <strong className="font-semibold text-ink-1">{t('landingContact.demo.label')}: </strong> : null}
        {t(kind === 'note' ? 'landingContact.demo.note' : 'landingContact.demo.sent')}{' '}
        <a href={`mailto:${SITE_INFO.supportEmail}`} className="font-semibold whitespace-nowrap text-primary underline underline-offset-2">
          {SITE_INFO.supportEmail}
        </a>
        .
      </span>
    </p>
  )
}

/**
 * Ô đồng ý (bắt buộc): checkbox Radix, nhãn bấm được cả dòng (44 px, 56 px trên máy cảm ứng), liên kết chính sách bảo mật mở thẻ mới
 * để chữ đang nhập không mất — kèm `?lang=` vì thẻ mở bằng `noopener` không mang theo ngôn ngữ đã chọn. Lỗi nối vào ô bằng
 * `aria-describedby`.
 */
export function ConsentField({ control }: { control: Control<ContactFormValues> }) {
  const t = useT()
  const { locale } = useLocale()
  const id = useId()
  const errorId = `${id}-loi`
  const { field: { ref, name, value, onChange, onBlur }, fieldState } = useController({ control, name: 'consent' })
  const error = translateContactError(t, fieldState.error?.message)
  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          ref={ref}
          name={name}
          checked={value}
          onCheckedChange={(checked) => onChange(checked === true)}
          onBlur={onBlur}
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn('mt-3 pointer-coarse:mt-4 pointer-coarse:size-6', error && 'border-red-500')}
        />
        <label htmlFor={id} className="min-h-11 cursor-pointer py-2.5 text-body text-ink-1 text-pretty pointer-coarse:min-h-14 pointer-coarse:py-3.5 pointer-coarse:text-body-lg">
          {t('landingContact.consent.label')}
          <span aria-hidden className="text-danger"> *</span>
        </label>
      </div>
      <div className="-mt-1.5 flex flex-col items-start pl-7.5 pointer-coarse:-mt-2 pointer-coarse:pl-9">
        <FieldMessage id={errorId} error={error} />
        <a
          href={`${PUBLIC_PRIVACY}?lang=${locale}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-primary underline underline-offset-2 hover:text-primary-hover pointer-coarse:min-h-14 pointer-coarse:text-body-lg"
        >
          {/* Chữ hiện ra và phần chỉ cho trình đọc màn hình chung một dòng chữ, để khoảng trắng giữa hai phần không mất trong hộp flex */}
          <span>
            {t('landingContact.consent.privacy')}{' '}
            <span className="sr-only">{t('landingContact.consent.newTab')}</span>
          </span>
          <ExternalLink aria-hidden className="size-4 flex-none" strokeWidth={1.5} />
        </a>
      </div>
    </div>
  )
}

/**
 * Kiểm chống gửi tự động lúc bấm gửi (`contactGuard`): ô bẫy có chữ, hoặc chưa đủ thời gian điền tối thiểu kể từ lúc form hiện ra trong
 * khung nhìn. Không có IntersectionObserver thì tính từ lúc form được dựng; chưa hiện ra lần nào thì gửi lúc đó tính là quá nhanh.
 */
export function useContactGuard(formRef: RefObject<HTMLFormElement | null>): (trap: string) => ContactGuard | null {
  const shownAt = useRef<number | null>(null)
  useEffect(() => {
    const form = formRef.current
    if (form === null) return
    if (typeof IntersectionObserver === 'undefined') {
      shownAt.current = Date.now()
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      shownAt.current = Date.now()
      observer.disconnect()
    })
    observer.observe(form)
    return () => observer.disconnect()
  }, [formRef])
  return useCallback((trap: string) => {
    const now = Date.now()
    return contactGuard({ trap, shownAt: shownAt.current ?? now, now })
  }, [])
}

