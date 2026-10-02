import { Download, FileUp } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Package } from '@/lib/mock-db'
import { importTemplateRows, MAX_IMPORT_FILE_MB, MAX_IMPORT_ROWS } from './package-pool-import'
import { PackageImportPreview } from './PackageImportPreview'
import { useConfirmPackageImportMutation, useDownloadImportTemplateMutation, usePreviewPackageImportMutation } from './usePackagePoolQuery'

/**
 * "Nhập file" vào kho kiện (FE-3b-02): chọn `.csv` / `.xlsx` → xem trước (tổng dòng, hợp lệ, lỗi, cảnh báo, từng dòng kèm kết quả
 * kiểm) → xác nhận. Có một dòng lỗi thì nút Xác nhận vô hiệu kèm lý do và không kiện nào được tạo; cảnh báo không chặn. Lỗi file
 * (đuôi file, rỗng, quá 10 MB, quá 1.000 dòng, thiếu cột) hiện bằng câu của `dataErrors`. File mẫu `.xlsx` / `.csv` tải ngay tại đây.
 */
export function PackageImportDialog({ onClose, onDone }: {
  onClose: () => void
  onDone: (created: Package[]) => void
}) {
  const t = useT()
  const inputId = useId()
  const blockedId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const preview = usePreviewPackageImportMutation()
  const confirm = useConfirmPackageImportMutation()
  const template = useDownloadImportTemplateMutation()
  const result = preview.data
  const blocked = result !== undefined && result.errorRows > 0
  const pending = confirm.isPending

  function handleFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    confirm.reset()
    preview.mutate(file)
    if (input.current) input.current.value = ''
  }

  function handleTemplate(format: 'xlsx' | 'csv') {
    template.mutate({ format, rows: importTemplateRows(t), sheet: t('sourcing.import.templateSheet'), fileName: `${t('sourcing.import.templateFile')}.${format}` })
  }

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent className="w-240">
        <DialogHeader icon={FileUp} title={t('sourcing.import.title')} description={t('sourcing.import.description', { maxRows: MAX_IMPORT_ROWS, maxMb: MAX_IMPORT_FILE_MB })} />
        <div className="flex max-h-[64vh] flex-col gap-3 overflow-y-auto px-7 pt-5 pb-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <input ref={input} id={inputId} type="file" accept=".csv,.xlsx" className="sr-only" tabIndex={-1} aria-label={t('sourcing.import.fileInput')} onChange={(event) => handleFile(event.target.files?.[0])} />
            <Button type="button" variant="secondary" disabled={pending} onClick={() => input.current?.click()} aria-describedby={`${inputId}-hint`}>
              <FileUp strokeWidth={1.5} />
              {fileName ? t('sourcing.import.change') : t('sourcing.import.choose')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleTemplate('xlsx')}>
              <Download strokeWidth={1.5} />
              {t('sourcing.import.templateXlsx')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleTemplate('csv')}>
              <Download strokeWidth={1.5} />
              {t('sourcing.import.templateCsv')}
            </Button>
          </div>
          <p id={`${inputId}-hint`} className="text-fine text-ink-3">{t('sourcing.import.hint')}</p>
          {fileName ? <p className="min-w-0 truncate font-mono text-caption text-ink-2">{fileName}</p> : null}

          {preview.isPending ? (
            <p role="status" className="flex items-center gap-2 text-body text-ink-2"><Spinner />{t('sourcing.import.reading')}</p>
          ) : preview.error ? (
            <Banner tone="danger">{dataErrorMessage(preview.error, t)}</Banner>
          ) : result ? (
            <>
              {blocked ? <Banner tone="danger"><span id={blockedId}>{t('sourcing.import.blocked', { count: result.errorRows })}</span></Banner> : null}
              {!blocked && result.warningRows > 0 ? <Banner tone="warning">{t('sourcing.import.warned', { count: result.warningRows })}</Banner> : null}
              <PackageImportPreview preview={result} />
            </>
          ) : null}
          {confirm.error ? <Banner tone="danger">{dataErrorMessage(confirm.error, t)}</Banner> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{t('sourcing.import.cancel')}</Button>
          <Button
            type="button"
            variant="primary"
            loading={pending}
            disabled={result === undefined || blocked || preview.isPending}
            aria-describedby={blocked ? blockedId : undefined}
            onClick={() => (result ? confirm.mutate(result, { onSuccess: onDone }) : undefined)}
          >
            {result && !blocked ? t('sourcing.import.confirmCount', { count: result.total }) : t('sourcing.import.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
