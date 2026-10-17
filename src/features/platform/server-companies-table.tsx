import { createColumnHelper } from '@tanstack/react-table'
import { CirclePause, CirclePlay, MoreHorizontal, Pencil, UserPlus } from 'lucide-react'
import { createContext, use, type ReactNode } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { ServerCompanyRow, ServerCompanyStatus, ServerPlanStatus } from './companies-server-api'

/**
 * Bảng công ty khi nối backend. Ô có menu khai một lần ở cấp module; thao tác và cờ "đã đọc được gói / người dùng" đi qua context —
 * dựng lại mảng cột sẽ gỡ menu đang mở (AGENTS mục 5, Bảng dữ liệu).
 */
export type ServerCompaniesTableValue = {
  readonly plansLoaded: boolean
  readonly usersLoaded: boolean
  readonly onEdit: (row: ServerCompanyRow) => void
  readonly onCreateAdmin: (row: ServerCompanyRow) => void
  readonly onStatus: (row: ServerCompanyRow, next: 'ACTIVE' | 'SUSPENDED') => void
}

export const ServerCompaniesTableContext = createContext<ServerCompaniesTableValue | null>(null)

function useServerCompaniesTable(): ServerCompaniesTableValue {
  const value = use(ServerCompaniesTableContext)
  if (!value) throw new Error('Ô bảng công ty phải nằm trong <ServerCompaniesTableContext>')
  return value
}

type Look = { tone: BadgeTone; dot: BadgeDot }

/** Cùng nghĩa màu với thẻ gói của màn gói cước; "dùng thử" là chờ người kế tiếp (vòng rỗng). */
const PLAN_LOOK: Record<ServerPlanStatus, Look> = {
  ACTIVE: { tone: 'success', dot: 'solid' },
  TRIAL: { tone: 'info', dot: 'ring' },
  CANCELLED: { tone: 'warning', dot: 'ring' },
  EXPIRED: { tone: 'danger', dot: 'solid' },
}

const STATUS_LOOK: Record<ServerCompanyStatus, Look> = {
  ACTIVE: { tone: 'success', dot: 'solid' },
  SUSPENDED: { tone: 'neutral', dot: 'solid' },
  EXPIRED: { tone: 'danger', dot: 'solid' },
}

const helper = createColumnHelper<BaseTableFeatures, ServerCompanyRow>()

/** Phần chưa đọc được: gạch ngang cho mắt, chữ cho trình đọc màn hình. */
function NotLoaded() {
  const t = useT()
  return (
    <span className="text-ink-3">
      <span aria-hidden>—</span>
      <span className="sr-only">{t('companies.server.notLoaded')}</span>
    </span>
  )
}

function CompanyCell({ row }: { row: ServerCompanyRow }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">{row.company.name}</span>
      <span className="font-mono text-caption text-ink-3">{row.company.code}</span>
    </span>
  )
}

function BillingCell({ row }: { row: ServerCompanyRow }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span className="line-clamp-2 break-all text-ink-1">{row.company.billingEmail}</span>
      <span className="font-mono text-caption text-ink-3">{t('companies.server.taxCode', { taxCode: row.company.taxCode })}</span>
    </span>
  )
}

function PlanCell({ row }: { row: ServerCompanyRow }) {
  const t = useT()
  const { plansLoaded } = useServerCompaniesTable()
  if (!plansLoaded) return <NotLoaded />
  if (row.plan === null) return <span className="text-ink-3">{t('companies.noPlan')}</span>
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="font-medium text-ink-1">{row.plan.name}</span>
      {row.plan.tier === null ? null : <Badge tone="cyan" shape="tag">{t(`common.planTiers.${row.plan.tier}`)}</Badge>}
    </span>
  )
}

function PlanStatusCell({ row }: { row: ServerCompanyRow }) {
  const t = useT()
  const format = useFormat()
  const { plansLoaded } = useServerCompaniesTable()
  if (!plansLoaded) return <NotLoaded />
  if (row.plan === null) return <span className="text-ink-3" aria-hidden>—</span>
  const { status, expiresAt } = row.plan
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      {status === null ? (
        <Badge>{t('companies.server.statusUnknown')}</Badge>
      ) : (
        <Badge tone={PLAN_LOOK[status].tone} dot={PLAN_LOOK[status].dot}>{t(`companies.server.planStatus.${status}`)}</Badge>
      )}
      {expiresAt === null ? null : <span className="text-caption text-ink-3">{t('companies.server.expires', { date: format.date(expiresAt) })}</span>}
    </span>
  )
}

