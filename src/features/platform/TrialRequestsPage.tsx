import { RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { TRIAL_REQUEST_STATUSES, TRIAL_REQUESTS_SOURCE, type TrialRequest, type TrialRequestStatus } from './trial-requests-api'
import { createTrialColumns, OpenTrialContext, type OpenTrialHandler } from './trial-requests-table'
import { TrialRequestDialog, type Step } from './TrialRequestDialog'
import { useTrialRequestsQuery } from './useTrialRequestsQuery'

const STATUS_FILTER = 'trang-thai'
const FILTERS = [STATUS_FILTER] as const
const STATUS_SLUGS: Record<TrialRequestStatus, string> = {
  PENDING: 'cho-duyet',
  PENDING_ADMIN_CREATION: 'cho-admin-tao',
  APPROVED: 'da-duyet',
  REJECTED: 'tu-choi',
}
const STATUS_ORDER: Record<TrialRequestStatus, number> = {
  PENDING: 0,
  PENDING_ADMIN_CREATION: 1,
  APPROVED: 2,
  REJECTED: 3,
}

/** Chờ duyệt trước, rồi mới gửi trước. */
function byStatusThenNewest(a: TrialRequest, b: TrialRequest): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt)
}

/**
 * Yêu cầu dùng thử `/nen-tang/yeu-cau-dung-thu`. Chỉ có khi nối máy chủ (`TRIAL_REQUESTS_SOURCE`); kho mẫu nói vậy, không gọi mạng. Đọc
 * hết rồi tìm và lọc trạng thái ở client, trên URL như mọi bảng; bấm tên mở yêu cầu, duyệt hay từ chối ở đó.
 */
export function TrialRequestsPage() {
  const t = useT()
  const auth = useAuthSafe()
  const role = auth?.user?.role
  const isAdmin = role === 'systemAdmin'
  const query = useTrialRequestsQuery()
  const list = useListUrlState<(typeof FILTERS)[number]>({ filters: FILTERS })
  const [openedState, setOpenedState] = useState<{ request: TrialRequest; step: Step } | null>(null)

  const handleOpen: OpenTrialHandler = useCallback((request: TrialRequest, step: Step = 'detail') => {
    setOpenedState({ request, step })
  }, [])

  // System Admin chỉ được xem các đơn đã được duyệt của System Manager:
  // 1. Không hiển thị các đơn PENDING (chưa duyệt của Manager)
  // 2. Không hiển thị các đơn bị AI từ chối (aiPrecheckStatus === 'FAILED' hoặc handledByName có chứa 'AI')
  const all = useMemo(() => {
    const listData = query.data ?? []
    const filtered = isAdmin
      ? listData.filter((r) => {
          if (r.status === 'PENDING') return false
          if (r.aiPrecheckStatus === 'FAILED' || r.handledByName?.startsWith('AI')) return false
          return true
        })
      : listData
    return filtered.toSorted(byStatusThenNewest)
  }, [query.data, isAdmin])

  const status = list.filters[STATUS_FILTER]
  const rows = useMemo(
    () => all.filter((request) =>
      matchesQuery([request.fullName, request.email, request.companyName, request.phoneNumber], list.query)
      && (status === '' || STATUS_SLUGS[request.status] === status)),
    [all, list.query, status],
  )
  const columns = useMemo(() => createTrialColumns(t), [t])

  const availableStatuses = useMemo(
    () => (isAdmin ? TRIAL_REQUEST_STATUSES.filter((s) => s !== 'PENDING') : TRIAL_REQUEST_STATUSES),
    [isAdmin],
  )
  const fields: FilterField<(typeof FILTERS)[number]>[] = useMemo(
    () => [
      {
        kind: 'select',
        name: STATUS_FILTER,
        label: t('platform.trialRequests.filters.status'),
        allLabel: t('platform.trialRequests.filters.allStatuses'),
        options: availableStatuses.map((value) => ({
          value: STATUS_SLUGS[value],
          label: t(`platform.trialRequests.status.${value}`),
        })),
      },
    ],
    [t, availableStatuses],
  )
  // Mở từ dòng thì giữ bản mới nhất của yêu cầu đó (đã duyệt ở tab khác thì không còn nút Duyệt)
  const current = openedState === null ? null : (all.find((request) => request.id === openedState.request.id) ?? openedState.request)

  let body: ReactNode
  if (!TRIAL_REQUESTS_SOURCE.available) {
    body = <EmptyState mascot="empty" title={t('platform.trialRequests.unavailable')} description={t('platform.trialRequests.unavailableDescription')} wide />
  } else if (query.isPending) {
    body = <div role="status" aria-label={t('platform.trialRequests.loading')} className="flex justify-center py-16"><Spinner /></div>
  } else if (query.isError) {
    body = (
      <EmptyState
        mascot="error"
        title={dataErrorMessage(query.error, t)}
        action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('platform.trialRequests.retry')}</Button>}
      />
    )
  } else if (all.length === 0) {
    body = <EmptyState mascot="empty" title={t('platform.trialRequests.empty')} description={t('platform.trialRequests.emptyDescription')} />
  } else {
    body = (
      <section aria-label={t('platform.trialRequests.title')} className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
        <FilterBar
          layout="toolbar"
          className="min-h-14 border-b border-border px-4 py-2"
          query={list.query}
          onQueryChange={list.setQuery}
          searchLabel={t('platform.trialRequests.search')}
          fields={fields}
          values={list.filters}
          onValueChange={list.setFilter}
          onClear={list.clearAll}
        />
        <OpenTrialContext value={handleOpen}>
          <DataTable
            data={rows}
            columns={columns}
            getRowId={(request) => request.id}
            density="roomy"
            appearance="paper"
            pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
            emptyMessage={t('platform.trialRequests.empty')}
            isFiltering={list.isFiltering}
            onClearFilters={list.clearAll}
            noMatchMessage={t('platform.trialRequests.noMatch')}
          />
        </OpenTrialContext>
      </section>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('platform.trialRequests.title')}
        meta={query.isSuccess && TRIAL_REQUESTS_SOURCE.available ? t('platform.trialRequests.count', { count: all.length }) : undefined}
        description={t('platform.trialRequests.description')}
      />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">{body}</div>
      <TrialRequestDialog
        request={current}
        initialStep={openedState?.step ?? 'detail'}
        onClose={() => setOpenedState(null)}
      />
    </div>
  )
}
