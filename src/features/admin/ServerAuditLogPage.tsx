import { useMemo } from 'react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useAuth } from '@/features/auth/AuthProvider'
import { isApiError } from '@/lib/api-client'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { compareText } from '@/lib/list-filter'
import { userScopeOf } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { ServerAuditFilter } from './audit-backend-api'
import { AuditDateRange } from './AuditDateRange'
import { serverAuditColumns } from './server-audit-columns'
import { SERVER_AUDIT_ACTIONS, serverActionLabel, serverAuditRow } from './server-audit-rows'
import { useServerAuditLogQuery } from './useServerAuditLogQuery'
import { useUserCompanyNamesQuery, useUsersQuery } from './useUsersQuery'

/** Bộ lọc trên URL — cùng tên với bản kho mẫu; `hanh-dong` thay `nhom` vì máy chủ lọc theo mã hành động, không theo nhóm. */
const FILTERS = ['tu', 'den', 'nguoi-lam', 'hanh-dong'] as const
const PLATFORM_FILTERS = [...FILTERS, 'cong-ty'] as const
/** `nen-tang` trên URL → `companyId=platform` của máy chủ: bản ghi không thuộc công ty nào. */
const PLATFORM_EVENTS = 'nen-tang'
const AUDIT_PAGE_SIZE = 50
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Nhật ký `/nhat-ky` khi nhóm `users` nối backend (`GET /api/audit-logs`). Máy chủ quyết phạm vi (quản trị công ty chỉ đọc công ty
 * mình), sắp mới nhất trước và phân trang: màn chỉ đọc một trang, không cột nào sắp xếp được, số đếm là tổng của máy chủ. Không có ba ô
 * tóm tắt của bản kho mẫu (máy chủ không trả số đó) và không có liên kết tới đối tượng: cột Đối tượng ghi mã chuyến khi máy chủ trả (`entityCode`), không thì mã số.
 */
export function ServerAuditLogPage() {
  const t = useT()
  const format = useFormat()
  const { user } = useAuth()
  const platform = user !== null && userScopeOf(user.role) === 'platform'
  const list = useListUrlState<(typeof PLATFORM_FILTERS)[number]>({
    filters: platform ? PLATFORM_FILTERS : FILTERS,
    defaultPageSize: AUDIT_PAGE_SIZE,
  })
  const { tu: from, den: to, 'nguoi-lam': userId, 'hanh-dong': actionType } = list.filters
  const company = platform ? list.filters['cong-ty'] : ''
  const q = list.query.trim()

  const filter = useMemo<ServerAuditFilter>(() => ({
    page: list.pageIndex,
    size: list.pageSize,
    ...(ISO_DATE.test(from) ? { from } : {}),
    ...(ISO_DATE.test(to) ? { to } : {}),
    ...(userId ? { userId } : {}),
    ...(actionType ? { actionType } : {}),
    ...(company ? { companyId: company === PLATFORM_EVENTS ? 'platform' : company } : {}),
    ...(q ? { q } : {}),
  }), [list.pageIndex, list.pageSize, from, to, userId, actionType, company, q])
  const log = useServerAuditLogQuery(filter)
  const users = useUsersQuery()
  const companies = useUserCompanyNamesQuery(platform)

  const rows = useMemo(() => (log.data?.entries ?? []).map((entry) => serverAuditRow(entry, t, format)), [log.data, t, format])
  const columns = useMemo(() => serverAuditColumns(t, format, platform), [t, format, platform])
  // Danh sách người làm đọc được hay không, bảng vẫn hiện; ô lọc chỉ có khi có danh sách
  const actorOptions = useMemo(() => (users.data ?? [])
    .map((person) => ({ value: person.id, label: person.fullName }))
    .toSorted((a, b) => compareText(a.label, b.label)), [users.data])
  const actionOptions = SERVER_AUDIT_ACTIONS.map((code) => ({ value: code, label: serverActionLabel(code, t) }))
  const companyOptions = [
    ...(companies.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
    { value: PLATFORM_EVENTS, label: t('audit.log.platform') },
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('audit.log.title')}
        meta={log.data ? t('audit.log.count', { count: log.data.total }) : undefined}
        description={t('pageHero.audit')}
        badge={<Badge>{t('audit.log.readOnly')}</Badge>}
      />

      <div className="sky-overlap flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell pb-6">
        {log.isError ? (
          <EmptyState
            mascot="error"
            title={t('audit.log.errorTitle')}
            description={isApiError(log.error) ? dataErrorMessage(log.error, t) : t('serverAudit.errorDescription')}
            action={<Button variant="secondary" onClick={() => void log.refetch()}>{t('audit.log.retry')}</Button>}
          />
        ) : log.isPending ? (
          <div role="status" aria-label={t('audit.log.loading')} className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
            <div className="flex items-start gap-3 border-b border-border px-4 py-3">
              <FilterBar
                layout="toolbar"
                className="min-w-0 flex-1"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('serverAudit.search')}
                fields={[
                  ...(actorOptions.length > 0 ? [{
                    kind: 'select' as const, name: 'nguoi-lam' as const, label: t('audit.log.actor'), options: actorOptions,
                    allLabel: t('audit.log.allActors'),
                  }] : []),
                  { kind: 'select', name: 'hanh-dong', label: t('serverAudit.action'), options: actionOptions, allLabel: t('serverAudit.allActions') },
                  ...(platform ? [{
                    kind: 'select' as const, name: 'cong-ty' as const, label: t('audit.log.company'), options: companyOptions,
                    allLabel: t('audit.log.allCompanies'), secondary: true,
                  }] : []),
                ]}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              <AuditDateRange
                from={from}
                to={to}
                onFromChange={(value) => list.setFilter('tu', value)}
                onToChange={(value) => list.setFilter('den', value)}
              />
            </div>
            <div aria-busy={log.isFetching || undefined} className={cn('relative overflow-x-auto', log.isPlaceholderData && 'opacity-60')}>
              <div className="min-w-285">
                <DataTable
                  data={rows}
                  columns={columns}
                  getRowId={(row) => row.id}
                  density="roomy"
                  appearance="paper"
                  serverPagination
                  totalRows={log.data.total}
                  pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                  emptyMessage={t('audit.log.empty')}
                  isFiltering={list.isFiltering}
                  onClearFilters={list.clearAll}
                  noMatchMessage={t('audit.log.noMatch')}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
