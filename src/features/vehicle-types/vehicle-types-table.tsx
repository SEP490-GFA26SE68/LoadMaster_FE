import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { createContext, use } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { VehicleAssignmentRow, VehicleTypeRow } from './vehicle-types-api'

/**
 * Hai bảng của màn Loại xe (LM-104). Ô có trạng thái (menu thao tác, ô chọn loại) khai **một lần ở cấp module**; phần thay đổi (quyền
 * ghi, hàm thao tác, danh mục loại) đi qua context — dựng lại mảng cột sẽ gỡ ô và đóng menu đang mở (AGENTS mục 5, Bảng dữ liệu).
 */
export type VehicleTypesTableValue = {
  readonly canEdit: boolean
  readonly onEdit: (row: VehicleTypeRow) => void
  readonly onDelete: (row: VehicleTypeRow) => void
  readonly types: readonly VehicleTypeRow[]
  readonly assigningId: string | null
  readonly onAssign: (vehicle: VehicleAssignmentRow['vehicle'], vehicleTypeId: string | null) => void
}

export const VehicleTypesTableContext = createContext<VehicleTypesTableValue | null>(null)

function useVehicleTypesTable(): VehicleTypesTableValue {
  const value = use(VehicleTypesTableContext)
  if (!value) throw new Error('Ô bảng loại xe phải nằm trong <VehicleTypesTableContext>')
  return value
}

const typeHelper = createColumnHelper<BaseTableFeatures, VehicleTypeRow>()
const assignHelper = createColumnHelper<BaseTableFeatures, VehicleAssignmentRow>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'
/** Giá trị của mục "Chưa gắn loại" trong Select (Radix không nhận chuỗi rỗng). */
const NO_TYPE = 'none'

function NameCell({ row }: { row: VehicleTypeRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">{row.type.name}</span>
      <span className="font-mono text-caption text-ink-3">{row.type.id}</span>
    </span>
  )
}

function CargoCell({ row }: { row: VehicleTypeRow }) {
  const format = useFormat()
  const { cargoLengthCm, cargoWidthCm, cargoHeightCm } = row.type
  return <span className={mono}>{format.dimensions(cargoLengthCm, cargoWidthCm, cargoHeightCm)}</span>
}

function PayloadCell({ row }: { row: VehicleTypeRow }) {
  const format = useFormat()
  return <span className={mono}>{format.weight(row.type.payloadKg)}</span>
}

function VehiclesCell({ row }: { row: VehicleTypeRow }) {
  const t = useT()
  if (row.vehicles.length === 0) return <span className="text-caption text-ink-3">{t('vehicleTypes.noVehicles')}</span>
  return (
    <span className="flex flex-wrap gap-1.5 whitespace-normal">
      {row.vehicles.map((vehicle) => <Badge key={vehicle.id} tone="cyan" title={vehicle.id}>{vehicle.name}</Badge>)}
    </span>
  )
}

function ActionsCell({ row }: { row: VehicleTypeRow }) {
  const t = useT()
  const { canEdit, onEdit, onDelete } = useVehicleTypesTable()
  if (!canEdit) return null
  const inUse = row.vehicleIds.length
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('vehicleTypes.actions', { name: row.type.name })}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onSelect={() => onEdit(row)}>
          <Pencil strokeWidth={1.5} aria-hidden />
          {t('vehicleTypes.edit')}
        </DropdownMenuItem>
        {/* Loại còn gắn xe: kho sẽ từ chối xoá, nên mục mờ đi kèm lý do ngay tại chỗ (LM-092) */}
        <DropdownMenuItem
          tone={inUse > 0 ? undefined : 'danger'}
          disabled={inUse > 0}
          onSelect={() => onDelete(row)}
          className={inUse > 0 ? 'h-auto items-start py-1.5' : undefined}
        >
          <Trash2 strokeWidth={1.5} aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span>{t('vehicleTypes.delete')}</span>
            {inUse > 0 ? <span className="text-caption whitespace-normal text-text-3">{t('vehicleTypes.inUse', { count: inUse })}</span> : null}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function createTypeColumns(t: TFunction) {
  return typeHelper.columns([
    typeHelper.accessor((row) => row.type.name, { id: 'name', header: t('vehicleTypes.columns.name'), enableSorting: true, cell: (info) => <NameCell row={info.row.original} /> }),
    typeHelper.display({ id: 'cargo', header: t('vehicleTypes.columns.cargo'), meta: { align: 'right', width: '200px' } satisfies ColumnMeta, cell: (info) => <CargoCell row={info.row.original} /> }),
    typeHelper.accessor((row) => row.type.payloadKg, { id: 'payload', header: t('vehicleTypes.columns.payload'), enableSorting: true, meta: { align: 'right', width: '130px' } satisfies ColumnMeta, cell: (info) => <PayloadCell row={info.row.original} /> }),
    typeHelper.display({ id: 'vehicles', header: t('vehicleTypes.columns.vehicles'), meta: { width: '34%' } satisfies ColumnMeta, cell: (info) => <VehiclesCell row={info.row.original} /> }),
    typeHelper.display({ id: 'actions', header: () => <span className="sr-only">{t('vehicleTypes.columns.actions')}</span>, meta: { align: 'right', width: '64px' } satisfies ColumnMeta, cell: (info) => <ActionsCell row={info.row.original} /> }),
  ])
}

function VehicleCell({ row }: { row: VehicleAssignmentRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <VehicleName name={row.vehicle.name} className="line-clamp-2 font-medium text-ink-strong" />
      <span className="font-mono text-caption text-ink-3">{row.vehicle.id}</span>
    </span>
  )
}

function TypeSelectCell({ row }: { row: VehicleAssignmentRow }) {
  const t = useT()
  const { canEdit, types, assigningId, onAssign } = useVehicleTypesTable()
  const current = types.find((item) => item.type.id === row.vehicleTypeId)
  if (!canEdit) return <span className="text-ink-1">{current?.type.name ?? t('vehicleTypes.assign.none')}</span>
  return (
    <Select
      value={row.vehicleTypeId ?? NO_TYPE}
      disabled={assigningId === row.vehicle.id}
      onValueChange={(value) => onAssign(row.vehicle, value === NO_TYPE ? null : value)}
    >
      <SelectTrigger aria-label={t('vehicleTypes.assign.select', { name: row.vehicle.name })} className="max-w-96">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TYPE}>{t('vehicleTypes.assign.none')}</SelectItem>
        {types.map((item) => <SelectItem key={item.type.id} value={item.type.id}>{item.type.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function createAssignColumns(t: TFunction) {
  return assignHelper.columns([
    assignHelper.accessor((row) => row.vehicle.name, { id: 'vehicle', header: t('vehicleTypes.assign.vehicle'), meta: { width: '40%' } satisfies ColumnMeta, cell: (info) => <VehicleCell row={info.row.original} /> }),
    assignHelper.display({ id: 'type', header: t('vehicleTypes.assign.type'), cell: (info) => <TypeSelectCell row={info.row.original} /> }),
  ])
}
