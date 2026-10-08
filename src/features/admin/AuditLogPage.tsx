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
import { useCan } from '@/features/auth/useCan'
import { useFormat, useT } from '@/lib/i18n'
import { compareText } from '@/lib/list-filter'
import { AUDIT_GROUPS, userScopeOf, type AuditGroup } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { AuditLogFilter } from './audit-api'
import { AuditDateRange } from './AuditDateRange'
import { describeChange, type AuditTableRow } from './audit-change'
import { auditColumns } from './audit-columns'
import { describeLogRow, type AuditDirectory } from './audit-log'
import { AuditSummary } from './AuditSummary'
import { useAuditDirectoryQuery, useAuditEventsQuery, useAuditSummaryQuery } from './useAuditLogQuery'
import { useCompanyNamesQuery } from './useUsersQuery'

/** Bộ lọc trên URL (D-52): khoảng ngày, người làm, nhóm hành động; ô tìm (`q`) là mã đối tượng. */
const FILTERS = ['tu', 'den', 'nguoi-lam', 'nhom'] as const
/** Quản trị hệ thống lọc thêm theo công ty của sự kiện (FE-0-08): mã công ty, hoặc `nen-tang` cho sự kiện không thuộc công ty nào. */
const PLATFORM_FILTERS = [...FILTERS, 'cong-ty'] as const
const PLATFORM_EVENTS = 'nen-tang'

/** Nhật ký dày: mặc định 50 dòng một trang (`so-dong` vắng là 50; người dùng vẫn chọn 25/100 ở chân bảng). */
const AUDIT_PAGE_SIZE = 50

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isAuditGroup(value: string): value is AuditGroup {
  return AUDIT_GROUPS.some((group) => group === value)
}

/**
 * Nhật ký hệ thống `/nhat-ky` (LM-091, D-43, V2) cho quản trị viên: ba ô tóm tắt cả nhật ký, rồi một thẻ gồm thanh tìm/lọc và bảng
 * mọi thao tác ghi của kho, mới nhất trước, lọc theo kỳ, người làm, nhóm hành động và mã đối tượng, phân trang. Màn chỉ đọc nên
 * không có nút primary. Quản trị hệ thống và quản trị công ty (FE-0-03) không xem được chuyến, xe: đối tượng chỉ là liên kết khi người
 * xem có quyền mở trang đích.
 *
 * Phạm vi theo vai trò (D-65, FE-0-08), do kho lọc: quản trị hệ thống đọc nhật ký toàn hệ thống và có bộ lọc công ty; quản trị công ty
 * chỉ đọc sự kiện của công ty mình — việc người của công ty làm và việc quản trị hệ thống làm trên tài khoản của công ty.
 */
