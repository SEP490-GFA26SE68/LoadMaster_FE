import { FileDown, Printer } from 'lucide-react'
import { useId, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { LABEL_SHEET, labelsBackTarget, labelSelection } from './label-sheet'
import { PackageLabel } from './PackageLabel'
import { MAX_PDF_LABELS, PACKAGE_POOL_SUPPORT, useExportLabelsPdfMutation, usePackageLabelsQuery } from './usePackagePoolQuery'

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
 * Nhân viên kho dùng máy tính bảng: nút cỡ cảm ứng. Nối backend: tờ nhãn vẫn dựng ở app, thêm nút phụ "Tải PDF nhãn" do backend dựng
 * (tối đa `MAX_PDF_LABELS` kiện); nhân viên kho và nhãn theo chuyến chưa có nguồn nên màn chỉ nói lý do.
 */
export function PackageLabelsPage() {
  const t = useT()
  const can = useCan()
  const pdfLimitId = useId()
  const [search] = useSearchParams()
  const selection = useMemo(() => labelSelection(search), [search])
  const back = labelsBackTarget(search, can)
  const touch = can('warehouse.operate')
  const chosen = selection.ids !== undefined || selection.tripId !== undefined
  const unavailable = PACKAGE_POOL_SUPPORT.dispatcherOnly && !can('packages.manage') ? t('sourcing.backend.labelsDispatcherOnly')
    : !PACKAGE_POOL_SUPPORT.tripLabels && selection.tripId !== undefined ? t('sourcing.backend.tripLabels') : null
  const query = usePackageLabelsQuery(selection, { enabled: unavailable === null })
  const pdf = useExportLabelsPdfMutation()
  const labels = query.data ?? []
  const missing = selection.ids === undefined || !query.isSuccess ? 0 : selection.ids.length - labels.length
  const withPdf = PACKAGE_POOL_SUPPORT.pdfLabels && can('packages.manage') && labels.length > 0
  const tooMany = labels.length > MAX_PDF_LABELS
  const backLabel = back.kind === 'trip' ? t('sourcing.labels.backToTrip', { id: back.tripId })
    : back.kind === 'loading' ? t('sourcing.labels.backToLoading', { id: back.tripId })
    : back.kind === 'lookup' ? t('sourcing.labels.backToLookup') : t('sourcing.labels.back')

  function handlePdf() {
    pdf.mutate(
      { ids: labels.map((label) => label.package.id), fileName: `${t('sourcing.labels.pdfFile')}.pdf` },
      { onError: (error) => toast.error(dataErrorMessage(error, t)) },
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('sourcing.labels.title')}
        meta={query.isSuccess && chosen ? t('sourcing.labels.count', { count: labels.length }) : undefined}
        description={t('pageHero.labels')}
        back={{ to: back.to, label: backLabel }}
        actions={labels.length > 0 ? (
          <>
            {withPdf ? (
              <Button variant="glass" loading={pdf.isPending} disabled={tooMany} aria-describedby={tooMany ? pdfLimitId : undefined} onClick={handlePdf}>
                <FileDown strokeWidth={1.5} />
                {t('sourcing.labels.downloadPdf')}
              </Button>
            ) : null}
            <Button variant="primary" size={touch ? 'touch' : 'md'} onClick={() => window.print()}>
              <Printer strokeWidth={1.5} />
              {t('sourcing.labels.print')}
            </Button>
          </>
        ) : null}
      />
      <main className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {unavailable !== null ? (
          <Banner tone="info">{unavailable}</Banner>
        ) : query.isPending ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : query.error ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : labels.length === 0 ? (
          <div className="flex flex-col gap-4">
            {missing > 0 ? <Banner tone="warning">{t('sourcing.labels.missing', { count: missing })}</Banner> : null}
            <EmptyState mascot="empty" title={t('sourcing.labels.empty')} description={back.kind === 'lookup' ? t('sourcing.labels.emptyLookup') : t('sourcing.labels.emptyDescription')} />
          </div>
        ) : (
          <div className={touch ? 'flex flex-col gap-4 text-body-lg' : 'flex flex-col gap-4'}>
            <Banner tone="info" icon={Printer}>{t('sourcing.labels.hint')}</Banner>
            {missing > 0 ? <Banner tone="warning">{t('sourcing.labels.missing', { count: missing })}</Banner> : null}
            {withPdf && tooMany ? <Banner tone="warning"><span id={pdfLimitId}>{t('sourcing.labels.pdfLimit', { max: MAX_PDF_LABELS })}</span></Banner> : null}
            <section aria-label={t('sourcing.labels.sheet')} className="flex flex-wrap items-start gap-4">
              {labels.map((label) => <PackageLabel key={label.package.id} label={label} />)}
            </section>
          </div>
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
