import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT, type MessageKey } from '@/lib/i18n'
import { CONTACT_HANDLER_ROLES } from '@/lib/mock-db'
import { SITE_INFO } from '@/lib/site-info'
import { GUEST_CONTACT_SOURCE } from '../contact-api'
import { CONTACT_FORM_FIELDS } from '../contact-form'

/** Đoạn và danh sách của trang chính sách: chữ thân 16 px, độ rộng đọc tối đa khoảng 70 ký tự. */
const TEXT = 'm-0 max-w-[70ch] text-body-lg text-ink-1 text-pretty'
const LIST = 'm-0 flex max-w-[70ch] list-disc flex-col gap-2 pl-6 text-body-lg text-ink-1 marker:text-ink-3'

/** Liên kết email hỗ trợ (`SITE_INFO`), không bẻ giữa địa chỉ. */
function SupportEmail() {
  return (
    <a href={`mailto:${SITE_INFO.supportEmail}`} className="font-semibold whitespace-nowrap text-primary underline underline-offset-2 hover:text-primary-hover">
      {SITE_INFO.supportEmail}
    </a>
  )
}

function Collect() {
  const t = useT()
  return (
    <>
      <p className={TEXT}>{t('legal.collect.intro')}</p>
      <ul className={LIST}>
        {CONTACT_FORM_FIELDS.map((field) => (
          <li key={field.name}>
            <span className="font-semibold text-ink-strong">{t(field.label)}</span>
            {' — '}
            {t(field.required ? 'legal.collect.required' : 'legal.collect.optional')}
          </li>
        ))}
      </ul>
      <p className={TEXT}>{t('legal.collect.system')}</p>
      <p className={TEXT}>{t('legal.collect.consent')}</p>
    </>
  )
}

function Purpose() {
  const t = useT()
  return (
    <ul className={LIST}>
      <li>{t('legal.purpose.consult', { type: t('landing.contact.form.type') })}</li>
      <li>{t('legal.purpose.account')}</li>
      <li>{t('legal.purpose.never')}</li>
    </ul>
  )
}

/** Hai cách lưu, rồi một ô nói trang đang mở chạy theo cách nào — đọc từ nguồn dữ liệu của form liên hệ. */
function Storage() {
  const t = useT()
  return (
    <>
      <p className={TEXT}>{t('legal.storage.demo')}</p>
      <p className={TEXT}>{t('legal.storage.server')}</p>
      <p className="m-0 flex max-w-[70ch] items-start gap-3 rounded-md border border-border bg-n-50 px-4 py-3 text-body-lg text-ink-1">
        <Info aria-hidden className="mt-1 size-5 flex-none text-primary" strokeWidth={1.5} />
        {t(GUEST_CONTACT_SOURCE.storedInBrowser ? 'legal.storage.nowDemo' : 'legal.storage.nowServer')}
      </p>
    </>
  )
}

function Access() {
  const t = useT()
  return (
    <>
      <p className={TEXT}>{t('legal.access.intro')}</p>
      <ul className={LIST}>
        {CONTACT_HANDLER_ROLES.map((role) => <li key={role}>{t(`roles.${role}`)}</li>)}
      </ul>
      <p className={TEXT}>{t('legal.access.companies')}</p>
    </>
  )
}

function Retention() {
  const t = useT()
  return <p className={TEXT}>{t('legal.retention.text')}</p>
}

function Rights() {
  const t = useT()
  return (
    <>
      <ul className={LIST}>
        <li>{t('legal.rights.view')}</li>
        <li>{t('legal.rights.edit')}</li>
        <li>{t('legal.rights.delete')}</li>
      </ul>
      <p className={TEXT}>{t('legal.rights.how')} <SupportEmail /></p>
    </>
  )
}

function Browser() {
  const t = useT()
  return (
    <ul className={LIST}>
      <li>{t('legal.browser.session')}</li>
      <li>{t('legal.browser.signIn')}</li>
      <li>{t('legal.browser.fonts')}</li>
      <li>{t('legal.browser.none')}</li>
    </ul>
  )
}

/** Chỉ thông tin có trong `SITE_INFO`: điện thoại, địa chỉ, mã số thuế chưa có thì không có dòng. */
function Contact() {
  const t = useT()
  const rows: readonly { key: MessageKey; value: ReactNode }[] = [
    { key: 'legal.contact.email', value: <SupportEmail /> },
    ...(SITE_INFO.phone === null ? [] : [{ key: 'legal.contact.phone' as const, value: SITE_INFO.phone }]),
    ...(SITE_INFO.address === null ? [] : [{ key: 'legal.contact.address' as const, value: SITE_INFO.address }]),
    ...(SITE_INFO.taxCode === null ? [] : [{ key: 'legal.contact.taxCode' as const, value: SITE_INFO.taxCode }]),
  ]
  return (
    <>
      <p className={TEXT}>{t('legal.contact.intro')}</p>
      <dl className="m-0 flex max-w-[70ch] flex-col gap-2 text-body-lg">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap gap-x-3">
            <dt className="text-ink-2">{t(row.key)}</dt>
            <dd className="m-0 text-ink-1">{row.value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

/**
 * Các mục của trang chính sách bảo mật, theo thứ tự: neo `#…` (mục lục, liên kết từ nơi khác), tiêu đề và nội dung. Mọi câu nói đúng điều
 * mã nguồn đang làm (nhánh `legal` của từ điển).
 */
export const PRIVACY_SECTIONS = [
  { id: 'thong-tin-thu-thap', title: 'legal.collect.title', Body: Collect },
  { id: 'muc-dich', title: 'legal.purpose.title', Body: Purpose },
  { id: 'noi-luu', title: 'legal.storage.title', Body: Storage },
  { id: 'ai-xem', title: 'legal.access.title', Body: Access },
  { id: 'thoi-gian-luu', title: 'legal.retention.title', Body: Retention },
  { id: 'quyen-cua-ban', title: 'legal.rights.title', Body: Rights },
  { id: 'bo-nho-trinh-duyet', title: 'legal.browser.title', Body: Browser },
  { id: 'lien-he', title: 'legal.contact.title', Body: Contact },
] as const satisfies readonly { id: string; title: MessageKey; Body: () => ReactNode }[]
