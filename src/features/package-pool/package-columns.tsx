import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { createContext, use } from 'react'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { Checkbox } from '@/components/ui/Checkbox'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { None, PackageFlagTag, PackageStatusBadge } from './package-look'
import type { PackageRow } from './packages-list'

/**
 * Trạng thái theo dòng của bảng kho kiện: kiện đang chọn để in nhãn, kiện đang mở panel chi tiết, quyền mở trang đơn và chuyến. Hàm ô
 * khai ở cấp module, giá trị đổi đi qua context (AGENTS mục 5): chọn hay mở một kiện không dựng lại cột, ô đang được bấm không bị gỡ
 * khỏi DOM.
 */
export type PackageTableState = {
  readonly selected: ReadonlySet<string>
  readonly toggle: (id: string, checked: boolean) => void
  /** Kiện khớp bộ lọc — ô chọn ở tiêu đề chọn / bỏ cả nhóm này. */
  readonly visibleIds: readonly string[]
  readonly setMany: (ids: readonly string[], checked: boolean) => void
  /** Kiện đang mở panel chi tiết. */
  readonly openId: string | null
  readonly onOpen: (id: string) => void
  readonly panelId: string
  readonly canOpenOrders: boolean
  readonly canOpenTrips: boolean
}

export const PackageTableContext = createContext<PackageTableState | null>(null)

function useTableState(): PackageTableState {
  const value = use(PackageTableContext)
  if (!value) throw new Error('Ô của bảng kho kiện phải nằm trong <PackageTableContext>')
  return value
}

/** Mã phần tử của nút mở panel ở mã kiện: đóng panel thì trả con trỏ về đây. */
export function packageOpenButtonId(id: string) {
  return `package-open-${id}`
}

const helper = createColumnHelper<BaseTableFeatures, PackageRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, PackageRow, TValue>
const LINK = 'rounded-sm font-mono text-caption text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
const CODE = 'font-mono text-caption text-ink-1'

function SelectHeader() {
  const t = useT()
  const { selected, visibleIds, setMany } = useTableState()
  const all = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  return <Checkbox aria-label={t('sourcing.packages.selectAll')} checked={all} disabled={visibleIds.length === 0} onCheckedChange={(checked) => setMany(visibleIds, checked === true)} />
}

function SelectCell({ id }: { id: string }) {
  const t = useT()
  const { selected, toggle } = useTableState()
  return (
    <span onClick={(event) => event.stopPropagation()} className="flex">
      <Checkbox aria-label={t('sourcing.packages.selectRow', { id })} checked={selected.has(id)} onCheckedChange={(checked) => toggle(id, checked === true)} />
    </span>
  )
}

/** Mã của bên gửi là nút mở panel chi tiết (bàn phím; chuột bấm cả dòng); dưới là mã của kho kiện khi hai mã khác nhau. */
function CodeCell({ row }: { row: PackageRow }) {
  const { openId, onOpen, panelId } = useTableState()
  const open = row.id === openId
  return (
    <span className="flex min-w-0 flex-col items-start whitespace-normal">
      <button
        type="button"
        id={packageOpenButtonId(row.id)}
        aria-pressed={open}
        aria-controls={open ? panelId : undefined}
        onClick={(event) => { event.stopPropagation(); onOpen(row.id) }}
        className="max-w-full cursor-pointer truncate rounded-sm text-left font-mono text-body font-medium text-ink-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {row.packageCode}
      </button>
      {row.packageCode !== row.id ? <>{' '}<span className="font-mono text-caption text-ink-3">{row.id}</span></> : null}
    </span>
  )
}

function DimensionsCell({ row }: { row: PackageRow }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1 tabular-nums">{format.dimensions(row.lengthCm, row.widthCm, row.heightCm)}</span>
}

function WeightCell({ value }: { value: number }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1 tabular-nums">{format.weight(value)}</span>
}

function FlagsCell({ row }: { row: PackageRow }) {
  if (row.flags.length === 0) return <None />
  return <span className="flex flex-wrap items-center gap-1">{row.flags.map((flag) => <PackageFlagTag key={flag} flag={flag} />)}</span>
}

