import { ArrowRight, ScanLine, TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { QrScanDialog } from '@/components/QrScanDialog'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { adaptResult } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { missingIds, type Revision, type Trip } from '@/lib/mock-db'
import { DeliveryItemRow } from './DeliveryItemRow'
import { deliveryView, type DeliveryView } from './delivery-progress'
import { DriverNotice } from './DriverNotice'
import { stopDeliveries } from './driver-plan'
import { DriverStopHeader } from './DriverStopHeader'
import { ReportIssueDialog } from './ReportIssueDialog'
import { StopContactCard } from './StopContactCard'
import { useDeliveryStop } from './useDeliveryStop'
import { useUnloadScan } from './useUnloadScan'

const DriverCargoViewer = lazy(() => import('@/features/viewer3d/DriverCargoViewer').then((m) => ({ default: m.DriverCargoViewer })))

/**
 * Màn tài xế tại điểm giao (LM-061, LM-087) — điện thoại, một tay, ngoài trời. Vùng chạm 56px, chữ 16px, một hành động chính ở chân
 * màn: "Bắt đầu giao" khi kho đã xếp xong, "Hoàn tất điểm giao" khi đang giao. Kho chưa xếp xong thì chỉ xem trước điểm 1.
 * Kiện, thứ tự dỡ lấy từ phương án kho đã xếp; kiện đã dỡ, sự cố và điểm đã hoàn tất đọc/ghi trong kho (D-47) — mở lại là đúng điểm.
 *
 * Lệch có chủ ý khỏi design: nút chỉ đường trong design màu primary — mỗi màn chỉ một nút primary (mục 5) nên đổi sang secondary;
 * nhãn nút chính viết hoa trong design — mục 5 cấm; bỏ thanh tab đáy vì các tab khác chưa có màn (LM-053, D-20).
 *
 * Review 1 (LM-104): khi đang giao có nút phụ "Quét QR dỡ" — quét nhãn từng kiện của điểm này để ghi đã dỡ; kiện của điểm khác được
 * giải thích và không ghi. Đánh dấu tay từng dòng vẫn giữ; dòng dỡ bằng quét QR ghi rõ "quét QR".
 */
export function DeliveryStopView({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const { id, stops: tripStops, inputVersion } = trip
  // Dựng lại chỉ khi phương án hoặc điểm giao đổi; mỗi lần đánh dấu dỡ chỉ đổi `trip.delivery`
  const model = useMemo(() => adaptResult({ trip: { id, stops: tripStops, inputVersion }, revision: plan }), [id, tripStops, inputVersion, plan])
  const stops = useMemo(() => stopDeliveries(tripStops, model), [tripStops, model])
  const view = deliveryView(trip, stops)
  const actions = useDeliveryStop(trip.id, view, stops.length)
  const scan = useUnloadScan(trip.id, view, stops)
  const [cargoOpen, setCargoOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  // Kiện không còn trên xe với khung 3D: đã dỡ ở mọi điểm, và kiện kho báo thiếu (chưa từng lên xe)
  const { delivery, loading } = trip
  const offVehicle = useMemo(
    () => new Set([...(delivery?.stops.flatMap((stop) => stop.unloadedIds) ?? []), ...missingIds({ loading })]),
    [delivery, loading],
  )
  // Chuyến không có điểm giao nào: vẫn giữ lối về danh sách (mục 10)
  if (!view) return <DriverNotice title={t('driver.noItems')} description="" />

  const qrIds = new Set(delivery?.stops.find((stop) => stop.number === view.stop.number)?.qrConfirmedIds)
  const handled = view.items.length - view.remaining
  const percent = view.items.length === 0 ? 100 : Math.round((handled / view.items.length) * 100)

  return (
    <Dialog open={cargoOpen} onOpenChange={setCargoOpen}>
      <div className="flex h-dvh flex-col bg-bg text-body-lg">
        <DriverStopHeader stop={view.stop} stops={stops} completedStops={view.completedStops} />
        <StopNotices view={view} stale={model.revision?.stale ?? false} />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-3 pb-4">
          <StopContactCard stop={view.stop} />

          <div className="flex flex-none flex-col gap-1.5 px-0.5 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{t('driver.summary', { total: view.items.length, done: view.unloadedCount, issues: view.issueCount })}</span>
              <span className="font-mono font-medium text-text-3">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('driver.progress')}
              className="h-2 overflow-hidden rounded-full border border-border bg-surface"
            >
              <div className="h-full bg-success transition-[width] duration-(--dur-md) ease-decelerate" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="flex flex-none flex-wrap gap-2 *:grow">
            {view.mode === 'delivering' && view.remaining > 0 ? (
              <Button variant="secondary" size="touch" className="basis-full" onClick={() => scan.setOpen(true)}>
                <ScanLine strokeWidth={2} />
                {t('driver.scan.open')}
              </Button>
            ) : null}
            <DialogTrigger asChild><Button variant="secondary" size="touch">{t('driver.viewCargo')}</Button></DialogTrigger>
            {view.mode === 'delivering' && view.items.length > 0 ? (
              <Button variant="secondary" size="touch" onClick={() => setIssueOpen(true)}>
                <TriangleAlert strokeWidth={2} />
                {t('driver.issue.report')}
              </Button>
            ) : null}
          </div>

          {view.items.length > 0 ? (
            <ul aria-label={view.stop.name} className="m-0 flex flex-none list-none flex-col overflow-hidden rounded-md border border-border bg-bg p-0">
              {view.items.map(({ item, unloaded, issue }) => (
                <DeliveryItemRow
                  key={item.id}
                  item={item}
                  done={unloaded}
                  viaQr={qrIds.has(item.id)}
                  issueLabel={issue ? t(`common.deliveryIssueKinds.${issue.kind}`) : undefined}
                  readOnly={view.mode !== 'delivering'}
                  onToggle={actions.toggle}
                />
              ))}
            </ul>
          ) : (
            <p className="m-0 flex-none rounded-md border border-border bg-surface p-4 text-text-2">{t('driver.noItems')}</p>
          )}

          {view.mode === 'delivering' ? (
            <span className="flex-none py-1 text-center text-text-3">
              {view.remaining > 0 ? t('driver.remaining', { count: view.remaining }) : t('driver.allHandled')}
            </span>
          ) : null}
        </div>

        {view.mode === 'preview' ? null : (
          <div className="flex-none border-t border-border bg-bg px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            {view.mode === 'ready' ? (
              <Button variant="primary" block className="h-15 text-[18px]" loading={actions.starting} onClick={actions.startDelivery}>
                {t('driver.start')}
              </Button>
            ) : (
              <Button
                variant="primary"
                block
                className="h-15 gap-2.5 text-[18px] [&_svg]:size-5.5"
                disabled={view.remaining > 0 || actions.unloadPending || actions.completing}
                onClick={actions.completeStop}
              >
                {t('driver.complete')}
                <ArrowRight strokeWidth={2.5} />
              </Button>
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
            <DriverCargoViewer model={model} stopNumber={view.stop.number} doneIds={offVehicle} />
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

      {view.mode === 'delivering' ? (
        <QrScanDialog
          open={scan.open}
          onOpenChange={scan.setOpen}
          title={t('driver.scan.title', { number: view.stop.number })}
          description={[
            t('driver.scan.description', { number: view.stop.number, done: view.unloadedCount, total: view.items.length }),
            scan.last ? t('driver.scan.lastUnloaded', { id: scan.last, name: scan.lastName ?? '' }) : '',
          ].join(' ').trim()}
          onScan={scan.handleScan}
          options={scan.options}
          error={scan.error}
          pending={scan.pending}
        />
      ) : null}
    </Dialog>
  )
}

/** Dải thông báo dưới thanh trên: bản duyệt lỗi thời, kho chưa xếp xong (chỉ xem), kho đã xếp xong (chờ bắt đầu), kiện kho báo thiếu. */
function StopNotices({ view, stale }: { view: DeliveryView; stale: boolean }) {
  const t = useT()
  const missing = view.missingAtWarehouse.length
  return (
    <>
      {stale ? (
        <div role="alert" className="flex-none border-b border-badge-warning-border bg-badge-warning-bg px-4 py-2 text-badge-warning-fg">
          {t('driver.stale')}
        </div>
      ) : null}
      {view.mode === 'delivering' ? null : (
        <p role="status" className="m-0 flex-none border-b border-badge-info-border bg-badge-info-bg px-4 py-2 text-badge-info-fg">
          {t(view.mode === 'preview' ? 'driver.notice.preview' : 'driver.notice.ready')}
        </p>
      )}
      {missing > 0 ? (
        <p className="m-0 flex-none border-b border-badge-warning-border bg-badge-warning-bg px-4 py-2 text-badge-warning-fg">
          {t('driver.notice.missing', { count: missing })}
        </p>
      ) : null}
    </>
  )
}
