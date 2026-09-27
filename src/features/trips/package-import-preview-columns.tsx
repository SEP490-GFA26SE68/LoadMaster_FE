import { createColumnHelper } from '@tanstack/react-table'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import type { CargoPackage } from '@/domain/models'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { ImportRow } from './package-import'
import { importProblemMessage } from './package-import-messages'
import { PackageStopMarker } from './PackageStopMarker'

/** Cột hai bảng xem trước của hộp thoại nhập kiện (LM-093, V2.3 `HopThoaiChuyen`): dòng lỗi và dòng hợp lệ. */

export type ValidRow = CargoPackage & { readonly row: number }

const mono = 'font-mono text-caption text-ink-1'
const validHelper = createColumnHelper<BaseTableFeatures, ValidRow>()
const errorHelper = createColumnHelper<BaseTableFeatures, ImportRow>()

export function createValidColumns(t: TFunction, format: Formatter) {
  return validHelper.columns([
    validHelper.accessor('row', { header: t('trips.import.preview.row'), meta: { align: 'right', width: '64px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{info.getValue()}</span> }),
    validHelper.accessor('id', { header: t('trips.import.preview.id'), meta: { width: '112px' } satisfies ColumnMeta, cell: (info) => <span className="font-mono text-caption text-ink-2">{info.getValue()}</span> }),
    validHelper.accessor('name', { header: t('trips.import.preview.name'), cell: (info) => <span className="block truncate text-ink-1">{info.getValue()}</span> }),
    validHelper.display({
      id: 'size',
      header: t('trips.import.preview.size'),
      meta: { align: 'right', width: '150px' } satisfies ColumnMeta,
      cell: ({ row }) => <span className={mono}>{format.dimensions(row.original.lengthCm, row.original.widthCm, row.original.heightCm)}</span>,
    }),
    validHelper.accessor('weightKg', { header: t('trips.import.preview.weight'), meta: { align: 'right', width: '104px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{format.weight(info.getValue())}</span> }),
    validHelper.accessor('quantity', { header: t('trips.import.preview.quantity'), meta: { align: 'right', width: '64px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{format.integer(info.getValue())}</span> }),
    validHelper.accessor('deliveryStop', {
      header: t('trips.import.preview.stop'),
      meta: { align: 'right', width: '64px' } satisfies ColumnMeta,
      cell: (info) => (
        <span className="inline-flex">
          <PackageStopMarker number={info.getValue()} size="sm" />
          <span className="sr-only">{t('common.stop', { number: info.getValue() })}</span>
        </span>
      ),
    }),
  ])
}

export function createErrorColumns(t: TFunction, format: Formatter) {
  return errorHelper.columns([
    errorHelper.accessor('row', { header: t('trips.import.preview.row'), meta: { align: 'right', width: '64px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{info.getValue()}</span> }),
    errorHelper.display({
      id: 'package',
      header: t('trips.import.preview.package'),
      meta: { width: '38%' } satisfies ColumnMeta,
      cell: ({ row }) => (
        <span className="block truncate text-small text-ink-1">
          {row.original.id ? <span className="font-mono text-caption text-ink-2">{row.original.id}</span> : null}
          {row.original.id && row.original.name ? ' · ' : null}
          {row.original.name}
        </span>
      ),
    }),
    errorHelper.display({
      id: 'problems',
      header: t('trips.import.preview.problems'),
      cell: ({ row }) => (
        <ul className="flex list-none flex-col gap-0.5 py-1.5 text-small whitespace-normal text-red-700">
          {row.original.problems.map((problem, index) => <li key={index}>{importProblemMessage(problem, t, format)}</li>)}
        </ul>
      ),
    }),
  ])
}
