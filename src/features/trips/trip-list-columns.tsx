import { createColumnHelper } from '@tanstack/react-table'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import { initialsOf } from '@/types/user'
import { splitVehicleName, type TripRow } from './trip-list'

const helper = createColumnHelper<BaseTableFeatures, TripRow>()
const mono = 'font-mono text-caption'

/** `hidden`: cột chỉ để sắp xếp — ngày chạy là dòng nhóm của bảng chứ không phải một cột (V2.3). */
export type TripColumnMeta = ColumnMeta & { hidden?: boolean }

/**
 * Cột danh sách chuyến V2.3 (`ChuyenHang.jpg`): Tuyến (tên chuyến + "N điểm · tuyến"), mã, xe (tên + biển số), tài xế, kiện, lấp đầy,
 * trạng thái, mũi tên mở. Ngày chạy là cột ẩn để sắp xếp; bảng nhóm dòng theo nó. Cột sắp xếp được khai `enableSorting`. Mã chuyến
 * là liên kết để mở chi tiết bằng bàn phím; bấm cả dòng cũng mở.
 */
export function createTripColumns(t: TFunction, format: Formatter) {
  return helper.columns([
    helper.accessor('scheduledDate', {
      header: t('trips.list.date'),
      enableSorting: true,
      sortDescFirst: true,
      meta: { hidden: true } satisfies TripColumnMeta,
    }),
    helper.accessor('name', {
      header: t('trips.list.route'),
      enableSorting: true,
      cell: (info) => {
        const row = info.row.original
        const line = t('trips.list.routeLine', { stops: t('trips.list.stopsShort', { count: row.stopCount }), route: row.route })
        return (
          <span className="flex min-w-0 flex-col gap-0.75">
            <span className="truncate font-semibold text-ink-strong">{info.getValue()}</span>
            <span className="truncate text-fine text-ink-3" title={line}>{line}</span>
          </span>
        )
      },
    }),
    helper.accessor('id', {
      header: t('trips.list.id'),
      enableSorting: true,
      // "TRIP-2026-0914" mono 12 px cùng mũi tên sắp xếp
      meta: { width: '136px' } satisfies TripColumnMeta,
      cell: (info) => (
        <Link
          to={`/chuyen/${info.getValue()}`}
          // Dòng cũng mở chi tiết khi bấm: chặn nổi bọt để không đẩy hai mục lịch sử
          onClick={(event) => event.stopPropagation()}
          className="rounded-sm font-mono text-caption text-ink-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    helper.accessor('vehicleName', {
      header: t('trips.list.vehicle'),
      enableSorting: true,
      meta: { width: '13%' } satisfies TripColumnMeta,
      cell: (info) => {
        const { model, plate } = splitVehicleName(info.getValue())
        return (
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-ink-1">{model}</span>
            {plate ? <span className="font-mono text-caption leading-none text-ink-3">{plate}</span> : null}
          </span>
        )
      },
    }),
    helper.accessor('driverName', {
      header: t('trips.list.driver'),
      enableSorting: true,
      meta: { width: '15%' } satisfies TripColumnMeta,
      cell: (info) => {
        const name = info.getValue()
        if (name === null) return <span className="text-body text-ink-3">{t('trips.list.unassignedDriver')}</span>
        return (
          <span className="flex min-w-0 items-center gap-2.25">
            {/* Ô vuông bo góc, không tròn (AGENTS mục 5, bảng dữ liệu); tên ngay bên cạnh nên ô ẩn khỏi trình đọc màn hình */}
            <span aria-hidden className="grid size-6.5 flex-none place-items-center rounded-sm bg-cyan-50 text-micro font-semibold text-cyan-800 shadow-[inset_0_0_0_1px_var(--cyan-100)]">
              {initialsOf(name)}
            </span>
            <span className="truncate">{name}</span>
          </span>
        )
      },
    }),
    helper.accessor('packageCount', {
      header: t('trips.list.packages'),
      enableSorting: true,
      meta: { align: 'right', width: '104px' } satisfies TripColumnMeta,
      cell: (info) => <span className="font-mono text-body font-semibold text-ink-strong tabular-nums">{format.integer(info.getValue())}</span>,
    }),
    helper.accessor('volumePercent', {
      header: t('trips.list.volume'),
      enableSorting: true,
      meta: { width: '150px' } satisfies TripColumnMeta,
      cell: (info) => {
        const value = info.getValue()
        if (value === null) return <span className="text-body text-ink-3">{t('trips.list.notOptimized')}</span>
        return (
          <span className="flex items-center gap-2.5">
            <ProgressBar value={value} className="w-16 flex-none" />
            <span className={mono}>{format.percent(value)}</span>
          </span>
        )
      },
    }),
    helper.accessor('status', {
      header: t('trips.list.status'),
      meta: { width: '184px' } satisfies TripColumnMeta,
      // Dòng phụ (LM-104) nằm dưới chip: tiến độ kho hoặc phương án lỗi thời — hai dòng vừa hàng 56 px
      cell: (info) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={info.getValue()} />
          <TripSubStatusTag sub={info.row.original.sub} />
          <TripSubStatusTag sub={info.row.original.routeSub} />
        </span>
      ),
    }),
    helper.display({
      id: 'open',
      header: () => null,
      meta: { align: 'right', width: '48px' } satisfies TripColumnMeta,
      cell: () => <ChevronRight aria-hidden className="ml-auto size-4.5 text-n-500" strokeWidth={1.5} />,
    }),
  ])
}
