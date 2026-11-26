import { CircleAlert, PackageOpen } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { OptimizationJob } from './load-plans-backend-api'
import { BackendRunProgress, type RunInputs } from './BackendRunProgress'
import { getBackendJobStatusKey } from './backend-job-status'
import { computationTime } from './computation-time'
import { DataWarningsBanner } from './DataWarningsBanner'
import { runAlgorithmLabel } from './server-algorithms'
import { serverRunSteps } from './server-run-steps'
import { solverConstraintMessage } from './solver-constraints'

/**
 * Hộp thoại một lần chạy tối ưu của máy chủ. Đang chạy: `BackendRunProgress` (hình, đồng hồ so giới hạn, số sống, các bước, đầu vào của
 * lần chạy — chỉ phần máy chủ hay chuyến có số). Vùng `role="status"` là câu trạng thái của job, thêm tên bước khi máy chủ báo bước, nên
 * chỉ đổi theo bước. Khi xong: trạng thái, mã lần chạy, thời gian tính (giây từ 1 giây trở lên), số phương án đã lưu, và — nếu lần chạy
 * không ra chỗ đặt — các mã ràng buộc cứng đã chặn (`violatedConstraints`). Cảnh báo dữ liệu của job (`dataWarnings`) hiện ngay khi máy
 * chủ trả, chỉ có số kiện (hộp thoại chưa có phương án để đổi mã số sang mã kiện).
 */
export function BackendRunDialog({ open, onOpenChange, jobId, job, error, compareTo, hasPlans, constraintCodes = [], inputs }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  /** `null` cho tới lần đọc trạng thái đầu tiên. */
  job: OptimizationJob | null
  error: unknown
  hasPlans: boolean
  compareTo: string
  /** Mã ràng buộc cứng gom từ kiện chưa xếp của lần chạy. */
  constraintCodes?: readonly string[]
  /** Đầu vào thật của lần chạy (số kiện, điểm giao, xe). */
  inputs?: RunInputs
}) {
  const t = useT()
  const format = useFormat()
  const status = job?.status ?? 'PENDING'
  const failed = status === 'NO_SOLUTION' || status === 'FAILED' || status === 'TIMEOUT' || status === 'CANCELLED'
  const finished = job?.finished === true
  const title = error ? t('serverPlans.job.loadError') : failed ? t('serverPlans.job.failedTitle') : finished ? t('serverPlans.job.finishedTitle') : t('serverPlans.job.title')
  const stage = status === 'RUNNING' ? (job?.progress?.stage ?? null) : null
  const currentStep = stage === null ? null : serverRunSteps({ status, stage, sawImproving: true }).find((step) => step.state === 'current')?.step
  const statusText = error ? dataErrorMessage(error, t) : t(getBackendJobStatusKey(status))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-3rem)] w-136">
        <DialogHeader icon={failed || error ? CircleAlert : PackageOpen} tone={failed || error ? 'danger' : 'info'} title={title} />
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-7 py-5">
          <p role={failed || error ? 'alert' : 'status'} className={failed || error ? 'text-body text-danger' : 'text-body text-ink-1'}>
            {currentStep ? `${statusText} — ${t(`serverRun.steps.${currentStep}.label`)}` : statusText}
          </p>
          {finished || error ? null : <BackendRunProgress job={job} inputs={inputs} />}
          <DataWarningsBanner warnings={job?.dataWarnings ?? []} />
          {constraintCodes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-small font-medium text-ink-2">{t('serverPlans.job.constraintsHeading')}</p>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body text-danger">
                {constraintCodes.map((code) => (
                  <li key={code}>{solverConstraintMessage(code, t)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
            <dt className="text-ink-3">{t('serverPlans.job.code')}</dt>
            <dd className="font-mono break-all">{jobId}</dd>
            {job?.computationMs == null ? null : <>
              <dt className="text-ink-3">{t('serverPlans.job.computation')}</dt>
              <dd data-run-computation className="font-mono tabular-nums">{computationTime(job.computationMs, t, format)}</dd>
            </>}
            {job?.runAlgorithm == null ? null : <>
              <dt className="text-ink-3">{t('serverPlans.algorithms.runLabel')}</dt>
              <dd data-run-algorithm>{runAlgorithmLabel(job.runAlgorithm, t)}</dd>
            </>}
          </dl>
          {job?.pinnedCount != null && job.pinnedCount > 0 ? (
            <p className="text-small text-ink-2">{t('serverPlans.job.pinned', { count: job.pinnedCount })}</p>
          ) : null}
          {finished && job?.packedPlanCount != null && job.packedPlanCount > 0 ? (
            <p className="text-small text-ink-2">{t('serverPlans.job.plans', { count: job.packedPlanCount })}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {finished || error ? t('serverPlans.job.close') : t('serverPlans.job.keepWaiting')}
          </Button>
          {finished && !failed && hasPlans ? <Button asChild><Link to={compareTo}>{t('serverPlans.job.compare')}</Link></Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
