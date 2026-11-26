import { useState, type ReactNode } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { JobProgress, OptimizationJob } from './load-plans-backend-api'
import { RunFigure } from './RunFigure'
import { StepList, type StepItem } from './RunStageList'
import { formatClock, timeShare } from './run-clock'
import { planAlgorithmLabel } from './server-algorithms'
import { serverRunSteps } from './server-run-steps'
import { useCountUp } from './useCountUp'
import { useRunClock } from './useRunClock'

/** Đầu vào thật của lần chạy, đọc sẵn ở Thiết lập tối ưu (Chi tiết chuyến của máy chủ). Số nào không có thì `null` — không vẽ dòng đó. */
export type RunInputs = {
  readonly packageCount: number | null
  readonly stopCount: number | null
  readonly vehicleName: string | null
}

/**
 * Phần "đang chạy" của hộp thoại chạy tối ưu máy chủ: hình thùng xe (`RunFigure`: phần kiện xếp được của cách xếp tốt nhất khi máy chủ báo,
 * không thì dải chạy vòng), đồng hồ so giới hạn tính, số sống, các bước và đầu vào của lần chạy. Mọi số là số máy chủ trả, của chuyến, hoặc
 * của đồng hồ; máy chủ chưa trả `progress` / `elapsedMs` thì phần đó không có. Số sống và đồng hồ không nằm trong vùng live — vùng
 * `role="status"` của hộp thoại chỉ đổi theo bước.
 */
export function BackendRunProgress({ job, inputs }: { job: OptimizationJob | null; inputs?: RunInputs }) {
  const t = useT()
  const status = job?.status ?? 'PENDING'
  const progress = status === 'RUNNING' ? (job?.progress ?? null) : null
  const [sawImproving, setSawImproving] = useState(false)
  if (progress?.stage === 'IMPROVING' && !sawImproving) setSawImproving(true)
  const elapsed = useRunClock(status === 'RUNNING', job?.elapsedMs ?? null)
  const placed = progress?.bestPlacedCount ?? null
  const total = progress?.totalPackages ?? null
  const fraction = placed !== null && total !== null && total > 0 ? placed / total : null
  const steps = serverRunSteps({ status, stage: progress?.stage ?? null, sawImproving }).map(({ step, state }): StepItem => ({
    key: step,
    label: t(`serverRun.steps.${step}.label`),
    state,
    note: state === 'current' ? t(`serverRun.steps.${step}.note`) : undefined,
  }))
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <RunFigure fraction={fraction} className="h-32 w-full" />
        <div className="flex min-w-0 flex-col gap-3">
          {elapsed === null ? null : <RunClock elapsedMs={elapsed} limitSec={job?.timeLimitSec ?? null} />}
          {progress ? <LiveFigures progress={progress} /> : null}
        </div>
      </div>
      {steps.length > 0 ? <StepList items={steps} label={t('serverRun.steps.label')} attribute="data-server-step" /> : null}
      {inputs ? <RunInputsList inputs={inputs} /> : null}
    </div>
  )
}

/** Đồng hồ `mm:ss` cạnh giới hạn tính, thanh thời gian dừng ở đầy; quá giới hạn thì một câu "đang hoàn tất". */
function RunClock({ elapsedMs, limitSec }: { elapsedMs: number; limitSec: number | null }) {
  const t = useT()
  const share = timeShare(elapsedMs, limitSec)
  return (
    <div data-run-clock className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-small text-ink-2">{t('serverRun.clock.label')}</span>
        <span className="flex items-baseline gap-2">
          <span data-run-elapsed className="font-mono text-h2 font-medium tabular-nums text-ink-strong">{formatClock(elapsedMs)}</span>
          {limitSec === null ? null : (
            <span className="text-small text-ink-3">{t('serverRun.clock.limit', { limit: formatClock(limitSec * 1000) })}</span>
          )}
        </span>
      </div>
      {share === null ? null : (
        <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-n-100">
          <span
            data-run-time-bar
            className="block h-full rounded-full bg-azure-500 transition-[width] duration-(--dur-md) ease-(--ease-standard) motion-reduce:transition-none"
            style={{ width: `${(share.fraction * 100).toFixed(1)}%` }}
          />
        </span>
      )}
      {share?.over ? <p data-run-finishing className="text-small text-ink-2">{t('serverRun.clock.finishing')}</p> : null}
    </div>
  )
}

/** Ba số sống của cách xếp tốt nhất tới lúc này, và thuật toán đang chạy. Số nào máy chủ chưa có thì không có dòng đó. */
function LiveFigures({ progress }: { progress: JobProgress }) {
  const t = useT()
  const format = useFormat()
  const layouts = useCountUp(progress.layoutsTried)
  const placed = useCountUp(progress.bestPlacedCount)
  const volume = useCountUp(progress.bestVolumePercent, 0.1)
  const total = progress.totalPackages
  return (
    <dl data-run-live className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
      {layouts === null ? null : <Row label={t('serverRun.live.layouts')}>{format.integer(layouts)}</Row>}
      {placed === null || total === null ? null : (
        <Row label={t('serverRun.live.placed')}>{t('serverRun.live.placedValue', { placed: format.integer(placed), total: format.integer(total) })}</Row>
      )}
      {volume === null ? null : <Row label={t('serverRun.live.volume')}>{format.percent(volume)}</Row>}
      {progress.algorithm === null ? null : <Row label={t('serverRun.algorithm')} text>{planAlgorithmLabel(progress.algorithm, t)}</Row>}
    </dl>
  )
}

function Row({ label, text = false, children }: { label: string; text?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn('m-0 text-right text-ink-1', !text && 'font-mono tabular-nums')}>{children}</dd>
    </>
  )
}

function RunInputsList({ inputs }: { inputs: RunInputs }) {
  const t = useT()
  const format = useFormat()
  const rows = [
    inputs.packageCount === null ? null : { key: 'packages', label: t('serverRun.inputs.packages'), value: format.integer(inputs.packageCount), text: false },
    inputs.stopCount === null ? null : { key: 'stops', label: t('serverRun.inputs.stops'), value: format.integer(inputs.stopCount), text: false },
    inputs.vehicleName === null ? null : { key: 'vehicle', label: t('serverRun.inputs.vehicle'), value: inputs.vehicleName, text: true },
  ].filter((row) => row !== null)
  if (rows.length === 0) return null
  return (
    <section data-run-inputs className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
      <h3 className="m-0 text-small font-medium text-ink-2">{t('serverRun.inputs.title')}</h3>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
        {rows.map((row) => <Row key={row.key} label={row.label} text={row.text}>{row.value}</Row>)}
      </dl>
    </section>
  )
}
