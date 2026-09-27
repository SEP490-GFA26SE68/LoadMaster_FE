import { Plus, Shapes } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { PackageTypeInput } from '@/lib/mock-db'
import { matchesQuery } from '@/lib/list-filter'
import { PackageTypeActionsContext, packageTypeColumns, type PackageTypeRow } from './package-type-columns'
import { PackageTypeFormDialog } from './PackageTypeFormDialog'
import { useDeletePackageTypeMutation, usePackageTypesQuery, useRegisteredPackagesQuery, useSavePackageTypeMutation } from './usePackagesSourceQuery'

type Editing = { kind: 'create' } | { kind: 'edit'; row: PackageTypeRow } | null

/**
 * Danh mục loại kiện `/loai-kien` (luồng 1, LM-104): bảng loại kiện (kích thước, khối lượng, dễ vỡ, hướng đặt, xếp chồng, số kiện của
 * công ty đang dùng) trong một thẻ đè lên dải trời; thêm / sửa trong hộp thoại, xoá qua hộp thoại xác nhận — loại còn kiện của công ty
 * thì nút xoá nói lý do thay vì xoá (kho cũng từ chối `PACKAGE_TYPE_IN_USE` khi kiện thuộc công ty khác).
 */
export function PackageTypesPage() {
  const t = useT()
  const canEdit = useCan()('packages.register')
  const typesQuery = usePackageTypesQuery()
  const packagesQuery = useRegisteredPackagesQuery()
  const save = useSavePackageTypeMutation()
  const remove = useDeletePackageTypeMutation()
  const list = useListUrlState({ defaultSort: { id: 'name', desc: false } })
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<PackageTypeRow | null>(null)

  const rows = useMemo<PackageTypeRow[]>(() => {
    const usage = new Map<string, number>()
    for (const pkg of packagesQuery.data ?? []) usage.set(pkg.packageTypeId, (usage.get(pkg.packageTypeId) ?? 0) + 1)
    return (typesQuery.data ?? []).map((type) => ({ ...type, usage: usage.get(type.id) ?? 0 }))
  }, [typesQuery.data, packagesQuery.data])
  const visible = useMemo(() => rows.filter((row) => matchesQuery([row.name, row.id], list.query)), [rows, list.query])
  const columns = useMemo(() => packageTypeColumns(t, canEdit), [t, canEdit])
  const actions = useMemo(() => ({ onEdit: (row: PackageTypeRow) => setEditing({ kind: 'edit', row }), onDelete: setDeleting }), [])

  const pending = typesQuery.isPending || packagesQuery.isPending
  const error = typesQuery.error ?? packagesQuery.error
  const hasRows = rows.length > 0
  const overlap = pending || (!error && hasRows)

  async function handleSubmit(input: PackageTypeInput) {
    const id = editing?.kind === 'edit' ? editing.row.id : undefined
    const saved = await save.mutateAsync({ input, id })
    toast.success(t(id ? 'sourcing.packageTypes.saved' : 'sourcing.packageTypes.created', { name: saved.name }))
    setEditing(null)
  }

  function handleDelete() {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('sourcing.packageTypes.deleted', { name: deleting.name }))
        setDeleting(null)
      },
    })
  }

  const addButton = canEdit ? (
    <Button variant="primary" onClick={() => setEditing({ kind: 'create' })}>
      <Plus strokeWidth={1.5} />
      {t('sourcing.packageTypes.add')}
    </Button>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={overlap}
        title={t('sourcing.packageTypes.title')}
        meta={typesQuery.isSuccess ? t('sourcing.packageTypes.count', { count: rows.length }) : undefined}
        description={t('pageHero.packageTypes')}
        actions={hasRows ? addButton : null}
      />
      <main className={overlap ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {pending ? (
          <div className="flex justify-center rounded-lg border border-border bg-bg py-16 shadow-card"><Spinner /></div>
        ) : error ? (
          <Banner tone="danger">{dataErrorMessage(error, t)}</Banner>
        ) : !hasRows ? (
          <EmptyState icon={Shapes} title={t('sourcing.packageTypes.empty')} description={t('sourcing.packageTypes.emptyDescription')} action={addButton ?? undefined} />
        ) : (
          <div className="flex flex-col gap-3">
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('sourcing.packageTypes.search')}
                onClear={list.clearAll}
              />
              <div className="relative overflow-x-auto">
                <div className="min-w-240">
                  <PackageTypeActionsContext value={actions}>
                    <DataTable
                      data={visible}
                      columns={columns}
                      getRowId={(row) => row.id}
                      density="roomy"
                      appearance="paper"
                      sorting={list.sorting}
                      onSortingChange={list.setSorting}
                      isFiltering={list.isFiltering}
                      onClearFilters={list.clearAll}
                    />
                  </PackageTypeActionsContext>
                </div>
              </div>
            </section>
            <p className="text-caption text-ink-3">{t('sourcing.packageTypes.sourceNote')}</p>
          </div>
        )}
      </main>

      {editing ? (
        <PackageTypeFormDialog
          key={editing.kind === 'edit' ? editing.row.id : 'new'}
          type={editing.kind === 'edit' ? editing.row : undefined}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={t('sourcing.packageTypes.deleteDialog.title', { name: deleting?.name ?? '' })}
        // Kiện của công ty khác cũng giữ loại kiện: kho từ chối `PACKAGE_TYPE_IN_USE`, câu lỗi thay mô tả
        description={remove.error ? dataErrorMessage(remove.error, t) : t('sourcing.packageTypes.deleteDialog.description')}
        cancelLabel={t('sourcing.packageTypes.deleteDialog.cancel')}
        confirmLabel={t('sourcing.packageTypes.deleteDialog.confirm')}
        danger
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
