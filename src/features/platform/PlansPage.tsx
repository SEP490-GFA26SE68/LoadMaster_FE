import { Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { PlanInput, PlanPatch } from '@/lib/mock-db'
import { firstFreeTier } from './plan-form'
import { PlanFormDialog } from './PlanFormDialog'
import { createPlanColumns, PlansTableContext, type PlansTableValue } from './plans-table'
import type { PlanRow } from './subscription-plans-api'
import {
  useCreatePlanMutation,
  useDeletePlanMutation,
  useSetPlanActiveMutation,
  useSubscriptionPlansQuery,
  useUpdatePlanMutation,
} from './useSubscriptionPlansQuery'

/**
 * Danh mục gói cước `/nen-tang/goi` (FE-8-02, D-90) — màn chính của quản lý nền tảng (`subscriptionPlans.manage`). Bảng gói: hạng, giá,
 * credit mỗi tháng, thuật toán, số công ty đang dùng, công tắc đang bán; gói chưa được nhóm chốt giá mang nhãn "Giá trị tạm — chờ chốt"
 * cho tới khi được sửa. Thêm / sửa ở `PlanFormDialog`, xoá gói chỉ khi không còn công ty dùng (mục Xoá mờ kèm lý do). Một nút chính: Thêm gói.
 */
export function PlansPage() {
  const t = useT()
  const query = useSubscriptionPlansQuery()
  const create = useCreatePlanMutation()
  const update = useUpdatePlanMutation()
  const toggle = useSetPlanActiveMutation()
  const remove = useDeletePlanMutation()
  const [editing, setEditing] = useState<{ row: PlanRow | null } | null>(null)
  const [deleting, setDeleting] = useState<PlanRow | null>(null)

  const rows = useMemo(() => query.data ?? [], [query.data])
  const columns = useMemo(() => createPlanColumns(t), [t])

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function handleCreate(input: PlanInput) {
    create.mutate(input, {
      onSuccess: (plan) => {
        setEditing(null)
        toast.success(t('platform.created', { name: plan.name }))
      },
      onError: showError,
    })
  }

  function handleUpdate(planId: string, patch: PlanPatch) {
    update.mutate({ planId, patch }, {
      onSuccess: (plan) => {
        setEditing(null)
        toast.success(t('platform.saved', { name: plan.name }))
      },
      onError: showError,
    })
  }

  function handleToggleSale(row: PlanRow, active: boolean) {
    toggle.mutate({ planId: row.plan.id, active }, {
      onSuccess: (plan) => toast.success(t(active ? 'platform.saleOn' : 'platform.saleOff', { name: plan.name })),
      onError: showError,
    })
  }

  function handleDelete() {
    if (!deleting) return
    const { id, name } = deleting.plan
    remove.mutate(id, {
      onSuccess: () => {
        setDeleting(null)
        toast.success(t('platform.deleted', { name }))
      },
      onError: (error) => {
        setDeleting(null)
        showError(error)
      },
    })
  }

  const context: PlansTableValue = {
    onEdit: (row) => setEditing({ row }),
    onDelete: setDeleting,
    onToggleSale: handleToggleSale,
    togglingId: toggle.isPending ? (toggle.variables?.planId ?? null) : null,
  }

  const addButton = (
    <Button variant="primary" onClick={() => setEditing({ row: null })}>
      <Plus strokeWidth={1.5} />
      {t('platform.add')}
    </Button>
  )
  const showTable = query.isSuccess && rows.length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={showTable}
        title={t('platform.title')}
        meta={query.isSuccess ? t('platform.count', { count: rows.length }) : undefined}
        description={t('pageHero.subscriptionPlans')}
        actions={rows.length > 0 ? addButton : null}
      />
      <div className={showTable ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div role="status" aria-label={t('platform.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(query.error, t)}
            action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('billing.retry')}</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState mascot="empty" title={t('platform.empty')} description={t('platform.emptyDescription')} action={addButton} />
        ) : (
          <PlansTableContext value={context}>
            <Card className="relative flex-none overflow-hidden">
              <DataTable data={rows} columns={columns} getRowId={(row) => row.plan.id} density="spacious" appearance="paper" />
            </Card>
          </PlansTableContext>
        )}
      </div>

      <PlanFormDialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        plan={editing?.row?.plan ?? null}
        defaultTier={firstFreeTier(rows.map((row) => row.plan))}
        pending={create.isPending || update.isPending}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title={deleting ? t('platform.deleteDialog.title', { name: deleting.plan.name }) : ''}
        description={deleting ? t('platform.deleteDialog.description', { id: deleting.plan.id }) : ''}
        cancelLabel={t('platform.deleteDialog.cancel')}
        confirmLabel={t('platform.deleteDialog.confirm')}
        danger
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
