import { createColumnHelper } from '@tanstack/react-table'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import type { TFunction } from '@/lib/i18n'
import { CargoBoxCell, ObstacleCell, PayloadCell, VehicleNameText } from './FleetCells'
import { statusRank, type VehicleRow } from './vehicle-status'
import { VehicleStatusCell } from './VehicleStatusBadge'

const helper = createColumnHelper<BaseTableFeatures, VehicleRow>()

/** Cột mũi tên không có tiêu đề; khai một lần ở cấp module để bảng không dựng lại ô tiêu đề (AGENTS mục 5). */
const NoHeader = () => null

/**
 * Cột bảng đội xe (V2.3, DoiXe.jpg): Phương tiện · Lòng thùng · Tải tối đa · Vật cản · Trạng thái, và một cột mũi tên trang trí vì
 * cả dòng mở trang cấu hình xe. Cửa xe xem ở trang cấu hình xe. Chữ trong ô tự lấy ngôn ngữ (`useT`, `useFormat`); `t` ở đây chỉ cho
 * tiêu đề cột, nên cột dựng lại khi đổi ngôn ngữ.
 */
export function createFleetColumns(t: TFunction) {
  return helper.columns([
    helper.accessor('name', {
      header: t('fleet.columns.name'),
      enableSorting: true,
      cell: (info) => {
        const vehicle = info.row.original
        return (
          <span className="flex min-w-0 flex-col whitespace-normal">
            {/* Dòng mở trang bằng chuột; liên kết ở tên cho bàn phím (AGENTS mục 10). */}
            <Link
              to={`/doi-xe/${vehicle.id}`}
              onClick={(event) => event.stopPropagation()}
              className="line-clamp-2 rounded-sm font-semibold text-ink-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <VehicleNameText name={info.getValue()} />
            </Link>
            {/* Khoảng trắng không hiện trong flex nhưng tách tên và mã trong tên truy cập của dòng */}
            {' '}
            <span className="font-mono text-caption text-ink-3">{vehicle.id}</span>
          </span>
        )
      },
    }),
    helper.accessor('innerLengthCm', {
      header: t('fleet.columns.inner'),
      enableSorting: true,
      meta: { width: '330px' } satisfies ColumnMeta,
      cell: (info) => <CargoBoxCell vehicle={info.row.original} />,
    }),
    helper.accessor('maxPayloadKg', {
      header: t('fleet.columns.payload'),
      enableSorting: true,
      meta: { align: 'right', width: '130px' } satisfies ColumnMeta,
      cell: (info) => <PayloadCell kilograms={info.getValue()} />,
    }),
    helper.accessor((vehicle) => vehicle.obstacles.length, {
      id: 'obstacleCount',
      header: t('fleet.columns.obstacles'),
      meta: { width: '150px' } satisfies ColumnMeta,
      cell: (info) => <ObstacleCell vehicle={info.row.original} />,
    }),
    helper.accessor((vehicle) => statusRank(vehicle.state.status), {
      id: 'status',
      header: t('fleet.columns.status'),
      enableSorting: true,
      // Bấm lần đầu: sẵn sàng trước, như thứ tự bộ lọc
      sortDescFirst: false,
      meta: { width: '260px' } satisfies ColumnMeta,
      cell: (info) => <VehicleStatusCell state={info.row.original.state} />,
    }),
    helper.display({
      id: 'open',
      header: NoHeader,
      meta: { align: 'right', width: '48px' } satisfies ColumnMeta,
      cell: () => <ChevronRight aria-hidden className="ml-auto size-4 text-ink-3" strokeWidth={1.5} />,
    }),
  ])
}
