import { Hourglass, PackageX, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PackageVerify, type VerifyCode, type VerifyOutcome } from '@/components/PackageVerify'
import { StopChip } from '@/components/StopChip'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { ManualConfirmInput } from '@/lib/mock-db'
import { MissingPackageDialog } from './MissingPackageDialog'
import { placementLabel, serverStagingView, type ServerStagingRow } from './server-loading'
import { StepHeader } from './StepHeader'
import { useReportServerShortageMutation, useStageServerPackageManuallyMutation, useStageServerPackageMutation } from './useServerWarehouseQuery'
import { codeMatches, type ServerLoadingSession } from './warehouse-server-api'

/**
 * Bước Soạn hàng của phiên bản máy chủ — như bản kho mẫu (`StagingStepPage`): kho đưa mọi kiện của phương án vào khu chờ và đối chiếu từng
 * kiện, không cần thứ tự (quét QR, gõ mã, hoặc xác nhận tay chờ điều phối viên duyệt). Mỗi kiện chưa soạn có "Báo thiếu": máy chủ ghi báo
 * thiếu, điều phối viên quyết tìm tiếp hay bỏ kiện ở Chi tiết chuyến. Soạn đủ thì máy chủ cho xếp và màn tự sang bước Xếp.
 */
export function ServerStagingStep({ tripId, session }: { tripId: string; session: ServerLoadingSession }) {
  const t = useT()
  const format = useFormat()
  const view = serverStagingView(session)
  const stage = useStageServerPackageMutation(tripId)
  const stageManually = useStageServerPackageManuallyMutation(tripId)
  const report = useReportServerShortageMutation(tripId)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerifyOutcome | null>(null)
  const [target, setTarget] = useState<ServerStagingRow | null>(null)
  const pending = stage.isPending || stageManually.isPending

  function handleVerifyOpen(next: boolean) {
    setResult(null)
    setVerifying(next)
  }

  function handleVerify({ method, code }: VerifyCode) {
    const placement = session.placements.find((item) => item.packageId !== null && codeMatches(item, code))
    if (placement?.packageId == null) {
      setResult({ tone: 'error', message: t('serverWarehouse.staging.codeUnknown', { code: code.trim() }) })
      return
    }
    const label = placementLabel(placement)
    stage.mutate({ packageId: placement.packageId, method }, {
      // Kiện rời danh sách chưa soạn và số đã soạn tăng ngay trên màn: không toast thành công
      onSuccess: ({ alreadyStaged }) => setResult({
        tone: 'success',
        message: t(alreadyStaged ? 'warehouse.staging.alreadyStaged' : 'warehouse.staging.lastStaged', { id: label, name: placement.name }),
      }),
      onError: (error) => setResult({ tone: 'error', message: dataErrorMessage(error, t) }),
    })
  }

  function handleManual({ packageInstanceId, reason, note }: ManualConfirmInput) {
    const placement = session.placements.find((item) => item.id === packageInstanceId)
    if (placement?.packageId == null) return
    stageManually.mutate({ packageId: placement.packageId, input: { reason, note } }, {
      onSuccess: () => {
        setVerifying(false)
        toast.warning(t('warehouse.staging.manualRecorded', { id: placementLabel(placement) }), { description: t('serverWarehouse.staging.manualDescription') })
      },
      onError: (error) => setResult({ tone: 'error', message: dataErrorMessage(error, t) }),
    })
  }

  function handleShortage() {
    const row = target
    if (row?.placement.packageId == null) return
    const label = placementLabel(row.placement)
    report.mutate(row.placement.packageId, {
      onSuccess: () => {
        setTarget(null)
        toast.warning(t('warehouse.staging.shortageRecorded', { id: label }), { description: t('warehouse.staging.shortageRecordedDescription') })
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-app text-body-lg">
      <StepHeader
        label={t('warehouse.staging.step')}
        progressLabel={t('warehouse.staging.progress')}
        step={view.staged}
        totalSteps={view.total}
        recorded={view.staged}
        tripId={tripId}
        code={session.code}
      />
      {view.openShortages > 0 ? (
        <p role="status" className="m-0 mx-3 mt-3 flex flex-none items-start gap-3 rounded-lg border border-badge-warning-border bg-badge-warning-bg px-4 py-3 font-medium text-badge-warning-fg">
          <Hourglass className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('warehouse.staging.shortages', { count: view.openShortages })}
        </p>
      ) : null}
      {view.manualPending > 0 ? (
        <p role="status" className="m-0 mx-3 mt-3 flex flex-none items-start gap-3 rounded-lg border border-badge-warning-border bg-badge-warning-bg px-4 py-3 font-medium text-badge-warning-fg">
          <Hourglass className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('serverWarehouse.staging.manualPendingBanner', { count: view.manualPending })}
        </p>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h2 font-bold text-ink-strong font-stretch-106%">{t('warehouse.staging.title', { count: format.integer(view.pending.length) })}</h1>
          <p className="m-0 text-pretty text-ink-2">{t('warehouse.staging.hint')}</p>
        </div>
        <ul aria-label={t('warehouse.staging.listLabel')} className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-border bg-bg p-0 shadow-card">
          {view.pending.map((row) => (
            <StagingRow key={row.placement.id} row={row} disabled={report.isPending} onReport={() => setTarget(row)} />
          ))}
        </ul>
      </main>

      <div className="flex-none px-3 pb-3">
        <Button variant="primary" className="h-14 w-full gap-3 text-body-lg [&_svg]:size-6" disabled={pending} onClick={() => handleVerifyOpen(true)}>
          <ScanLine strokeWidth={2} />
          {t('warehouse.scan.open')}
        </Button>
      </div>

      <MissingPackageDialog
        placement={target === null ? null : { id: placementLabel(target.placement), name: target.placement.name, stop: target.placement.stopSequence }}
        onOpenChange={(open) => { if (!open) setTarget(null) }}
        onConfirm={handleShortage}
        pending={report.isPending}
      />
      <PackageVerify
        open={verifying}
        onOpenChange={handleVerifyOpen}
        title={t('warehouse.staging.scanTitle')}
        description={t('warehouse.staging.scanDescription', { done: format.integer(view.staged), total: format.integer(view.total) })}
        codeLabel={t('serverWarehouse.session.codeLabel')}
        codeHint={t('serverWarehouse.session.codeHint')}
        onVerify={handleVerify}
        candidates={view.pending.map(({ placement }) => ({
          packageInstanceId: placement.id,
          label: placementLabel(placement),
          name: placement.name,
          description: placement.stopSequence === null ? undefined : t('common.stop', { number: placement.stopSequence }),
        }))}
        onManual={handleManual}
        result={result}
        pending={pending}
      />
    </div>
  )
}

function StagingRow({ row, disabled, onReport }: { row: ServerStagingRow; disabled: boolean; onReport: () => void }) {
  const t = useT()
  const { placement } = row
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft py-3 pr-3 pl-4 last:border-b-0">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        <span className="font-mono text-[18px] leading-6 font-semibold break-all text-ink-strong">{placementLabel(placement)}</span>
        <span className="text-pretty text-ink-2">{placement.name}</span>
        {row.rejectReason === null ? null : (
          <span className="text-pretty font-medium text-badge-warning-fg">{t('serverWarehouse.staging.rejected', { reason: row.rejectReason })}</span>
        )}
        {row.shortage === 'keepSearching' ? <span className="text-pretty text-ink-2">{t('serverWarehouse.staging.keepSearching')}</span> : null}
      </div>
      {placement.stopSequence === null ? null : (
        <StopChip stop={placement.stopSequence} label={t('common.stop', { number: placement.stopSequence })} name={placement.stopName ?? undefined} className="flex-none" />
      )}
      {row.manualPending ? (
        <span className="inline-flex min-h-14 max-w-80 items-center gap-2 text-pretty font-medium text-badge-warning-fg">
          <Hourglass className="size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('serverWarehouse.staging.manualPending')}
        </span>
      ) : row.shortage === 'open' ? (
        <span className="inline-flex min-h-14 items-center gap-2 font-medium text-badge-warning-fg">
          <Hourglass className="size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('warehouse.staging.reported')}
        </span>
      ) : (
        <Button variant="secondary" size="touch" className="flex-none" disabled={disabled} onClick={onReport}>
          <PackageX strokeWidth={2} />
          {t('warehouse.staging.reportShortage')}
        </Button>
      )}
    </li>
  )
}
