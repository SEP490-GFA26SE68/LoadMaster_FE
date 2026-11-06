import { createColumnHelper } from '@tanstack/react-table'
import { RotateCcw } from 'lucide-react'
import { createContext, use, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { CompanyAdminStatusBadge, EditAdminDialog, ViewAdminDialog, type AdminFormValues } from './CompanyAdminDialogs'
import type { CompanyAdminStatus, CompanyAdminUser } from './company-admins-api'
import { useCompanyAdminsQuery, useSaveCompanyAdminMutation } from './useCompanyAdminsQuery'

const STATUS_FILTER = 'trang-thai'
const FILTERS = [STATUS_FILTER] as const
const STATUS_SLUGS: Record<CompanyAdminStatus, string> = { ACTIVE: 'hoat-dong', LOCKED: 'da-khoa' }

/** Mở chi tiết từ ô tên — khai một lần ở cấp module, hàm mở đi qua context (AGENTS mục 5, Bảng dữ liệu). */
const OpenAdminContext = createContext<((admin: CompanyAdminUser) => void) | null>(null)

function AdminCell({ admin }: { admin: CompanyAdminUser }) {
  const t = useT()
  const open = use(OpenAdminContext)
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <button
        type="button"
        className="line-clamp-2 text-left font-medium text-primary hover:underline"
        aria-label={t('platform.companyAdmins.open', { name: admin.fullName })}
        onClick={(event) => {
          event.stopPropagation()
          open?.(admin)
        }}
      >
        {admin.fullName}
      </button>
      <span className="line-clamp-1 break-all text-caption text-ink-3">{admin.email}</span>
    </span>
  )
}

function CompanyCell({ admin }: { admin: CompanyAdminUser }) {
  const t = useT()
  if (admin.companyName === null) return <span className="text-ink-3">{t('platform.companyAdmins.noCompany')}</span>
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span className="line-clamp-2 text-ink-1">{admin.companyName}</span>
      {admin.companyCode ? <span className="font-mono text-caption text-ink-3">{admin.companyCode}</span> : null}
    </span>
  )
}

function PlanCell({ admin }: { admin: CompanyAdminUser }) {
  const t = useT()
  if (admin.planName === null) return <span className="text-ink-3">{t('platform.companyAdmins.noPlan')}</span>
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-ink-1">{admin.planName}</span>
      {admin.planTier ? <Badge tone="cyan" shape="tag">{admin.planTier}</Badge> : null}
    </span>
  )
}

function CreditsCell({ admin }: { admin: CompanyAdminUser }) {
  const format = useFormat()
  if (admin.creditBalance === null) return <span className="text-ink-3" aria-hidden>—</span>
  return <span className="font-mono text-ink-1 tabular-nums">{format.integer(admin.creditBalance)}</span>
}

const helper = createColumnHelper<BaseTableFeatures, CompanyAdminUser>()

function createAdminColumns(t: TFunction) {
  const column = (id: string, header: string, meta: ColumnMeta, Cell: (props: { admin: CompanyAdminUser }) => ReactNode) =>
    helper.display({ id, header, meta, cell: (info) => <Cell admin={info.row.original} /> })
  return helper.columns([
    column('admin', t('platform.companyAdmins.columns.admin'), { width: '28%' }, AdminCell),
    column('company', t('platform.companyAdmins.columns.company'), { width: '26%' }, CompanyCell),
    column('plan', t('platform.companyAdmins.columns.plan'), { width: '20%' }, PlanCell),
    column('credits', t('platform.companyAdmins.columns.credits'), { align: 'right', width: '128px' }, CreditsCell),
    column('status', t('platform.companyAdmins.columns.status'), { width: '148px' }, ({ admin }) => <CompanyAdminStatusBadge status={admin.status} />),
  ])
}

/**
 * Tài khoản Quản trị công ty của mọi công ty — tab thứ hai của màn Công ty khi nối backend. Đọc hết danh sách rồi tìm (tên, email, công ty)
 * và lọc trạng thái ở client, trên URL như mọi bảng. Bấm tên mở chi tiết (tài khoản, công ty, gói, thoả thuận); sửa họ tên, số điện thoại
 * và khoá / mở khoá ở hộp sửa.
 */
export function CompanyAdminsTab() {
  const t = useT()
  const query = useCompanyAdminsQuery()
  const save = useSaveCompanyAdminMutation()
  const list = useListUrlState<(typeof FILTERS)[number]>({ filters: FILTERS })
  const [viewing, setViewing] = useState<CompanyAdminUser | null>(null)
  const [editing, setEditing] = useState<CompanyAdminUser | null>(null)

  const all = useMemo(() => query.data ?? [], [query.data])
  const status = list.filters[STATUS_FILTER]
  const rows = useMemo(
    () => all.filter((admin) =>
      matchesQuery([admin.fullName, admin.email, admin.companyName, admin.companyCode], list.query)
      && (status === '' || STATUS_SLUGS[admin.status] === status)),
    [all, list.query, status],
  )
  const columns = useMemo(() => createAdminColumns(t), [t])
  const fields: FilterField<(typeof FILTERS)[number]>[] = [{
    kind: 'select', name: STATUS_FILTER, label: t('platform.companyAdmins.filters.status'), allLabel: t('platform.companyAdmins.filters.allStatuses'),
    options: (['ACTIVE', 'LOCKED'] as const).map((value) => ({ value: STATUS_SLUGS[value], label: t(`platform.companyAdmins.status.${value}`) })),
  }]

  function handleSave(admin: CompanyAdminUser, values: AdminFormValues) {
    save.mutate({ admin, fullName: values.fullName, phoneNumber: values.phoneNumber, status: values.status }, {
      onSuccess: () => {
        toast.success(t('platform.companyAdmins.saved', { name: values.fullName }))
        setEditing(null)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  if (query.isPending) return <div className="flex justify-center py-16"><Spinner label={t('platform.companyAdmins.loading')} /></div>
  if (query.isError) {
    return (
      <EmptyState
        mascot="error"
        title={dataErrorMessage(query.error, t)}
        action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('platform.companyAdmins.retry')}</Button>}
      />
    )
  }
  if (all.length === 0) return <EmptyState mascot="empty" title={t('platform.companyAdmins.empty')} description={t('platform.companyAdmins.emptyDescription')} />

  return (
    <>
      <section aria-label={t('platform.companyAdmins.title')} className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
        <FilterBar
          layout="toolbar"
          className="min-h-14 border-b border-border px-4 py-2"
          query={list.query}
          onQueryChange={list.setQuery}
          searchLabel={t('platform.companyAdmins.search')}
          fields={fields}
          values={list.filters}
          onValueChange={list.setFilter}
          onClear={list.clearAll}
        />
        <OpenAdminContext value={setViewing}>
          <DataTable
            data={rows}
            columns={columns}
            getRowId={(admin) => String(admin.id)}
            density="roomy"
            appearance="paper"
            pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
            emptyMessage={t('platform.companyAdmins.empty')}
            isFiltering={list.isFiltering}
            onClearFilters={list.clearAll}
            noMatchMessage={t('platform.companyAdmins.noMatch')}
          />
        </OpenAdminContext>
      </section>
      <ViewAdminDialog
        admin={viewing}
        onClose={() => setViewing(null)}
        onEdit={(admin) => {
          setViewing(null)
          setEditing(admin)
        }}
      />
      {editing === null ? null : (
        <EditAdminDialog key={editing.id} admin={editing} pending={save.isPending} onClose={() => setEditing(null)} onSave={(values) => handleSave(editing, values)} />
      )}
    </>
  )
}