export function AuditLogPage() {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const { user } = useAuth()
  const platform = user !== null && userScopeOf(user.role) === 'platform'
  const list = useListUrlState<(typeof PLATFORM_FILTERS)[number]>({
    filters: platform ? PLATFORM_FILTERS : FILTERS,
    defaultSort: { id: 'at', desc: true },
    defaultPageSize: AUDIT_PAGE_SIZE,
  })
  const { tu: from, den: to, 'nguoi-lam': actorId, nhom: group } = list.filters
  const company = platform ? list.filters['cong-ty'] : ''
  const targetId = list.query.trim()

  const filter = useMemo<AuditLogFilter>(() => ({
    ...(ISO_DATE.test(from) ? { from } : {}),
    ...(ISO_DATE.test(to) ? { to } : {}),
    ...(actorId ? { actorId } : {}),
    ...(targetId ? { targetId } : {}),
    ...(isAuditGroup(group) ? { group } : {}),
    ...(company ? { company: company === PLATFORM_EVENTS ? null : company } : {}),
  }), [from, to, actorId, targetId, group, company])
  const events = useAuditEventsQuery(filter)
  const summary = useAuditSummaryQuery()
  const directoryQuery = useAuditDirectoryQuery()
  const companies = useCompanyNamesQuery(platform)

  const directory = useMemo<AuditDirectory | undefined>(() => directoryQuery.data && {
    users: new Map(directoryQuery.data.users.map((user) => [user.id, user.fullName])),
    roles: new Map(directoryQuery.data.users.map((user) => [user.id, user.role])),
    trips: new Map(directoryQuery.data.trips.map((trip) => [trip.id, trip.name])),
    vehicles: new Map(directoryQuery.data.vehicles.map((vehicle) => [vehicle.id, vehicle.name])),
  }, [directoryQuery.data])
  const rows = useMemo(
    () => (events.data && directory
      ? events.data.map((event): AuditTableRow => ({
        ...describeLogRow(event, directory, t, format, can),
        actorRoleCode: event.actorId === null ? null : directory.roles?.get(event.actorId) ?? null,
        change: describeChange(event, directory, t, format),
      }))
      : []),
    [events.data, directory, t, format, can],
  )
  const columns = useMemo(() => auditColumns(t, format), [t, format])
  const actorOptions = useMemo(() => (directoryQuery.data?.users ?? [])
    .map((user) => ({ value: user.id, label: user.fullName }))
    .toSorted((a, b) => compareText(a.label, b.label)), [directoryQuery.data])
  const groupOptions = AUDIT_GROUPS.map((value) => ({ value, label: t(`audit.groups.${value}`) }))
  const companyOptions = [
    ...(companies.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
    { value: PLATFORM_EVENTS, label: t('audit.log.platform') },
  ]

  // Ô "ngày gần nhất" lọc đúng một ngày: hai đầu khoảng ngày cùng là ngày đó
  const latestDate = summary.data?.latestDay?.date
  function handleDayFilterChange(date: string | null) {
    list.setFilter('tu', date ?? '')
    list.setFilter('den', date ?? '')
  }

  const failed = events.isError || directoryQuery.isError || summary.isError
  const loading = !failed && (events.isPending || directoryQuery.isPending || summary.isPending)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('audit.log.title')}
        meta={events.data ? t('audit.log.count', { count: rows.length }) : undefined}
        description={t('pageHero.audit')}
        badge={<Badge>{t('audit.log.readOnly')}</Badge>}
      />

      <div className="sky-overlap flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell pb-6">
        {failed ? (
          <EmptyState
            mascot="error"
            title={t('audit.log.errorTitle')}
            description={t('audit.log.errorDescription')}
            action={
              <Button
                variant="secondary"
                onClick={() => void Promise.all([events.refetch(), directoryQuery.refetch(), summary.refetch()])}
              >
                {t('audit.log.retry')}
              </Button>
            }
          />
        ) : loading || summary.data === undefined ? (
          <div role="status" aria-label={t('audit.log.loading')} className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <AuditSummary
              summary={summary.data}
              dayFiltered={latestDate !== undefined && from === latestDate && to === latestDate}
              onDayFilterChange={handleDayFilterChange}
            />
            {/* Một thẻ: thanh tìm/lọc là đầu thẻ, bảng ngay dưới (V2). flex-none: con overflow-hidden của cột flex không được co —
                thiếu nó bảng bị cắt còn chiều cao khung, vùng cuộn không có gì để cuộn. */}
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
              {/* Khoảng ngày là một nút mở bảng nhỏ (V2.3) nằm cạnh thanh lọc; `values` vẫn mang `tu`, `den` để "Xoá lọc" biết đang lọc ngày */}
              <div className="flex items-start gap-3 border-b border-border px-4 py-3">
                <FilterBar
                  layout="toolbar"
                  className="min-w-0 flex-1"
                  query={list.query}
                  onQueryChange={list.setQuery}
                  searchLabel={t('audit.log.search')}
                  fields={[
                    { kind: 'select', name: 'nguoi-lam', label: t('audit.log.actor'), options: actorOptions, allLabel: t('audit.log.allActors') },
                    { kind: 'select', name: 'nhom', label: t('audit.log.group'), options: groupOptions, allLabel: t('audit.log.allGroups') },
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
              {/* Màn quản trị là màn desktop: khung hẹp hơn bảng thì cuộn ngang trong khung, không bóp cột */}
              <div
                aria-busy={events.isFetching || undefined}
                className={cn('relative overflow-x-auto', events.isPlaceholderData && 'opacity-60')}
              >
                <div className="min-w-285">
                  <DataTable
                    data={rows}
                    columns={columns}
                    getRowId={(event) => event.id}
                    density="roomy"
                    appearance="paper"
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                    emptyMessage={t('audit.log.empty')}
                    isFiltering={list.isFiltering}
                    onClearFilters={list.clearAll}
                    noMatchMessage={t('audit.log.noMatch')}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
