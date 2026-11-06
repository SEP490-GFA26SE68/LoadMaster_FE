import { FileSignature, Lock } from 'lucide-react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'

/** Nhắc ký thoả thuận dịch vụ thử nghiệm (chỉ khi nối backend): chờ ký thì kèm số giờ còn lại và nút ký; quá hạn thì báo tài khoản bị khoá. */
export function TrialAgreementBanner({ agreement, onOpenSignDialog }: { agreement?: CompanyAgreement | null; onOpenSignDialog: () => void }) {
  const t = useT()
  if (!agreement || agreement.status === 'SIGNED') return null
  if (agreement.status === 'EXPIRED' || agreement.isExpired) {
    return (
      <Banner tone="danger" icon={Lock} role="alert">
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{t('billing.agreement.banner.expiredTitle')}</span>
          <span className="text-small text-ink-2">{t('billing.agreement.banner.expiredBody')}</span>
        </span>
      </Banner>
    )
  }
  return (
    <Banner
      tone="warning"
      action={
        <Button variant="secondary" size="sm" onClick={onOpenSignDialog}>
          <FileSignature strokeWidth={1.5} />
          {t('billing.agreement.banner.signNow')}
        </Button>
      }
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">
          {t('billing.agreement.banner.pendingTitle')} · {t('billing.agreement.banner.hoursLeft', { hours: agreement.hoursRemaining })}
        </span>
        <span className="text-small text-ink-2">{t('billing.agreement.banner.pendingBody')}</span>
      </span>
    </Banner>
  )
}
