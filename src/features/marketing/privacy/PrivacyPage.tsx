import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CONTACT_READER_ROLES } from '@/features/contacts/contact-readers'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { backendConfig, usesBackend } from '@/lib/backend-config'
import { useFormat, useT } from '@/lib/i18n'
import { SITE_INFO } from '@/lib/site-info'
import { contactPath } from '../contact-form'
import { PublicPage } from '../PublicPage'
import { PUBLIC_TOUCH } from '../public-chrome'

/** Ngày sửa nội dung trang lần cuối — giữa trưa giờ máy để định dạng ngày không lệch sang hôm trước / hôm sau. */
const UPDATED_AT = new Date(2026, 10, 19, 12)

/** Ô của form liên hệ theo đúng thứ tự trên form (nhãn lấy từ chính form), và ô đó có bắt buộc không — `contactFormSchema`. */
const CONTACT_FIELDS = [
  ['fullName', true],
  ['email', true],
  ['type', true],
  ['phone', false],
  ['company', false],
  ['plan', false],
  ['message', false],
] as const

/** Nguồn dữ liệu đang chạy: mỗi mục có câu riêng cho máy chủ và cho bản demo (kho mẫu trong trình duyệt). */
const CONTACTS_ON_SERVER = usesBackend('contacts')
const SIGN_IN_ON_SERVER = backendConfig.authSource === 'keycloak'

const TEXT = 'm-0 max-w-[70ch] text-body-lg text-pretty text-ink-1'
const LIST = 'm-0 flex max-w-[70ch] list-disc flex-col gap-1 pl-6 text-body-lg text-ink-1 marker:text-ink-3'

function PrivacySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-line-soft pt-6 first:border-t-0 first:pt-0">
      <h2 id={id} tabIndex={-1} className="m-0 font-display text-h2 font-[650] text-ink-strong outline-none font-stretch-108%">{title}</h2>
      {children}
    </section>
  )
}

function ContactPart() {
  const t = useT()
  const format = useFormat()
  const roles = format.list(CONTACT_READER_ROLES.map((role) => t(`roles.${role}`)))
  return (
    <PrivacySection id="privacy-contact" title={t('privacy.contact.title')}>
      <p className={TEXT}>{t('privacy.contact.intro')}</p>
      <ul className={LIST}>
        {CONTACT_FIELDS.map(([key, required]) => {
          const field = t(`landing.contact.form.${key}`)
          return <li key={key}>{required ? t('privacy.contact.required', { field }) : t('privacy.contact.optional', { field })}</li>
        })}
      </ul>
      <p className={TEXT}>{t('privacy.contact.consent')}</p>
      <p className={TEXT}>{t('privacy.contact.record')}</p>
      <p className={TEXT}>{t('privacy.contact.handlers', { roles })}</p>
      <p className={TEXT}>{CONTACTS_ON_SERVER ? t('privacy.contact.server') : t('privacy.contact.demo')}</p>
      {/* Trả lời bằng email chỉ máy chủ có (`CONTACTS_SOURCE.canReply` cùng điều kiện) */}
      {CONTACTS_ON_SERVER ? <p className={TEXT}>{t('privacy.contact.reply')}</p> : null}
    </PrivacySection>
  )
}

function RegistrationPart() {
  const t = useT()
  return (
    <PrivacySection id="privacy-registration" title={t('privacy.registration.title')}>
      {REGISTRATION_CAPABILITIES.publicSignUp ? (
        <>
          <p className={TEXT}>{t('privacy.registration.trial')}</p>
          <p className={TEXT}>{t('privacy.registration.paid')}</p>
          <p className={TEXT}>{t('privacy.registration.email')}</p>
          <p className={TEXT}>{t('privacy.registration.payment')}</p>
        </>
      ) : (
        <p className={TEXT}>{t('privacy.registration.off')}</p>
      )}
    </PrivacySection>
  )
}

