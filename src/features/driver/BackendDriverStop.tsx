import { ScanLine, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { PackageVerify } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { DeliveryItemRow } from './DeliveryItemRow'
import type { DriverStopScreen } from './driver-api'
import { DriverGpsToggle } from './DriverGpsToggle'
import { DriverNotice } from './DriverNotice'
import { DriverStopHeader } from './DriverStopHeader'
import { ReportIssueDialog } from './ReportIssueDialog'
import { ServerCargoPosition, ServerStopEta } from './ServerStopParts'
import { StopContactCard } from './StopContactCard'
import { StopFooter } from './StopFooter'
import { StopMoreActions } from './StopMoreActions'
import { StopNotices } from './StopNotices'
import { StopProgress } from './StopProgress'
import { useDeliveryStop } from './useDeliveryStop'
import { useDriverStopScreenQuery } from './useDriverQueries'
import { useUnloadScan } from './useUnloadScan'

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
 * chân màn), bỏ những phần backend chưa có (D-20): không "Xuất phát" (ở thẻ chuyến), không nhận hàng dọc đường. "Đã đến điểm n" là nút
 * chính trước khi dỡ; giờ đến, kiện đã dỡ, sự cố và xác nhận tay đọc từ máy chủ. Thẻ liên hệ có giờ đến và hạn giao của máy chủ
 * (`ServerStopEta`); "Xem vị trí hàng" vẽ phương án kho đã xếp (`ServerCargoPosition`). Dỡ qua hộp đối chiếu ba mức: quét nhãn QR, gõ mã in
 * trên nhãn (mã QR, mã đứng đầu dòng kiện hoặc mã của kho kiện — `packageOfCode`, nên ô gõ mã có nhãn và gợi ý riêng), hoặc xác nhận tay kèm
 * lý do — chờ điều phối viên duyệt, còn chờ thì chưa hoàn tất điểm được. "Báo sự cố" theo kiện; khách từ chối thì kiện ở lại xe và thành
 * hoàn trả khi hoàn tất điểm. "Sự cố trên đường" của cả chuyến nằm sau nút phụ "Thêm" (`StopMoreActions`) và gửi lên máy chủ.
 */
function BackendStopView({ tripId, screen }: { tripId: string; screen: Extract<DriverStopScreen, { kind: 'stop' }> }) {
  const t = useT()
  const { view, stops } = screen
  const actions = useDeliveryStop(tripId, view)
  const scan = useUnloadScan(tripId, view, stops)
  const [issueOpen, setIssueOpen] = useState(false)
  const arrived = view.arrivedAt !== undefined || view.arrivedEarlier === true
  // Backend báo cả điểm đã dỡ (kể cả kiện dỡ trước lần mở trang này): không còn gì để đối chiếu thì đóng hộp
  if (scan.open && !scan.pending && view.verifiable === 0) scan.setOpen(false)

  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <DriverStopHeader stop={view.stop} stops={stops} completedStops={view.completedStops} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-4 pb-4">
        <StopNotices view={view} />
        <DriverGpsToggle tripId={tripId} />
        <StopContactCard stop={view.stop}>
          <ServerStopEta tripId={tripId} stopNumber={view.stop.number} />
        </StopContactCard>
        <StopProgress view={view} />

        <div className="flex flex-none flex-wrap gap-2 *:grow">
          {arrived && view.verifiable > 0 ? (
            <Button variant="secondary" size="touch" className="basis-full" onClick={() => scan.setOpen(true)}>
              <ScanLine strokeWidth={2} />
              {t('driver.scan.open')}
            </Button>
          ) : null}
          <ServerCargoPosition tripId={tripId} stopNumber={view.stop.number} />
          {arrived && view.items.length > 0 ? (
            <Button variant="secondary" size="touch" onClick={() => setIssueOpen(true)}>
              <TriangleAlert strokeWidth={2} />
              {t('driver.issue.report')}
            </Button>
          ) : null}
          <StopMoreActions tripId={tripId} tripLabel={screen.trip.code} stops={[]} />
        </div>

        {view.items.length > 0 ? (
          <ul aria-label={view.stop.name} className="m-0 flex flex-none list-none flex-col overflow-hidden rounded-lg border border-border bg-bg p-0 shadow-card">
            {view.items.map(({ item, unloaded, issue, returned, verification }) => (
              <DeliveryItemRow
                key={item.id}
                item={item}
                done={unloaded}
                verification={verification}
                issueLabel={issue ? t(`common.deliveryIssueKinds.${issue.kind}`) : undefined}
                returned={returned}
              />
            ))}
          </ul>
        ) : (
          <p className="m-0 flex-none rounded-lg border border-border bg-bg p-4 text-ink-2 shadow-card">{t('driver.noItems')}</p>
        )}

        <span className="flex-none py-1 text-center text-ink-3">
          {view.remaining > 0 ? t('driver.remaining', { count: view.remaining }) : t('driver.allHandled')}
        </span>
      </div>

      <StopFooter view={view} stops={stops} actions={actions} scanPending={scan.pending} />

      <ReportIssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        stopNumber={view.stop.number}
        items={view.items}
        pending={actions.reporting}
        onSubmit={async (values) => {
          if (await actions.reportIssue(values)) setIssueOpen(false)
        }}
      />

      <PackageVerify
        open={scan.open}
        onOpenChange={scan.setOpen}
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
