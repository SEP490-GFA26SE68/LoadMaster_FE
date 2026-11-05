
import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { createContext, use } from 'react'

import type {
  BaseTableFeatures,
  ColumnMeta,
} from '@/components/DataTable'

import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

import {
  useFormat,
  useT,
  type TFunction,
} from '@/lib/i18n'

import { ratioToPercent } from './vehicle-type-form'
import type { VehicleType } from './vehicle-types-api'
import { VehicleTypeMiniPreview } from './VehicleTypeMiniPreview'

/**
 * Context thao tác bảng loại xe.
 *
 * Hiện tại GET / POST đã nối BE.
 * Chức năng sửa / xóa chỉ bật khi có API thật.
 */
export type VehicleTypesTableValue = {
  readonly canEdit: boolean
  readonly canUpdate?: boolean
  readonly canDelete?: boolean
  readonly onEdit: (type: VehicleType) => void
  readonly onDelete: (type: VehicleType) => void
}

export const VehicleTypesTableContext =
  createContext<VehicleTypesTableValue | null>(null)

function useVehicleTypesTable(): VehicleTypesTableValue {
  const value = use(VehicleTypesTableContext)

  if (!value) {
    throw new Error(
      'VehicleTypesTableContext is required',
    )
  }

  return value
}

const helper =
  createColumnHelper<BaseTableFeatures, VehicleType>()

const mono =
  'font-mono text-caption text-ink-1 tabular-nums'

function NameCell({
  type,
}: {
  type: VehicleType
}) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">
        {type.name}
      </span>

      <span className="font-mono text-caption text-ink-3">
        {type.id}
      </span>
    </span>
  )
}

function CargoCell({
  type,
}: {
  type: VehicleType
}) {
  const format = useFormat()

  return (
    <span className={mono}>
      {format.dimensions(
        type.cargoLengthCm,
        type.cargoWidthCm,
        type.cargoHeightCm,
      )}
    </span>
  )
}

function PayloadCell({
  type,
}: {
  type: VehicleType
}) {
  const format = useFormat()

  return (
    <span className={mono}>
      {format.weight(type.payloadKg)}
    </span>
  )
}

function LimitsCell({
  type,
}: {
  type: VehicleType
}) {
  const t = useT()
  const format = useFormat()

  const {
    frontAxleLimitKg,
    rearAxleLimitKg,
    maxCogOffsetRatio,
  } = type

  const limit = (kg: number | undefined) =>
    kg === undefined
      ? t('vehicleTypes.limits.noAxleLimit')
      : format.weight(kg)

  return (
    <span className="flex min-w-0 flex-col whitespace-normal text-caption text-ink-1">
      <span>
        {t('vehicleTypes.limits.axles', {
          front: limit(frontAxleLimitKg),
          rear: limit(rearAxleLimitKg),
        })}
      </span>

      <span className="text-ink-3">
        {t('vehicleTypes.limits.cogOffset', {
          percent: format.percent(
            ratioToPercent(maxCogOffsetRatio),
          ),
        })}
      </span>
    </span>
  )
}

function PreviewCell({
  type,
}: {
  type: VehicleType
}) {
  return (
    <VehicleTypeMiniPreview vehicleType={type} />
  )
}

function ActionsCell({
  type,
}: {
  type: VehicleType
}) {
  const t = useT()

  const {
    canEdit,
    canUpdate = false,
    canDelete = false,
    onEdit,
    onDelete,
  } = useVehicleTypesTable()

  if (!canEdit || (!canUpdate && !canDelete)) {
    return null
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('vehicleTypes.actions', {
            name: type.name,
          })}
        >
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64"
      >
        {canUpdate && (
          <DropdownMenuItem
            onSelect={() => onEdit(type)}
          >
            <Pencil strokeWidth={1.5} aria-hidden />
            {t('vehicleTypes.edit')}
          </DropdownMenuItem>
        )}

        {canDelete && (
          <DropdownMenuItem
            tone="danger"
            onSelect={() => onDelete(type)}
          >
            <Trash2 strokeWidth={1.5} aria-hidden />
            {t('vehicleTypes.delete')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function createTypeColumns(t: TFunction) {
  return helper.columns([
    helper.accessor('name', {
      header: t('vehicleTypes.columns.name'),
      enableSorting: true,

      cell: (info) => (
        <NameCell type={info.row.original} />
      ),
    }),
    helper.accessor('vehicleCount', {
      header: t('vehicleTypes.columns.vehicleCount'),
      enableSorting: true,
      meta: {
        align: 'right',
        width: '200px',
      } satisfies ColumnMeta,
      cell: (info) => (
        <span className="font-mono tabular-nums">
          {info.getValue()}
        </span>
      ),
    }),

    helper.display({
      id: 'cargo',
      header: t('vehicleTypes.columns.cargo'),

      meta: {
        align: 'right',
        width: '200px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <CargoCell type={info.row.original} />
      ),
    }),

    helper.accessor('payloadKg', {
      header: t('vehicleTypes.columns.payload'),
      enableSorting: true,

      meta: {
        align: 'right',
        width: '130px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <PayloadCell type={info.row.original} />
      ),
    }),

    helper.display({
      id: 'limits',
      header: t('vehicleTypes.columns.limits'),

      meta: {
        width: '250px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <LimitsCell type={info.row.original} />
      ),
    }),

    helper.display({
      id: 'cargoPreview',
      header: t('vehicleTypes.columns.cargoPreview'),
      enableSorting: false,

      meta: {
        width: '220px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <PreviewCell type={info.row.original} />
      ),
    }),

    helper.display({
      id: 'actions',
      header: () => (
        <span className="sr-only">
          {t('vehicleTypes.columns.actions')}
        </span>
      ),

      meta: {
        align: 'right',
        width: '64px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <ActionsCell type={info.row.original} />
      ),
    }),
  ])
}
