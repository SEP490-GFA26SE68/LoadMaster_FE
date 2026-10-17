
import { createColumnHelper } from '@tanstack/react-table'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type {
  BaseTableFeatures,
  ColumnMeta,
} from '@/components/DataTable'
import type { TFunction } from '@/lib/i18n'
import {
  statusRank,
  type VehicleRow,
} from './vehicle-status'
import { VehicleStatusCell } from './VehicleStatusBadge'

const helper =
  createColumnHelper<BaseTableFeatures, VehicleRow>()

const NoHeader = () => null

/**
 * Bảng danh sách xe lấy từ BE thật.
 *
 * Vehicle chỉ chứa:
 * - Tên xe
 * - Biển số
 * - Loại xe
 * - Công ty
 *
 * Các thông số kỹ thuật nằm trong VehicleType.
 */
export function createFleetColumns(t: TFunction) {
  return helper.columns([
    helper.accessor('name', {
      header: t('fleet.columns.name'),
      enableSorting: true,

      cell: (info) => {
        const vehicle = info.row.original

        return (
          <span className="flex min-w-0 flex-col gap-1">
            <Link
              to={`/doi-xe/${vehicle.id}`}
              onClick={(event) => event.stopPropagation()}
              className="line-clamp-2 rounded-sm font-semibold text-ink-strong hover:text-primary"
            >
              {vehicle.name}
            </Link>

            <span className="font-mono text-caption text-ink-3">
              {vehicle.id}
            </span>
          </span>
        )
      },
    }),

    helper.accessor('licensePlate', {
      header: t('fleet.columns.licensePlate'),
      enableSorting: true,
      meta: {
        width: '160px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <span className="font-mono font-semibold text-ink-strong">
          {info.getValue()}
        </span>
      ),
    }),

    helper.accessor('vehicleTypeName', {
      header: t('fleet.columns.vehicleType'),
      enableSorting: true,
      meta: {
        width: '200px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <span className="text-body text-ink-1">
          {info.getValue()}
        </span>
      ),
    }),

    helper.accessor('companyName', {
      header: t('fleet.columns.company'),
      enableSorting: true,
      meta: {
        width: '200px',
      } satisfies ColumnMeta,

      cell: (info) => (
        <span className="text-body text-ink-1">
          {info.getValue()}
        </span>
      ),
    }),

    helper.accessor(
      (vehicle) => statusRank(vehicle.status),
      {
        id: 'status',
        header: t('fleet.columns.status'),
        enableSorting: true,
        sortDescFirst: false,
        meta: {
          width: '220px',
        } satisfies ColumnMeta,
        cell: (info) => (
          <VehicleStatusCell
            status={info.row.original.status}
          />
        ),
      },
    ),

    helper.display({
      id: 'open',
      header: NoHeader,
      meta: {
        align: 'right',
        width: '48px',
      } satisfies ColumnMeta,

      cell: () => (
        <ChevronRight
          aria-hidden
          className="ml-auto size-4 text-ink-3"
          strokeWidth={1.5}
        />
      ),
    }),
  ])
}
