import { FileSignature } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'

/** Thoả thuận dịch vụ của công ty dùng thử (chỉ khi nối backend): mã, trạng thái, người ký hoặc hạn ký, nút ký và xem văn bản. */
export function AgreementCard({ agreement, onSign, onView }: { agreement: CompanyAgreement; onSign: () => void; onView: () => void }) {
  const t = useT()
  const format = useFormat()
  const signed = agreement.status === 'SIGNED'
  const expired = !signed && (agreement.status === 'EXPIRED' || agreement.isExpired)
  return (
    <Card role="region" aria-labelledby="billing-agreement" className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className={`grid size-9 flex-none place-items-center rounded-md ${signed ? 'bg-tint-green text-tint-green-fg' : 'bg-tint-amber text-tint-amber-fg'}`}>
            <FileSignature className="size-4" strokeWidth={1.5} />
          </span>
          <span className="flex min-w-0 flex-col">
            <h2 id="billing-agreement" className="m-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong">{t('billing.agreementCard.title')}</h2>
            <span className="font-mono text-caption text-ink-3">{agreement.agreementCode}</span>
          </span>
        </div>
        {signed ? (
          <Badge tone="success" dot="solid">{t('billing.agreement.view.badgeSigned')}</Badge>
        ) : expired ? (
          <Badge tone="danger" dot="solid">{t('billing.agreement.view.badgeExpired')}</Badge>
        ) : (
          <Badge tone="warning" dot="ring">{t('billing.agreement.view.badgePending')}</Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2.5">
        <span className="min-w-0 text-small text-ink-2">
          {signed
            ? t('billing.agreementCard.signedBy', { name: agreement.signerName ?? '—' })
            : agreement.deadlineAt === null ? null : t('billing.agreementCard.deadline', { date: format.date(agreement.deadlineAt) })}
        </span>
        <span className="flex flex-none gap-1.5">
          {!signed && !expired ? <Button size="sm" variant="secondary" onClick={onSign}>{t('billing.agreementCard.sign')}</Button> : null}
          <Button size="sm" variant="secondary" onClick={onView}>{t('billing.agreementCard.view')}</Button>
        </span>
      </div>
    </Card>
  )
}
