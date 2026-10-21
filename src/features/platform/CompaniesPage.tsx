import { Building2, Plus, RotateCcw, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { TemporaryPasswordDialog } from '@/features/admin/TemporaryPasswordDialog'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Company, CompanyOverview, PlanTier, SubscriptionStatus, TemporaryPassword } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { toCompanyInfo, toNewCompany } from './company-form'
import { CompanyFormDialog } from './CompanyFormDialog'
import { CompaniesTableContext, createCompanyColumns, type CompaniesTableValue } from './companies-table'
import { CompanyAdminsTab } from './CompanyAdminsTab'
import { useCompaniesQuery, useCreateCompanyMutation, useUpdateCompanyMutation } from './useCompaniesQuery'
import { ViewCompanyDetailsDialog } from './ViewCompanyDetailsDialog'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; company: Company }
  | { kind: 'password'; result: TemporaryPassword }

/**
 * Công ty `/nen-tang/cong-ty` (FE-8-06, D-65) — màn chính của quản trị hệ thống (`companies.manage`).
 * Thiết kế điều hướng bên cạnh trái:
 * - Doanh nghiệp: Quản lý công ty, xem chi tiết, sửa và tạo mới
 * - Chủ tài khoản: Quản trị tài khoản Company Admin
 */
export function CompaniesPage() {
  const t = useT()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = tabParam === 'tai-khoan' ? 'admins' : 'companies'

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<PlanTier | 'ALL' | 'NO_PLAN'>('ALL')
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'ALL'>('ALL')

  const query = useCompaniesQuery({ search: search.trim() || undefined })
  const create = useCreateCompanyMutation()
  const update = useUpdateCompanyMutation()

  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [viewingOverview, setViewingOverview] = useState<CompanyOverview | null>(null)

  const rows = useMemo(() => query.data ?? [], [query.data])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = r.company.name.toLowerCase().includes(q)
        const matchCode = r.company.id.toLowerCase().includes(q)
        const matchAdmin =
          r.adminUser?.email?.toLowerCase().includes(q) ||
          r.adminUser?.fullName?.toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchAdmin) return false
      }
      if (tierFilter !== 'ALL') {
        if (tierFilter === 'NO_PLAN') {
          if (r.current !== null) return false
        } else {
          if (r.current?.plan.tier !== tierFilter) return false
        }
      }
      if (statusFilter !== 'ALL') {
        if (r.planStatus !== statusFilter) return false
      }
      return true
    })
  }, [rows, search, tierFilter, statusFilter])

  const isFiltering = Boolean(search || tierFilter !== 'ALL' || statusFilter !== 'ALL')
  const columns = useMemo(() => createCompanyColumns(t), [t])

  const context: CompaniesTableValue = {
    onEdit: (row: CompanyOverview) => setDialog({ kind: 'edit', company: row.company }),
    onView: (row: CompanyOverview) => setViewingOverview(row),
  }

  const handleTabChange = (val: 'companies' | 'admins') => {
    if (val === 'admins') {
      setSearchParams({ tab: 'tai-khoan' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  const addButton = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => void query.refetch()}>
        <RotateCcw className="mr-1.5 size-4" />
        Làm mới
      </Button>
      <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
        <Plus strokeWidth={1.5} aria-hidden />
        {t('companies.add')}
      </Button>
    </div>
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={activeTab === 'companies' ? t('companies.title') : 'Quản lý Chủ tài khoản Doanh nghiệp'}
        meta={
          activeTab === 'companies' && query.isSuccess
            ? t('companies.count', { count: filteredRows.length })
            : undefined
        }
        description={
          activeTab === 'companies'
            ? t('pageHero.companies')
            : 'Quản lý danh sách các tài khoản chủ sở hữu doanh nghiệp (Company Admin), thông tin người đại diện và gói cước đang sở hữu.'
        }
        actions={activeTab === 'companies' ? addButton : undefined}
      />

      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        <div className="flex flex-col gap-6 lg:flex-row items-start">
          {/* Menu điều hướng bên cạnh trái */}
          <div className="w-full lg:w-72 flex-none flex flex-col gap-2">
            <div className="rounded-xl border border-border bg-bg p-2 shadow-sm flex flex-col gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'companies'}
                onClick={() => handleTabChange('companies')}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3.5 py-3 text-left transition-colors',
                  activeTab === 'companies'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-ink-2 hover:bg-surface-hover hover:text-ink-strong',
                )}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="size-5" />
                  <div>
                    <div className="text-body font-medium">Doanh nghiệp</div>
                    <div className="text-caption text-ink-3">Quản lý các công ty</div>
                  </div>
                </div>
                {query.isSuccess && (
                  <Badge tone={activeTab === 'companies' ? 'cyan' : 'neutral'}>
                    {rows.length}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'admins'}
                onClick={() => handleTabChange('admins')}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3.5 py-3 text-left transition-colors',
                  activeTab === 'admins'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-ink-2 hover:bg-surface-hover hover:text-ink-strong',
                )}
              >
                <div className="flex items-center gap-3">
                  <Users className="size-5" />
                  <div>
                    <div className="text-body font-medium">Chủ tài khoản</div>
                    <div className="text-caption text-ink-3">Company Admin đại diện</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Vùng nội dung chính bên phải */}
          <div className="min-w-0 flex-1 w-full">
            {activeTab === 'companies' ? (
              query.isPending ? (
                <div role="status" aria-label={t('companies.loading')} className="flex justify-center py-16">
                  <Spinner />
                </div>
              ) : query.isError ? (
                <EmptyState
                  mascot="error"
                  title={dataErrorMessage(query.error, t)}
                  action={
                    <Button variant="secondary" onClick={() => void query.refetch()}>
                      <RotateCcw strokeWidth={1.5} />
                      {t('companies.retry')}
                    </Button>
                  }
                />
              ) : rows.length === 0 && !isFiltering ? (
                <EmptyState
                  mascot="empty"
                  title={t('companies.empty')}
                  description={t('companies.emptyDescription')}
                  action={addButton}
                />
              ) : (
                <CompaniesTableContext value={context}>
                  <Card className="relative flex-none overflow-hidden">
                    {/* Thanh tìm kiếm và bộ lọc thống nhất */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[220px] max-w-xs flex-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                          <Input
                            placeholder="Tìm theo tên, mã, email..."
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
                              setTierFilter(val as PlanTier | 'ALL' | 'NO_PLAN')
                              setPageIndex(0)
                            }}
                          >
                            <SelectTrigger aria-label="Lọc theo gói">
                              <SelectValue placeholder="Tất cả gói" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">Tất cả gói</SelectItem>
                              <SelectItem value="BASIC">Gói Basic</SelectItem>
                              <SelectItem value="PRO">Gói Pro</SelectItem>
                              <SelectItem value="ULTIMATE">Gói Ultimate</SelectItem>
                              <SelectItem value="NO_PLAN">Chưa có gói</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-44">
                          <Select
                            value={statusFilter}
                            onValueChange={(val) => {
                              setStatusFilter(val as SubscriptionStatus | 'ALL')
                              setPageIndex(0)
                            }}
                          >
                            <SelectTrigger aria-label="Lọc trạng thái gói">
                              <SelectValue placeholder="Tất cả trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                              <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                              <SelectItem value="CANCELLED">Đã hủy</SelectItem>
                              <SelectItem value="EXPIRED">Đã hết hạn</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {isFiltering && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setSearch('')
                              setTierFilter('ALL')
                              setStatusFilter('ALL')
                              setPageIndex(0)
                            }}
                          >
                            Xóa lọc
                          </Button>
                        )}
                      </div>
                    </div>

                    <DataTable
                      data={filteredRows}
                      columns={columns}
                      getRowId={(row) => row.company.id}
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
                      serverPagination={false}
                      totalRows={filteredRows.length}
                      isFiltering={isFiltering}
                    />
                  </Card>
                </CompaniesTableContext>
              )
            ) : (
              <CompanyAdminsTab />
            )}
          </div>
        </div>
      </div>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <CompanyFormDialog
          key={dialog.kind === 'edit' ? dialog.company.id : 'new'}
          company={dialog.kind === 'edit' ? dialog.company : undefined}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            if (dialog.kind === 'edit') {
              const company = await update.mutateAsync({ id: dialog.company.id, input: toCompanyInfo(values) })
              toast.success(t('companies.saved', { name: company.name }))
              setDialog(null)
              return
            }
            const { company, ...result } = await create.mutateAsync(toNewCompany(values))
            toast.success(t('companies.created', { name: company.name }))
            setDialog({ kind: 'password', result })
          }}
        />
      ) : null}

      <TemporaryPasswordDialog
        result={dialog?.kind === 'password' ? dialog.result : undefined}
        reason="created"
        onClose={() => setDialog(null)}
      />

      {viewingOverview && (
        <ViewCompanyDetailsDialog
          overview={viewingOverview}
          open={Boolean(viewingOverview)}
          onClose={() => setViewingOverview(null)}
          onEdit={() => {
            const company = viewingOverview.company
            setViewingOverview(null)
            setDialog({ kind: 'edit', company })
          }}
        />
      )}
    </div>
  )
}
