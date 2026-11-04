import { RotateCcw } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { TabCount, Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { BILLING_CAPABILITIES } from './billing-api'
import { CreditLedgerTable } from './CreditLedgerTable'
import { InvoicesTable } from './InvoicesTable'
import { PaymentsTable } from './PaymentsTable'
import { useCreditTransactionsQuery, useInvoicesQuery, usePaymentsQuery } from './useBillingQuery'

/** Tab lịch sử trên URL (`?lich-su=thanh-toan` | `hoa-don`); vắng, hoặc tab nguồn dữ liệu không có, là lịch sử credit. */
const HISTORY_TAB = 'lich-su'
type HistoryTab = 'credit' | 'payments' | 'invoices'
const TAB_SLUGS: Readonly<Record<HistoryTab, string>> = { credit: '', payments: 'thanh-toan', invoices: 'hoa-don' }
const TABS: readonly HistoryTab[] = [
  'credit',
  ...(BILLING_CAPABILITIES.payments ? (['payments'] as const) : []),
  ...(BILLING_CAPABILITIES.invoices ? (['invoices'] as const) : []),
]

const tabOf = (slug: string): HistoryTab => TABS.find((tab) => tab !== 'credit' && TAB_SLUGS[tab] === slug) ?? 'credit'
const isHistoryTab = (value: string): value is HistoryTab => TABS.some((tab) => tab === value)

/**
 * Lịch sử của gói và credit (FE-8-03): sổ cái credit; thanh toán khi nguồn dữ liệu có (kho mẫu — mỗi thanh toán chờ có nút Trả); hoá
 * đơn khi nối backend. Mỗi tab phân trang qua `useListUrlState`; tab đang mở đọc lỗi thì nói lỗi kèm nút thử lại, không giả là danh sách rỗng.
 */
export function BillingHistoryCard() {
  const t = useT()
  const transactions = useCreditTransactionsQuery()
  const payments = usePaymentsQuery()
  const invoices = useInvoicesQuery()
  const list = useListUrlState<typeof HISTORY_TAB>({ filters: [HISTORY_TAB] })
  const tab = tabOf(list.filters[HISTORY_TAB])
  const pagination = { pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }
  const active = { credit: transactions, payments, invoices }[tab]
  const counts: Readonly<Record<HistoryTab, number>> = {
    credit: transactions.data?.length ?? 0,
    payments: payments.data?.length ?? 0,
    invoices: invoices.data?.length ?? 0,
  }

  return (
    <Card role="region" aria-labelledby="billing-history" className="relative flex-none overflow-hidden">
      <CardHeader className="border-b-0 pb-0">
        <CardTitle as="h2" id="billing-history">{t('billing.history.title')}</CardTitle>
      </CardHeader>
      <Tabs value={tab} onValueChange={(value) => list.setFilter(HISTORY_TAB, isHistoryTab(value) ? TAB_SLUGS[value] : '')}>
        <TabsList aria-label={t('billing.history.title')}>
          {TABS.map((item) => (
            <TabsTrigger key={item} value={item}>{t(`billing.history.tabs.${item}`)}<TabCount>{counts[item]}</TabCount></TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {active.isError ? (
        <EmptyState
          compact
          mascot="error"
          title={dataErrorMessage(active.error, t)}
          action={<Button variant="secondary" onClick={() => void active.refetch()}><RotateCcw strokeWidth={1.5} />{t('billing.retry')}</Button>}
        />
      ) : active.isPending ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : tab === 'credit' ? (
        <CreditLedgerTable rows={transactions.data ?? []} pagination={pagination} />
      ) : tab === 'payments' ? (
        <PaymentsTable rows={payments.data ?? []} pagination={pagination} />
      ) : (
        <InvoicesTable rows={invoices.data ?? []} pagination={pagination} />
      )}
    </Card>
  )
}
