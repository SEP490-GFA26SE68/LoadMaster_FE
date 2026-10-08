import { ScanLine, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { PackageVerify } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { adaptResult } from '@/features/viewer3d/scene-input'
import { withPickupPlacements } from '@/features/viewer3d/scene-pickups'
import { useT } from '@/lib/i18n'
import { leftOutIds, type Revision, type Trip } from '@/lib/mock-db'
import { CargoPositionDialog } from './CargoPositionDialog'
import { DeliveryItemRow } from './DeliveryItemRow'
import { deliveryView } from './delivery-progress'
import { NO_PICKUPS, pickupSceneItems, unplacedPickups, type PickupFacts } from './driver-pickups'
import { DriverGpsToggle } from './DriverGpsToggle'
import { DriverNotice } from './DriverNotice'
import { stopDeliveries } from './driver-plan'
import { DriverStopHeader } from './DriverStopHeader'
import { DriverStopList } from './DriverStopList'
import { PickupItemRow } from './PickupItemRow'
import { ReportIssueDialog } from './ReportIssueDialog'
import { StopContactCard } from './StopContactCard'
import { StopFooter } from './StopFooter'
import { StopMoreActions } from './StopMoreActions'
import { StopNotices } from './StopNotices'
import { StopProgress } from './StopProgress'
import { useDeliveryStop } from './useDeliveryStop'
import { useUnloadScan } from './useUnloadScan'

/**
 * Màn tài xế tại điểm giao (LM-061, LM-087, FE-6-06) — điện thoại, một tay, ngoài trời. Vùng chạm 56px, chữ 16px, một hành động chính
 * ở chân màn theo bước của luồng giao nhiều điểm (D-84): "Xuất phát" khi kho đã xếp xong; đang vận chuyển thì "Đã đến điểm n" — ghi giờ
 * đến thật — rồi mới tới "Hoàn tất điểm giao" (`StopFooter`). Kho chưa xếp xong thì chỉ xem trước điểm 1. Đang vận chuyển có công tắc
 * "Dùng GPS thật" đầu vùng cuộn (`DriverGpsToggle`, FE-6-13).
 * Kiện, thứ tự dỡ lấy từ phương án kho đã xếp; kiện đã dỡ, sự cố và điểm đã hoàn tất đọc/ghi trong kho (D-47) — mở lại là đúng điểm.
 *
 * Lệch có chủ ý khỏi design: nút chỉ đường trong design màu primary — mỗi màn chỉ một nút primary (mục 5) nên đổi sang secondary;
 * nhãn nút chính viết hoa trong design — mục 5 cấm; bỏ thanh tab đáy vì các tab khác chưa có màn (LM-053, D-20).
 * *(V2.3 đợt 6)* Dải trời điều khiển đặc ở đầu, thông báo và công tắc GPS nằm trong vùng cuộn; "Sự cố trên đường" và "Nhận hàng dọc
 * đường" gom sau nút "Thêm" (`StopMoreActions`).
 *
 * Đã đến điểm thì nút phụ "Đối chiếu kiện dỡ" mở hộp đối chiếu ba mức (`PackageVerify`, FE-6-03) — cách duy nhất ghi một kiện "đã dỡ":
 * quét hoặc gõ mã từng kiện của điểm này; kiện của điểm khác được giải thích và không ghi; nhãn không đọc được thì xác nhận tay kèm lý
 * do, chờ điều phối viên duyệt. Còn xác nhận tay của điểm chờ duyệt thì chưa hoàn tất điểm được (FE-6-04) — lý do nằm ngay trên nút.
 * Mỗi dòng đã dỡ ghi cách đối chiếu; kiện khách từ chối ở lại xe và thành Hoàn trả. Dòng kiện không có nút đánh dấu tay.
 */
export function DeliveryStopView({ trip, plan, pickup = NO_PICKUPS }: { trip: Trip; plan: Revision; pickup?: PickupFacts }) {
  const t = useT()
  const { id, stops: tripStops, inputVersion } = trip
  // Dựng lại chỉ khi phương án hoặc điểm giao đổi; mỗi lần đánh dấu dỡ chỉ đổi `trip.delivery`
  const planModel = useMemo(() => adaptResult({ trip: { id, stops: tripStops, inputVersion }, revision: plan }), [id, tripStops, inputVersion, plan])
  const stops = useMemo(() => stopDeliveries(tripStops, planModel, pickup), [tripStops, planModel, pickup])
  // Kiện nhận dọc đường đã có chỗ (FE-BL-01) vào scene của khung 3D cùng kiện của phương án — dòng kiện của điểm vẫn chỉ lấy từ phương án,
  // kiện nhận có danh sách riêng; kiện chưa có chỗ chỉ liệt kê cạnh khung, kèm lý do
  const model = useMemo(() => withPickupPlacements(planModel, pickupSceneItems(tripStops, pickup)), [planModel, tripStops, pickup])
  const pickupCargo = useMemo(() => unplacedPickups(pickup), [pickup])
  const view = deliveryView(trip, stops)
  const actions = useDeliveryStop(trip.id, view)
  const scan = useUnloadScan(trip.id, view, stops)
  const [issueOpen, setIssueOpen] = useState(false)
  const pickupListId = useId()
  // Kiện không còn trên xe với khung 3D: đã dỡ ở mọi điểm, và kiện hỏng bị bỏ lại kho (chưa từng lên xe)
  const { delivery, loading } = trip
  const offVehicle = useMemo(
    () => new Set([...(delivery?.stops.flatMap((stop) => stop.unloadedIds) ?? []), ...leftOutIds({ loading })]),
    [delivery, loading],
  )
  // Chuyến không có điểm giao nào: vẫn giữ lối về danh sách (mục 10)
  if (!view) return <DriverNotice title={t('driver.noItems')} description="" />

  const arrived = view.arrivedAt !== undefined
  // Điểm nhận dọc đường (FE-7-05): không có kiện nào của phương án, việc ở đây là đối chiếu kiện lên xe
  const pickupStop = view.stop.kind === 'PICKUP'

  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <DriverStopHeader stop={view.stop} stops={stops} completedStops={view.completedStops} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-4 pb-4">
        <StopNotices view={view} stale={model.revision?.stale ?? false} />
        {view.mode === 'delivering' ? <DriverGpsToggle tripId={trip.id} /> : null}
        {stops.some((stop) => stop.kind === 'PICKUP') ? <DriverStopList stops={stops} currentNumber={view.stop.number} completedStops={view.completedStops} /> : null}
        <StopContactCard stop={view.stop} />
        <StopProgress view={view} />

        <div className="flex flex-none flex-wrap gap-2 *:grow">
          {arrived && view.verifiable > 0 ? (
            <Button variant="secondary" size="touch" className="basis-full" onClick={() => scan.setOpen(true)}>
              <ScanLine strokeWidth={2} />
              {t(pickupStop ? 'driver.pickup.scanOpen' : 'driver.scan.open')}
            </Button>
          ) : null}
          <CargoPositionDialog model={model} stopNumber={view.stop.number} doneIds={offVehicle} pickupCargo={pickupCargo} />
          {arrived && view.items.length > 0 ? (
            <Button variant="secondary" size="touch" onClick={() => setIssueOpen(true)}>
              <TriangleAlert strokeWidth={2} />
              {t('driver.issue.report')}
            </Button>
          ) : null}
          {view.mode === 'delivering' ? <StopMoreActions tripId={trip.id} stops={tripStops} /> : null}
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
        ) : view.pickupItems.length === 0 ? (
          <p className="m-0 flex-none rounded-lg border border-border bg-bg p-4 text-ink-2 shadow-card">{t('driver.noItems')}</p>
        ) : null}

        {view.pickupItems.length > 0 ? (
          <section aria-labelledby={pickupListId} className="flex flex-none flex-col gap-2">
            <h2 id={pickupListId} className="m-0 px-0.5 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('driver.pickup.listTitle')}</h2>
            <p className="m-0 px-0.5 text-ink-2">{t('driver.pickup.listHint')}</p>
            <ul aria-labelledby={pickupListId} className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-border bg-bg p-0 shadow-card">
              {view.pickupItems.map((progress) => <PickupItemRow key={progress.item.id} progress={progress} />)}
            </ul>
          </section>
        ) : null}

        {arrived ? (
          <span className="flex-none py-1 text-center text-ink-3">
            {view.remaining > 0
              ? t(pickupStop ? 'driver.pickup.remaining' : 'driver.remaining', { count: view.remaining })
              : t(pickupStop ? 'driver.pickup.allHandled' : 'driver.allHandled')}
          </span>
        ) : null}
      </div>

      <StopFooter view={view} actions={actions} scanPending={scan.pending} />

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

      {arrived ? (
        <PackageVerify
          open={scan.open}
          onOpenChange={scan.setOpen}
          title={t(pickupStop ? 'driver.pickup.scanTitle' : 'driver.scan.title', { number: view.stop.number })}
          description={t(pickupStop ? 'driver.pickup.scanDescription' : 'driver.scan.description', { number: view.stop.number, done: view.unloadedCount, total: view.total })}
          onVerify={scan.handleVerify}
          candidates={scan.candidates}
          onManual={scan.handleManual}
          result={scan.result}
          pending={scan.pending}
        />
      ) : null}
    </div>
  )
}
