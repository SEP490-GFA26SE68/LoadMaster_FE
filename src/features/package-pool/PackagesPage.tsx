import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'

import { PackageFormDialog } from './PackageFormDialog'
import { PackagesTable } from './PackagesTable'

import type { CargoPackage } from './packages-api'
import { FileUp, PackagePlus, Printer, Shapes } from 'lucide-react'
import { PackageImportDialog } from './PackageImportDialog'


import {
  CARGO_PACKAGE_TABS,
  CLASS_FILTER,
  STATUS_FILTER,
  cargoPackageRows,
  cargoTabFromSlug,
  cargoSlugFromTab,
  cargoFiltersFromUrl,
  filterCargoPackages,
  filterCargoByTab,
  searchCargoPackages,
  labelsPath,
} from './packages-list'

import {
  useCargoPackagesQuery,
  usePackageTypesQuery,
} from './usePackagePoolQuery'

export function PackagesPage() {
  const t = useT()
  const can = useCan()
  const canManage = can('packages.manage')
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  )

  // Các bộ lọc giữ trên URL.
  const list = useListUrlState({
    filters: [STATUS_FILTER, CLASS_FILTER] as const,
  })

  // Danh sách kiện thật từ BE.
  const packagesQuery = useCargoPackagesQuery(
    list.pageIndex,
    list.pageSize,
  )

  // Danh mục loại kiện thật để ghép tên loại kiện.
  // Tạm lấy 100 loại đầu tiên.
  const typesQuery = usePackageTypesQuery(0, 100)

  const [dialog, setDialog] = useState<'add' | 'import' | null>(null)

  const all = useMemo(
    () =>
      cargoPackageRows(
        packagesQuery.data?.data ?? [],
        typesQuery.data?.data ?? [],
      ),
    [packagesQuery.data, typesQuery.data],
  )

  const matched = useMemo(
    () =>
      filterCargoPackages(
        searchCargoPackages(all, list.query),
        cargoFiltersFromUrl(list.filters),
      ),
    [all, list.query, list.filters],
  )

  const tab = cargoTabFromSlug(
    list.filters[STATUS_FILTER],
  )

  const rows = useMemo(
    () => filterCargoByTab(matched, tab),
    [matched, tab],
  )

  const totalElements =
    packagesQuery.data?.totalElements ?? 0

  const pending =
    packagesQuery.isPending || typesQuery.isPending

  const error =
    packagesQuery.error ?? typesQuery.error

  const hasRows = totalElements > 0

  const overlap =
    pending || (!error && hasRows)


  function handleAdded(created: CargoPackage[]) {
    setDialog(null)
    list.clearAll()

    if (created.length === 0) return

    if (created.length === 1) {
      const pkg = created[0]

      if (pkg) {
        toast.success(
          t('sourcing.packages.added', {
            code: pkg.packageCode || `PKG-${pkg.id}`,
          }),
        )
      }

      return
    }

    toast.success(
      t('sourcing.packages.addedMany', {
        count: created.length,
      }),
    )
  }


  const addButton = canManage ? (
    <Button
      variant="primary"
      onClick={() => setDialog('add')}
    >
      <PackagePlus strokeWidth={1.5} />
      {t('sourcing.packages.add')}
    </Button>
  ) : null

  const printButton = can('labels.print') ? (
    <Button
      variant="glass"
      disabled={selectedIds.size === 0}
      asChild={selectedIds.size > 0}
    >
      {selectedIds.size > 0 ? (
        <Link to={labelsPath([...selectedIds])}>
          <Printer strokeWidth={1.5} />
          {t('sourcing.labels.print')} ({selectedIds.size})
        </Link>
      ) : (
        <>
          <Printer strokeWidth={1.5} />
          {t('sourcing.labels.print')} (0)
        </>
      )}
    </Button>
  ) : null

  const secondary = canManage ? (
    <>
      <Button variant="glass" asChild>
        <Link to="/loai-kien">
          <Shapes strokeWidth={1.5} />
          {t('sourcing.packageTypes.title')}
        </Link>
      </Button>

      <Button
        variant="glass"
        onClick={() => setDialog('import')}
      >
        <FileUp strokeWidth={1.5} />
        {t('sourcing.packages.import')}
      </Button>
    </>
  ) : null

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const nextTab =
          CARGO_PACKAGE_TABS.find(
            (key) => key === value,
          ) ?? 'all'

        list.setFilter(
          STATUS_FILTER,
          cargoSlugFromTab(nextTab),
        )
      }}
      className="flex min-w-0 flex-1 flex-col"
    >
      <PageHero
        overlap={overlap}
        title={t('sourcing.packages.title')}
        meta={
          packagesQuery.isSuccess
            ? t('sourcing.packages.count', {
              count: totalElements,
            })
            : undefined
        }
        description={t('pageHero.packages')}
        actions={
          <>
            {printButton}
            {secondary}
            {addButton}
          </>
        }
      >
        {hasRows ? (
          <TabsList
            tone="sky"
            aria-label={t('sourcing.packages.tabs.label')}
          >
            {CARGO_PACKAGE_TABS.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
              >
                {key === 'all'
                  ? t('sourcing.packages.tabs.all')
                  : ({
                    PENDING: 'Chờ xử lý',
                    PLANNED: 'Đã lập kế hoạch',
                    LOADED: 'Đã xếp',
                    DELIVERED: 'Đã giao',
                    CANCELLED: 'Đã hủy',
                  } as const)[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}
      </PageHero>

      <main
        className={
          overlap
            ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6'
            : 'min-h-0 flex-1 overflow-auto px-shell py-6'
        }
      >
        {pending ? (
          <div className="flex justify-center rounded-lg border border-border bg-bg py-16 shadow-card">
            <Spinner />
          </div>
        ) : error ? (
          <Banner tone="danger">
            {dataErrorMessage(error, t)}
          </Banner>
        ) : !hasRows ? (
          <EmptyState
            mascot="empty"
            title={t('sourcing.packages.empty')}
            description={
              canManage
                ? t('sourcing.packages.emptyDescription')
                : t('sourcing.packages.emptyReadOnly')
            }
            action={addButton ?? undefined}
          />
        ) : (
          <TabsContent
            value={tab}
            className="flex flex-col gap-3 outline-none"
          >
            <PackagesTable
              rows={rows}
              list={list}
              totalElements={totalElements}
              tabbed={tab !== 'all'}
              openId={openId}
              onOpenChange={setOpenId}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </TabsContent>
        )}
      </main>

      {canManage && dialog === 'add' ? (
        <PackageFormDialog
          onClose={() => setDialog(null)}
          onDone={handleAdded}
        />
      ) : null}

      {canManage && dialog === 'import' ? (
        <PackageImportDialog
          onClose={() => setDialog(null)}
          onDone={() => {
            // Chưa kết nối API import thật.
            setDialog(null)
          }}
        />
      ) : null}F
    </Tabs>
  )
}