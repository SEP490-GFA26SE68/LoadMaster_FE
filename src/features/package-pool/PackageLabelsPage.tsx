import { Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { LABEL_SHEET, labelsBackTarget, labelSelection } from './label-sheet'
import { PackageLabel } from './PackageLabel'
import { usePackageLabelsQuery } from './usePackagePoolQuery'
import { apiFetchBlob } from '@/lib/api-client'

/*
 * Bản in là một tờ riêng gắn thẳng vào `<body>`: khi in, mọi thứ khác của trang (thanh điều hướng, dải trời, toast) bị ẩn và tờ nhãn
 * hiện ra theo khổ A4 dọc, bốn nhãn mỗi trang (`LABEL_SHEET`); trên màn hình tờ này ẩn. Không phải sửa khung ứng dụng cho riêng một màn.
 */
const PRINT_CSS = `
@media screen { [data-label-sheet] { display: none; } }
@media print {
  @page { size: A4 portrait; margin: ${LABEL_SHEET.marginMm}mm; }
  html, body { height: auto !important; overflow: visible !important; background: var(--bg) !important; }
  body > :not([data-label-sheet]) { display: none !important; }
  [data-label-sheet] { display: grid; grid-template-columns: repeat(${LABEL_SHEET.columns}, ${LABEL_SHEET.labelWidthMm}mm); gap: ${LABEL_SHEET.gapMm}mm; }
}
`

/**
 * Trang in nhãn QR `/kien-hang/nhan` (LM-104, FE-3b-05), mở theo `labels.print` — điều phối viên và nhân viên kho: nhãn của các kiện
 * trên đường dẫn (`?kien=` từ Kho kiện hay Tra cứu kiện, `?chuyen=` mọi kiện của một chuyến), nút "In nhãn" gọi hộp thoại in của trình
 * duyệt. In lại không đổi mã QR. Mã không có / không thuộc công ty thì nói rõ số bị bỏ. Nút quay lại về nơi bấm in (`labelsBackTarget`).
 * Nhân viên kho dùng máy tính bảng: nút cỡ cảm ứng.
 */
export function PackageLabelsPage() {
  const t = useT()
  const can = useCan()
  const [search] = useSearchParams()
  const selection = useMemo(() => labelSelection(search), [search])
  const back = labelsBackTarget(search, can)
  const touch = can('warehouse.operate')
  const chosen = selection.ids !== undefined || selection.tripId !== undefined
  const backendPackageIds = useMemo(
    () =>
      (selection.ids ?? [])
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    [selection.ids],
  )
  const query = usePackageLabelsQuery(selection)
  const labels = query.data ?? []
  const missing = selection.ids === undefined || !query.isSuccess ? 0 : selection.ids.length - labels.length
  const backLabel = back.kind === 'trip' ? t('sourcing.labels.backToTrip', { id: back.tripId })
    : back.kind === 'loading' ? t('sourcing.labels.backToLoading', { id: back.tripId })
      : back.kind === 'lookup' ? t('sourcing.labels.backToLookup') : t('sourcing.labels.back')

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const packageIdsKey = backendPackageIds.join(',')

  useEffect(() => {
    if (backendPackageIds.length === 0) {
      setPreviewUrl(null)
      return
    }

    let cancelled = false
    let url: string | null = null

    async function loadPreview() {
      setPreviewUrl(null)
      setExportError(null)

      try {
        const pdf = await apiFetchBlob(
          '/api/packages/export/labels',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              packageIds: backendPackageIds,
            }),
          },
        )

        if (cancelled) return

        url = URL.createObjectURL(pdf)
        setPreviewUrl(url)
      } catch (error) {
        if (!cancelled) {
          setExportError(error)
        }
      }
    }

    void loadPreview()

    return () => {
      cancelled = true

      if (url) URL.revokeObjectURL(url)
    }
    // Chỉ tải lại khi danh sách ID thay đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageIdsKey])
  async function handleExportLabels() {
    if (exporting || backendPackageIds.length === 0) return

    const packageIds = backendPackageIds

    if (
      packageIds.some(
        (id) => !Number.isSafeInteger(id) || id <= 0,
      )
    ) {
      setExportError(
        new Error('Invalid package ID for PDF export'),
      )
      return
    }

    setExporting(true)
    setExportError(null)

    try {
      const pdf = await apiFetchBlob(
        '/api/packages/export/labels',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ packageIds }),
        },
      )

      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')

      link.href = url
      link.download = 'package-labels.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()

      // Không thu hồi URL ngay trước khi trình duyệt bắt đầu tải.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setExportError(error)
    } finally {
      setExporting(false)
    }
  }

  return (

    <div className="flex min-w-0 flex-1 flex-col">

      <PageHero
        title={t('sourcing.labels.title')}
        meta={query.isSuccess && chosen ? t('sourcing.labels.count', { count: labels.length }) : undefined}
        description={t('pageHero.labels')}
        back={{ to: back.to, label: backLabel }}
        actions={backendPackageIds.length > 0 ? (
          <Button
            variant="primary"
            size={touch ? 'touch' : 'md'}
            loading={exporting}
            disabled={exporting}
            onClick={() => void handleExportLabels()}
          >
            <Printer strokeWidth={1.5} />
            {t('sourcing.labels.print')}
          </Button>
        ) : null}
      />
      {exportError ? (
        <div className="px-shell pt-4">
          <Banner tone="danger">
            {dataErrorMessage(exportError, t)}
          </Banner>
        </div>
      ) : null}
      <main className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {previewUrl ? (
          <div className="overflow-hidden rounded-lg border border-border bg-bg">
            <iframe
              src={previewUrl}
              title={t('sourcing.labels.title')}
              className="h-[75vh] w-full"
            />
          </div>
        ) : exportError ? (
          <Banner tone="danger">
            {dataErrorMessage(exportError, t)}
          </Banner>
        ) : backendPackageIds.length > 0 ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <EmptyState
            mascot="empty"
            title={t('sourcing.labels.empty')}
            description={t('sourcing.labels.emptyDescription')}
          />
        )}
      </main>
      {labels.length > 0
        ? createPortal(
          <div data-label-sheet aria-hidden>
            <style>{PRINT_CSS}</style>
            {labels.map((label) => <PackageLabel key={label.package.id} label={label} print />)}
          </div>,
          document.body,
        )
        : null}
    </div>
  )
}
