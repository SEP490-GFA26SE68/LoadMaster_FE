import { FileSignature } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useFormat, useT } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 font-medium break-words text-ink-strong">{children}</dd>
    </div>
  )
}

/** Xem thoả thuận dịch vụ (chỉ khi nối backend): trạng thái, hạn ký, người ký, thời điểm và địa chỉ IP khi ký, toàn văn thoả thuận. */
export function ViewAgreementDialog({ agreement, open, onClose }: { agreement: CompanyAgreement | null; open: boolean; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  if (!agreement) return null
  const signed = agreement.status === 'SIGNED'
  const expired = !signed && (agreement.status === 'EXPIRED' || agreement.isExpired)
  const dateTime = (iso: string | null) => (iso === null ? '—' : `${format.date(iso)} ${format.time(iso)}`)
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="w-180">
        <DialogHeader
          icon={FileSignature}
          tone={signed ? 'success' : expired ? 'danger' : 'warning'}
          title={agreement.title}
          description={`${t('billing.agreement.code', { code: agreement.agreementCode })} · ${t('billing.agreement.company', { name: agreement.companyName })}`}
        />
        <div className="flex flex-col gap-5 px-7 pt-5 pb-6">
          <div>
            {signed ? (
              <Badge tone="success" dot="solid">{t('billing.agreement.view.badgeSigned')}</Badge>
            ) : expired ? (
              <Badge tone="danger" dot="solid">{t('billing.agreement.view.badgeExpired')}</Badge>
            ) : (
              <Badge tone="warning" dot="ring">{t('billing.agreement.view.badgePending')}</Badge>
            )}
          </div>
          <section aria-labelledby="agreement-legal" className="flex flex-col gap-3">
            <h3 id="agreement-legal" className="m-0 text-small font-semibold text-ink-2">{t('billing.agreement.view.legalTitle')}</h3>
            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label={t('billing.agreement.view.statusLabel')}>
                {t(signed ? 'billing.agreement.view.statusSigned' : expired ? 'billing.agreement.view.statusExpired' : 'billing.agreement.view.statusPending')}
              </Field>
              <Field label={t('billing.agreement.view.deadlineLabel')}>
                {dateTime(agreement.deadlineAt)}
                {!signed && !expired ? ` · ${t('billing.agreement.view.hoursLeft', { hours: agreement.hoursRemaining })}` : null}
              </Field>
              {signed ? (
                <>
                  <Field label={t('billing.agreement.view.signerLabel')}>{agreement.signerName ?? '—'}</Field>
                  <Field label={t('billing.agreement.view.signedAtLabel')}>{dateTime(agreement.signedAt)}</Field>
                  <Field label={t('billing.agreement.view.signerPhoneLabel')}><span className="font-mono tabular-nums">{agreement.signerPhone ?? '—'}</span></Field>
                  <Field label={t('billing.agreement.view.ipLabel')}><span className="font-mono">{agreement.ipAddress ?? '—'}</span></Field>
                </>
              ) : null}
            </dl>
          </section>
          <section aria-labelledby="agreement-text" className="flex flex-col gap-1.5">
            <h3 id="agreement-text" className="m-0 text-small font-semibold text-ink-2">{t('billing.agreement.view.contentTitle')}</h3>
            <div tabIndex={0} className="max-h-72 overflow-y-auto rounded-md border border-border bg-surface p-4 text-small whitespace-pre-wrap text-ink-1">
              {agreement.content}
            </div>
          </section>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t('billing.agreement.view.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
