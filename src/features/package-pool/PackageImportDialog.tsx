import { Download, FileUp } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { MAX_IMPORT_FILE_MB, MAX_IMPORT_ROWS } from './package-pool-import'
import {
  useConfirmPackageImportMutation,
  useDownloadImportTemplateMutation,
  usePreviewPackageImportMutation,
} from './usePackagePoolQuery'

import { useQuery } from '@tanstack/react-query'
import { listDeliveryRequirements } from '@/features/requirements/requirements-api'
import { SelectField } from '@/components/ui/SelectField'
import { useForm } from 'react-hook-form'

const IMPORT_FIELD_LABELS: Record<string, string> = {
  packageCode: 'Mã kiện (packageCode)',
  packageName: 'Tên kiện (packageName)',
  lengthCm: 'Chiều dài (lengthCm)',
  widthCm: 'Chiều rộng (widthCm)',
  heightCm: 'Chiều cao (heightCm)',
  weightKg: 'Khối lượng (weightKg)',
  quantity: 'Số lượng (quantity)',
  handlingClass: 'Phân loại xử lý (handlingClass)',
  destination: 'Điểm đến (destination)',
  packageTypeCode: 'Mã loại kiện (packageTypeCode)',
  orientation: 'Hướng đặt (orientation)',
  fragilityLevel: 'Mức dễ vỡ (fragilityLevel)',
  maxTopLoadKg: 'Tải đè tối đa (maxTopLoadKg)',
  maxLayers: 'Số tầng tối đa (maxLayers)',
  minSupportRatio: 'Tỷ lệ đỡ tối thiểu (minSupportRatio)',
  priority: 'Độ ưu tiên (priority)',
}

function formatImportFieldLabel(field: string): string {
  return IMPORT_FIELD_LABELS[field] ?? field
}

export function PackageImportDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const t = useT()
  const format = useFormat()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const requirementForm = useForm<{ deliveryRequirementId: string }>({
    defaultValues: {
      deliveryRequirementId: '',
    },
  })

  const requirementsQuery = useQuery({
    queryKey: ['requirements'],
    queryFn: listDeliveryRequirements,
  })

  const deliveryRequirementId = requirementForm.watch('deliveryRequirementId')

  const availableRequirements = (requirementsQuery.data ?? [])
    .map((row) => row.requirement)
    .filter(
      (requirement) =>
        requirement.status === 'PENDING' &&
        requirement.tripId === undefined,
    )

  const requirementOptions = availableRequirements.map((requirement) => ({
    value: requirement.id,
    label:
      `#${requirement.id} — ${requirement.customerName ?? '—'}` +
      ` — ${requirement.address}` +
      ` (${requirement.receivedPackageCount ?? 0}/${requirement.expectedPackageCount ?? '—'} kiện)`,
  }))
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
    if (
      !deliveryRequirementId ||
      !selectedFile ||
      !result ||
      blocked ||
      pending ||
      preview.isPending ||
      requirementsQuery.isPending ||
      requirementsQuery.isError
    ) {
      return
    }

    confirm.mutate(
      {
        file: selectedFile,
        deliveryRequirementId,
      },
      {
        onSuccess: () => {
          onDone()
        },
      },
    )
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
          <div className="flex flex-col gap-2">
            {requirementsQuery.isPending ? (
              <div className="flex items-center gap-2">
                <Spinner />
                <span>{t('sourcing.import.loadingRequirements')}</span>
              </div>
            ) : requirementsQuery.isError ? (
              <Banner tone="danger">
                {dataErrorMessage(requirementsQuery.error, t)}
              </Banner>
            ) : availableRequirements.length === 0 ? (
              <Banner tone="info">
                {t('sourcing.import.noRequirements')}
              </Banner>
            ) : (
              <SelectField
                control={requirementForm.control}
                name="deliveryRequirementId"
                label={t('sourcing.import.deliveryRequirement')}
                options={requirementOptions}
                disabled={preview.isPending || confirm.isPending}
              />
            )}
          </div>
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
                    field: formatImportFieldLabel(issue.field),
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
                    field: formatImportFieldLabel(issue.field),
                    message: issue.message,
                  })}
                </Banner>
              ))}

              {result.validRows.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-small">
                    <thead className="border-b border-border bg-n-50 text-caption font-semibold text-ink-2">
                      <tr>
                        <th className="px-3 py-2">Dòng</th>
                        <th className="px-3 py-2">Mã kiện</th>
                        <th className="px-3 py-2">Kích thước (D × R × C)</th>
                        <th className="px-3 py-2">Khối lượng</th>
                        <th className="px-3 py-2">Loại hàng</th>
                        <th className="px-3 py-2">Điểm đến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.validRows.map((row) => (
                        <tr key={`valid-row-${row.rowIndex}-${row.packageCode}`}>
                          <td className="px-3 py-2 font-mono tabular-nums">{row.rowIndex}</td>
                          <td className="px-3 py-2 font-mono font-medium">{row.packageCode}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {format.dimensions(row.lengthCm, row.widthCm, row.heightCm)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {format.weight(row.weightKg)}
                          </td>
                          <td className="px-3 py-2 font-mono">{row.handlingClass || 'STANDARD'}</td>
                          <td className="px-3 py-2">{row.destination}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

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
              !deliveryRequirementId ||
              requirementsQuery.isPending ||
              requirementsQuery.isError ||
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
