import { ArrowRight, MapPinCheck, PackagePlus, ScanLine, TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { PackageVerify } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { TripExceptionButton } from '@/features/monitoring/TripExceptionButton'
import { PickupDriverButton } from '@/features/pickups/PickupDriverButton'
import { adaptResult } from '@/features/viewer3d/scene-input'
import { useFormat, useT } from '@/lib/i18n'
import { leftOutIds, type Revision, type Trip } from '@/lib/mock-db'
import { DeliveryItemRow } from './DeliveryItemRow'
import { deliveryView, type DeliveryView } from './delivery-progress'
import { NO_PICKUPS, type PickupFacts } from './driver-pickups'
import { DriverGpsToggle } from './DriverGpsToggle'
import { DriverNotice } from './DriverNotice'
import { stopDeliveries } from './driver-plan'
import { DriverStopHeader } from './DriverStopHeader'
import { DriverStopList } from './DriverStopList'
import { PickupItemRow } from './PickupItemRow'
import { ReportIssueDialog } from './ReportIssueDialog'
import { StopContactCard } from './StopContactCard'
import { useDeliveryStop } from './useDeliveryStop'
import { useUnloadScan } from './useUnloadScan'

const DriverCargoViewer = lazy(() => import('@/features/viewer3d/DriverCargoViewer').then((m) => ({ default: m.DriverCargoViewer })))

/**
 * Màn tài xế tại điểm giao (LM-061, LM-087, FE-6-06) — điện thoại, một tay, ngoài trời. Vùng chạm 56px, chữ 16px, một hành động chính
 * ở chân màn theo bước của luồng giao nhiều điểm (D-84): "Xuất phát" khi kho đã xếp xong; đang vận chuyển thì "Đã đến điểm n" — ghi giờ
 * đến thật — rồi mới tới "Hoàn tất điểm giao". Kho chưa xếp xong thì chỉ xem trước điểm 1. Đang vận chuyển có công tắc "Dùng GPS thật"
 * dưới dải thông báo (`DriverGpsToggle`, FE-6-13).
 * Kiện, thứ tự dỡ lấy từ phương án kho đã xếp; kiện đã dỡ, sự cố và điểm đã hoàn tất đọc/ghi trong kho (D-47) — mở lại là đúng điểm.
 *
 * Lệch có chủ ý khỏi design: nút chỉ đường trong design màu primary — mỗi màn chỉ một nút primary (mục 5) nên đổi sang secondary;
 * nhãn nút chính viết hoa trong design — mục 5 cấm; bỏ thanh tab đáy vì các tab khác chưa có màn (LM-053, D-20).
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
  const model = useMemo(() => adaptResult({ trip: { id, stops: tripStops, inputVersion }, revision: plan }), [id, tripStops, inputVersion, plan])
  const stops = useMemo(() => stopDeliveries(tripStops, model, pickup), [tripStops, model, pickup])
  // Kiện nhận dọc đường còn đi cùng xe hoặc sắp lên xe: chưa có vị trí 3D nên khung 3D chỉ liệt kê (FE-7-05)
  const pickupCargo = useMemo(
    () => pickup.requests.filter((request) => request.status === 'APPROVED' || request.status === 'LOADED').flatMap((request) =>
      pickup.packages.filter((pkg) => request.packageIds?.includes(pkg.id)).map((pkg) => ({ id: pkg.id, name: pkg.packageCode, weightKg: pkg.weightKg }))),
    [pickup],
  )
  const view = deliveryView(trip, stops)
  const actions = useDeliveryStop(trip.id, view, stops.length)
  const scan = useUnloadScan(trip.id, view, stops)
  const [cargoOpen, setCargoOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const blockedId = useId()
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
  const handled = view.total - view.remaining
  const percent = view.total === 0 ? 100 : Math.round((handled / view.total) * 100)
  // Điểm nhận dọc đường (FE-7-05): không có kiện nào của phương án, việc ở đây là đối chiếu kiện lên xe
  const pickupStop = view.stop.kind === 'PICKUP'

  return (
    <Dialog open={cargoOpen} onOpenChange={setCargoOpen}>
      <div className="flex h-dvh flex-col bg-bg text-body-lg">
        <DriverStopHeader stop={view.stop} stops={stops} completedStops={view.completedStops} />
        <StopNotices view={view} stale={model.revision?.stale ?? false} />
        {pickupStop ? (
          <p className="m-0 flex flex-none items-start gap-2 border-b border-badge-azure-border bg-badge-azure-bg px-4 py-2 font-medium text-badge-azure-fg">
            <PackagePlus className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
            {t('driver.pickup.banner', { count: view.pickupItems.length, name: view.stop.name })}
          </p>
        ) : null}
        {view.mode === 'delivering' ? <DriverGpsToggle tripId={trip.id} /> : null}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-3 pb-4">
          {stops.some((stop) => stop.kind === 'PICKUP') ? <DriverStopList stops={stops} currentNumber={view.stop.number} completedStops={view.completedStops} /> : null}
          <StopContactCard stop={view.stop} />

          <div className="flex flex-none flex-col gap-1.5 px-0.5 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {pickupStop ? t('driver.pickup.summary', { total: view.total, done: view.unloadedCount }) : t('driver.summary', { total: view.total, done: view.unloadedCount, issues: view.issueCount })}
              </span>
              <span className="font-mono font-medium text-text-3">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t(pickupStop ? 'driver.pickup.progress' : 'driver.progress')}
              className="h-2 overflow-hidden rounded-full border border-border bg-surface"
            >
              <div className="h-full bg-success transition-[width] duration-(--dur-md) ease-decelerate" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="flex flex-none flex-wrap gap-2 *:grow">
            {arrived && view.verifiable > 0 ? (
              <Button variant="secondary" size="touch" className="basis-full" onClick={() => scan.setOpen(true)}>
                <ScanLine strokeWidth={2} />
                {t(pickupStop ? 'driver.pickup.scanOpen' : 'driver.scan.open')}
              </Button>
            ) : null}
            <DialogTrigger asChild><Button variant="secondary" size="touch">{t('driver.viewCargo')}</Button></DialogTrigger>
            {arrived && view.items.length > 0 ? (
              <Button variant="secondary" size="touch" onClick={() => setIssueOpen(true)}>
                <TriangleAlert strokeWidth={2} />
                {t('driver.issue.report')}
              </Button>
            ) : null}
            {view.mode === 'delivering' ? <TripExceptionButton tripId={trip.id} /> : null}
            {view.mode === 'delivering' ? <PickupDriverButton tripId={trip.id} stops={tripStops} /> : null}
          </div>

          {view.items.length > 0 ? (
            <ul aria-label={view.stop.name} className="m-0 flex flex-none list-none flex-col overflow-hidden rounded-md border border-border bg-bg p-0">
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
            <p className="m-0 flex-none rounded-md border border-border bg-surface p-4 text-text-2">{t('driver.noItems')}</p>
          ) : null}

          {view.pickupItems.length > 0 ? (
            <section aria-labelledby={pickupListId} className="flex flex-none flex-col gap-2">
              <h2 id={pickupListId} className="m-0 px-0.5 font-display text-h3 font-[650] text-ink-strong">{t('driver.pickup.listTitle')}</h2>
              <p className="m-0 px-0.5 text-text-2">{t('driver.pickup.listHint')}</p>
              <ul aria-labelledby={pickupListId} className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-border bg-bg p-0">
                {view.pickupItems.map((progress) => <PickupItemRow key={progress.item.id} progress={progress} />)}
              </ul>
            </section>
          ) : null}

          {arrived ? (
            <span className="flex-none py-1 text-center text-text-3">
              {view.remaining > 0
                ? t(pickupStop ? 'driver.pickup.remaining' : 'driver.remaining', { count: view.remaining })
                : t(pickupStop ? 'driver.pickup.allHandled' : 'driver.allHandled')}
            </span>
          ) : null}
        </div>

        {view.mode === 'preview' ? null : (
          <div className="flex-none border-t border-border bg-bg px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            {view.mode === 'ready' ? (
              <Button variant="primary" block className="h-15 text-[18px]" loading={actions.starting} onClick={actions.startDelivery}>
                {t('driver.start')}
              </Button>
            ) : !arrived ? (
              <Button variant="primary" block className="h-15 gap-2.5 text-[18px] [&_svg]:size-5.5" loading={actions.arriving} onClick={actions.arrive}>
                <MapPinCheck strokeWidth={2.5} />
                {t('driver.arrive', { number: view.stop.number })}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Xác nhận tay của điểm còn chờ duyệt (FE-6-04): kho chặn hoàn tất điểm — nút mờ, lý do ngay tại chỗ */}
                {view.pendingConfirms > 0 ? (
                  <p id={blockedId} role="status" className="m-0 rounded-md border border-badge-warning-border bg-badge-warning-bg px-3 py-2 font-medium text-badge-warning-fg">
                    {t(pickupStop ? 'driver.pickup.blocked' : 'driver.confirms.blocked', { count: view.pendingConfirms })}
                  </p>
                ) : null}
                <Button
                  variant="primary"
                  block
                  className="h-15 gap-2.5 text-[18px] [&_svg]:size-5.5"
                  disabled={view.remaining > 0 || view.pendingConfirms > 0 || scan.pending || actions.completing}
                  aria-describedby={view.pendingConfirms > 0 ? blockedId : undefined}
                  onClick={actions.completeStop}
                >
                  {t(pickupStop ? 'driver.pickup.complete' : 'driver.complete')}
                  <ArrowRight strokeWidth={2.5} />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {cargoOpen ? (
        <DialogContent className="fixed inset-0 h-dvh max-h-dvh w-full max-w-full rounded-none">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
            <DialogTitle className="text-h3 font-semibold">{t('driver.cargo.title')}</DialogTitle>
            <DialogClose asChild><Button variant="secondary" size="touch">{t('driver.cargo.close')}</Button></DialogClose>
          </div>
          <DialogDescription className="sr-only">{t('driver.cargo.description')}</DialogDescription>
          <Suspense fallback={<div className="grid flex-1 place-items-center bg-canvas-1"><Spinner tone="light" /></div>}>
            <DriverCargoViewer model={model} stopNumber={view.stop.number} doneIds={offVehicle} pickupCargo={pickupCargo} />
          </Suspense>
        </DialogContent>
      ) : null}

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
    </Dialog>
  )
}

