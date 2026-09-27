import { CircleAlert, CircleCheck } from 'lucide-react'
import { useId, useMemo } from 'react'
import { DataTable } from '@/components/DataTable'
import { useFormat, useT } from '@/lib/i18n'
import type { ReadyPreview } from './package-import'
import { createErrorColumns, createValidColumns } from './package-import-preview-columns'

/** Số dòng hợp lệ vẽ ra bảng xem trước; phần còn lại chỉ đếm. */
const VALID_ROWS_SHOWN = 50

/**
 * Xem trước file nhập kiện (LM-093, V2.3 `HopThoaiChuyen`): tổng số dòng hợp lệ / lỗi, cột bị bỏ qua, bảng dòng lỗi viền đỏ (dòng · kiện ·
 * mọi lỗi của dòng — dòng lỗi sẽ bỏ qua khi nhập) và bảng dòng hợp lệ (50 dòng đầu) có mốc điểm giao.
 */
export function PackageImportPreview({ preview }: { preview: ReadyPreview }) {
  const t = useT()
  const format = useFormat()
  const errorsId = useId()
  const validId = useId()
  const validColumns = useMemo(() => createValidColumns(t, format), [t, format])
  const errorColumns = useMemo(() => createErrorColumns(t, format), [t, format])
  const invalidRows = useMemo(() => preview.rows.filter((row) => row.problems.length > 0), [preview])
  const validRows = useMemo(
    () => preview.rows.flatMap((row) => (row.pkg ? [{ ...row.pkg, row: row.row }] : [])).slice(0, VALID_ROWS_SHOWN),
    [preview],
  )
  const hiddenValid = preview.valid.length - validRows.length

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <p role="status" className="text-body text-ink-1">
        {t('trips.import.summary', {
          total: format.integer(preview.rows.length),
          valid: format.integer(preview.valid.length),
          invalid: format.integer(preview.invalidCount),
        })}
      </p>
      {preview.ignoredColumns.length > 0 ? (
        <p className="text-fine text-ink-3">{t('trips.import.ignoredColumns', { columns: format.list(preview.ignoredColumns) })}</p>
      ) : null}

      {invalidRows.length > 0 ? (
        <section aria-labelledby={errorsId} className="flex flex-col gap-2">
          <h3 id={errorsId} className="flex items-center gap-1.5 text-small font-semibold text-red-700">
            <CircleAlert aria-hidden className="size-4" strokeWidth={1.75} />
            {t('trips.import.errorsTitle', { count: invalidRows.length })}
          </h3>
          {/* V2.3: khung viền đỏ, tiêu đề cột nền đỏ nhạt */}
          <div className="relative max-h-56 overflow-auto rounded-md border border-red-200 [&_thead_th]:bg-red-50 [&_thead_th]:text-ink-2 [&_tbody_tr:last-child>td]:border-b-0">
            <DataTable data={invalidRows} columns={errorColumns} cellPadding="tight" />
          </div>
        </section>
      ) : null}

      {validRows.length > 0 ? (
        <section aria-labelledby={validId} className="flex flex-col gap-2">
          <h3 id={validId} className="flex items-center gap-1.5 text-small font-semibold text-green-700">
            <CircleCheck aria-hidden className="size-4" strokeWidth={1.75} />
            {t('trips.import.validTitle', { count: preview.valid.length })}
          </h3>
          <div className="relative max-h-56 overflow-auto rounded-md border border-border [&_tbody_tr:last-child>td]:border-b-0">
            <DataTable data={validRows} columns={validColumns} cellPadding="tight" />
          </div>
          {hiddenValid > 0 ? <p className="text-fine text-ink-3">{t('trips.import.moreRows', { count: hiddenValid })}</p> : null}
        </section>
      ) : null}
    </div>
  )
}
