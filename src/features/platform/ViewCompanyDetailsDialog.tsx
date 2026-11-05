import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { BILLING_CAPABILITIES } from '@/features/billing/billing-api'
import { useFormat, useT } from '@/lib/i18n'
import { tierBesideName } from '@/lib/plan-tier'
import type { ServerCompanyRow } from './companies-server-api'
import { AgreementSection, FactSection, Facts, type Fact } from './company-facts'
import { ServerCompanyStatusBadge, ServerPlanStatusBadge } from './server-companies-table'

/**
 * Chi tiết một công ty khi nối backend: hồ sơ trên máy chủ, gói cước theo hợp đồng và — khi nhóm `billing` cũng nối backend — thoả thuận
 * dịch vụ của công ty dùng thử. Chỉ đọc; "Sửa thông tin" mở form sửa của màn. Phần chưa đọc được nói vậy, không hiện số 0.
 */
export function ViewCompanyDetailsDialog({ row, plansLoaded, onClose, onEdit }: {
  row: ServerCompanyRow | null
  plansLoaded: boolean
  onClose: () => void
  onEdit: (row: ServerCompanyRow) => void
}) {
  const t = useT()
  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="w-160">
        {row === null ? null : (
          <>
            <DialogHeader icon={Building2} title={row.company.name} description={t('platform.companyDetails.description', { code: row.company.code })} />
            <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto px-7 py-5">
              <CompanySection row={row} />
              <PlanSection row={row} plansLoaded={plansLoaded} />
              {BILLING_CAPABILITIES.agreements ? <AgreementSection companyId={row.company.id} /> : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">{t('platform.companyDetails.close')}</Button>
              </DialogClose>
              <Button variant="primary" onClick={() => onEdit(row)}>{t('platform.companyDetails.edit')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CompanySection({ row }: { row: ServerCompanyRow }) {
  const t = useT()
  const format = useFormat()
  const { company } = row
  const missing = <span className="text-ink-3">{t('platform.companyDetails.company.notUpdated')}</span>
  return (
    <FactSection title={t('platform.companyDetails.company.title')}>
      <Facts
        items={[
          [t('platform.companyDetails.company.taxCode'), company.taxCode ? <span key="fact-56" className="font-mono">{company.taxCode}</span> : missing],
          [t('platform.companyDetails.company.billingEmail'), company.billingEmail || missing],
          [t('platform.companyDetails.company.status'), <ServerCompanyStatusBadge key="fact-58" status={company.status} />],
          [t('platform.companyDetails.company.createdAt'), company.createdAt ? format.date(company.createdAt) : missing],
        ]}
      />
    </FactSection>
  )
}

function PlanSection({ row, plansLoaded }: { row: ServerCompanyRow; plansLoaded: boolean }) {
  const t = useT()
  const format = useFormat()
  const users: Fact = [t('platform.companyDetails.plan.users'), row.userCount === null ? '—' : format.integer(row.userCount)]
  if (!plansLoaded || row.plan === null) {
    return (
      <FactSection title={t('platform.companyDetails.plan.title')}>
        <p className="m-0 text-body text-ink-2">{t(plansLoaded ? 'platform.companyDetails.plan.none' : 'platform.companyDetails.plan.notLoaded')}</p>
        <Facts items={[users]} />
      </FactSection>
    )
  }
  const { plan } = row
  const tier = plan.tier === null ? null : tierBesideName(plan.name, t(`common.planTiers.${plan.tier}`))
  return (
    <FactSection title={t('platform.companyDetails.plan.title')}>
      <Facts
        items={[
          [
            t('platform.companyDetails.plan.name'),
            <span key="fact-86" className="flex flex-wrap items-center gap-2">{plan.name}{tier === null ? null : <Badge tone="cyan" shape="tag">{tier}</Badge>}</span>,
          ],
          [t('platform.companyDetails.plan.status'), <ServerPlanStatusBadge key="fact-88" status={plan.status} />],
          [t('platform.companyDetails.plan.expires'), plan.expiresAt ? format.date(plan.expiresAt) : '—'],
          users,
        ]}
      />
    </FactSection>
  )
}