function AppPart() {
  const t = useT()
  return (
    <PrivacySection id="privacy-app" title={t('privacy.app.title')}>
      {SIGN_IN_ON_SERVER ? (
        <>
          <p className={TEXT}>{t('privacy.app.signIn')}</p>
          <p className={TEXT}>{t('privacy.app.signInPage')}</p>
        </>
      ) : (
        <p className={TEXT}>{t('privacy.app.signInDemo')}</p>
      )}
      <p className={TEXT}>{t('privacy.app.tenancy')}</p>
      <p className={TEXT}>{t('privacy.app.maps')}</p>
      <p className={TEXT}>{t('privacy.app.gps')}</p>
    </PrivacySection>
  )
}

function BrowserPart() {
  const t = useT()
  return (
    <PrivacySection id="privacy-browser" title={t('privacy.browser.title')}>
      <p className={TEXT}>{t('privacy.browser.storage')}</p>
      <p className={TEXT}>{t('privacy.browser.tracking')}</p>
      <p className={TEXT}>{t('privacy.browser.assistant', { name: LUMO_NAME })}</p>
      <p className={TEXT}>{t('privacy.browser.fonts')}</p>
    </PrivacySection>
  )
}

/** Lối hỏi về dữ liệu: form liên hệ; email hỗ trợ chỉ khi `SITE_INFO` có (hôm nay chưa có, nên không có dòng đó). */
function QuestionsPart() {
  const t = useT()
  return (
    <PrivacySection id="privacy-questions" title={t('privacy.questions.title')}>
      <p className={TEXT}>{t('privacy.questions.body')}</p>
      {SITE_INFO.supportEmail === null ? null : <p className={TEXT}>{t('privacy.questions.email', { email: SITE_INFO.supportEmail })}</p>}
      <div>
        <Button asChild variant="secondary" size="lg" className={PUBLIC_TOUCH}>
          <Link to={contactPath({ type: 'INQUIRY' })}>
            {t('privacy.questions.action')}
            <ArrowRight aria-hidden strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </PrivacySection>
  )
}

/**
 * Chính sách bảo mật công khai `/chinh-sach-bao-mat` (ngoài `RequireAuth`, không quyền nào): dải trời có tiêu đề, câu mô tả và ngày cập nhật,
 * rồi một thẻ nền đặc đè lên dải chia năm mục — form liên hệ, đăng ký, khi dùng ứng dụng, trên trình duyệt, hỏi về dữ liệu. Mỗi câu nói
 * đúng điều mã hôm nay làm, chọn theo nguồn đang chạy (máy chủ hay bản demo); không hạn lưu trữ, pháp nhân hay cam kết nào chưa có. Không
 * nút chính: lối duy nhất là nút phụ mở form liên hệ.
 */
export function PrivacyPage() {
  const t = useT()
  const format = useFormat()
  return (
    <PublicPage>
      <section aria-labelledby="privacy-title" className="sky">
        <div className="flex flex-col items-start gap-3 px-4 pt-8 pb-[calc(var(--sky-overlap)+2rem)] md:px-shell lg:pt-12">
          <h1 id="privacy-title" className="m-0 font-display text-display leading-10 font-bold tracking-[-0.5px] text-balance text-sky-text font-stretch-112%">
            {t('privacy.title')}
          </h1>
          <p className="m-0 max-w-150 text-body-lg text-pretty text-sky-text-2">{t('privacy.lede')}</p>
          <p className="m-0 text-body text-sky-text-2 pointer-coarse:text-body-lg">{t('privacy.updated', { date: format.date(UPDATED_AT) })}</p>
        </div>
      </section>
      <div className="sky-overlap flex flex-col px-4 pb-14 md:px-shell lg:pb-18">
        <Card className="flex max-w-200 flex-col gap-6 p-5 sm:p-8">
          <ContactPart />
          <RegistrationPart />
          <AppPart />
          <BrowserPart />
          <QuestionsPart />
        </Card>
      </div>
    </PublicPage>
  )
}
