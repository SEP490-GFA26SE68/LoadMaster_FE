import { Printer } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { downloadBlob } from '@/features/trips/download-file'
import { isApiError } from '@/lib/api-client'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { labelsBackTarget, labelSelection } from './label-sheet'
import type { LabelsPdfSource } from './packages-api'
import { useLabelsPdfQuery } from './usePackagePoolQuery'

/** Kiện cần nhãn trên đường dẫn: `?chuyen=` mọi kiện của chuyến (mã chuyến), `?kien=` các kiện theo mã số của máy chủ (bỏ mã lạ). */
function sourceOf(search: URLSearchParams): LabelsPdfSource | null {
  const selection = labelSelection(search)
  if (selection.tripId !== undefined) return { tripId: selection.tripId }
  const packageIds = (selection.ids ?? []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
  return packageIds.length > 0 ? { packageIds } : null
}

/**
 * Trang in nhãn QR `/kien-hang/nhan` (LM-104, FE-3b-05), mở theo `labels.print` — điều phối viên và nhân viên kho: nhãn của các kiện
 * trên đường dẫn (`?kien=` từ Kho kiện hay Tra cứu kiện, `?chuyen=` mọi kiện chuyến đang giữ). In lại không đổi mã QR. Nút quay lại về
 * nơi bấm in (`labelsBackTarget`). Nhân viên kho dùng máy tính bảng: nút cỡ cảm ứng.
 *
 * Khi đọc máy chủ, nhãn là file PDF máy chủ dựng (`POST /api/packages/export/labels`, theo chuyến
 * `GET /api/packages/export/labels/trip/{tripId}`): trang xem trước file đó và "In nhãn" tải đúng file đang xem. Không dựng tờ nhãn từ
 * kho mẫu. Chuyến chưa có kiện nào thì nói rõ thay cho lỗi.
 */
export function PackageLabelsPage() {
  const t = useT()
  const can = useCan()
  const [search] = useSearchParams()
  const source = useMemo(() => sourceOf(search), [search])
  const back = labelsBackTarget(search, can)
  const touch = can('warehouse.operate')
  const pdf = useLabelsPdfQuery(source)
  const previewUrl = useMemo(() => (pdf.data ? URL.createObjectURL(pdf.data) : null), [pdf.data])
  useEffect(() => () => {
    if (previewUrl !== null) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const noPackages = isApiError(pdf.error) && pdf.error.code === 'TRIP_HAS_NO_PACKAGES'
  const count = source !== null && 'packageIds' in source ? source.packageIds.length : null
  const backLabel = back.kind === 'trip' ? t('sourcing.labels.backToTrip', { id: back.tripId })
    : back.kind === 'loading' ? t('sourcing.labels.backToLoading', { id: back.tripId })
      : back.kind === 'lookup' ? t('sourcing.labels.backToLookup') : t('sourcing.labels.back')

  function handlePrint() {
    if (pdf.data) downloadBlob(pdf.data, `${t('sourcing.labels.pdfFile')}.pdf`)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('sourcing.labels.title')}
        meta={count === null ? undefined : t('sourcing.labels.count', { count })}
        description={t('pageHero.labels')}
        back={{ to: back.to, label: backLabel }}
        actions={pdf.data ? (
          <Button variant="primary" size={touch ? 'touch' : 'md'} onClick={handlePrint}>
            <Printer strokeWidth={1.5} />
            {t('sourcing.labels.print')}
          </Button>
        ) : null}
      />
      <main className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {source === null || noPackages ? (
          <EmptyState
            mascot="empty"
            title={noPackages ? dataErrorMessage(pdf.error, t) : t('sourcing.labels.empty')}
            description={noPackages ? undefined : t('sourcing.labels.emptyDescription')}
          />
        ) : pdf.error ? (
          <Banner tone="danger">{dataErrorMessage(pdf.error, t)}</Banner>
        ) : previewUrl === null ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-bg">
            <iframe src={previewUrl} title={t('sourcing.labels.title')} className="h-[75vh] w-full" />
          </div>
        )}
      </main>
    </div>
  )
}
