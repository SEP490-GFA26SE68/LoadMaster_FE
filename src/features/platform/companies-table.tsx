import { createColumnHelper } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { createContext, use } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { CompanyOverview, SubscriptionStatus } from '@/lib/mock-db'

/**
 * Bảng công ty (FE-8-06). Ô có nút khai một lần ở cấp module; hàm sửa đi qua context — dựng lại mảng cột sẽ gỡ ô đang mở
 * (AGENTS mục 5, Bảng dữ liệu).
 */
export type CompaniesTableValue = { readonly onEdit: (row: CompanyOverview) => void }

export const CompaniesTableContext = createContext<CompaniesTableValue | null>(null)

function useCompaniesTable(): CompaniesTableValue {
  const value = use(CompaniesTableContext)
  if (!value) throw new Error('Ô bảng công ty phải nằm trong <CompaniesTableContext>')
  return value
}

/** Cùng nghĩa với thẻ gói của màn gói cước: đang dùng xanh lá, đã huỷ nhưng còn hiệu lực hổ phách, hết hạn đỏ. */
const STATUS_LOOK: Record<SubscriptionStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  ACTIVE: { tone: 'success', dot: 'solid' },
  CANCELLED: { tone: 'warning', dot: 'ring' },
  EXPIRED: { tone: 'danger', dot: 'solid' },
}

const helper = createColumnHelper<BaseTableFeatures, CompanyOverview>()

function CompanyCell({ row }: { row: CompanyOverview }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">{row.company.name}</span>
      <span className="font-mono text-caption text-ink-3">{row.company.id}</span>
    </span>
  )
}

function PlanCell({ row }: { row: CompanyOverview }) {
  const t = useT()
  if (row.current === null) return <span className="text-ink-3">{t('companies.noPlan')}</span>
  const { plan } = row.current
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="font-medium text-ink-1">{plan.name}</span>
      <Badge tone="cyan" shape="tag">{t(`common.planTiers.${plan.tier}`)}</Badge>
    </span>
  )
}

function StatusCell({ row }: { row: CompanyOverview }) {
  const t = useT()
  if (row.planStatus === null) return <span className="text-ink-3">—</span>
  const look = STATUS_LOOK[row.planStatus]
  return <Badge tone={look.tone} dot={look.dot}>{t(`billing.plan.status.${row.planStatus}`)}</Badge>
}

function UsersCell({ row }: { row: CompanyOverview }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1 tabular-nums">{format.integer(row.userCount)}</span>
}

function ActionsCell({ row }: { row: CompanyOverview }) {
  const t = useT()
  const { onEdit } = useCompaniesTable()
  return (
    <Button variant="ghost" size="icon" aria-label={t('companies.actions', { name: row.company.name })} onClick={() => onEdit(row)}>
      <Pencil strokeWidth={1.5} />
    </Button>
  )
}

export function createCompanyColumns(t: TFunction) {
  return helper.columns([
    helper.display({ id: 'company', header: t('companies.columns.company'), meta: { width: '34%' } satisfies ColumnMeta, cell: (info) => <CompanyCell row={info.row.original} /> }),
    helper.display({ id: 'plan', header: t('companies.columns.plan'), meta: { width: '24%' } satisfies ColumnMeta, cell: (info) => <PlanCell row={info.row.original} /> }),
    helper.display({ id: 'planStatus', header: t('companies.columns.planStatus'), meta: { width: '24%' } satisfies ColumnMeta, cell: (info) => <StatusCell row={info.row.original} /> }),
    helper.display({ id: 'users', header: t('companies.columns.users'), meta: { align: 'right', width: '130px' } satisfies ColumnMeta, cell: (info) => <UsersCell row={info.row.original} /> }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('companies.columns.actions')}</span>,
      meta: { align: 'right', width: '64px' } satisfies ColumnMeta,
      cell: (info) => <ActionsCell row={info.row.original} />,
    }),
  ])
}
