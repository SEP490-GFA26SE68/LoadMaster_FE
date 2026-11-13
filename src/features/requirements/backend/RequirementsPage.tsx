import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { requirementColumns } from './requirement-columns'
import {
  DUE_FROM_FILTER, DUE_TO_FILTER, statusFromSlug, priorityFromSlug, PRIORITY_FILTER, REQUIREMENT_FILTERS, REQUIREMENT_PRIORITY_ORDER, REQUIREMENT_PRIORITY_SLUGS,
  REQUIREMENT_STATUS_ORDER, REQUIREMENT_STATUS_SLUGS, STATUS_FILTER, type RequirementFilterName,
} from './requirement-list'
import { RequirementAssignDialog } from './RequirementAssignDialog'
import { RequirementDetailDialog } from './RequirementDetailDialog'
import { RequirementFormDialog } from './RequirementFormDialog'
import type { RequirementRow } from './requirements-api'
import { RequirementsTableContext, type RequirementAction, type RequirementsTableContextValue } from './requirements-table-context'
import { useDeleteRequirementMutation, useRequirementsPageQuery } from './useRequirementsQuery'
import { useNavigate } from 'react-router'
import { REQUIREMENT_SERVER_SUPPORT } from './requirements-capabilities'


type Editing = { kind: 'create' } | { kind: 'edit'; row: RequirementRow }

/**
 * Backend requirements: Dispatcher can create using the verified CREATE capability.
 * Existing list/detail/filter/assignment and coordinate-only editing are unchanged.
 * Other management actions remain gated separately.
 */
export function RequirementsPage() {
  const t = useT()
  const can = useCan()
  const navigate = useNavigate()
  // CREATE is verified separately; existing missing-coordinate actions remain available.
  const canEdit = can('requirements.edit')
  const { user } = useAuth()
  const canCreate = user?.role === 'dispatcher' && canEdit && REQUIREMENT_SERVER_SUPPORT.create
  const canAssign = can('trips.edit')
  const remove = useDeleteRequirementMutation()
  const list = useListUrlState({ filters: REQUIREMENT_FILTERS, defaultSort: { id: 'deadline', desc: false } })
  const sort = list.sorting[0]
  const query = useRequirementsPageQuery({
    page: list.pageIndex, size: list.pageSize, search: list.query,
    status: statusFromSlug(list.filters[STATUS_FILTER]) ?? undefined,
    priority: priorityFromSlug(list.filters[PRIORITY_FILTER]) ?? undefined,
    deadlineFrom: list.filters[DUE_FROM_FILTER] || undefined,
    deadlineTo: list.filters[DUE_TO_FILTER] || undefined,
    sortBy: sort?.id ?? 'deadline', sortDir: sort?.desc ? 'DESC' : 'ASC',
  })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<RequirementRow | null>(null)

  const all = useMemo(() => query.data?.data ?? [], [query.data])
  const rows = query.isFetching ? [] : all
  const columns = useMemo(() => requirementColumns(t), [t])


  const table = useMemo<RequirementsTableContextValue>(() => ({
    canEdit,
    canAssign,
    onAction: (action: RequirementAction, row: RequirementRow) => {
      const { id } = row.requirement

      if (action === 'view') {
        setViewing(id)
      } else if (action === 'viewTrip') {
        const tripId = row.requirement.tripId

        if (tripId) {
          navigate(`/chuyen/${encodeURIComponent(tripId)}`)
        }
      } else if (action === 'edit') {
        setEditing({ kind: 'edit', row })
      } else if (action === 'delete') {
        setDeleting(row)
      } else if (action === 'assign') {
        setAssigning(id)
      }
    },
  }), [canEdit, canAssign, navigate])

  const fields: FilterField<RequirementFilterName>[] = [
    { kind: 'select', name: STATUS_FILTER, label: t('requirements.filters.status'), options: REQUIREMENT_STATUS_ORDER.map((value) => ({ value: REQUIREMENT_STATUS_SLUGS[value], label: t(`requirements.status.${value}`) })) },
    { kind: 'select', name: PRIORITY_FILTER, label: t('requirements.filters.priority'), options: REQUIREMENT_PRIORITY_ORDER.map((value) => ({ value: REQUIREMENT_PRIORITY_SLUGS[value], label: t(`requirements.priority.${value}`) })) },
    { kind: 'dateRange', label: t('requirements.filters.deadline'), from: DUE_FROM_FILTER, to: DUE_TO_FILTER, secondary: true },
  ]

  function handleDelete() {
    if (!deleting) return
    const { id } = deleting.requirement
    remove.mutate(id, {
      onSuccess: () => toast.success(t('requirements.remove.done', { id })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
      onSettled: () => setDeleting(null),
    })
  }

  const createButton = canCreate ? (
    <Button onClick={() => setEditing({ kind: 'create' })}>
      <Plus strokeWidth={1.5} />
      {t('requirements.add')}
    </Button>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={all.length > 0}
        title={t('requirements.title')}
        meta={!query.isFetching && query.isSuccess ? t('requirements.count', { count: query.data.totalElements }) : undefined}
        description={t('pageHero.requirements')}
        actions={createButton}
      />

      <div className={all.length > 0 ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
          <div className="flex flex-col gap-3">
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('requirements.search')}
                fields={fields}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              {query.isFetching ? <div role="status" aria-label={t('requirements.loading')} className="flex justify-center py-16"><Spinner /></div>
                : query.isError ? <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
                : all.length === 0 ? <EmptyState mascot="empty" title={t('requirements.empty')} description={canCreate ? t('requirements.emptyDescription') : t('requirements.emptyReadOnly')} />
                : <div className="relative overflow-x-auto">
                <div className="min-w-280">
                  <RequirementsTableContext value={table}>
                    <DataTable
                      data={rows}
                      serverPagination
                      serverSorting
                      totalRows={query.data?.totalElements ?? 0}
                      columns={columns}
                      getRowId={(row) => row.requirement.id}
                      density="roomy"
                      appearance="paper"
                      sorting={list.sorting}
                      onSortingChange={list.setSorting}
                      pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                      isFiltering={list.isFiltering}
                      onClearFilters={list.clearAll}
                    />
                  </RequirementsTableContext>
                </div>
              </div>}
            </section>
            <p className="text-caption text-ink-3">{t('requirements.sourceNote')}</p>
          </div>
      </div>

      <RequirementDetailDialog requirementId={viewing} onClose={() => setViewing(null)} />
      {canEdit ? (
        <>
          <RequirementFormDialog
            open={editing !== null}
            onOpenChange={(open) => { if (!open) setEditing(null) }}
            row={editing?.kind === 'edit' ? editing.row : undefined}
          />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => { if (!open) setDeleting(null) }}
            title={t('requirements.remove.title', { id: deleting?.requirement.id ?? '' })}
            description={t('requirements.remove.description', { destination: deleting?.requirement.destinationName ?? '', count: deleting?.packages.length ?? 0 })}
            cancelLabel={t('requirements.remove.keep')}
            confirmLabel={t('requirements.remove.confirm')}
            danger
            pending={remove.isPending}
            onConfirm={handleDelete}
          />
        </>
      ) : null}
      {canAssign ? (
        <RequirementAssignDialog open={assigning !== null} onOpenChange={(open) => { if (!open) setAssigning(null) }} requirementId={assigning ?? undefined} requirement={all.find(row => row.requirement.id === assigning)?.requirement} />
      ) : null}
    </div>
  )
}
