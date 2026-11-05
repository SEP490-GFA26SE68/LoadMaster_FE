import { RotateCcw, ScrollText } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Banner } from '@/components/Banner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { usesBackend } from '@/lib/backend-config'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { CONTRACT_STATUSES, type ContractStatus, type SubscriptionContract } from './contracts-api'
import { FactSection, Facts } from './company-facts'
import { ContractPrice, ContractStatusBadge, createContractColumns, OpenContractContext } from './subscription-history-table'
import { useContractsQuery } from './useContractsQuery'

const ON_BACKEND = usesBackend('billing')
const STATUS_FILTER = 'trang-thai'
const FILTERS = [STATUS_FILTER] as const
const STATUS_SLUGS: Record<ContractStatus, string> = { ACTIVE: 'hieu-luc', TRIAL: 'dung-thu', EXPIRED: 'het-han', CANCELLED: 'da-huy' }

/**
 * Lịch sử gói cước `/nen-tang/lich-su-goi`: hợp đồng gói của mọi công ty, bắt đầu gần nhất trước. Đọc hết rồi tìm (công ty, mã, gói) và
 * lọc trạng thái ở client, trên URL như mọi bảng. Bấm tên công ty mở chi tiết hợp đồng. Kho mẫu chỉ giữ gói hiện tại của mỗi công ty nên
 * màn nói rõ điều đó.
 */
export function SubscriptionHistoryPage() {
  const t = useT()
  const query = useContractsQuery()
  const list = useListUrlState<(typeof FILTERS)[number]>({ filters: FILTERS })
  const [viewing, setViewing] = useState<SubscriptionContract | null>(null)

  const all = useMemo(() => query.data ?? [], [query.data])
  const status = list.filters[STATUS_FILTER]
  const rows = useMemo(
    () => all.filter((contract) =>
      matchesQuery([contract.companyName, contract.companyCode, contract.planName, contract.planCode], list.query)
      && (status === '' || (contract.status !== null && STATUS_SLUGS[contract.status] === status))),
    [all, list.query, status],
  )
  const columns = useMemo(() => createContractColumns(t), [t])
  const fields: FilterField<(typeof FILTERS)[number]>[] = [{
    kind: 'select', name: STATUS_FILTER, label: t('platform.subscriptionHistory.filters.status'), allLabel: t('platform.subscriptionHistory.filters.allStatuses'),
    options: CONTRACT_STATUSES.map((value) => ({ value: STATUS_SLUGS[value], label: t(`platform.subscriptionHistory.status.${value}`) })),
  }]

  let body: ReactNode
  if (query.isPending) {
    body = <div role="status" aria-label={t('platform.subscriptionHistory.loading')} className="flex justify-center py-16"><Spinner /></div>
  } else if (query.isError) {
    body = (
      <EmptyState
        mascot="error"
        title={dataErrorMessage(query.error, t)}
        action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('platform.subscriptionHistory.retry')}</Button>}
      />
    )
  } else if (all.length === 0) {
    body = <EmptyState mascot="empty" title={t('platform.subscriptionHistory.empty')} description={t('platform.subscriptionHistory.emptyDescription')} />
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {ON_BACKEND ? null : <Banner tone="info">{t('platform.subscriptionHistory.mockNote')}</Banner>}
        <section aria-label={t('platform.subscriptionHistory.title')} className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
          <FilterBar
            layout="toolbar"
            className="min-h-14 border-b border-border px-4 py-2"
            query={list.query}
            onQueryChange={list.setQuery}
            searchLabel={t('platform.subscriptionHistory.search')}
            fields={fields}
            values={list.filters}
            onValueChange={list.setFilter}
            onClear={list.clearAll}
          />
          <OpenContractContext value={setViewing}>
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(contract) => contract.id}
              density="roomy"
              appearance="paper"
              pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
              emptyMessage={t('platform.subscriptionHistory.empty')}
              isFiltering={list.isFiltering}
              onClearFilters={list.clearAll}
              noMatchMessage={t('platform.subscriptionHistory.noMatch')}
            />
          </OpenContractContext>
        </section>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('platform.subscriptionHistory.title')}
        meta={query.isSuccess ? t('platform.subscriptionHistory.count', { count: all.length }) : undefined}
        description={t('platform.subscriptionHistory.description')}
      />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">{body}</div>
      <ContractDialog contract={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function ContractDialog({ contract, onClose }: { contract: SubscriptionContract | null; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const day = (iso: string | null) => (iso === null ? '—' : format.date(iso))
  const credits = (value: SubscriptionContract) => {
    if (value.creditsGranted !== null) return <span className="font-mono tabular-nums">{format.integer(value.creditsGranted)}</span>
    return value.planTier === 'ULTIMATE' ? t('platform.subscriptionHistory.detail.unlimited') : '—'
  }
  const autoRenew = (value: boolean | null) => {
    if (value === null) return '—'
    return t(value ? 'platform.subscriptionHistory.detail.autoRenewOn' : 'platform.subscriptionHistory.detail.autoRenewOff')
  }
  return (
    <Dialog open={contract !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="w-160">
        {contract === null ? null : (
          <>
            <DialogHeader icon={ScrollText} title={contract.companyName} description={t('platform.subscriptionHistory.detail.description')} />
            <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto px-7 py-5">
              <FactSection title={t('platform.subscriptionHistory.detail.plan')}>
                <Facts
                  items={[
                    [t('platform.subscriptionHistory.detail.planName'), (
                      <span className="flex flex-wrap items-center gap-2">
                        {contract.planName}
                        {contract.planTier ? <Badge tone="cyan" shape="tag">{contract.planTier}</Badge> : null}
                      </span>
                    )],
                    [t('platform.subscriptionHistory.detail.price'), <ContractPrice contract={contract} />],
                    [t('platform.subscriptionHistory.detail.cycle'), contract.billingCycle ? t(`platform.subscriptionHistory.detail.cycles.${contract.billingCycle}`) : '—'],
                    [t('platform.subscriptionHistory.detail.credits'), credits(contract)],
                    [t('platform.subscriptionHistory.detail.status'), <ContractStatusBadge status={contract.status} />],
                  ]}
                />
              </FactSection>
              <FactSection title={t('platform.subscriptionHistory.detail.period')}>
                <Facts
                  items={[
                    [t('platform.subscriptionHistory.detail.start'), day(contract.startedAt)],
                    [t('platform.subscriptionHistory.detail.end'), day(contract.expiresAt)],
                    [t('platform.subscriptionHistory.detail.autoRenew'), autoRenew(contract.autoRenew)],
                  ]}
                />
              </FactSection>
              <FactSection title={t('platform.subscriptionHistory.detail.company')}>
                <Facts
                  items={[
                    [t('platform.subscriptionHistory.detail.companyCode'), contract.companyCode ? <span className="font-mono">{contract.companyCode}</span> : '—'],
                    [t('platform.subscriptionHistory.detail.admin'), contract.adminName ?? '—'],
                    [t('platform.subscriptionHistory.detail.email'), contract.adminEmail ?? '—'],
                    [t('platform.subscriptionHistory.detail.phone'), contract.adminPhone ? <span className="font-mono">{contract.adminPhone}</span> : '—'],
                  ]}
                />
              </FactSection>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">{t('platform.subscriptionHistory.detail.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
