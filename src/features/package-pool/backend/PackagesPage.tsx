import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { serverSort } from './package-list-query'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'

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
  labelsPath,
} from './packages-list'

import {
  useCargoPackagesQuery,
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

  const tab = cargoTabFromSlug(list.filters[STATUS_FILTER])
  const packagesQuery = useCargoPackagesQuery(list.pageIndex, list.pageSize, {
    search: list.query,
    status: tab === 'all' ? undefined : tab,
    ...cargoFiltersFromUrl(list.filters),
    ...serverSort(list.sorting, 'packages'),
  })
  const [dialog, setDialog] = useState<'add' | 'import' | null>(null)
  const rows = useMemo(() => cargoPackageRows(packagesQuery.data?.data ?? []), [packagesQuery.data])

  const totalElements =
    packagesQuery.data?.totalElements ?? 0

  const pending =
    packagesQuery.isFetching

  const error =
    packagesQuery.error

  const hasRows = totalElements > 0



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
        {hasRows || list.isFiltering ? (
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
                  : t(`sourcing.server.tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}
      </PageHero>

      <main
        className="min-h-0 flex-1 overflow-auto px-shell py-6"
      >
        {!pending && !error && !hasRows && !list.isFiltering ? (
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
              rows={pending || error ? [] : rows}
              pending={pending}
              error={error}
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
      ) : null}
    </Tabs>
  )
}