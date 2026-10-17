import { ScanLine } from 'lucide-react'
import { PackageVerify } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { VerifyMethod } from '@/lib/mock-db'
import { DeliveryItemRow } from './DeliveryItemRow'
import type { DriverStopScreen } from './driver-api'
import { DriverGpsToggle } from './DriverGpsToggle'
import { DriverNotice } from './DriverNotice'
import { DriverStopHeader } from './DriverStopHeader'
import { StopContactCard } from './StopContactCard'
import { StopFooter } from './StopFooter'
import { StopNotices } from './StopNotices'
import { StopProgress } from './StopProgress'
import { useDeliveryStop } from './useDeliveryStop'
import { useDriverStopScreenQuery } from './useDriverQueries'
import { useUnloadScan } from './useUnloadScan'

/**
 * Backend chưa trả mã QR của kiện cho tài xế và chưa có xác nhận tay: hộp đối chiếu chỉ còn gõ mã — mã đứng đầu dòng kiện hoặc mã của kho
 * kiện (`packageOfCode`), nên ô gõ mã có nhãn và gợi ý riêng.
 */
const CODE_ONLY: readonly VerifyMethod[] = ['CODE']

/**
 * Màn điểm giao `/tai-xe/diem-giao?chuyen=<mã số>` khi nhóm tài xế nối backend: điểm đang giao của chuyến lấy từ backend (điểm chưa
 * hoàn tất đầu tiên). Chỉ chuyến đang vận chuyển của chính tài xế mở được; chuyến vừa giao xong trong lần mở trang này nói đã xong.
 */
export function BackendDriverStop({ tripId }: { tripId: string }) {
  const t = useT()
  const query = useDriverStopScreenQuery(tripId)
  if (query.isPending) {
    return (
      <div role="status" className="grid h-dvh place-items-center bg-bg text-body-lg text-text-2">
        <span className="inline-flex items-center gap-2"><Spinner />{t('driver.loading')}</span>
      </div>
    )
  }
  if (query.isError) return <DriverNotice mascot="error" title={t('driver.loadErrorTitle')} description={dataErrorMessage(query.error, t)} />
  const screen = query.data
  if (screen.kind === 'notInTransit') return <DriverNotice title={t('driver.backend.notInTransitTitle')} description={t('driver.backend.notInTransitDescription')} />
  if (screen.kind === 'noStops') return <DriverNotice title={t('driver.backend.noStopsTitle')} description={t('driver.backend.noStopsDescription', { tripId: screen.trip.code })} />
  if (screen.kind === 'completed') {
    return <DriverNotice mascot="done" title={t('driver.backend.completedTitle')} description={t('driver.backend.completedDescription', { tripId: screen.trip.code })} />
  }
  return <BackendStopView tripId={tripId} screen={screen} />
}

/**
 * Một điểm giao theo backend — cùng bố cục và luật cảm ứng với màn kho mẫu (`DeliveryStopView`: chữ 16 px, nút 56 px, một nút chính ở
 * chân màn), bỏ những phần backend chưa có (D-20): không "Xuất phát", không "Đã đến" (điểm đang giao dỡ được ngay), không quét QR hay xác
 * nhận tay, không báo sự cố theo kiện hay sự cố trên đường, không nhận hàng dọc đường, không khung 3D vị trí hàng (backend chưa trả chỗ xếp),
 * không giờ đến dự kiến. Dỡ: gõ mã in trên nhãn từng kiện; hoàn tất điểm khi mọi kiện đã dỡ, rồi màn sang điểm kế tiếp của backend.
 */
function BackendStopView({ tripId, screen }: { tripId: string; screen: Extract<DriverStopScreen, { kind: 'stop' }> }) {
  const t = useT()
  const { view, stops } = screen
  const actions = useDeliveryStop(tripId, view)
  const scan = useUnloadScan(tripId, view, stops)
  // Backend báo cả điểm đã dỡ (kể cả kiện dỡ trước lần mở trang này): không còn gì để đối chiếu thì đóng hộp
  if (scan.open && !scan.pending && view.verifiable === 0) scan.setOpen(false)

  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <DriverStopHeader stop={view.stop} stops={stops} completedStops={view.completedStops} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-4 pb-4">
        <StopNotices view={view} />
        <DriverGpsToggle tripId={tripId} />
        <StopContactCard stop={view.stop} />
        <StopProgress view={view} />

        {view.verifiable > 0 ? (
          <Button variant="secondary" size="touch" className="w-full flex-none" onClick={() => scan.setOpen(true)}>
            <ScanLine strokeWidth={2} />
            {t('driver.scan.open')}
          </Button>
        ) : null}

        {view.items.length > 0 ? (
          <ul aria-label={view.stop.name} className="m-0 flex flex-none list-none flex-col overflow-hidden rounded-lg border border-border bg-bg p-0 shadow-card">
            {view.items.map(({ item, unloaded }) => <DeliveryItemRow key={item.id} item={item} done={unloaded} />)}
          </ul>
        ) : (
          <p className="m-0 flex-none rounded-lg border border-border bg-bg p-4 text-ink-2 shadow-card">{t('driver.noItems')}</p>
        )}

        <span className="flex-none py-1 text-center text-ink-3">
          {view.remaining > 0 ? t('driver.backend.remaining', { count: view.remaining }) : t('driver.backend.allUnloaded')}
        </span>
      </div>

      <StopFooter view={view} stops={stops} actions={actions} scanPending={scan.pending} />

      <PackageVerify
        open={scan.open}
        onOpenChange={scan.setOpen}
        methods={CODE_ONLY}
        codeLabel={t('driver.backend.codeLabel')}
        codeHint={t('driver.backend.codeHint')}
        title={t('driver.scan.title', { number: view.stop.number })}
        description={t('driver.backend.scanDescription', { number: view.stop.number, done: view.unloadedCount, total: view.total })}
        onVerify={scan.handleVerify}
        candidates={scan.candidates}
        onManual={scan.handleManual}
        result={scan.result}
        pending={scan.pending}
      />
    </div>
  )
}
