import { PUBLIC_PRICING, PUBLIC_PRIVACY } from '@/features/auth/landing'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { backendConfig, usesBackend } from '@/lib/backend-config'
import { useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import { FOOTER_ROLES } from '../footer/footer-links'
import { TRIAL_AGREEMENT_HOURS, TRIAL_PURGE_DAYS } from '../legal/legal-facts'
import { LegalLink, LegalList, LegalText, type LegalSectionSpec } from '../legal/LegalParts'

const SCOPE_ITEMS = ['plan', 'optimize', 'operate', 'monitor'] as const
const RESULT_CHECKS = ['load', 'securing', 'safety'] as const
const CONDUCT_ITEMS = ['share', 'access', 'attack', 'content', 'copy'] as const

/** Nguồn đang chạy: đăng nhập bằng máy chủ thì có khoá theo gói cước; chuyến của kho mẫu thì kết quả tối ưu mang MOCK RESULT. */
const SIGN_IN_ON_SERVER = backendConfig.authSource === 'keycloak'
const TRIPS_ON_SERVER = usesBackend('trips')

/**
 * Mười một mục của Điều khoản sử dụng theo thứ tự đọc: dịch vụ là gì → tài khoản, dùng thử, gói cước và credit → trách nhiệm khi dùng
 * kết quả và dữ liệu → việc không được làm, tạm ngừng, giới hạn trách nhiệm → thay đổi và liên hệ. Câu chọn theo nguồn đang chạy (đăng ký
 * công khai, máy chủ hay bản demo); mọi số là tham số — credit và kỳ gói từ `BILLING_CONSTANTS`, hai hạn của dùng thử từ `legal-facts`.
 */
export function useTermsSections(): LegalSectionSpec[] {
  const t = useT()
  const format = useFormat()
  const signUpOpen = REGISTRATION_CAPABILITIES.publicSignUp
  const roles = format.list(FOOTER_ROLES.map((role) => t(`roles.${role}`)))

  return [
    {
      id: 'pham-vi-dich-vu',
      title: t('terms.scope.title'),
      content: (
        <>
          <LegalText>{t('terms.scope.body')}</LegalText>
          <LegalList>{SCOPE_ITEMS.map((key) => <li key={key}>{t(`terms.scope.items.${key}`)}</li>)}</LegalList>
          <LegalText>{t('terms.scope.agree')}</LegalText>
          <LegalText>{t('terms.scope.availability')}</LegalText>
        </>
      ),
    },
    {
      id: 'tai-khoan',
      title: t('terms.account.title'),
      content: (
        <>
          <LegalText>{t('terms.account.company', { roles })}</LegalText>
          <LegalText>{signUpOpen ? t('terms.account.adminSelf') : t('terms.account.admin')}</LegalText>
          <LegalText>{t('terms.account.password')}</LegalText>
          <LegalText>{t('terms.account.responsible')}</LegalText>
        </>
      ),
    },
    {
      id: 'dung-thu',
      title: t('terms.trial.title'),
      content: signUpOpen ? (
        <>
          <LegalText>{t('terms.trial.request')}</LegalText>
          <LegalText>{t('terms.trial.agreement', { hours: TRIAL_AGREEMENT_HOURS })}</LegalText>
          <LegalText>{t('terms.trial.purge', { purgeDays: TRIAL_PURGE_DAYS })}</LegalText>
          <LegalText>{t('terms.trial.after')}</LegalText>
        </>
      ) : (
        <LegalText>{t('terms.trial.off')}</LegalText>
      ),
    },
    {
      id: 'goi-cuoc-va-credit',
      title: t('terms.billing.title'),
      content: (
        <>
          <LegalText>{t('terms.billing.plans', { provisional: t('common.provisionalPlan') })}</LegalText>
          <LegalLink to={PUBLIC_PRICING}>{t('terms.billing.pricingLink')}</LegalLink>
          <LegalText>{t('terms.billing.period', { days: BILLING_CONSTANTS.periodDays })}</LegalText>
          <LegalText>{t('terms.billing.cost', { cost: BILLING_CONSTANTS.optimizationCost })}</LegalText>
          <LegalText>{t('terms.billing.topUp', { percent: BILLING_CONSTANTS.lowCreditRatio * 100 })}</LegalText>
          <LegalText>{t('terms.billing.renew')}</LegalText>
          <LegalText>{t('terms.billing.cancel')}</LegalText>
          <LegalText>{SIGN_IN_ON_SERVER ? t('terms.billing.expiredServer') : t('terms.billing.expiredDemo')}</LegalText>
          <LegalText>{t('terms.billing.payment')}</LegalText>
          {SIGN_IN_ON_SERVER ? null : <LegalText>{t('terms.billing.paymentDemo')}</LegalText>}
        </>
      ),
    },
    {
      id: 'ket-qua-toi-uu',
      title: t('terms.results.title'),
      content: (
        <>
          <LegalText>{t('terms.results.estimate')}</LegalText>
          <LegalText>{t('terms.results.checkIntro')}</LegalText>
          <LegalList>{RESULT_CHECKS.map((key) => <li key={key}>{t(`terms.results.check.${key}`)}</li>)}</LegalList>
          <LegalText>{t('terms.results.input')}</LegalText>
          <LegalText>{t('terms.results.approval')}</LegalText>
          {/* Phương án của máy chủ không mang nhãn MOCK RESULT */}
          {TRIPS_ON_SERVER ? null : <LegalText>{t('terms.results.mock')}</LegalText>}
        </>
      ),
    },
    {
      id: 'du-lieu-cong-ty',
      title: t('terms.data.title'),
      content: (
        <>
          <LegalText>{t('terms.data.owner')}</LegalText>
          <LegalText>{t('terms.data.tenancy')}</LegalText>
          <LegalText>{t('terms.data.privacy')}</LegalText>
          <LegalLink to={PUBLIC_PRIVACY}>{t('terms.data.privacyLink')}</LegalLink>
        </>
      ),
    },
    {
      id: 'hanh-vi-khong-duoc-phep',
      title: t('terms.conduct.title'),
      content: (
        <>
          <LegalText>{t('terms.conduct.intro')}</LegalText>
          <LegalList>{CONDUCT_ITEMS.map((key) => <li key={key}>{t(`terms.conduct.items.${key}`)}</li>)}</LegalList>
        </>
      ),
    },
    {
      id: 'tam-ngung-cham-dut',
      title: t('terms.termination.title'),
      content: (
        <>
          <LegalText>{t('terms.termination.company')}</LegalText>
          <LegalText>{t('terms.termination.platform')}</LegalText>
          {/* Khoá theo gói cước chỉ có khi đăng nhập bằng máy chủ; bản demo không khoá */}
          {SIGN_IN_ON_SERVER ? <LegalText>{t('terms.termination.plan')}</LegalText> : null}
          <LegalText>{t('terms.termination.leave')}</LegalText>
        </>
      ),
    },
    {
      id: 'gioi-han-trach-nhiem',
      title: t('terms.liability.title'),
      content: (
        <>
          <LegalText>{t('terms.liability.asIs')}</LegalText>
          <LegalText>{t('terms.liability.limits')}</LegalText>
        </>
      ),
    },
    {
      id: 'thay-doi-dieu-khoan',
      title: t('terms.changes.title'),
      content: <LegalText>{t('terms.changes.body')}</LegalText>,
    },
    {
      id: 'lien-he',
      title: t('terms.contact.title'),
      content: (
        <>
          <LegalText>{t('terms.contact.guest')}</LegalText>
          <LegalText>{t('terms.contact.user')}</LegalText>
        </>
      ),
    },
  ]
}
