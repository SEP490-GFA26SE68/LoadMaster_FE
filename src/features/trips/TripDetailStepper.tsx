import { Check, TriangleAlert, X } from 'lucide-react'
import { useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import type { Formatter } from '@/lib/format'
import type { Trip } from '@/lib/mock-db'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { tripProgress, type ProgressStep } from './trip-progress'
import { useTripActivityQuery } from './useTripsQuery'

type Look = 'done' | 'closed' | 'final' | 'current' | 'next' | 'stale' | 'cancel' | 'pending'

/** Cách vẽ một mốc: chuyến đã khép (hoàn thành, huỷ) thì mốc đã qua dịu đi, chỉ mốc cuối còn màu. */
function lookOf(step: ProgressStep, closed: boolean): Look {
  if (step.kind === 'cancelled') return 'cancel'
  if (step.stale) return 'stale'
  if (step.state === 'current') return 'current'
  if (step.state === 'done') return step.kind === 'completed' ? 'final' : closed ? 'closed' : 'done'
  return step.note ? 'next' : 'pending'
}

const DOT: Record<Look, string> = {
  done: 'border-cyan-400 bg-cyan-400 text-cyan-950 shadow-[0_0_14px_-2px_var(--cyan-400)]',
  closed: 'border-transparent bg-cyan-200/85 text-cyan-950',
  final: 'border-green-500 bg-green-500 text-cyan-950 shadow-[0_0_14px_-2px_var(--green-500)]',
  current: 'border-2 border-azure-200 bg-azure-500/30 shadow-[0_0_0_5px_color-mix(in_srgb,var(--azure-500)_24%,transparent)]',
  next: 'border-2 border-cyan-300 shadow-[0_0_0_5px_color-mix(in_srgb,var(--cyan-400)_18%,transparent)]',
  stale: 'border-amber-500 bg-amber-500/20 text-amber-200',
  cancel: 'border-red-500 bg-red-500 text-white',
  pending: 'border-cyan-100/30',
}

/** Đoạn nối tới mốc này, theo mốc đích. */
function connector(look: Look): string {
  switch (look) {
    case 'done':
    case 'stale':
      return 'bg-linear-to-r from-cyan-400 to-cyan-300 shadow-[0_0_10px_color-mix(in_srgb,var(--cyan-400)_50%,transparent)]'
    case 'closed':
      return 'bg-cyan-200/55'
    case 'final':
      return 'bg-linear-to-r from-cyan-200/55 to-green-500'
    case 'current':
      return 'bg-linear-to-r from-cyan-400 to-azure-200'
    case 'cancel':
      return 'bg-[repeating-linear-gradient(90deg,var(--red-500)_0_6px,transparent_6px_11px)]'
    default:
      return 'bg-cyan-100/16'
  }
}

/**
 * Tiến trình của chuyến trên dải trời (V2.3, `ChiTietChuyen*.jpg`; LM-088, D-47): các mốc nối nhau với giờ và người làm, số kiện đã
 * xếp / số điểm đã giao kèm thanh tiến độ ở mốc đang diễn ra, "Tiếp theo" ở mốc kế tiếp, "Lỗi thời" ở mốc duyệt khi bản duyệt lỗi
 * thời. Mọi số và mốc lấy từ kho. Đang diễn ra dùng xanh lam (AGENTS mục 5, không dùng tím của bản mẫu).
 */
export function TripDetailStepper({ trip }: { trip: Trip }) {
  const t = useT()
  const activity = useTripActivityQuery(trip.id)
  const data = activity.data
  const steps = useMemo(() => (data ? tripProgress(trip, data.revisions, data.events) : []), [trip, data])
  const names = useMemo(() => new Map(data?.users.map((user) => [user.id, user.fullName])), [data])
  const closed = trip.phase === 'completed' || trip.phase === 'cancelled'

  if (activity.isPending) {
    return <div role="status" aria-label={t('trips.detail.loading')} className="grid h-16 place-items-center"><Spinner tone="light" /></div>
  }
  return (
    <ol aria-label={t('trips.progress.title')} className="m-0 flex list-none items-start overflow-x-auto p-0 pt-1.5 pb-1">
      {steps.map((step, index) => {
        const look = lookOf(step, closed)
        return (
          <li key={step.kind} className={cn('flex min-w-0 items-start', index > 0 && 'flex-1')}>
            {index > 0 ? <span aria-hidden className={cn('mx-3 mt-2.5 h-0.5 min-w-5 flex-1 rounded-full', connector(look))} /> : null}
            <Step step={step} look={look} actor={step.actorId ? names.get(step.actorId) ?? step.actorId : null} />
          </li>
        )
      })}
    </ol>
  )
}

function Step({ step, look, actor }: { step: ProgressStep; look: Look; actor: string | null }) {
  const t = useT()
  const format = useFormat()
  const bar = step.loading
    ? { count: loadingCount(step, t, format), ratio: step.loading.total > 0 ? step.loading.loaded / step.loading.total : 0 }
    : step.delivery
      ? {
          count: t('trips.progress.deliveryCount', { done: format.integer(step.delivery.done), total: format.integer(step.delivery.total) }),
          ratio: step.delivery.total > 0 ? step.delivery.done / step.delivery.total : 0,
        }
      : null
  const reached = look !== 'pending' && look !== 'next'

  return (
    <div className="flex flex-none items-start gap-2.5 whitespace-nowrap">
      <span aria-hidden className={cn('-mt-0.5 grid size-6 flex-none place-items-center rounded-full border-[1.5px]', DOT[look])}>
        {look === 'cancel' ? <X className="size-3" strokeWidth={3} /> : null}
        {look === 'current' ? <span className="size-2 rounded-full bg-azure-50" /> : null}
        {look === 'done' || look === 'closed' || look === 'final' || look === 'stale' ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className={cn('flex items-center text-small font-semibold', reached ? 'text-sky-text' : look === 'next' ? 'text-cyan-200' : 'text-cyan-50/55')}>
          {t(`trips.progress.steps.${step.kind}`)}
          <span className="sr-only">
            , {t(`trips.progress.state.${step.state}`)}{step.stale ? `, ${t('trips.progress.staleA11y')}` : null}
          </span>
          {step.stale ? (
            <span aria-hidden className="ml-2 inline-flex h-4.5 items-center gap-1 rounded-sm bg-amber-500/20 px-1.5 text-note text-amber-200 ring-1 ring-amber-500/45 ring-inset">
              <TriangleAlert className="size-3" strokeWidth={2.2} />
              {t('trips.progress.staleTag')}
            </span>
          ) : null}
        </span>
        {bar ? (
          <>
            <span className={cn('mt-1 text-caption font-medium', look === 'current' ? 'text-azure-50' : 'text-cyan-50/90')}>{bar.count}</span>
            {look === 'current' ? (
              <span aria-hidden className="mt-1.5 h-1 w-31 overflow-hidden rounded-full bg-white/14">
                <span className="block h-full rounded-full bg-linear-to-r from-azure-50 to-azure-200" style={{ width: `${Math.round(bar.ratio * 100)}%` }} />
              </span>
            ) : null}
          </>
        ) : null}
        {step.at ? (
          <span className="mt-1 font-display text-caption text-cyan-100/62 tabular-nums">
            {t('trips.progress.at', { time: format.time(step.at), date: format.date(step.at) })}
          </span>
        ) : null}
        {step.at && actor ? <span className="text-caption text-cyan-100/62">{actor}</span> : null}
        {step.note ? (
          <span className={cn('mt-1 text-caption font-semibold', step.note === 'next' ? 'text-cyan-300' : 'text-amber-200')}>
            {t(`trips.progress.note.${step.note}`)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function loadingCount(step: ProgressStep, t: TFunction, format: Formatter): string {
  const loading = step.loading
  if (!loading) return ''
  return [
    t('trips.progress.loadingCount', { loaded: format.integer(loading.loaded), total: format.integer(loading.total) }),
    ...(loading.damaged > 0 ? [t('trips.progress.damagedCount', { count: loading.damaged })] : []),
  ].join(' · ')
}
