import { createColumnHelper } from '@tanstack/react-table'
import { CircleCheck, Download, FileUp, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { downloadBlob } from '@/features/trips/download-file'
import { readImportFile } from '@/features/trips/read-import-file'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PackageType } from '@/lib/mock-db'
import { MAX_REGISTER_QUANTITY } from './register-form'
import { parseRegisterTable, registerTemplateCsv, type ParsedRegisterRow, type RegisterProblem } from './register-import'

const helper = createColumnHelper<BaseTableFeatures, ParsedRegisterRow>()

function problemText(problem: RegisterProblem, t: TFunction): string {
  switch (problem.code) {
    case 'typeMissing':
      return t('sourcing.register.file.problems.typeMissing')
    case 'typeUnknown':
      return t('sourcing.register.file.problems.typeUnknown', { value: problem.value })
    case 'quantityInvalid':
      return t('sourcing.register.file.problems.quantityInvalid', { max: MAX_REGISTER_QUANTITY })
  }
}

function previewColumns(t: TFunction) {
  return helper.columns([
    helper.accessor('line', { header: t('sourcing.register.file.columns.row'), meta: { width: '56px', align: 'right' } satisfies ColumnMeta, cell: (info) => <span className="font-mono text-caption">{info.getValue()}</span> }),
    helper.accessor('typeText', {
      header: t('sourcing.register.file.columns.type'),
      cell: (info) => <span className="line-clamp-2 whitespace-normal">{info.row.original.type?.name ?? info.getValue()}</span>,
    }),
    helper.accessor('quantity', { header: t('sourcing.register.file.columns.quantity'), meta: { width: '84px', align: 'right' } satisfies ColumnMeta, cell: (info) => <span className="font-mono text-caption">{info.getValue() ?? '—'}</span> }),
    helper.accessor('reference', { header: t('sourcing.register.file.columns.reference'), meta: { width: '116px' } satisfies ColumnMeta, cell: (info) => <span className="truncate font-mono text-caption">{info.getValue()}</span> }),
    helper.display({
      id: 'check',
      header: t('sourcing.register.file.columns.check'),
      meta: { width: '180px' } satisfies ColumnMeta,
      cell: (info) => {
        const problems = info.row.original.problems
        return problems.length === 0 ? (
          <span className="flex items-center gap-1.5 text-success"><CircleCheck aria-hidden className="size-4" strokeWidth={1.5} />{t('sourcing.register.file.ok')}</span>
        ) : (
          <span className="flex items-start gap-1.5 whitespace-normal text-danger">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" strokeWidth={1.5} />
            {problems.map((problem) => problemText(problem, t)).join('; ')}
          </span>
        )
      },
    }),
  ])
}

/**
 * Chế độ "Nhập file" của hộp thoại đăng ký (LM-104): chọn `.csv` / `.xlsx` (dùng lại bộ đọc file của nhập kiện LM-093), xem trước
 * từng dòng với kết quả kiểm, tải file mẫu dựng từ loại kiện thật. `onRowsChange` nhận các dòng đã đọc (hoặc `null` khi chưa có file).
 */
export function RegisterImportPanel({ types, rows, onRowsChange }: {
  types: readonly PackageType[]
  rows: readonly ParsedRegisterRow[] | null
  onRowsChange: (rows: ParsedRegisterRow[] | null) => void
}) {
  const t = useT()
  const format = useFormat()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [unreadable, setUnreadable] = useState(false)
  const columns = useMemo(() => previewColumns(t), [t])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setUnreadable(false)
    setReading(true)
    onRowsChange(null)
    try {
      onRowsChange(parseRegisterTable(await readImportFile(file), types, MAX_REGISTER_QUANTITY))
    } catch {
      setUnreadable(true)
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  function handleTemplate() {
    const header = (['type', 'quantity', 'reference'] as const).map((key) => t(`sourcing.register.file.header.${key}`))
    const csv = registerTemplateCsv(header, types)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), t('sourcing.register.file.templateFile'))
  }

  const invalid = rows?.filter((row) => row.problems.length > 0).length ?? 0
  const packages = rows?.reduce((sum, row) => sum + (row.quantity ?? 0), 0) ?? 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()} aria-describedby={`${inputId}-hint`}>
          <FileUp strokeWidth={1.5} />
          {fileName ? t('sourcing.register.file.change') : t('sourcing.register.file.choose')}
        </Button>
        <Button type="button" variant="ghost" onClick={handleTemplate}>
          <Download strokeWidth={1.5} />
          {t('sourcing.register.file.template')}
        </Button>
        {fileName ? <span className="min-w-0 truncate font-mono text-caption text-ink-2">{fileName}</span> : null}
      </div>
      <p id={`${inputId}-hint`} className="text-fine text-ink-3">{t('sourcing.register.file.hint')}</p>

      {reading ? (
        <p role="status" className="flex items-center gap-2 text-body text-ink-2"><Spinner />{t('sourcing.register.file.reading')}</p>
      ) : unreadable ? (
        <Banner tone="danger">{t('sourcing.register.file.unreadable')}</Banner>
      ) : rows && rows.length === 0 ? (
        <Banner tone="warning">{t('sourcing.register.file.empty')}</Banner>
      ) : rows ? (
        <>
          <p role="status" className="text-small text-ink-2">
            {t('sourcing.register.file.summary', { count: rows.length, packages: format.integer(packages) })}
          </p>
          {invalid > 0 ? <Banner tone="danger">{t('sourcing.register.file.invalid', { count: invalid })}</Banner> : null}
          <div className="max-h-60 overflow-auto rounded-md border border-border">
            <DataTable data={[...rows]} columns={columns} density="comfortable" appearance="paper" />
          </div>
        </>
      ) : null}
    </div>
  )
}
