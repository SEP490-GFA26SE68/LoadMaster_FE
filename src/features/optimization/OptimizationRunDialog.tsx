import { LoaderCircle, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/Dialog'
import { useFormat, useT } from '@/lib/i18n'
import type { OptimizationProgress } from '@/services/optimization'
import type { SetupValues } from './optimization-request'

/** Thiết lập của lần chạy đang chạy: đọc lại trong hộp thoại để người dùng biết mình đang chờ cái gì. */
export type RunDialogContext = {
  readonly tripId: string
  readonly vehicleName: string
  /** Tổng kiện của chuyến — hiện ngay khi service chưa kịp báo tiến trình đầu tiên. */
  readonly total: number
  readonly values: SetupValues
}

/**
 * Tiến trình tối ưu thật (LM-048, V2.3 `DangToiUu.jpg`): số kiện đã xét trên tổng, thời gian đã chạy và giới hạn, rồi thiết lập của lần
 * chạy (chuyến · xe, mục tiêu · thuật toán · seed, hai yêu cầu). Không có "vòng tối ưu" hay tỷ lệ lấp đầy giả lập — service mock chỉ báo
 * số kiện đã xét (AGENTS mục 6 "Không bịa số"). Tông xanh lam = đang chạy (bản mẫu dùng tím, repo không dùng tím). Đóng là huỷ job.
 */
export function OptimizationRunDialog({ progress, context, onCancel }: {
  progress: OptimizationProgress | null
  context: RunDialogContext
  onCancel: () => void
}) {
  const t = useT()
  const format = useFormat()
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const { values } = context
  const placed = progress?.placed ?? 0
  const total = progress?.total ?? context.total
  const percent = total > 0 ? Math.min(100, (placed / total) * 100) : 0
  const onOff = (value: boolean) => (value ? t('optimization.running.on') : t('optimization.running.off'))
  const rows = [
    { label: t('optimization.running.trip'), value: <><span className="font-mono text-caption">{context.tripId}</span> · {context.vehicleName}</> },
    {
      label: t('optimization.running.choice'),
      value: t('optimization.running.choiceValue', {
        objective: t(`runs.objectives.${values.objective}`),
        algorithm: t(`runs.algorithms.${values.algorithm}`),
        seed: values.randomSeed === undefined || Number.isNaN(values.randomSeed) ? t('runs.noValue') : String(values.randomSeed),
      }),
    },
    {
      label: t('optimization.running.requirements'),
      value: t('optimization.running.requirementsValue', { lifo: onOff(values.enforceLifo), lowCenter: onOff(values.prioritizeLowCenterOfGravity) }),
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="w-125">
        <div className="flex items-start gap-3.5 px-7 pt-6">
          <span aria-hidden className="grid size-10 flex-none place-items-center rounded-lg bg-azure-50 text-azure-700">
            <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle className="font-display text-h2 leading-6.5 font-bold text-ink-strong font-stretch-106%">{t('optimization.running.title')}</DialogTitle>
            <DialogDescription className="text-body text-ink-2 tabular-nums">
              {t('optimization.running.progress', { placed: format.integer(placed), total: format.integer(total) })}
            </DialogDescription>
          </div>
        </div>
        <div className="px-7 pt-4 pb-5">
          <div role="progressbar" aria-label={t('optimization.running.title')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={placed}
            className="h-2.5 overflow-hidden rounded-full bg-azure-50 shadow-[inset_0_0_0_1px_var(--azure-200)]">
            <div className="h-full rounded-full bg-azure-500 transition-[width] duration-(--dur-md) ease-decelerate" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3 text-small text-ink-3 tabular-nums">
            <p role="status" className="m-0 inline-flex items-center gap-1.5">
              <Timer aria-hidden className="size-3.75" strokeWidth={2} />
              {t('optimization.running.elapsed', { seconds: format.integer(Math.floor((now - startedAt) / 1000)) })}
            </p>
            {Number.isFinite(values.timeLimitSeconds) ? (
              <span>{t('optimization.running.limit', { seconds: format.integer(values.timeLimitSeconds) })}</span>
            ) : null}
          </div>
          <dl className="m-0 mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-md border border-line-soft bg-n-25 px-3.5 py-3 text-small leading-4.75">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-ink-3">{row.label}</dt>
                <dd className="m-0 text-ink-strong">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <DialogFooter>
          <span className="mr-auto text-small text-ink-3">{t('optimization.running.note')}</span>
          <Button variant="secondary" onClick={onCancel}>{t('optimization.running.cancel')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
