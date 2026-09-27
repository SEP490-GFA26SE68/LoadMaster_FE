import { Package, PackagePlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { RegisteredPackage } from '@/lib/mock-db'
import { packageColumns, PackageSelectionContext, type PackageSelection } from './package-columns'
import { PackageSelectionBar } from './PackageSelectionBar'
import {
  filterByTab,
  isShippable,
  labelsPath,
  orderedSelection,
  PACKAGE_TABS,
  packageRows,
  searchPackages,
  slugFromTab,
  STATUS_FILTER,
  tabCounts,
  tabFromSlug,
} from './packages-list'
import { RegisterPackagesDialog } from './RegisterPackagesDialog'
import { usePackageTypesQuery, useRegisteredPackagesQuery } from './usePackagesSourceQuery'

/**
 * Kiện đã đăng ký `/kien-hang` (luồng 1, LM-104) — màn chính của nhà sản xuất. Dải trời có tab trạng thái kèm số (bộ lọc `trang-thai`
 * trên URL); thẻ bảng đè lên dải: tìm bỏ dấu, chọn kiện → in nhãn QR / tạo lô hàng, phân trang. "Đăng ký kiện" (một kiện, theo số
 * lượng, nhập file) là hành động chính; kiện vừa đăng ký được chọn sẵn và toast mở thẳng trang in nhãn.
 */
export function PackagesPage() {
  const t = useT()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canRegister = useCan()('packages.register')
  const packagesQuery = useRegisteredPackagesQuery()
  const typesQuery = usePackageTypesQuery()
  const list = useListUrlState({ filters: [STATUS_FILTER], defaultSort: { id: 'registeredAt', desc: true } })
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [registering, setRegistering] = useState(false)

  const all = useMemo(() => packageRows(packagesQuery.data ?? [], typesQuery.data ?? []), [packagesQuery.data, typesQuery.data])
  const searched = useMemo(() => searchPackages(all, list.query), [all, list.query])
  const tab = tabFromSlug(list.filters[STATUS_FILTER])
  const rows = useMemo(() => filterByTab(searched, tab), [searched, tab])
  const counts = useMemo(() => tabCounts(searched), [searched])
  const columns = useMemo(() => packageColumns(t), [t])

  const selectedIds = useMemo(() => orderedSelection(all, selected), [all, selected])
  const shippable = useMemo(() => all.filter((row) => selected.has(row.id) && isShippable(row)).map((row) => row.id), [all, selected])
  const selection = useMemo<PackageSelection>(() => ({
    selected,
    visibleIds: rows.map((row) => row.id),
    toggle: (id, checked) => setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    }),
    setMany: (ids, checked) => setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    }),
  }), [selected, rows])

  const pending = packagesQuery.isPending || typesQuery.isPending
  const error = packagesQuery.error ?? typesQuery.error
  const hasRows = all.length > 0
  const overlap = pending || (!error && hasRows)

  function handleRegistered(created: RegisteredPackage[]) {
    setRegistering(false)
    const ids = created.map((pkg) => pkg.id)
    setSelected(new Set(ids))
    list.setFilter(STATUS_FILTER, '')
    toast.success(t('sourcing.register.done', { count: ids.length }), {
      action: { label: t('sourcing.register.doneAction'), onClick: () => void navigate(labelsPath(ids)) },
    })
  }

  const registerButton = canRegister ? (
    <Button variant="primary" onClick={() => setRegistering(true)}>
      <PackagePlus strokeWidth={1.5} />
      {t('sourcing.packages.register')}
    </Button>
  ) : null

  return (
    <Tabs value={tab} onValueChange={(value) => list.setFilter(STATUS_FILTER, slugFromTab(PACKAGE_TABS.find((key) => key === value) ?? 'all'))} className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={overlap}
        title={t('sourcing.packages.title')}
        meta={packagesQuery.isSuccess ? t('sourcing.packages.count', { count: all.length }) : undefined}
        description={t('pageHero.packages')}
        actions={hasRows ? registerButton : null}
      >
        {hasRows ? (
          <TabsList tone="sky" aria-label={t('sourcing.packages.tabs.label')}>
            {PACKAGE_TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {key === 'all' ? t('sourcing.packages.tabs.all') : t(`sourcing.packages.status.${key}`)}
                <TabCount>{counts[key]}</TabCount>
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}
      </PageHero>

      <main className={overlap ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {pending ? (
          <div className="flex justify-center rounded-lg border border-border bg-bg py-16 shadow-card"><Spinner /></div>
        ) : error ? (
          <Banner tone="danger">{dataErrorMessage(error, t)}</Banner>
        ) : !hasRows ? (
          <EmptyState icon={Package} title={t('sourcing.packages.empty')} description={t('sourcing.packages.emptyDescription')} action={registerButton ?? undefined} />
        ) : (
          <div className="flex flex-col gap-3">
            <TabsContent value={tab} className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card outline-none">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('sourcing.packages.search')}
                onClear={list.clearAll}
              />
              {selectedIds.length > 0 ? <PackageSelectionBar selected={selectedIds} shippable={shippable} onClear={() => setSelected(new Set())} /> : null}
              <div className="relative overflow-x-auto">
                <div className="min-w-250">
                  <PackageSelectionContext value={selection}>
                    <DataTable
                      data={rows}
                      columns={columns}
                      getRowId={(row) => row.id}
                      density="roomy"
                      appearance="paper"
                      sorting={list.sorting}
                      onSortingChange={list.setSorting}
                      pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                      isFiltering={list.isFiltering || tab !== 'all'}
                      onClearFilters={list.clearAll}
                      isRowSelected={(row) => selected.has(row.id)}
                      onRowClick={(row) => selection.toggle(row.id, !selected.has(row.id))}
                    />
                  </PackageSelectionContext>
                </div>
              </div>
            </TabsContent>
            <p className="text-caption text-ink-3">{t('sourcing.packages.sourceNote')}</p>
          </div>
        )}
      </main>

      {registering ? <RegisterPackagesDialog needCompany={user?.role !== 'manufacturer'} onClose={() => setRegistering(false)} onDone={handleRegistered} /> : null}
    </Tabs>
  )
}
