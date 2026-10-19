import { Plus, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { PlanTier } from '@/lib/mock-db/billing-model'
import { firstFreeTier } from './plan-form'
import { PlanFormDialog } from './PlanFormDialog'
import { createPlanColumns, PlansTableContext, type PlansTableValue } from './plans-table'
import type { CreatePlanInput, ListPlansParams, PlanRow, UpdatePlanInput } from './subscription-plans-api'
import {
  useCreatePlanMutation,
  useDeletePlanMutation,
  useSetPlanActiveMutation,
  useSubscriptionPlansQuery,
  useUpdatePlanMutation,
} from './useSubscriptionPlansQuery'

/**
 * Danh mục gói cước `/nen-tang/goi` (FE-8-02, D-90) — màn chính của quản lý nền tảng (`subscriptionPlans.manage`).
 * Bảng gói: hạng, mã gói, giá, chu kỳ, credit mỗi tháng, thuật toán, giới hạn xe & chuyến, số công ty đang dùng, công tắc đang bán.
 * Hỗ trợ tìm kiếm, lọc theo tier & active status, phân trang server (`PageResponse`), và đầy đủ CRUD thêm/sửa/xóa gói.
 */
export function PlansPage() {
  const t = useT()
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<PlanTier | 'ALL'>('ALL')
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  const queryParams = useMemo<ListPlansParams>(() => ({
    page: pageIndex,
    size: pageSize,
    search: search.trim() || undefined,
    tier: tierFilter === 'ALL' ? undefined : tierFilter,
    active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE',
  }), [pageIndex, pageSize, search, tierFilter, activeFilter])

  const query = useSubscriptionPlansQuery(queryParams)
  const create = useCreatePlanMutation()
  const update = useUpdatePlanMutation()
  const toggle = useSetPlanActiveMutation()
  const remove = useDeletePlanMutation()
  const [editing, setEditing] = useState<{ row: PlanRow | null } | null>(null)
  const [deleting, setDeleting] = useState<PlanRow | null>(null)

  const rows = useMemo(() => {
    if (!query.data) return []
    return Array.isArray(query.data) ? query.data : (query.data.rows ?? [])
  }, [query.data])

  const totalCount = useMemo(() => {
    if (!query.data) return 0
    return Array.isArray(query.data) ? query.data.length : (query.data.totalElements ?? rows.length)
  }, [query.data, rows.length])

  const columns = useMemo(() => createPlanColumns(t), [t])

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function handleCreate(input: CreatePlanInput) {
    create.mutate(input, {
      onSuccess: (plan) => {
        setEditing(null)
        toast.success(t('platform.created', { name: plan.name }))
      },
      onError: showError,
    })
  }

  function handleUpdate(planId: string, patch: UpdatePlanInput) {
    update.mutate({ planId, patch }, {
      onSuccess: (plan) => {
        setEditing(null)
        toast.success(t('platform.saved', { name: plan.name }))
      },
      onError: showError,
    })
  }

  function handleToggleSale(row: PlanRow, active: boolean) {
    toggle.mutate(
      {
        planId: row.plan.id,
        active,
        existingPlan: {
          planCode: row.plan.planCode,
          name: row.plan.name,
          priceVnd: row.plan.priceVnd,
          tier: row.plan.tier,
          monthlyCredits: row.plan.monthlyCredits,
          billingCycle: row.plan.billingCycle,
          algorithmTier: row.plan.algorithmTier,
          maxVehicles: row.plan.maxVehicles,
          maxMonthlyJobs: row.plan.maxMonthlyJobs,
          features: row.plan.features,
        },
      },
      {
        onSuccess: (plan) => toast.success(t(active ? 'platform.saleOn' : 'platform.saleOff', { name: plan.name })),
        onError: showError,
      },
    )
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
  const showTable = query.isSuccess && (rows.length > 0 || Boolean(search || tierFilter !== 'ALL' || activeFilter !== 'ALL'))

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={showTable}
        title={t('platform.title')}
        meta={query.isSuccess ? t('platform.count', { count: totalCount }) : undefined}
        description={t('pageHero.subscriptionPlans')}
        actions={addButton}
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
        ) : rows.length === 0 && !search && tierFilter === 'ALL' && activeFilter === 'ALL' ? (
          <EmptyState mascot="empty" title={t('platform.empty')} description={t('platform.emptyDescription')} action={addButton} />
        ) : (
          <PlansTableContext value={context}>
            <Card className="relative flex-none overflow-hidden p-4">
              {/* Thanh tìm kiếm và bộ lọc */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <Input
                    placeholder="Tìm theo tên hoặc mã gói..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPageIndex(0)
                    }}
                    className="pl-9"
                  />
                </div>
                <div className="w-40">
                  <Select
                    value={tierFilter}
                    onValueChange={(val) => {
                      setTierFilter(val as PlanTier | 'ALL')
                      setPageIndex(0)
                    }}
                  >
                    <SelectTrigger aria-label="Lọc theo hạng">
                      <SelectValue placeholder="Tất cả hạng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả hạng</SelectItem>
                      <SelectItem value="BASIC">Hạng Basic</SelectItem>
                      <SelectItem value="PRO">Hạng Pro</SelectItem>
                      <SelectItem value="ULTIMATE">Hạng Ultimate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Select
                    value={activeFilter}
                    onValueChange={(val) => {
                      setActiveFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE')
                      setPageIndex(0)
                    }}
                  >
                    <SelectTrigger aria-label="Lọc trạng thái">
                      <SelectValue placeholder="Tất cả trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                      <SelectItem value="ACTIVE">Đang bán</SelectItem>
                      <SelectItem value="INACTIVE">Ngừng bán</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {search || tierFilter !== 'ALL' || activeFilter !== 'ALL' ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch('')
                      setTierFilter('ALL')
                      setActiveFilter('ALL')
                      setPageIndex(0)
                    }}
                  >
                    Xóa lọc
                  </Button>
                ) : null}
              </div>

              <DataTable
                data={rows}
                columns={columns}
                getRowId={(row) => row.plan.id}
                density="spacious"
                appearance="paper"
                pagination={{
                  pageIndex,
                  pageSize,
                  onPageChange: setPageIndex,
                  onPageSizeChange: (newSize) => {
                    setPageSize(newSize)
                    setPageIndex(0)
                  },
                }}
                serverPagination
                totalRows={totalCount}
                isFiltering={Boolean(search || tierFilter !== 'ALL' || activeFilter !== 'ALL')}
              />
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
