import { CircleAlert, PackageOpen } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { OptimizationJob } from './load-plan-dto'
import { RunFigure } from './RunFigure'
import { runAlgorithmLabel } from './server-algorithms'

/**
 * Hộp thoại một lần chạy tối ưu của máy chủ. Máy chủ chỉ báo trạng thái job — không báo số kiện đã xét — nên hình là dải khối chạy vòng
 * (`fraction={null}`), không dừng ở mức đầy nào; bên cạnh chỉ có đúng điều máy chủ trả: trạng thái, mã lần chạy, thời gian tính và số
 * phương án đã lưu khi xong. Không ra phương án (`NO_SOLUTION`, `FAILED`) thì nói rõ, kèm việc máy chủ không trừ credit.
 */
export function BackendRunDialog({ open, onOpenChange, jobId, job, error, compareTo }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  /** `null` cho tới lần đọc trạng thái đầu tiên. */
  job: OptimizationJob | null
  error: unknown
  compareTo: string
}) {
  const t = useT()
  const format = useFormat()
  const status = job?.status ?? 'PENDING'
  const failed = status === 'NO_SOLUTION' || status === 'FAILED'
  const finished = job?.finished === true
  const title = error ? t('serverPlans.job.loadError') : failed ? t('serverPlans.job.failedTitle') : finished ? t('serverPlans.job.finishedTitle') : t('serverPlans.job.title')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">
        <DialogHeader icon={failed || error ? CircleAlert : PackageOpen} tone={failed || error ? 'danger' : 'info'} title={title} />
        <div className="flex flex-col gap-4 px-7 py-5">
          {finished || error ? null : <RunFigure fraction={null} className="h-36 w-full" />}
          <p role={failed || error ? 'alert' : 'status'} className={failed || error ? 'text-body text-danger' : 'text-body text-ink-1'}>
            {error ? dataErrorMessage(error, t) : t(`serverPlans.job.status.${status}`)}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
            <dt className="text-ink-3">{t('serverPlans.job.code')}</dt>
            <dd className="font-mono break-all">{jobId}</dd>
            {job?.computationMs == null ? null : <>
              <dt className="text-ink-3">{t('serverPlans.job.computation')}</dt>
              <dd className="font-mono tabular-nums">{t('serverPlans.job.computationValue', { ms: format.integer(job.computationMs) })}</dd>
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
          {finished && !failed ? <Button asChild><Link to={compareTo}>{t('serverPlans.job.compare')}</Link></Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
