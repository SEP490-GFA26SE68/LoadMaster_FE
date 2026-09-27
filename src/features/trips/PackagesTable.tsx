import { FileUp, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import type { CargoPackage, VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { createPackageColumns, type PackageRow } from './package-columns'
import { packageIssues } from './package-issues'
import { isFragile } from './package-requirements'
import { PackagesToolbar } from './PackagesToolbar'
import type { StopRow } from './trip-summary'

/**
 * Bảng kiện của chuyến (LM-044, V2.3 `ChiTietChuyenKien`): card gồm đầu card (tiêu đề, số dòng, Thêm kiện, Nhập từ file), thanh lọc
 * (tìm mã/tên, điểm giao, chip "Chỉ hàng dễ vỡ" và "Chỉ kiện có lỗi"), bảng và chân bảng. Lọc điểm giao do trang giữ để danh sách
 * điểm giao lọc cùng một chỗ. Phân trang 50 dòng thay vì ảo hoá: giữ số node DOM nhỏ ở 500 kiện mà không thêm
 * `@tanstack/react-virtual` (AGENTS mục 2). "Nhập từ file" (LM-093) chỉ hiện khi được sửa chuyến — nút hoạt động thật (Spec 9.3, D-20).
 */
const PAGE_SIZE = 50

/**
 * Dòng đang chọn (V2.3 `tr.sel`): nền cyan-50 của `DataTable` cộng vạch trái 3 px `--cyan-500`. `DataTable` chỉ đánh dấu dòng chọn
 * bằng lớp nền, nên vạch bám vào đúng lớp đó.
 */
const SELECTED_ACCENT = '[&_tbody_tr.bg-primary-bg>td:first-child]:shadow-[inset_3px_0_0_var(--cyan-500)]'

export function PackagesTable({ packages, vehicle, stops, selectedId, onSelect, onAdd, onImport, stopFilter, onStopFilterChange }: {
  packages: readonly CargoPackage[]
  vehicle: VehicleConfig
  stops: readonly StopRow[]
  selectedId: string | null
  onSelect: (pkg: CargoPackage) => void
  /** Vắng khi không được thêm kiện (chỉ xem, chuyến đã khoá): ẩn nút Thêm kiện. */
  onAdd?: () => void
  /** Mở hộp thoại nhập kiện từ file (LM-093); vắng như `onAdd`. */
  onImport?: () => void
  stopFilter: number | null
  onStopFilterChange: (stop: number | null) => void
}) {
  const t = useT()
  const format = useFormat()
  const [query, setQuery] = useState('')
  const [onlyFragile, setOnlyFragile] = useState(false)
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [page, setPage] = useState(0)

  const issues = useMemo(() => packageIssues(packages, vehicle), [packages, vehicle])
  const rows = useMemo<PackageRow[]>(() => packages.map((pkg) => {
    const own = issues.byPackageId.get(pkg.id) ?? []
    return {
      ...pkg,
      errorCount: own.filter(({ severity }) => severity === 'error').length,
      warningCount: own.filter(({ severity }) => severity === 'warning').length,
      stopName: stops[pkg.deliveryStop - 1]?.name ?? '',
    }
  }), [packages, issues, stops])

  const filtered = useMemo(() => rows.filter((row) =>
    (stopFilter === null || row.deliveryStop === stopFilter)
    && (!onlyFragile || isFragile(row))
    && (!onlyIssues || row.errorCount > 0)
    && matchesQuery([row.id, row.name], query)), [rows, stopFilter, onlyFragile, onlyIssues, query])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const columns = useMemo(() => createPackageColumns(t, format), [t, format])

  if (packages.length === 0) {
    // Nút phụ: hành động chính của màn là "Chạy tối ưu" ở header (AGENTS mục 5, mỗi màn một nút primary)
    return <EmptyState
      mascot="empty"
      compact
      title={t('trips.packages.emptyTitle')}
      description={t('trips.packages.emptyDescription')}
      action={onAdd || onImport ? (
        <div className="flex flex-wrap justify-center gap-2">
          {onAdd ? <Button variant="secondary" onClick={onAdd}><Plus strokeWidth={1.5} />{t('trips.packages.add')}</Button> : null}
          {onImport ? <Button variant="secondary" onClick={onImport}><FileUp strokeWidth={1.5} />{t('trips.import.open')}</Button> : null}
        </div>
      ) : undefined}
    />
  }

  const resetPage = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(0) }

  return (
    // flex-none: con overflow-hidden của cột flex bị co về 0 (AGENTS mục 5, "Cuộn trong khung ứng dụng")
    <Card role="region" aria-labelledby="packages-title" className="relative flex min-w-0 flex-none flex-col overflow-hidden">
      <CardHeader>
        <CardTitle as="h2" id="packages-title">{t('trips.packages.title')}</CardTitle>
        <CardMeta>{t('trips.packages.lineCount', { count: packages.length })}</CardMeta>
        {onAdd || onImport ? (
          <CardActions>
            {onAdd ? <Button variant="secondary" size="sm" onClick={onAdd}><Plus strokeWidth={1.75} />{t('trips.packages.add')}</Button> : null}
            {onImport ? <Button variant="secondary" size="sm" onClick={onImport}><FileUp strokeWidth={1.75} />{t('trips.import.open')}</Button> : null}
          </CardActions>
        ) : null}
      </CardHeader>

      <PackagesToolbar
        stops={stops}
        query={query}
        onQueryChange={resetPage(setQuery)}
        stopFilter={stopFilter}
        onStopFilterChange={resetPage(onStopFilterChange)}
        onlyFragile={onlyFragile}
        onOnlyFragileChange={resetPage(setOnlyFragile)}
        onlyIssues={onlyIssues}
        onOnlyIssuesChange={resetPage(setOnlyIssues)}
      />

      {/* Khung cuộn ngang khi cột giữa hẹp hơn tổng cột cố định; relative vì ô ẩn định vị tuyệt đối (AGENTS mục 5) */}
      <div className={`relative overflow-x-auto ${SELECTED_ACCENT}`}>
        <div className="min-w-180">
          <DataTable data={visible} columns={columns} density="roomy" appearance="paper" onRowClick={onSelect}
            isRowSelected={(row) => row.id === selectedId} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-fine text-ink-3">
        <span>
          {t('trips.packages.shown', {
            shown: format.integer(filtered.length),
            total: format.integer(rows.length),
            instances: format.integer(filtered.reduce((sum, row) => sum + row.quantity, 0)),
          })}
        </span>
        {pages > 1 ? (
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('trips.packages.previousPage')}</Button>
            <span className="font-mono">{t('trips.packages.page', { page: current + 1, pages })}</span>
            <Button variant="ghost" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t('trips.packages.nextPage')}</Button>
          </span>
        ) : <span>{t('trips.packages.units')}</span>}
      </div>
    </Card>
  )
}
