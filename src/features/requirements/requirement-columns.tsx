import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { RequirementRow } from './requirements-api'
import { REQUIREMENT_PRIORITY_ORDER, REQUIREMENT_STATUS_ORDER } from './requirement-list'
import { RequirementPriorityTag, RequirementStatusBadge } from './requirement-look'
import { RequirementRowMenu } from './RequirementRowMenu'
import { useRequirementsTable } from './requirements-table-context'

const helper = createColumnHelper<BaseTableFeatures, RequirementRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, RequirementRow, TValue>

const FOCUS = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/*
 * Hàm `cell` khai ở mức module: TanStack Table v9 dựng ô như component, hàm mới là gỡ và gắn lại ô — kể cả menu thao tác đang mở
 * (AGENTS mục 5). Phần thay đổi (quyền, thao tác) đọc qua `RequirementsTableContext`.
 */

/** Mã yêu cầu là nút mở chi tiết; dưới là ngày lập. */
function RequirementCell({ row }: { row: RequirementRow }) {
  const t = useT()
  const format = useFormat()
  const { onAction } = useRequirementsTable()
  const { id } = row.requirement
  return (
    <span className="flex min-w-0 flex-col items-start">
      <button
        type="button"
        aria-label={t('requirements.open', { id })}
        onClick={() => onAction('view', row)}
        className={`cursor-pointer font-mono text-caption font-medium text-primary hover:text-primary-hover ${FOCUS}`}
      >
        {id}
      </button>
      {' '}
      <span className="text-note text-ink-3">{t('requirements.createdAt', { date: format.date(row.requirement.createdAt) })}</span>
    </span>
  )
}

function DestinationCell({ row }: { row: RequirementRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-1 font-medium text-ink-strong">{row.requirement.destinationName}</span>
      {' '}
      <span className="line-clamp-1 text-small text-ink-3">{row.requirement.address}</span>
    </span>
  )
}

function DeadlineCell({ value }: { value: string }) {
  const format = useFormat()
  return (
    <span className="flex flex-col font-mono text-caption tabular-nums">
      <span className="text-ink-1">{format.date(value)}</span>
      {' '}
      <span className="text-ink-3">{format.time(value)}</span>
    </span>
  )
}

function PackagesCell({ row }: { row: RequirementRow }) {
  const t = useT()
  const format = useFormat()
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-ink-1">{t('requirements.packageCount', { count: row.packages.length })}</span>
      {' '}
      <span className="font-mono text-caption text-ink-3 tabular-nums">{format.weight(row.totalKg)}</span>
    </span>
  )
}

function TripCell({ row }: { row: RequirementRow }) {
  const t = useT()
  if (!row.trip) return <span className="text-ink-3">{t('requirements.notAssigned')}</span>
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <Link to={`/chuyen/${row.trip.id}`} className={`line-clamp-1 font-medium text-ink-strong hover:text-primary ${FOCUS}`}>
        {row.trip.name}
      </Link>
      {' '}
      <span className="font-mono text-caption text-ink-3">
        {row.stopNumber === undefined ? row.trip.id : `${row.trip.id} · ${t('requirements.stop', { number: row.stopNumber })}`}
      </span>
    </span>
  )
}

function ActionsHeader() {
  const t = useT()
  return <span className="sr-only">{t('requirements.columns.actions')}</span>
}

const requirementCell = (info: Cell<string>) => <RequirementCell row={info.row.original} />
const destinationCell = (info: Cell<string>) => <DestinationCell row={info.row.original} />
const deadlineCell = (info: Cell<string>) => <DeadlineCell value={info.getValue()} />
const priorityCell = (info: Cell<number>) => <RequirementPriorityTag priority={info.row.original.requirement.priority} />
const packagesCell = (info: Cell<number>) => <PackagesCell row={info.row.original} />
const statusCell = (info: Cell<number>) => <RequirementStatusBadge status={info.row.original.status} />
const tripCell = (info: Cell<string>) => <TripCell row={info.row.original} />
const actionsCell = (info: Cell<unknown>) => <RequirementRowMenu row={info.row.original} />

/**
 * Cột bảng yêu cầu giao (FE-4b-02): Yêu cầu (mã, ngày lập) · Điểm đến (tên, địa chỉ) · Hạn giao · Ưu tiên · Kiện (số kiện, khối lượng)
 * · Trạng thái · Chuyến / điểm giao · menu. Mọi cột sắp xếp được; hạn so theo thời điểm, ưu tiên từ thấp tới khẩn, trạng thái theo
 * vòng đời. Dựng lại khi đổi ngôn ngữ; hàm ô giữ nguyên.
 */
export function requirementColumns(t: TFunction) {
  return helper.columns([
    helper.accessor((row) => row.requirement.id, { id: 'id', header: t('requirements.columns.requirement'), enableSorting: true, meta: { width: '132px' } satisfies ColumnMeta, cell: requirementCell }),
    helper.accessor((row) => row.requirement.destinationName, { id: 'destination', header: t('requirements.columns.destination'), enableSorting: true, meta: { width: '28%' } satisfies ColumnMeta, cell: destinationCell }),
    helper.accessor((row) => row.requirement.deadline, { id: 'deadline', header: t('requirements.columns.deadline'), enableSorting: true, sortDescFirst: false, meta: { width: '124px' } satisfies ColumnMeta, cell: deadlineCell }),
    helper.accessor((row) => REQUIREMENT_PRIORITY_ORDER.indexOf(row.requirement.priority), { id: 'priority', header: t('requirements.columns.priority'), enableSorting: true, meta: { width: '120px' } satisfies ColumnMeta, cell: priorityCell }),
    helper.accessor((row) => row.packages.length, { id: 'packages', header: t('requirements.columns.packages'), enableSorting: true, meta: { width: '110px' } satisfies ColumnMeta, cell: packagesCell }),
    helper.accessor((row) => REQUIREMENT_STATUS_ORDER.indexOf(row.status), { id: 'status', header: t('requirements.columns.status'), enableSorting: true, sortDescFirst: false, meta: { width: '168px' } satisfies ColumnMeta, cell: statusCell }),
    helper.accessor((row) => row.trip?.name ?? '', { id: 'trip', header: t('requirements.columns.trip'), enableSorting: true, meta: { width: '22%' } satisfies ColumnMeta, cell: tripCell }),
    helper.display({ id: 'actions', header: ActionsHeader, meta: { width: '56px', align: 'right' } satisfies ColumnMeta, cell: actionsCell }),
  ])
}
