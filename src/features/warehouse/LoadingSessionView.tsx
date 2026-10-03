import { PackageX, ScanLine } from 'lucide-react'
import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PackageVerify } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { restingOnIds } from '@/domain/constraints'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { pendingManualConfirms, type Revision, type Trip } from '@/lib/mock-db'
import { ConfirmedOverlay } from './ConfirmedOverlay'
import { ConfirmNotices } from './ConfirmNotices'
import { DamagedPackageDialog } from './DamagedPackageDialog'
import { PackageInstructionCard } from './PackageInstructionCard'
import { PlanNotices } from './PlanNotices'
import { StepHeader } from './StepHeader'
import { useLoadingScan } from './useLoadingScan'
import { useLoadingSession } from './useLoadingSession'
import { useSessionModel } from './useSessionModel'
import { useCompleteLoadingMutation } from './useWarehouseQueries'

/** Three.js nặng — chỉ tải khi màn kho thực sự hiển thị ô vị trí 3D. */
const PositionViewer = lazy(() =>
  import('@/features/viewer3d/PositionViewer').then((m) => ({ default: m.PositionViewer })),
)

/**
 * Bước Xếp (LM-060, LM-086, FE-6-05) — một thao tác mỗi màn: đối chiếu kiện của bước hiện tại. Toàn màn, không nav rail, vùng chạm
 * ≥ 56px, chữ ≥ 16px (mục 10). Bước đi theo `loadingOrder` của bản duyệt đã chốt lúc bắt đầu; tiến độ ghi vào kho.
 *
 * Mỗi kiện **phải đối chiếu** (D-83): nút chính "Đối chiếu kiện" mở hộp đối chiếu ba mức (`PackageVerify`) — quét hoặc gõ đúng mã kiện
 * của bước là ghi "đã xếp"; sai kiện hoặc sai thứ tự thì hộp nói rõ kiện vừa đưa và kiện cần xếp, không ghi gì; nhãn không đọc được thì
 * xác nhận tay kèm lý do, chờ điều phối viên duyệt. Không có nút "Xác nhận đã xếp" không đối chiếu, không báo thiếu ở bước này — kiện
 * thiếu đã xử lý ở bước soạn. Nút phụ "Kiện hỏng" bỏ kiện của bước lại kho (`DamagedPackageDialog`). Còn xác nhận tay chờ duyệt thì
 * chưa hoàn tất xếp được (FE-6-04) — màn nói lý do tại chỗ; xác nhận tay bị từ chối đưa bước hiện tại về đúng kiện đó.
 */
export function LoadingSessionView({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const model = useSessionModel(trip, plan)
  const session = useLoadingSession(trip.id, model.placements, trip.loading)
  const scan = useLoadingScan({ tripId: trip.id, pending: session.pending, onConfirmed: session.celebrate })
  const [damagedTarget, setDamagedTarget] = useState<ScenePlacement | null>(null)
  const current = session.current
  const busy = session.busy || scan.pending
  const pendingConfirms = pendingManualConfirms(trip, 'STAGING').length + pendingManualConfirms(trip, 'LOADING').length
  // Kiện hỏng bị bỏ lại kho không lên xe: khung 3D không vẽ chúng như đã xếp
  const leftOutIds = useMemo(() => new Set(session.damaged.map((placement) => placement.id)), [session.damaged])
  // Kiện tựa lên kiện đang hỏi trong phương án (trừ kiện cũng đã bị bỏ): hộp nói trước hệ quả của việc báo hỏng
  const resting = damagedTarget === null ? 0 : restingOnIds(plan.result.placements, damagedTarget.id).filter((id) => !leftOutIds.has(id)).length

  async function handleDamaged(id: string) {
    if (await session.reportDamaged(id)) setDamagedTarget(null)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-body-lg">
      <StepHeader step={current?.step ?? session.total} totalSteps={session.total} recorded={session.recorded} tripId={trip.id} />
      <PlanNotices model={model} />
      <ConfirmNotices trip={trip} />

      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        {current ? (
          <>
            <PackageInstructionCard placement={current} placements={model.placements} vehicle={model.vehicle} stops={model.stops} zones={model.zones} />
            {/* Khung giữ chỗ nằm đúng ô của khung 3D để lúc tải xong bố cục không nhảy */}
            <div className="order-first min-h-96 lg:order-last lg:min-h-0">
              <Suspense
                fallback={
                  <div role="status" aria-label={t('warehouse.viewerLoading')} className="grid h-full min-h-80 place-items-center rounded-md bg-canvas-1">
                    <Spinner tone="light" />
                  </div>
                }
              >
                <PositionViewer model={model} current={current} leftOutIds={leftOutIds} />
              </Suspense>
            </div>
          </>
        ) : (
          <AllRecorded tripId={trip.id} pendingConfirms={pendingConfirms} />
        )}

        {session.overlay ? (
          <ConfirmedOverlay
            confirmedId={session.overlay.id}
            nextStep={session.overlay.nextStep}
            awaitingApproval={session.overlay.manual || pendingConfirms > 0}
          />
        ) : null}
      </div>

      {current ? (
        <div className="flex flex-none flex-wrap gap-2 px-3 pb-3">
          <Button variant="secondary" size="touch" className="flex-none" disabled={busy} onClick={() => setDamagedTarget(current)}>
            <PackageX strokeWidth={2} />
            {t('warehouse.damaged.open')}
          </Button>
          <Button variant="primary" className="h-14 min-w-0 flex-1 basis-64 gap-3 text-body-lg [&_svg]:size-6" disabled={busy} onClick={() => scan.setOpen(true)}>
            <ScanLine strokeWidth={2} />
            {t('warehouse.scan.open')}
          </Button>
        </div>
      ) : null}

      <DamagedPackageDialog
        placement={damagedTarget}
        resting={resting}
        onOpenChange={(open) => { if (!open) setDamagedTarget(null) }}
        onConfirm={(id) => void handleDamaged(id)}
        pending={session.reporting}
      />

      {current ? (
        <PackageVerify
          open={scan.open}
          onOpenChange={scan.setOpen}
          title={t('warehouse.scan.title', { step: current.step })}
          description={t('warehouse.scan.description', { id: current.id, name: current.name })}
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

/**
 * Mọi kiện đã có kết quả nhưng chuyến chưa sang "Xếp xong — chờ xuất phát". Bước cuối tự hoàn tất, nên gặp ở đây khi còn xác nhận tay
 * chờ điều phối viên duyệt (FE-6-04: kho chặn xong xếp — nút mờ, lý do ngay bên trên), hoặc khi lần hoàn tất đó không thành (ví dụ mất
 * kết nối). Cho bấm hoàn tất lại, không bịa là đã xong.
 */
function AllRecorded({ tripId, pendingConfirms }: { tripId: string; pendingConfirms: number }) {
  const t = useT()
  const reasonId = useId()
  const complete = useCompleteLoadingMutation(tripId)
  const blocked = pendingConfirms > 0
  return (
    <div className="col-span-full flex flex-col items-start justify-center gap-3 rounded-md border border-border p-8">
      <p id={reasonId} className="m-0">{blocked ? t('warehouse.confirms.blocked', { count: pendingConfirms }) : t('warehouse.allRecorded')}</p>
      <Button
        variant="primary"
        size="touch"
        disabled={blocked}
        aria-describedby={blocked ? reasonId : undefined}
        loading={complete.isPending}
        onClick={() => complete.mutate(undefined, { onError: (error) => toast.error(dataErrorMessage(error, t)) })}
      >
        {t('warehouse.complete')}
      </Button>
    </div>
  )
}
