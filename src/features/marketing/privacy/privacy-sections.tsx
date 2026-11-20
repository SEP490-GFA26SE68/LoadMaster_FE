import { LUMO_NAME } from '@/components/brand/Lumo'
import { CONTACT_READER_ROLES } from '@/features/contacts/contact-readers'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { backendConfig, usesBackend } from '@/lib/backend-config'
import { useFormat, useT } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { TRIAL_AGREEMENT_HOURS, TRIAL_PURGE_DAYS } from '../legal/legal-facts'
import { LegalList, LegalText, type LegalSectionSpec } from '../legal/LegalParts'

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

const PURPOSES = ['contact', 'signUp', 'signIn', 'operate', 'billing', 'support'] as const

/** Hai vai trò có quyền `monitoring.view` — thấy vị trí xe ở màn Giám sát. */
const LOCATION_READERS: readonly Role[] = ['dispatcher', 'companyManager']

/** Nguồn dữ liệu đang chạy: mỗi mục có câu riêng cho máy chủ và cho bản demo (kho mẫu trong trình duyệt). */
const CONTACTS_ON_SERVER = usesBackend('contacts')
const SIGN_IN_ON_SERVER = backendConfig.authSource === 'keycloak'
const DRIVER_ON_SERVER = usesBackend('driver')
/** Thoả thuận dịch vụ thử nghiệm (`agreements-api.ts`) và bảng lương tài xế chỉ có khi nhóm của chúng nối máy chủ. */
const BILLING_ON_SERVER = usesBackend('billing')
const PAYROLL_ON_SERVER = usesBackend('payroll')
/** Trợ lý AI: câu hỏi đi qua máy chủ tới Anthropic. Tắt thì Lumo trả lời từ bộ câu soạn sẵn trên trình duyệt. */
const ASSISTANT_ON_SERVER = usesBackend('assistant')

/**
 * Mười hai mục của Chính sách bảo mật theo thứ tự đọc: phạm vi và mục đích → từng lối dữ liệu đi vào (form liên hệ, đăng ký, tài khoản,
 * dữ liệu vận hành, thiết bị, bản thử và trợ lý) → nơi dữ liệu tới (bên thứ ba, trình duyệt) → thời gian lưu, quyền của bạn, thay đổi.
 * Câu chọn theo nguồn đang chạy; số (hạn ký thoả thuận, ngày xoá) là tham số từ `legal-facts`.
 */