/**
 * Dải thông báo dưới thanh trên: bản duyệt lỗi thời, kho chưa xếp xong (chỉ xem), kho đã xếp xong (chờ xuất phát), đang tới điểm (chưa
 * bấm "Đã đến") hoặc giờ đã đến, và kiện của điểm này hỏng lúc xếp nên bị bỏ lại kho.
 */
function StopNotices({ view, stale }: { view: DeliveryView; stale: boolean }) {
  const t = useT()
  const format = useFormat()
  const leftOut = view.leftAtWarehouse.length
  return (
    <>
      {stale ? (
        <div role="alert" className="flex-none border-b border-badge-warning-border bg-badge-warning-bg px-4 py-2 text-badge-warning-fg">
          {t('driver.stale')}
        </div>
      ) : null}
      <p role="status" className="m-0 flex-none border-b border-badge-info-border bg-badge-info-bg px-4 py-2 text-badge-info-fg">
        {view.mode !== 'delivering'
          ? t(view.mode === 'preview' ? 'driver.notice.preview' : 'driver.notice.ready')
          : view.arrivedAt === undefined
            ? t('driver.notice.enRoute', { number: view.stop.number })
            : t('driver.notice.arrived', { number: view.stop.number, time: format.time(view.arrivedAt) })}
      </p>
      {leftOut > 0 ? (
        <p className="m-0 flex-none border-b border-badge-warning-border bg-badge-warning-bg px-4 py-2 text-badge-warning-fg">
          {t('driver.notice.leftOut', { count: leftOut })}
        </p>
      ) : null}
    </>
  )
}
