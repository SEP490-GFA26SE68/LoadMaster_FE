import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ProgressStep } from '@/features/trips/trip-progress'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { SheetSample, SheetTrip } from '../design-system-api'
import { SheetCard } from '../SheetLayout'

/**
 * Thước đo lấp đầy và tải trọng của chuyến đầu kho và của chuyến dùng tải cao nhất, rồi bốn mốc đầu của tiến trình một chuyến đang
 * chờ duyệt (`tripProgress` của Chi tiết chuyến). `ProgressBar` chỉ hiện số nguyên ở nhãn riêng của nó, nên nhãn và số thập phân
 * nằm ở hàng trên, thanh để trần.
 */
export function MetersCard({ sample }: { sample: SheetSample | undefined }) {
  const t = useT()
  const format = useFormat()
  if (!sample) {
    return (
      <SheetCard title={t('designSystem.components.meters.title')}>
        <Skeleton className="h-40 w-full rounded-md" />
      </SheetCard>
    )
  }

  const payload = (trip: SheetTrip) => t('designSystem.components.meters.payloadValue', {
    percent: format.percent(trip.payloadPercent ?? 0),
    used: format.integer(trip.usedPayloadKg ?? 0),
    max: format.weight(trip.maxPayloadKg),
  })
  const { trip, heaviest, progress } = sample

  return (
    <SheetCard title={t('designSystem.components.meters.title')}>
      <Meter label={t('viewer.plan.volume')} value={trip.volumePercent ?? 0} text={format.percent(trip.volumePercent ?? 0)} />
      <Meter label={t('viewer.plan.payload')} value={trip.payloadPercent ?? 0} text={payload(trip)} />
      {heaviest ? (
        <div className="flex flex-col gap-1.5">
          <Meter label={t('viewer.plan.payload')} value={heaviest.payloadPercent ?? 0} text={payload(heaviest)} />
          <p className="m-0 text-fine text-ink-3">{t('designSystem.components.meters.heaviest', { id: heaviest.id })}</p>
        </div>
      ) : null}
      {progress ? <Steps tripId={progress.tripId} steps={progress.steps.slice(0, 4)} /> : null}
    </SheetCard>
  )
}

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
  const tone = value > 100 ? 'danger' : value > 90 ? 'warning' : 'primary'
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small text-ink-3">{label}</span>
        <span className={cn('font-display text-small font-[650] tabular-nums', tone === 'danger' ? 'text-danger' : 'text-ink-strong')}>{text}</span>
      </div>
      <ProgressBar value={value} tone={tone} />
    </div>
  )
}

/** Mốc ngang: xong = chấm đặc, mốc kế tiếp = vòng cyan "đang chờ", còn lại = vòng xám và "—". */
function Steps({ tripId, steps }: { tripId: string; steps: readonly ProgressStep[] }) {
  const t = useT()
  const format = useFormat()
  const next = steps.findIndex((step) => step.state !== 'done')
  return (
    <ol aria-label={t('designSystem.components.meters.stepsLabel', { id: tripId })} className="m-0 mt-1 grid list-none grid-cols-4 p-0">
      {steps.map((step, index) => {
        const done = step.state === 'done'
        return (
          <li key={step.kind} className="flex min-w-0 flex-col gap-1">
            <div aria-hidden className="flex items-center">
              <span
                className={cn(
                  'size-2.5 flex-none rounded-full',
                  done ? 'bg-cyan-600' : index === next ? 'bg-bg shadow-[inset_0_0_0_2px_var(--cyan-500)]' : 'bg-bg shadow-[inset_0_0_0_2px_var(--n-300)]',
                )}
              />
              {index < steps.length - 1 ? <span className={cn('h-0.5 flex-1', done ? 'bg-cyan-600' : 'bg-n-200')} /> : null}
            </div>
            <span className={cn('pr-2 text-fine font-semibold', done || index === next ? 'text-ink-strong' : 'text-ink-3')}>
              {t(`trips.progress.steps.${step.kind}`)}
            </span>
            <span className="font-mono text-note text-ink-3">
              {step.at ? format.time(step.at) : index === next ? t('designSystem.components.meters.waiting') : t('designSystem.style.unread')}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