export function usePrivacySections(): LegalSectionSpec[] {
  const t = useT()
  const format = useFormat()
  const roles = (list: readonly Role[]) => format.list(list.map((role) => t(`roles.${role}`)))
  const signUpOpen = REGISTRATION_CAPABILITIES.publicSignUp

  return [
    {
      id: 'pham-vi',
      title: t('privacy.scope.title'),
      content: (
        <>
          <LegalText>{t('privacy.scope.body')}</LegalText>
          <LegalText>{t('privacy.scope.purposesIntro')}</LegalText>
          <LegalList>{PURPOSES.map((key) => <li key={key}>{t(`privacy.scope.purposes.${key}`)}</li>)}</LegalList>
          <LegalText>{t('privacy.scope.noAds')}</LegalText>
        </>
      ),
    },
    {
      id: 'form-lien-he',
      title: t('privacy.contact.title'),
      content: (
        <>
          <LegalText>{t('privacy.contact.intro')}</LegalText>
          <LegalList>
            {CONTACT_FIELDS.map(([key, required]) => {
              const field = t(`landing.contact.form.${key}`)
              return <li key={key}>{required ? t('privacy.contact.required', { field }) : t('privacy.contact.optional', { field })}</li>
            })}
          </LegalList>
          <LegalText>{t('privacy.contact.consent')}</LegalText>
          <LegalText>{t('privacy.contact.record')}</LegalText>
          <LegalText>{t('privacy.contact.handlers', { roles: roles(CONTACT_READER_ROLES) })}</LegalText>
          <LegalText>{CONTACTS_ON_SERVER ? t('privacy.contact.server') : t('privacy.contact.demo')}</LegalText>
          {/* Trả lời bằng email chỉ máy chủ có (`CONTACTS_SOURCE.canReply` cùng điều kiện) */}
          {CONTACTS_ON_SERVER ? <LegalText>{t('privacy.contact.reply')}</LegalText> : null}
        </>
      ),
    },
    {
      id: 'dang-ky',
      title: t('privacy.registration.title'),
      content: signUpOpen ? (
        <>
          <LegalText>{t('privacy.registration.trial')}</LegalText>
          <LegalText>{t('privacy.registration.paid')}</LegalText>
          <LegalText>{t('privacy.registration.email')}</LegalText>
          <LegalText>{t('privacy.registration.payment')}</LegalText>
        </>
      ) : (
        <LegalText>{t('privacy.registration.off')}</LegalText>
      ),
    },
    {
      id: 'tai-khoan',
      title: t('privacy.account.title'),
      content: (
        <>
          <LegalText>{t('privacy.account.data')}</LegalText>
          {SIGN_IN_ON_SERVER ? (
            <>
              <LegalText>{t('privacy.account.signIn')}</LegalText>
              <LegalText>{t('privacy.account.signInPage')}</LegalText>
              <LegalText>{t('privacy.account.reset')}</LegalText>
            </>
          ) : (
            <LegalText>{t('privacy.account.signInDemo')}</LegalText>
          )}
          {BILLING_ON_SERVER ? <LegalText>{t('privacy.account.agreement')}</LegalText> : null}
          <LegalText>{t('privacy.account.audit')}</LegalText>
        </>
      ),
    },
    {
      id: 'du-lieu-van-hanh',
      title: t('privacy.company.title'),
      content: (
        <>
          <LegalText>{t('privacy.company.data')}</LegalText>
          {PAYROLL_ON_SERVER ? <LegalText>{t('privacy.company.payroll')}</LegalText> : null}
          <LegalText>{t('privacy.company.support')}</LegalText>
          <LegalText>{t('privacy.company.recipients')}</LegalText>
          <LegalText>{t('privacy.company.tenancy')}</LegalText>
        </>
      ),
    },
    {
      id: 'thiet-bi',
      title: t('privacy.device.title'),
      content: (
        <>
          <LegalText>{t('privacy.device.gps')}</LegalText>
          <LegalText>{t('privacy.device.gpsReaders', { roles: roles(LOCATION_READERS) })}</LegalText>
          {DRIVER_ON_SERVER ? null : <LegalText>{t('privacy.device.gpsDemo')}</LegalText>}
          <LegalText>{t('privacy.device.guidance')}</LegalText>
          <LegalText>{t('privacy.device.camera')}</LegalText>
        </>
      ),
    },
    {
      id: 'ban-thu-va-tro-ly',
      title: t('privacy.local.title'),
      content: (
        <>
          <LegalText>{t('privacy.local.tryOut')}</LegalText>
          {ASSISTANT_ON_SERVER ? <LegalText>{t('privacy.local.tryDescribe')}</LegalText> : null}
          <LegalText>{t(ASSISTANT_ON_SERVER ? 'privacy.local.assistantAi' : 'privacy.local.assistant', { name: LUMO_NAME })}</LegalText>
        </>
      ),
    },
    {
      id: 'ben-thu-ba',
      title: t('privacy.thirdParties.title'),
      content: (
        <>
          <LegalText>{t('privacy.thirdParties.intro')}</LegalText>
          <LegalList>
            {SIGN_IN_ON_SERVER ? <li>{t('privacy.thirdParties.brevo')}</li> : null}
            {SIGN_IN_ON_SERVER ? <li>{t('privacy.thirdParties.vnpay')}</li> : null}
            {ASSISTANT_ON_SERVER ? <li>{t('privacy.thirdParties.anthropic', { name: LUMO_NAME })}</li> : null}
            <li>{t('privacy.thirdParties.goong')}</li>
            <li>{t('privacy.thirdParties.google')}</li>
          </LegalList>
          {SIGN_IN_ON_SERVER ? null : <LegalText>{t('privacy.thirdParties.demo')}</LegalText>}
          <LegalText>{t('privacy.thirdParties.maps')}</LegalText>
          <LegalText>{t('privacy.thirdParties.fonts')}</LegalText>
        </>
      ),
    },
    {
      id: 'trinh-duyet',
      title: t('privacy.browser.title'),
      content: (
        <>
          <LegalText>{t('privacy.browser.storage')}</LegalText>
          <LegalText>{t('privacy.browser.tracking')}</LegalText>
        </>
      ),
    },
    {
      id: 'thoi-gian-luu',
      title: t('privacy.retention.title'),
      content: (
        <>
          <LegalText>{t('privacy.retention.browser')}</LegalText>
          {SIGN_IN_ON_SERVER ? (
            <>
              <LegalText>{t('privacy.retention.trial', { hours: TRIAL_AGREEMENT_HOURS, days: TRIAL_PURGE_DAYS })}</LegalText>
              <LegalText>{t('privacy.retention.open')}</LegalText>
            </>
          ) : (
            <LegalText>{t('privacy.retention.demo')}</LegalText>
          )}
        </>
      ),
    },
    {
      id: 'quyen-cua-ban',
      title: t('privacy.rights.title'),
      content: (
        <>
          <LegalText>{t('privacy.rights.body')}</LegalText>
          <LegalText>{t('privacy.rights.intro')}</LegalText>
          <LegalList>
            <li>{t('privacy.rights.see')}</li>
            <li>{t('privacy.rights.fix')}</li>
            <li>{t('privacy.rights.remove')}</li>
          </LegalList>
          <LegalText>{t('privacy.rights.company')}</LegalText>
        </>
      ),
    },
    {
      id: 'thay-doi',
      title: t('privacy.changes.title'),
      content: <LegalText>{t('privacy.changes.body')}</LegalText>,
    },
  ]
}