/** *(tạm)* Đơn hàng Review 1 giữ kiện; yêu cầu giao (`requirementId`) thay nó khi có màn yêu cầu giao. */
function OrderCell({ row }: { row: PackageRow }) {
  const { canOpenOrders } = useTableState()
  if (row.requirementId !== undefined) return <span className={CODE}>{row.requirementId}</span>
  if (row.orderId === undefined) return <None />
  if (!canOpenOrders) return <span className={CODE}>{row.orderId}</span>
  return <Link to={`/don-hang?q=${encodeURIComponent(row.orderId)}`} onClick={(event) => event.stopPropagation()} className={LINK}>{row.orderId}</Link>
}

function TripCell({ row }: { row: PackageRow }) {
  const { canOpenTrips } = useTableState()
  if (row.tripId === undefined) return <None />
  if (!canOpenTrips) return <span className={CODE}>{row.tripId}</span>
  return <Link to={`/chuyen/${encodeURIComponent(row.tripId)}`} onClick={(event) => event.stopPropagation()} className={LINK}>{row.tripId}</Link>
}

const selectHeader = () => <SelectHeader />
const selectCell = (info: Cell<unknown>) => <SelectCell id={info.row.original.id} />
const codeCell = (info: Cell<string>) => <CodeCell row={info.row.original} />
const dimensionsCell = (info: Cell<unknown>) => <DimensionsCell row={info.row.original} />
const weightCell = (info: Cell<number>) => <WeightCell value={info.getValue()} />
const classCell = (info: Cell<PackageRow['handlingClass']>) => <HandlingClassChip handlingClass={info.getValue()} />
const destinationCell = (info: Cell<string>) => <span className="line-clamp-2 whitespace-normal text-ink-1">{info.getValue()}</span>
const statusCell = (info: Cell<PackageRow['status']>) => <PackageStatusBadge status={info.getValue()} />
const flagsCell = (info: Cell<unknown>) => <FlagsCell row={info.row.original} />
const orderCell = (info: Cell<unknown>) => <OrderCell row={info.row.original} />
const tripCell = (info: Cell<unknown>) => <TripCell row={info.row.original} />

/**
 * Cột bảng kho kiện (FE-3b-03): chọn (chỉ người in được nhãn) · mã kiện của bên gửi (+ mã của kho) · kích thước · khối lượng · loại
 * hàng · điểm đến · trạng thái · cờ · đơn hàng · chuyến. Panel chi tiết đang mở thì bỏ bốn cột đã có trong panel (kích thước, khối
 * lượng, đơn hàng, chuyến) để bảng còn đủ chỗ cho mã kiện và điểm đến ở 1.366 px.
 */
export function packageColumns(t: TFunction, { selectable, panelOpen }: { selectable: boolean; panelOpen: boolean }) {
  const label = (key: 'code' | 'dimensions' | 'weight' | 'handlingClass' | 'destination' | 'status' | 'flags' | 'order' | 'trip') => t(`sourcing.packages.columns.${key}`)
  return helper.columns([
    ...(selectable ? [helper.display({ id: 'select', header: selectHeader, meta: { width: '48px' } satisfies ColumnMeta, cell: selectCell })] : []),
    helper.accessor('packageCode', { id: 'code', header: label('code'), enableSorting: true, meta: { width: '178px' } satisfies ColumnMeta, cell: codeCell }),
    ...(panelOpen ? [] : [
      helper.display({ id: 'dimensions', header: label('dimensions'), meta: { width: '156px' } satisfies ColumnMeta, cell: dimensionsCell }),
      helper.accessor('weightKg', { id: 'weight', header: label('weight'), enableSorting: true, meta: { width: '128px', align: 'right' } satisfies ColumnMeta, cell: weightCell }),
    ]),
    helper.accessor('handlingClass', { header: label('handlingClass'), meta: { width: '132px' } satisfies ColumnMeta, cell: classCell }),
    helper.accessor('destination', { header: label('destination'), enableSorting: true, cell: destinationCell }),
    helper.accessor('status', { header: label('status'), meta: { width: '156px' } satisfies ColumnMeta, cell: statusCell }),
    helper.display({ id: 'flags', header: label('flags'), meta: { width: '124px' } satisfies ColumnMeta, cell: flagsCell }),
    ...(panelOpen ? [] : [
      helper.display({ id: 'order', header: label('order'), meta: { width: '92px' } satisfies ColumnMeta, cell: orderCell }),
      helper.display({ id: 'trip', header: label('trip'), meta: { width: '128px' } satisfies ColumnMeta, cell: tripCell }),
    ]),
  ])
}
