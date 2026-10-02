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
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { requirementColumns } from './requirement-columns'
import {
  DUE_FROM_FILTER, DUE_TO_FILTER, filterRequirementRows, PRIORITY_FILTER, REQUIREMENT_FILTERS, REQUIREMENT_PRIORITY_ORDER, REQUIREMENT_PRIORITY_SLUGS,
  REQUIREMENT_STATUS_ORDER, REQUIREMENT_STATUS_SLUGS, STATUS_FILTER, type RequirementFilterName,
} from './requirement-list'
import { RequirementAssignDialog } from './RequirementAssignDialog'
import { RequirementDetailDialog } from './RequirementDetailDialog'
import { RequirementFormDialog } from './RequirementFormDialog'
import type { RequirementRow } from './requirements-api'
import { RequirementsTableContext, type RequirementAction, type RequirementsTableContextValue } from './requirements-table-context'
import { useDeleteRequirementMutation, useRequirementsQuery, useUnassignRequirementMutation } from './useRequirementsQuery'

type Editing = { kind: 'create' } | { kind: 'edit'; row: RequirementRow }

/**
 * Yêu cầu giao `/yeu-cau-giao` (FE-4b-02, D-72) — thay màn Đơn hàng của Review 1. Quản lý công ty (`requirements.edit`) tạo, sửa, xoá:
 * nút chính "Tạo yêu cầu giao" trên dải trời. Điều phối viên (`requirements.view` + `trips.edit`) chỉ xem và đưa yêu cầu vào chuyến /
 * gỡ khỏi chuyến từ menu cuối dòng. Một thẻ gồm thanh tìm / lọc (trạng thái, ưu tiên, khoảng hạn) và bảng, mặc định sắp theo hạn gần
 * nhất trước; bấm mã yêu cầu mở chi tiết. Tìm, lọc, sắp xếp giữ trên URL (D-52).
 */
export function RequirementsPage() {
  const t = useT()
  const can = useCan()
  const canEdit = can('requirements.edit')
  const canAssign = can('trips.edit')
  const query = useRequirementsQuery()
  const unassign = useUnassignRequirementMutation()
  const remove = useDeleteRequirementMutation()
  const list = useListUrlState({ filters: REQUIREMENT_FILTERS, defaultSort: { id: 'deadline', desc: false } })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<RequirementRow | null>(null)

  const all = useMemo(() => query.data ?? [], [query.data])
  const rows = useMemo(() => filterRequirementRows(all, list.query, list.filters), [all, list.query, list.filters])
  const columns = useMemo(() => requirementColumns(t), [t])
  const pending = all.filter((row) => row.status === 'PENDING').length

  const table = useMemo<RequirementsTableContextValue>(() => ({
    canEdit,
    canAssign,
    onAction: (action: RequirementAction, row: RequirementRow) => {
      const { id } = row.requirement
      if (action === 'view') setViewing(id)
      else if (action === 'edit') setEditing({ kind: 'edit', row })
      else if (action === 'delete') setDeleting(row)
      else if (action === 'assign') setAssigning(id)
      else {
        unassign.mutate(id, {
          onSuccess: () => toast.success(t('requirements.assign.unassigned', { id })),
          onError: (error) => toast.error(dataErrorMessage(error, t)),
        })
      }
    },
  }), [canEdit, canAssign, unassign, t])

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

  const createButton = canEdit ? (
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
        meta={query.isSuccess && all.length > 0 ? t('requirements.pendingCount', { count: pending }) : undefined}
        description={t('pageHero.requirements')}
        actions={all.length > 0 ? createButton : null}
      />

      <div className={all.length > 0 ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div role="status" aria-label={t('requirements.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : all.length === 0 ? (
          <EmptyState
            mascot="empty"
            title={t('requirements.empty')}
            description={canEdit ? t('requirements.emptyDescription') : t('requirements.emptyReadOnly')}
            action={createButton ?? undefined}
          />
        ) : (
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
              <div className="relative overflow-x-auto">
                <div className="min-w-280">
                  <RequirementsTableContext value={table}>
                    <DataTable
                      data={rows}
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
              </div>
            </section>
            <p className="text-caption text-ink-3">{t('requirements.sourceNote')}</p>
          </div>
        )}
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
        <RequirementAssignDialog open={assigning !== null} onOpenChange={(open) => { if (!open) setAssigning(null) }} requirementId={assigning ?? undefined} />
      ) : null}
    </div>
  )
}
