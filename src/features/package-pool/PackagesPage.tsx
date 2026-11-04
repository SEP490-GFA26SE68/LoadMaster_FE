import { FileUp, PackagePlus, ScanLine, Shapes } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Package } from '@/lib/mock-db'
import { PackageFormDialog } from './PackageFormDialog'
import { PackageImportDialog } from './PackageImportDialog'
import {
  filterByTab, filterPackages, filtersFromUrl, labelsPath, LOOKUP_PATH, PACKAGE_FILTERS, packageRows, searchPackages, slugFromTab, STATUS_FILTER, tabCounts,
  tabFromSlug, type PackageTab,
} from './packages-list'
import { PackagesTable } from './PackagesTable'
import { PACKAGE_POOL_SUPPORT, usePackagesQuery, usePackageTypesQuery } from './usePackagePoolQuery'

/** Tab của màn: Tất cả + các trạng thái nguồn dữ liệu có (backend không có Đã soạn, Đang vận chuyển, Hoàn trả). */
const TABS: readonly PackageTab[] = ['all', ...PACKAGE_POOL_SUPPORT.statuses]

/**
 * Kho kiện `/kien-hang` (FE-3b-03, D-68) — kiện của công ty, mở theo `packages.view`: điều phối viên quản lý, quản lý công ty chỉ xem
 * (không nút ghi, không chọn kiện in nhãn). Dải trời có tab trạng thái kèm số (`trang-thai` trên URL); thẻ bảng đè lên dải: tìm bỏ
 * dấu, lọc loại hàng / cờ / đã-chưa vào yêu cầu giao hay chuyến, panel chi tiết. "Thêm kiện" là hành động chính; "Nhập file", lối sang danh
 * mục Loại kiện và sang Tra cứu kiện (`packages.lookup`, FE-3b-06) là nút phụ trên dải. Kiện vừa thêm mở ngay chi tiết (đã có mã QR); kiện vừa nhập được chọn sẵn để in nhãn.
 * Nối backend: chỉ điều phối viên đọc được kiện — người khác thấy một dòng lý do, màn không gọi backend (`PACKAGE_POOL_SUPPORT`).
 */
export function PackagesPage() {
  const t = useT()
  const navigate = useNavigate()
  const can = useCan()
  const canManage = can('packages.manage')
  const blocked = PACKAGE_POOL_SUPPORT.dispatcherOnly && !canManage
  const packagesQuery = usePackagesQuery({ enabled: !blocked })
  const typesQuery = usePackageTypesQuery()
  const list = useListUrlState({ filters: PACKAGE_FILTERS })
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'add' | 'import' | null>(null)

  const all = useMemo(() => packageRows(packagesQuery.data ?? [], typesQuery.data ?? []), [packagesQuery.data, typesQuery.data])
  const matched = useMemo(() => filterPackages(searchPackages(all, list.query), filtersFromUrl(list.filters)), [all, list.query, list.filters])
  const urlTab = tabFromSlug(list.filters[STATUS_FILTER])
  const tab = TABS.includes(urlTab) ? urlTab : 'all'
  const rows = useMemo(() => filterByTab(matched, tab), [matched, tab])
  const counts = useMemo(() => tabCounts(matched), [matched])

  const pending = packagesQuery.isPending || typesQuery.isPending
  const error = packagesQuery.error ?? typesQuery.error
  const hasRows = all.length > 0
  const overlap = !blocked && (pending || (!error && hasRows))

  function handleAdded(created: Package) {
    setDialog(null)
    list.clearAll()
    setOpenId(created.id)
    toast.success(t('sourcing.packages.added', { code: created.packageCode }))
  }

  function handleImported(created: Package[]) {
    setDialog(null)
    const ids = created.map((pkg) => pkg.id)
    list.clearAll()
    setSelected(new Set(ids))
    toast.success(t('sourcing.import.done', { count: ids.length }), {
      action: { label: t('sourcing.packages.selection.printLabels'), onClick: () => void navigate(labelsPath(ids)) },
    })
  }

  const addButton = canManage ? (
    <Button variant="primary" onClick={() => setDialog('add')}>
      <PackagePlus strokeWidth={1.5} />
      {t('sourcing.packages.add')}
    </Button>
  ) : null
  // Nút phụ trên dải trời dùng `glass`. Danh mục loại kiện không có mục riêng trên thanh điều hướng: mở từ đây
  // Tra cứu kiện (FE-3b-06) cũng mở từ đây: điều phối viên không có mục riêng trên thanh điều hướng
  const lookupLink = can('packages.lookup') ? (
    <Button variant="glass" asChild>
      <Link to={LOOKUP_PATH}>
        <ScanLine strokeWidth={1.5} />
        {t('sourcing.packages.lookup')}
      </Link>
    </Button>
  ) : null
  const secondary = canManage ? (
    <>
      {PACKAGE_POOL_SUPPORT.packageTypes ? (
        <Button variant="glass" asChild>
          <Link to="/loai-kien">
            <Shapes strokeWidth={1.5} />
            {t('sourcing.packageTypes.title')}
          </Link>
        </Button>
      ) : null}
      <Button variant="glass" onClick={() => setDialog('import')}>
        <FileUp strokeWidth={1.5} />
        {t('sourcing.packages.import')}
      </Button>
    </>
  ) : null

  return (
    <Tabs value={tab} onValueChange={(value) => list.setFilter(STATUS_FILTER, slugFromTab(TABS.find((key) => key === value) ?? 'all'))} className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={overlap}
        title={t('sourcing.packages.title')}
        meta={packagesQuery.isSuccess ? t('sourcing.packages.count', { count: all.length }) : undefined}
        description={t('pageHero.packages')}
        actions={<>{lookupLink}{secondary}{hasRows ? addButton : null}</>}
      >
        {hasRows ? (
          <TabsList tone="sky" aria-label={t('sourcing.packages.tabs.label')}>
            {TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {key === 'all' ? t('sourcing.packages.tabs.all') : t(`common.packageStatuses.${key}`)}
                <TabCount>{counts[key]}</TabCount>
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}
      </PageHero>

      <main className={overlap ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {blocked ? (
          <Banner tone="info">{t('sourcing.backend.dispatcherOnly')}</Banner>
        ) : pending ? (
          <div className="flex justify-center rounded-lg border border-border bg-bg py-16 shadow-card"><Spinner /></div>
        ) : error ? (
          <Banner tone="danger">{dataErrorMessage(error, t)}</Banner>
        ) : !hasRows ? (
          <EmptyState
            mascot="empty"
            title={t('sourcing.packages.empty')}
            description={canManage ? t('sourcing.packages.emptyDescription') : t('sourcing.packages.emptyReadOnly')}
            action={addButton ?? undefined}
          />
        ) : (
          <TabsContent value={tab} className="flex flex-col gap-3 outline-none">
            <PackagesTable all={all} rows={rows} list={list} tabbed={tab !== 'all'} selected={selected} onSelectedChange={setSelected} openId={openId} onOpenChange={setOpenId} />
            <p className="text-caption text-ink-3">{PACKAGE_POOL_SUPPORT.listDestinations ? t('sourcing.packages.sourceNote') : t('sourcing.backend.sourceNote')}</p>
          </TabsContent>
        )}
      </main>

      {dialog === 'add' ? <PackageFormDialog onClose={() => setDialog(null)} onDone={handleAdded} /> : null}
      {dialog === 'import' ? <PackageImportDialog onClose={() => setDialog(null)} onDone={handleImported} /> : null}
    </Tabs>
  )
}
