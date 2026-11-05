import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { None } from './package-look'
import type { ImportRow, ImportRowError, ImportRowWarning, PackageImportPreview as Preview } from './package-pool-import'

const helper = createColumnHelper<BaseTableFeatures, ImportRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, ImportRow, TValue>

/** Câu của một lỗi hoặc cảnh báo dòng: mã của `package-pool-import.ts` → câu theo ngôn ngữ. */
export function rowIssueText(issue: ImportRowError | ImportRowWarning, t: TFunction): string {
  switch (issue.code) {
    case 'INVALID_DIMENSION':
      return t('sourcing.import.rowIssues.INVALID_DIMENSION', { field: t(`sourcing.import.dimensionFields.${issue.field}`) })
    case 'INVALID_HANDLING_CLASS':
      return issue.value === '' ? t('sourcing.import.rowIssues.INVALID_HANDLING_CLASS_EMPTY') : t('sourcing.import.rowIssues.INVALID_HANDLING_CLASS', { value: issue.value })
    case 'PACKAGE_TYPE_NOT_FOUND':
      return t('sourcing.import.rowIssues.PACKAGE_TYPE_NOT_FOUND', { value: issue.value })
    case 'DUPLICATE_PACKAGE_CODE':
      return t('sourcing.import.rowIssues.DUPLICATE_PACKAGE_CODE', { line: issue.firstLine })
    case 'PACKAGE_CODE_EXISTS':
      return t('sourcing.import.rowIssues.PACKAGE_CODE_EXISTS', { packageId: issue.packageId })
    default:
      return t(`sourcing.import.rowIssues.${issue.code}`)
  }
}

function MeasureCell({ row }: { row: ImportRow }) {
  const t = useT()
  const format = useFormat()
  const { lengthCm, widthCm, heightCm, weightKg } = row
  if (lengthCm === null || widthCm === null || heightCm === null || weightKg === null) return <None />
  return (
    <span className="font-mono text-caption text-ink-1 tabular-nums">
      {t('sourcing.measure', { dimensions: format.dimensions(lengthCm, widthCm, heightCm), weight: format.weight(weightKg) })}
    </span>
  )
}

function CheckCell({ row }: { row: ImportRow }) {
  const t = useT()
  if (row.errors.length === 0 && row.warnings.length === 0) {
    return <span className="flex items-center gap-1.5 text-success"><CircleCheck aria-hidden className="size-4 flex-none" strokeWidth={1.5} />{t('sourcing.import.ok')}</span>
  }
  return (
    <span className="flex flex-col gap-1 whitespace-normal">
      {row.errors.length > 0 ? (
        <span className="flex items-start gap-1.5 text-danger">
          <CircleX aria-hidden className="mt-0.5 size-4 flex-none" strokeWidth={1.5} />
          {row.errors.map((issue) => rowIssueText(issue, t)).join('; ')}
        </span>
      ) : null}
      {row.warnings.length > 0 ? (
        <span className="flex items-start gap-1.5 text-warning">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" strokeWidth={1.5} />
          {row.warnings.map((issue) => rowIssueText(issue, t)).join('; ')}
        </span>
      ) : null}
    </span>
  )
}

const lineCell = (info: Cell<number>) => <span className="font-mono text-caption tabular-nums">{info.getValue()}</span>
const codeCell = (info: Cell<string>) => (info.getValue() === '' ? <None /> : <span className="block truncate font-mono text-caption text-ink-strong">{info.getValue()}</span>)
const measureCell = (info: Cell<unknown>) => <MeasureCell row={info.row.original} />
const classCell = (info: Cell<ImportRow['handlingClass']>) => {
  const value = info.getValue()
  return value === null ? <None /> : <HandlingClassChip handlingClass={value} />
}
const destinationCell = (info: Cell<string>) => (info.getValue() === '' ? <None /> : <span className="line-clamp-2 whitespace-normal">{info.getValue()}</span>)
const checkCell = (info: Cell<unknown>) => <CheckCell row={info.row.original} />

function previewColumns(t: TFunction) {
  const label = (key: 'line' | 'packageCode' | 'measure' | 'handlingClass' | 'destination' | 'check') => t(`sourcing.import.columns.${key}`)
  return helper.columns([
    helper.accessor('line', { header: label('line'), meta: { width: '60px', align: 'right' } satisfies ColumnMeta, cell: lineCell }),
    helper.accessor('packageCode', { header: label('packageCode'), meta: { width: '148px' } satisfies ColumnMeta, cell: codeCell }),
    helper.display({ id: 'measure', header: label('measure'), meta: { width: '184px' } satisfies ColumnMeta, cell: measureCell }),
    helper.accessor('handlingClass', { header: label('handlingClass'), meta: { width: '128px' } satisfies ColumnMeta, cell: classCell }),
    helper.accessor('destination', { header: label('destination'), cell: destinationCell }),
    helper.display({ id: 'check', header: label('check'), meta: { width: '240px' } satisfies ColumnMeta, cell: checkCell }),
  ])
}

/** Dòng cần sửa đứng trước: lỗi, rồi cảnh báo, rồi dòng hợp lệ — trong mỗi nhóm theo số dòng của file. */
function byUrgency(rows: readonly ImportRow[]): ImportRow[] {
  const rank = (row: ImportRow) => (row.errors.length > 0 ? 0 : row.warnings.length > 0 ? 1 : 2)
  return rows.toSorted((a, b) => rank(a) - rank(b) || a.line - b.line)
}

/**
 * Bản xem trước của file nhập kho kiện (FE-3b-02): bốn số (tổng dòng, hợp lệ, lỗi, cảnh báo) và bảng từng dòng kèm kết quả kiểm, dòng
 * có lỗi đứng đầu. Bảng phân trang tại chỗ — file tới 1.000 dòng.
 */
export function PackageImportPreview({ preview }: { preview: Preview }) {
  const t = useT()
  const format = useFormat()
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 25 })
  const columns = useMemo(() => previewColumns(t), [t])
  const rows = useMemo(() => byUrgency(preview.rows), [preview.rows])
  const stats = [
    { key: 'total', value: preview.total, tone: 'text-ink-strong' },
    { key: 'valid', value: preview.valid, tone: 'text-success' },
    { key: 'errors', value: preview.errorRows, tone: preview.errorRows > 0 ? 'text-danger' : 'text-ink-strong' },
    { key: 'warnings', value: preview.warningRows, tone: preview.warningRows > 0 ? 'text-warning' : 'text-ink-strong' },
  ] as const

  return (
    <>
      <div role="group" aria-label={t('sourcing.import.summary.label')}>
        <dl className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.key} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
              <dt className="text-caption text-ink-3">{t(`sourcing.import.summary.${stat.key}`)}</dt>
              <dd className={`font-display text-h2 font-bold tabular-nums ${stat.tone}`}>{format.integer(stat.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="relative flex-none overflow-x-auto rounded-md border border-border">
        <div className="min-w-210">
          <DataTable
            data={rows}
            columns={columns}
            getRowId={(row) => String(row.line)}
            density="roomy"
            appearance="paper"
            pagination={{ ...page, onPageChange: (pageIndex) => setPage((current) => ({ ...current, pageIndex })), onPageSizeChange: (pageSize) => setPage({ pageIndex: 0, pageSize }) }}
          />
        </div>
      </div>
    </>
  )
}
