import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { createContext, use } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Switch } from '@/components/ui/Switch'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PlanRow } from './subscription-plans-api'

/**
 * Bảng danh mục gói (FE-8-02). Ô có trạng thái (công tắc bán, menu thao tác) khai một lần ở cấp module; phần thay đổi (hàm thao tác, gói
 * đang đổi) đi qua context — dựng lại mảng cột sẽ gỡ ô và đóng menu đang mở (AGENTS mục 5, Bảng dữ liệu).
 */
export type PlansTableValue = {
  readonly onEdit: (row: PlanRow) => void
  readonly onDelete: (row: PlanRow) => void
  readonly onToggleSale: (row: PlanRow, active: boolean) => void
  /** Gói đang chờ kho trả lời khi đổi cờ bán. */
  readonly togglingId: string | null
}

export const PlansTableContext = createContext<PlansTableValue | null>(null)

function usePlansTable(): PlansTableValue {
  const value = use(PlansTableContext)
  if (!value) throw new Error('Ô bảng gói cước phải nằm trong <PlansTableContext>')
  return value
}

const helper = createColumnHelper<BaseTableFeatures, PlanRow>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'

function PlanCell({ row }: { row: PlanRow }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col items-start gap-1 whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">{row.plan.name}</span>
      <span className="font-mono text-caption text-ink-3">{row.plan.id}</span>
      {row.plan.provisional ? <Badge shape="tag" tone="warning" outlined>{t('common.provisionalPlan')}</Badge> : null}
    </span>
  )
}

function PriceCell({ row }: { row: PlanRow }) {
  const t = useT()
  const format = useFormat()
  return <span className={mono}>{t('platform.perMonth', { price: format.currency(row.plan.priceVnd) })}</span>
}

function CreditsCell({ row }: { row: PlanRow }) {
  const t = useT()
  const format = useFormat()
  const { monthlyCredits } = row.plan
  return <span className={mono}>{monthlyCredits === null ? t('common.unlimitedCredits') : format.integer(monthlyCredits)}</span>
}

function CompaniesCell({ row }: { row: PlanRow }) {
  const format = useFormat()
  return <span className={mono}>{format.integer(row.companies)}</span>
}

function SaleCell({ row }: { row: PlanRow }) {
  const t = useT()
  const { onToggleSale, togglingId } = usePlansTable()
  return (
    <Switch
      aria-label={t('platform.onSaleSwitch', { name: row.plan.name })}
      checked={row.plan.active}
      disabled={togglingId === row.plan.id}
      onCheckedChange={(active) => onToggleSale(row, active)}
    />
  )
}

function ActionsCell({ row }: { row: PlanRow }) {
  const t = useT()
  const { onEdit, onDelete } = usePlansTable()
  const inUse = row.companies
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('platform.actions', { name: row.plan.name })}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onSelect={() => onEdit(row)}>
          <Pencil strokeWidth={1.5} aria-hidden />
          {t('platform.edit')}
        </DropdownMenuItem>
        {/* Gói còn công ty dùng: kho sẽ từ chối xoá, nên mục mờ đi kèm lý do ngay tại chỗ (LM-092) */}
        <DropdownMenuItem
          tone={inUse > 0 ? undefined : 'danger'}
          disabled={inUse > 0}
          onSelect={() => onDelete(row)}
          className={inUse > 0 ? 'h-auto items-start py-1.5' : undefined}
        >
          <Trash2 strokeWidth={1.5} aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span>{t('platform.delete')}</span>
            {inUse > 0 ? <span className="text-caption whitespace-normal text-text-3">{t('platform.inUse', { count: inUse })}</span> : null}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function createPlanColumns(t: TFunction) {
  return helper.columns([
    helper.display({ id: 'plan', header: t('platform.columns.plan'), meta: { width: '24%' } satisfies ColumnMeta, cell: (info) => <PlanCell row={info.row.original} /> }),
    helper.display({
      id: 'tier',
      header: t('platform.columns.tier'),
      meta: { width: '110px' } satisfies ColumnMeta,
      cell: (info) => <Badge tone="cyan">{t(`common.planTiers.${info.row.original.plan.tier}`)}</Badge>,
    }),
    helper.display({ id: 'price', header: t('platform.columns.price'), meta: { align: 'right', width: '170px' } satisfies ColumnMeta, cell: (info) => <PriceCell row={info.row.original} /> }),
    helper.display({ id: 'credits', header: t('platform.columns.credits'), meta: { align: 'right', width: '150px' } satisfies ColumnMeta, cell: (info) => <CreditsCell row={info.row.original} /> }),
    helper.display({
      id: 'algorithm',
      header: t('platform.columns.algorithm'),
      cell: (info) => <span className="text-ink-1">{t(`optimization.credit.tiers.${info.row.original.plan.algorithmTier}`)}</span>,
    }),
    helper.display({ id: 'companies', header: t('platform.columns.companies'), meta: { align: 'right', width: '130px' } satisfies ColumnMeta, cell: (info) => <CompaniesCell row={info.row.original} /> }),
    helper.display({ id: 'onSale', header: t('platform.columns.onSale'), meta: { width: '110px' } satisfies ColumnMeta, cell: (info) => <SaleCell row={info.row.original} /> }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('platform.columns.actions')}</span>,
      meta: { align: 'right', width: '64px' } satisfies ColumnMeta,
      cell: (info) => <ActionsCell row={info.row.original} />,
    }),
  ])
}
