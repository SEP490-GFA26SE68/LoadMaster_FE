
import { Download, FileUp } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { MAX_IMPORT_FILE_MB, MAX_IMPORT_ROWS } from './package-pool-import'
import {
  useConfirmPackageImportMutation,
  useDownloadImportTemplateMutation,
  usePreviewPackageImportMutation,
} from './usePackagePoolQuery'

export function PackageImportDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const t = useT()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const preview = usePreviewPackageImportMutation()
  const confirm = useConfirmPackageImportMutation()
  const template = useDownloadImportTemplateMutation()

  const result = preview.data
  const errorCount = result?.errors.length ?? 0
  const warningCount = result?.warnings.length ?? 0
  const blocked = errorCount > 0
  const pending = confirm.isPending

  function handleFile(file: File | undefined) {
    if (!file) return

    if (input.current) {
      input.current.value = ''
    }

    preview.reset()
    confirm.reset()
    setSelectedFile(null)
    setFileError(null)

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setFileError('Chỉ hỗ trợ file Excel .xlsx')
      return
    }

    if (file.size === 0) {
      setFileError('File Excel không được để trống')
      return
    }

    if (file.size > MAX_IMPORT_FILE_MB * 1024 * 1024) {
      setFileError(`File không được vượt quá ${MAX_IMPORT_FILE_MB} MB`)
      return
    }

    setSelectedFile(file)
    preview.mutate(file)
  }

  function handleConfirm() {
    if (!selectedFile || !result || blocked || pending) return

    confirm.mutate(selectedFile, {
      onSuccess: () => {
        onDone()
      },
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent className="w-240">
        <DialogHeader
          icon={FileUp}
          title={t('sourcing.import.title')}
          description={t('sourcing.import.description', {
            maxRows: MAX_IMPORT_ROWS,
            maxMb: MAX_IMPORT_FILE_MB,
          })}
        />

        <div className="flex max-h-[64vh] flex-col gap-3 overflow-y-auto px-7 pt-5 pb-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={input}
              id={inputId}
              type="file"
              accept=".xlsx"
              className="sr-only"
              tabIndex={-1}
              aria-label={t('sourcing.import.fileInput')}
              onChange={(event) => handleFile(event.target.files?.[0])}
            />

            <Button
              type="button"
              variant="secondary"
              disabled={pending || preview.isPending}
              onClick={() => input.current?.click()}
            >
              <FileUp strokeWidth={1.5} />
              {selectedFile
                ? t('sourcing.import.change')
                : t('sourcing.import.choose')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={template.isPending || pending}
              onClick={() => template.mutate()}
            >
              <Download strokeWidth={1.5} />
              {t('sourcing.import.templateXlsx')}
            </Button>
          </div>

          {selectedFile ? (
            <p className="min-w-0 truncate font-mono text-caption text-ink-2">
              {selectedFile.name}
            </p>
          ) : null}

          {fileError ? (
            <Banner tone="danger">{fileError}</Banner>
          ) : null}

          {template.error ? (
            <Banner tone="danger">
              {dataErrorMessage(template.error, t)}
            </Banner>
          ) : null}

          {preview.isPending ? (
            <p
              role="status"
              className="flex items-center gap-2 text-body text-ink-2"
            >
              <Spinner />
              {t('sourcing.import.reading')}
            </p>
          ) : preview.error ? (
            <Banner tone="danger">
              {dataErrorMessage(preview.error, t)}
            </Banner>
          ) : result ? (
            <>
              <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
                {[
                  { label: 'Tổng dòng', value: result.totalRows },
                  { label: 'Hợp lệ', value: result.validCount },
                  { label: 'Lỗi', value: errorCount },
                  { label: 'Cảnh báo', value: warningCount },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <p className="text-caption text-ink-3">{item.label}</p>
                    <p className="font-display text-h2 font-bold tabular-nums">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>


              {blocked ? (
                <Banner tone="danger">
                  {t('sourcing.import.blockedExcel', {
                    count: errorCount,
                  })}
                </Banner>
              ) : null}

              {result.errors.map((issue, index) => (
                <Banner
                  key={`error-${issue.rowIndex}-${issue.field}-${index}`}
                  tone="danger"
                >
                  {t('sourcing.import.rowErrorDetail', {
                    row: issue.rowIndex,
                    field: issue.field,
                    message: issue.message,
                  })}
                </Banner>
              ))}

              {result.warnings.map((issue, index) => (
                <Banner
                  key={`warning-${issue.rowIndex}-${issue.field}-${index}`}
                  tone="warning"
                >
                  {t('sourcing.import.rowWarningDetail', {
                    row: issue.rowIndex,
                    field: issue.field,
                    message: issue.message,
                  })}
                </Banner>
              ))}


              <p className="text-body text-ink-2">
                {t('sourcing.import.previewResult', {
                  total: result.totalRows,
                  valid: result.validCount,
                })}
              </p>
            </>
          ) : null}

          {confirm.error ? (
            <Banner tone="danger">
              {dataErrorMessage(confirm.error, t)}
            </Banner>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onClose}
          >
            {t('sourcing.import.cancel')}
          </Button>

          <Button
            type="button"
            variant="primary"
            loading={pending}
            disabled={
              !selectedFile ||
              !result ||
              blocked ||
              preview.isPending ||
              pending
            }
            onClick={handleConfirm}
          >
            {result && !blocked
              ? t('sourcing.import.confirmCount', {
                count: result.validCount,
              })
              : t('sourcing.import.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
