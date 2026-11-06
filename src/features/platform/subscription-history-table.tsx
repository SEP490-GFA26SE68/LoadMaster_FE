import { createColumnHelper } from '@tanstack/react-table'
import { createContext, use, type ReactNode } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { ContractStatus, SubscriptionContract } from './contracts-api'

const STATUS_TONE: Record<ContractStatus, 'success' | 'info' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  TRIAL: 'info',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
}

export function ContractStatusBadge({ status }: { status: ContractStatus | null }) {
  const t = useT()
  if (status === null) return <Badge tone="neutral" dot="solid">{t('platform.subscriptionHistory.status.unknown')}</Badge>
  return <Badge tone={STATUS_TONE[status]} dot="solid">{t(`platform.subscriptionHistory.status.${status}`)}</Badge>
}

/** Giá kèm chu kỳ; máy chủ không trả giá thì "—". */
export function ContractPrice({ contract }: { contract: SubscriptionContract }) {
  const t = useT()
  const format = useFormat()
  if (contract.priceVnd === null) return <span className="text-ink-3" aria-hidden>—</span>
  return (
    <span className="font-mono tabular-nums text-ink-1">
      {format.currency(contract.priceVnd)}
      {contract.billingCycle === null ? null : <span className="text-ink-3"> {t(`platform.subscriptionHistory.cycle.${contract.billingCycle}`)}</span>}
    </span>
  )
}

/** Mở chi tiết từ ô tên công ty — hàm ô khai một lần ở cấp module, hàm mở đi qua context (AGENTS mục 5, Bảng dữ liệu). */
export const OpenContractContext = createContext<((contract: SubscriptionContract) => void) | null>(null)

function CompanyCell({ contract }: { contract: SubscriptionContract }) {
  const t = useT()
  const open = use(OpenContractContext)
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <button
        type="button"
        className="line-clamp-2 text-left font-medium text-primary hover:underline"
        aria-label={t('platform.subscriptionHistory.open', { name: contract.companyName })}
        onClick={() => open?.(contract)}
      >
        {contract.companyName}
      </button>
      {contract.companyCode ? <span className="font-mono text-caption text-ink-3">{contract.companyCode}</span> : null}
    </span>
  )
}

function PlanCell({ contract }: { contract: SubscriptionContract }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-ink-1">{contract.planName}</span>
      {contract.planTier ? <Badge tone="cyan" shape="tag">{contract.planTier}</Badge> : null}
    </span>
  )
}

function PeriodCell({ contract }: { contract: SubscriptionContract }) {
  const format = useFormat()
  const day = (iso: string | null) => (iso === null ? '—' : format.date(iso))
  return <span className="font-mono tabular-nums text-ink-2">{day(contract.startedAt)} → {day(contract.expiresAt)}</span>
}

const helper = createColumnHelper<BaseTableFeatures, SubscriptionContract>()

export function createContractColumns(t: TFunction) {
  const column = (id: string, header: string, meta: ColumnMeta, Cell: (props: { contract: SubscriptionContract }) => ReactNode) =>
    helper.display({ id, header, meta, cell: (info) => <Cell contract={info.row.original} /> })
  return helper.columns([
    column('company', t('platform.subscriptionHistory.columns.company'), { width: '30%' }, CompanyCell),
    column('plan', t('platform.subscriptionHistory.columns.plan'), { width: '22%' }, PlanCell),
    column('price', t('platform.subscriptionHistory.columns.price'), { align: 'right', width: '180px' }, ContractPrice),
    column('period', t('platform.subscriptionHistory.columns.period'), { width: '220px' }, PeriodCell),
    column('status', t('platform.subscriptionHistory.columns.status'), { width: '148px' }, ({ contract }) => <ContractStatusBadge status={contract.status} />),
  ])
}
