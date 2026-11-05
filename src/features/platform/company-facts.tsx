import { FileSignature } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { CompanyAgreement } from '@/features/billing/agreements-api'
import { useCompanyAgreementQuery } from '@/features/billing/useAgreementQuery'
import { ViewAgreementDialog } from '@/features/billing/ViewAgreementDialog'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

/**
 * Khối chỉ đọc dùng chung cho hai hộp chi tiết của màn Công ty khi nối backend (công ty, quản trị công ty): mục có tiêu đề, bảng nhãn —
 * giá trị, và thoả thuận dịch vụ của một công ty (`GET /api/agreements/company/{id}`).
 */
export type Fact = readonly [label: string, value: ReactNode]

export function FactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 font-display text-h3 font-semibold text-ink-strong">{title}</h3>
      {children}
    </section>
  )
}

export function Facts({ items }: { items: readonly Fact[] }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-3 text-body">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-3">{label}</dt>
          <dd className="m-0 min-w-0 break-words text-ink-1">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Giờ · ngày theo ngôn ngữ đang chọn; không có mốc là "—". */
export function useWhen() {
  const format = useFormat()
  return (iso: string | null) => (iso === null ? '—' : `${format.time(iso)} · ${format.date(iso)}`)
}

function AgreementBadge({ agreement }: { agreement: CompanyAgreement }) {
  const t = useT()
  if (agreement.status === 'SIGNED') return <Badge tone="success" dot="solid">{t('platform.companyDetails.agreement.signed')}</Badge>
  if (agreement.isExpired || agreement.status === 'EXPIRED') return <Badge tone="danger" dot="solid">{t('platform.companyDetails.agreement.expired')}</Badge>
  return <Badge tone="warning" dot="ring">{t('platform.companyDetails.agreement.pending', { count: agreement.hoursRemaining })}</Badge>
}

function AgreementFacts({ agreement }: { agreement: CompanyAgreement }) {
  const t = useT()
  const when = useWhen()
  const [viewing, setViewing] = useState(false)
  const facts: Fact[] = [
    [t('platform.companyDetails.agreement.status'), <AgreementBadge agreement={agreement} />],
    [t('platform.companyDetails.agreement.code'), <span className="font-mono">{agreement.agreementCode}</span>],
    [t('platform.companyDetails.agreement.deadline'), when(agreement.deadlineAt)],
  ]
  if (agreement.status === 'SIGNED') {
    facts.push([t('platform.companyDetails.agreement.signer'), agreement.signerName ?? '—'])
    facts.push([t('platform.companyDetails.agreement.signedAt'), when(agreement.signedAt)])
  }
  return (
    <>
      <Facts items={facts} />
      <Button variant="secondary" className="self-start" onClick={() => setViewing(true)}>
        <FileSignature strokeWidth={1.5} aria-hidden />
        {t('platform.companyDetails.agreement.view')}
      </Button>
      <ViewAgreementDialog agreement={agreement} open={viewing} onClose={() => setViewing(false)} />
    </>
  )
}

/** Thoả thuận dịch vụ của công ty; nơi gọi chỉ vẽ khối này khi `BILLING_CAPABILITIES.agreements`. */
export function AgreementSection({ companyId }: { companyId: string }) {
  const t = useT()
  const query = useCompanyAgreementQuery(companyId)
  let body: ReactNode
  if (query.isPending) {
    body = <div role="status" aria-label={t('platform.companyDetails.agreement.loading')} className="flex py-3"><Spinner /></div>
  } else if (query.isError) {
    body = <p className="m-0 text-body text-danger">{dataErrorMessage(query.error, t)}</p>
  } else if (query.data === null) {
    body = <p className="m-0 text-body text-ink-2">{t('platform.companyDetails.agreement.none')}</p>
  } else {
    body = <AgreementFacts agreement={query.data} />
  }
  return <FactSection title={t('platform.companyDetails.agreement.title')}>{body}</FactSection>
}
