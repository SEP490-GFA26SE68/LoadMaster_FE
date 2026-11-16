import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'

/** Máy chủ đã nhận đơn dùng thử, chờ đội nền tảng duyệt. */
export function TrialSubmitted({ companyName, taxCode, email }: { companyName: string; taxCode: string; email: string }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="size-10" />
      </div>
      <h2 className="mt-4 font-display text-h2 font-bold text-ink-strong">{t('trialRegistration.success.title')}</h2>
      <p className="mt-2 max-w-md text-body text-ink-2">{t('trialRegistration.success.description')}</p>

      <div className="mt-6 w-full max-w-lg rounded-lg border border-primary/20 bg-primary/5 p-4 text-left">
        <div className="flex flex-col gap-1 text-small text-ink-strong">
          <strong>{t('trialRegistration.success.receivedInfo')}</strong>
          <span>{t('trialRegistration.success.company', { name: companyName })}</span>
          <span>{t('trialRegistration.success.taxCode', { code: taxCode })}</span>
          <span>{t('trialRegistration.success.email', { email })}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="primary">
          <Link to="/gioi-thieu">{t('trialRegistration.success.backHome')}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/dang-nhap">{t('trialRegistration.success.toLogin')}</Link>
        </Button>
      </div>
    </div>
  )
}

/** Máy chủ kiểm sơ bộ và từ chối đơn; người dùng sửa thông tin hoặc liên hệ. */
export function TrialRejected({ reason, onEdit }: { reason: string | undefined; onEdit: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertCircle className="size-10" />
      </div>
      <h2 className="mt-4 font-display text-h2 font-bold text-ink-strong">{t('trialRegistration.rejected.title')}</h2>
      <p className="mt-2 max-w-md text-body text-ink-2">{t('trialRegistration.rejected.description')}</p>

      <div className="mt-6 w-full max-w-lg rounded-lg border border-danger/20 bg-danger/5 p-4 text-left">
        <div className="flex flex-col gap-1 text-small text-danger">
          <strong>{t('trialRegistration.rejected.reasonHeader')}</strong>
          <span>{reason ?? t('trialRegistration.rejected.defaultReason')}</span>
        </div>
      </div>

      <p className="mt-4 max-w-md text-caption text-ink-3">{t('trialRegistration.rejected.emailNote')}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" variant="secondary" onClick={onEdit}>
          {t('trialRegistration.rejected.editInfo')}
        </Button>
        <Button asChild variant="primary">
          <Link to="/gioi-thieu#lien-he">{t('trialRegistration.rejected.contactSupport')}</Link>
        </Button>
      </div>
    </div>
  )
}
