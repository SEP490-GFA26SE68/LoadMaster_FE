import { CheckCircle2, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PackageVerify, type VerifyCode, type VerifyOutcome } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { isApiError } from '@/lib/api-client'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { VerifyMethod } from '@/lib/mock-db'
import { serverLoadingView } from './server-loading'
import { ServerDeviationDialog } from './ServerDeviationDialog'
import { ServerPlacementCard, ServerPlacementList } from './ServerPlacementCard'
import { StepHeader } from './StepHeader'
import { useCompleteServerLoadingMutation, useConfirmServerPlacementMutation, useServerLoadingSessionQuery } from './useServerWarehouseQuery'
import { codeMatches, type ServerLoadingSession as Session } from './warehouse-server-api'
import { WarehouseEmpty } from './WarehouseEmpty'

/** Máy chủ không trả mã QR của kiện ở bước xếp và chưa có xác nhận tay: hộp đối chiếu chỉ còn gõ mã. */
const CODE_ONLY: readonly VerifyMethod[] = ['CODE']

/**
 * Phiên xếp `/kho?chuyen=<mã số>` khi nhóm `warehouse` nối backend: kiện theo thứ tự xếp của phương án đã duyệt mà máy chủ trả lúc bắt đầu.
 * Mỗi kiện: đối chiếu bằng mã gõ (tab kiểm mã khớp kiện của bước rồi máy chủ ghi đã xếp) hoặc ghi sai lệch vị trí; xong mọi kiện thì "Hoàn
 * tất xếp hàng". Không có bước soạn hàng, báo thiếu, kiện hỏng, xác nhận tay, seal, khung 3D (D-20).
 */
export function ServerLoadingSession({ tripId }: { tripId: string }) {
  const t = useT()
  const query = useServerLoadingSessionQuery(tripId)
  if (query.isPending) {
    return (
      <div role="status" className="grid h-dvh place-items-center bg-bg text-body-lg text-text-2">
        <span className="inline-flex items-center gap-2"><Spinner />{t('warehouse.loading')}</span>
      </div>
    )
  }
  if (query.isError) {
    const unavailable = isApiError(query.error) && query.error.code === 'LOADING_SESSION_UNAVAILABLE'
    return (
      <WarehouseEmpty
        tripId={tripId}
        mascot={unavailable ? 'warehouseWaiting' : 'error'}
        title={t(unavailable ? 'serverWarehouse.session.unavailableTitle' : 'warehouse.loadErrorTitle')}
        description={dataErrorMessage(query.error, t)}
      />
    )
  }
  const session = query.data
  if (session.completed) {
    return (
      <WarehouseEmpty
        tripId={tripId}
        label={session.code}
        mascot="done"
        title={t('serverWarehouse.session.finishedTitle', { code: session.code })}
        description={t('serverWarehouse.session.finishedDescription')}
      />
    )
  }
  return <SessionView tripId={tripId} session={session} />
}

function SessionView({ tripId, session }: { tripId: string; session: Session }) {
  const t = useT()
  const view = serverLoadingView(session)
  const confirm = useConfirmServerPlacementMutation(tripId)
  const complete = useCompleteServerLoadingMutation(tripId)
  const [verifying, setVerifying] = useState(false)
  const [deviating, setDeviating] = useState(false)
  const [result, setResult] = useState<VerifyOutcome | null>(null)
  const current = view.current

  function handleVerifyOpen(next: boolean) {
    setResult(null)
    setVerifying(next)
  }

  function handleVerify({ code }: VerifyCode) {
    if (current === undefined) return
    if (!codeMatches(current, code)) {
      setResult({ tone: 'error', message: t('serverWarehouse.session.codeUnmatched', { code: code.trim(), name: current.name }) })
      return
    }
    confirm.mutate(current.id, {
      // Màn sang kiện kế tiếp ngay (thẻ, thanh tiến độ): không toast thành công; dòng kết quả trong hộp cho trình đọc màn hình
      onSuccess: () => setResult({ tone: 'success', message: t('serverWarehouse.session.confirmed', { name: current.name }) }),
      onError: (error) => setResult({ tone: 'error', message: dataErrorMessage(error, t) }),
    })
  }

  function handleComplete() {
    complete.mutate(undefined, { onError: (error) => toast.error(dataErrorMessage(error, t)) })
  }

  // Kiện cuối đã có kết quả: không còn gì để đối chiếu
  if (verifying && current === undefined) setVerifying(false)

  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <StepHeader
        step={view.step}
        totalSteps={view.total}
        recorded={view.done}
        tripId={tripId}
        code={session.code}
        progressLabel={t('serverWarehouse.session.progressLabel', { code: session.code })}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-200 flex-col gap-4">
          <p role="status" className="m-0 font-medium text-ink-2">{t('serverWarehouse.session.progress', { done: view.done, total: view.total })}</p>
          {current === undefined ? (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5 shadow-card">
              <p className="m-0 flex items-start gap-3 text-ink-strong">
                <CheckCircle2 className="mt-0.5 size-6 flex-none text-success" strokeWidth={1.5} aria-hidden />
                {t(view.total === 0 ? 'serverWarehouse.session.noPlacements' : 'serverWarehouse.session.allDone')}
              </p>
              <Button variant="primary" size="touch" className="h-16 w-full" loading={complete.isPending} onClick={handleComplete}>
                {t('serverWarehouse.session.complete')}
              </Button>
            </div>
          ) : (
            <ServerPlacementCard placement={current} step={view.step} total={view.total}>
              <Button variant="primary" size="touch" className="h-16 w-full" onClick={() => handleVerifyOpen(true)}>
                <ScanLine strokeWidth={2} />
                {t('serverWarehouse.session.verify')}
              </Button>
              <Button variant="secondary" size="touch" className="w-full" onClick={() => setDeviating(true)}>
                {t('serverWarehouse.session.deviate')}
              </Button>
            </ServerPlacementCard>
          )}
          <ServerPlacementList rows={view.rows} />
        </div>
      </main>

      {current === undefined ? null : (
        <>
          <PackageVerify
            open={verifying}
            onOpenChange={handleVerifyOpen}
            methods={CODE_ONLY}
            codeLabel={t('serverWarehouse.session.codeLabel')}
            codeHint={t('serverWarehouse.session.codeHint')}
            title={t('serverWarehouse.session.verifyTitle', { step: view.step })}
            description={t('serverWarehouse.session.verifyDescription')}
            onVerify={handleVerify}
            candidates={[]}
            onManual={() => undefined}
            result={result}
            pending={confirm.isPending}
          />
          <ServerDeviationDialog key={current.id} tripId={tripId} placement={current} step={view.step} open={deviating} onOpenChange={setDeviating} />
        </>
      )}
    </div>
  )
}
