import { Hourglass, PackageX, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PackageVerify } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { Revision, Trip } from '@/lib/mock-db'
import { ConfirmNotices } from './ConfirmNotices'
import { stagingProgress } from './loading-session'
import { MissingPackageDialog } from './MissingPackageDialog'
import { PlanNotices } from './PlanNotices'
import { StepHeader } from './StepHeader'
import { useSessionModel } from './useSessionModel'
import { useStagingScan } from './useStagingScan'
import { useReportShortageMutation } from './useWarehouseQueries'

/**
 * Bước Soạn hàng (FE-6-02, D-82) — trước khi xếp, kho đưa mọi kiện của phương án vào khu chờ và đối chiếu từng kiện, không cần thứ tự:
 * kiện thiếu lộ ra khi xe còn trống. Toàn màn, vùng chạm ≥ 56 px, chữ ≥ 16 px (mục 10). Một hành động chính: "Đối chiếu kiện" mở hộp
 * đối chiếu ba mức (`PackageVerify`). Danh sách là các kiện **chưa soạn**; mỗi dòng có "Báo thiếu" — kiện báo thiếu ở lại danh sách kèm
 * dòng "chờ điều phối", điều phối viên chọn tìm tiếp hoặc bỏ kiện khỏi chuyến ở Chi tiết chuyến. Soạn đủ thì màn tự sang bước Xếp.
 */
export function StagingStepPage({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const format = useFormat()
  const model = useSessionModel(trip, plan)
  const progress = stagingProgress(model.placements, trip.loading)
  const scan = useStagingScan({ tripId: trip.id, placements: model.placements, pending: progress.pending })
  const report = useReportShortageMutation(trip.id)
  const [target, setTarget] = useState<ScenePlacement | null>(null)
  const shortages = progress.shortageIds.size

  function handleShortage(id: string) {
    report.mutate(id, {
      onSuccess: () => {
        setTarget(null)
        toast.warning(t('warehouse.staging.shortageRecorded', { id }), { description: t('warehouse.staging.shortageRecordedDescription') })
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-body-lg">
      <StepHeader label={t('warehouse.staging.step')} progressLabel={t('warehouse.staging.progress')} step={progress.staged} totalSteps={progress.total} recorded={progress.staged} tripId={trip.id} />
      <PlanNotices model={model} />
      <ConfirmNotices trip={trip} />
      {shortages > 0 ? (
        <p role="status" className="m-0 mx-3 mt-3 flex flex-none items-start gap-3 rounded-md border border-badge-warning-border bg-badge-warning-bg px-4 py-3 font-medium text-badge-warning-fg">
          <Hourglass className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('warehouse.staging.shortages', { count: shortages })}
        </p>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-semibold">{t('warehouse.staging.title', { count: format.integer(progress.pending.length) })}</h1>
          <p className="m-0 text-pretty text-text-2">{t('warehouse.staging.hint')}</p>
        </div>
        <ul aria-label={t('warehouse.staging.listLabel')} className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-border bg-bg p-0">
          {progress.pending.map((placement) => {
            const reported = progress.shortageIds.has(placement.id)
            return (
              <li key={placement.id} data-package-id={placement.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 pr-3 pl-4 last:border-b-0">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                  <span className="font-mono text-[18px] leading-6 font-semibold">{placement.id}</span>
                  <span className="text-pretty text-text-2">{placement.name} · {t('common.stop', { number: placement.stop })}</span>
                </div>
                {reported ? (
                  <span className="inline-flex min-h-14 items-center gap-2 font-medium text-badge-warning-fg">
                    <Hourglass className="size-5 flex-none" strokeWidth={2} aria-hidden />
                    {t('warehouse.staging.reported')}
                  </span>
                ) : (
                  <Button variant="secondary" size="touch" className="flex-none" disabled={report.isPending} onClick={() => setTarget(placement)}>
                    <PackageX strokeWidth={2} />
                    {t('warehouse.staging.reportShortage')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </main>

      <div className="flex-none px-3 pb-3">
        <Button variant="primary" className="h-14 w-full gap-3 text-body-lg [&_svg]:size-6" disabled={scan.pending} onClick={() => scan.setOpen(true)}>
          <ScanLine strokeWidth={2} />
          {t('warehouse.scan.open')}
        </Button>
      </div>

      <MissingPackageDialog
        placement={target}
        onOpenChange={(open) => { if (!open) setTarget(null) }}
        onConfirm={handleShortage}
        pending={report.isPending}
      />
      <PackageVerify
        open={scan.open}
        onOpenChange={scan.setOpen}
        title={t('warehouse.staging.scanTitle')}
        description={t('warehouse.staging.scanDescription', { done: format.integer(progress.staged), total: format.integer(progress.total) })}
        onVerify={scan.handleVerify}
        candidates={scan.candidates}
        onManual={scan.handleManual}
        result={scan.result}
        pending={scan.pending}
      />
    </div>
  )
}