function UsersCell({ row }: { row: ServerCompanyRow }) {
  const t = useT()
  const format = useFormat()
  const { usersLoaded } = useServerCompaniesTable()
  if (!usersLoaded || row.userCount === null) return <NotLoaded />
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="font-mono text-caption text-ink-1 tabular-nums">{format.integer(row.userCount)}</span>
      {row.hasAdmin === false ? <Badge tone="warning" shape="tag" outlined>{t('companies.server.noAdmin')}</Badge> : null}
    </span>
  )
}

/** Trạng thái của công ty trên máy chủ — dùng chung với màn Thông tin công ty của quản trị công ty. */
export function ServerCompanyStatusBadge({ status }: { status: ServerCompanyStatus | null }) {
  const t = useT()
  if (status === null) return <Badge>{t('companies.server.statusUnknown')}</Badge>
  return <Badge tone={STATUS_LOOK[status].tone} dot={STATUS_LOOK[status].dot}>{t(`companies.server.status.${status}`)}</Badge>
}

function StatusCell({ row }: { row: ServerCompanyRow }) {
  return <ServerCompanyStatusBadge status={row.company.status} />
}

function CreatedCell({ row }: { row: ServerCompanyRow }) {
  const format = useFormat()
  if (row.company.createdAt === null) return <span className="text-ink-3" aria-hidden>—</span>
  return <span className="text-ink-2 tabular-nums">{format.date(row.company.createdAt)}</span>
}

function ActionsCell({ row }: { row: ServerCompanyRow }) {
  const t = useT()
  const { onEdit, onCreateAdmin, onStatus } = useServerCompaniesTable()
  const { status } = row.company
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('companies.actions', { name: row.company.name })}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onEdit(row)}>
          <Pencil strokeWidth={1.5} aria-hidden />
          {t('companies.server.menu.edit')}
        </DropdownMenuItem>
        {row.hasAdmin === false ? (
          <DropdownMenuItem onSelect={() => onCreateAdmin(row)}>
            <UserPlus strokeWidth={1.5} aria-hidden />
            {t('companies.server.menu.createAdmin')}
          </DropdownMenuItem>
        ) : null}
        {status === null ? null : (
          <>
            <DropdownMenuSeparator />
            {status === 'ACTIVE' ? (
              <DropdownMenuItem tone="danger" onSelect={() => onStatus(row, 'SUSPENDED')}>
                <CirclePause strokeWidth={1.5} aria-hidden />
                {t('companies.server.menu.suspend')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onStatus(row, 'ACTIVE')}>
                <CirclePlay strokeWidth={1.5} aria-hidden />
                {t('companies.server.menu.reactivate')}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function createServerCompanyColumns(t: TFunction) {
  const column = (id: string, header: string, meta: ColumnMeta, Cell: (props: { row: ServerCompanyRow }) => ReactNode) =>
    helper.display({ id, header, meta, cell: (info) => <Cell row={info.row.original} /> })
  return helper.columns([
    column('company', t('companies.server.columns.company'), { width: '22%' }, CompanyCell),
    column('billing', t('companies.server.columns.billing'), { width: '22%' }, BillingCell),
    column('plan', t('companies.server.columns.plan'), { width: '14%' }, PlanCell),
    column('planStatus', t('companies.server.columns.planStatus'), { width: '15%' }, PlanStatusCell),
    column('users', t('companies.server.columns.users'), { align: 'right', width: '128px' }, UsersCell),
    column('status', t('companies.server.columns.status'), { width: '148px' }, StatusCell),
    column('createdAt', t('companies.server.columns.createdAt'), { width: '120px' }, CreatedCell),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('companies.server.columns.actions')}</span>,
      meta: { align: 'right', width: '64px' } satisfies ColumnMeta,
      cell: (info) => <ActionsCell row={info.row.original} />,
    }),
  ])
}
