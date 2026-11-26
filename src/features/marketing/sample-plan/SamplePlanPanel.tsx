import { useId, type ReactNode } from 'react'
import { StopDot } from '@/components/StopChip'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { HowComputed } from '@/components/HowComputed'
import { PlanHow } from '../how/PlanHow'
import { firstStopFacts, type LandingPlan } from '../landing-plans'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from '../landing-sample.mock'
import { CONTROL, STAGE_SURFACE } from '../LandingStageParts'
import { StagePlans } from '../StagePlans'
import type { SampleMode, SamplePlanState } from './sample-plan-url'

const PACKAGE_COUNT = LANDING_REQUEST.packages.reduce((count, line) => count + line.quantity, 0)
const MODES = ['load', 'unload'] as const satisfies readonly SampleMode[]
const PRESSED = cn('aria-pressed:bg-cyan-400/20 aria-pressed:text-sky-text aria-pressed:shadow-[inset_0_0_0_1px_var(--cyan-300)]',
  'forced-colors:aria-pressed:border-b-4 forced-colors:aria-pressed:border-transparent')
const HEADING = 'm-0 font-display text-h3 font-bold text-sky-text font-stretch-112%'

/** Một số của bảng: nhãn trên, số dưới (mono). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-small text-sky-text-3 pointer-coarse:text-body-lg">{label}</dt>
      <dd className="m-0 font-mono text-body text-sky-text tabular-nums pointer-coarse:text-body-lg">{value}</dd>
    </div>
  )
}

/**
 * Cột điều khiển và bảng số của `/phuong-an-mau`: chọn xem xếp hay dỡ, điểm giao để dỡ, phương án A · B · C (`StagePlans`, cùng bộ chọn và
 * bốn số với khung mở đầu), rồi số của phương án và của điểm đang dỡ — mọi số đọc từ chính lần chạy trên trình duyệt, kèm "Tính thế nào?".
 * Chưa tính xong: bộ chọn giữ chỗ, không số nào.
 */
export function SamplePlanPanel({ state, plans, stopNames, onChange, children }: {
  state: SamplePlanState
  plans: readonly LandingPlan[] | null
  stopNames: readonly string[]
  onChange: (patch: Partial<SamplePlanState>) => void
  /** Phần cuối cột: câu nguồn, liên kết chia sẻ. */
  children?: ReactNode
}) {
  const t = useT()
  const format = useFormat()
  const plan = plans?.find((candidate) => candidate.id === state.plan)
  const metrics = plan?.result.metrics
  const stop = plan && state.mode === 'unload' ? firstStopFacts(LANDING_REQUEST, plan.result, state.stop) : null
  const stopName = stopNames[state.stop - 1] ?? ''
  const tripId = useId()
  const stopId = useId()

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('samplePlan.mode.label')} className={cn(STAGE_SURFACE, 'grid grid-cols-2 overflow-hidden')}>
        {MODES.map((mode) => (
          <button key={mode} type="button" aria-pressed={state.mode === mode} onClick={() => onChange({ mode })} className={cn(CONTROL, 'min-h-12', PRESSED)}>
            {t(`samplePlan.mode.${mode}`)}
          </button>
        ))}
      </div>

      {state.mode === 'unload' ? (
        <div role="group" aria-label={t('samplePlan.stops')} className="grid grid-cols-2 gap-2">
          {Array.from({ length: LANDING_STOP_COUNT }, (_, index) => index + 1).map((number) => (
            <button key={number} type="button" aria-pressed={state.stop === number} onClick={() => onChange({ stop: number })}
              aria-label={t('samplePlan.stopOption', { number, name: stopNames[number - 1] ?? '' })}
              className={cn(STAGE_SURFACE, CONTROL, 'min-h-14 justify-start px-2 text-left font-medium text-pretty', PRESSED)}>
              <StopDot stop={number} />
              <span className="min-w-0">{stopNames[number - 1]}</span>
            </button>
          ))}
        </div>
      ) : null}

      <StagePlans plans={plans} selected={state.plan} onSelect={(label) => onChange({ plan: label })} total={PACKAGE_COUNT}
        className="lg:[&_[data-stage-plan-figures]]:grid-cols-2" />

      {plan && metrics ? (
        <section aria-labelledby={tripId} className={cn(STAGE_SURFACE, 'flex flex-col gap-3 rounded-lg px-4 py-3')}>
          <h2 id={tripId} className={HEADING}>{t('samplePlan.trip.title', { label: plan.id })}</h2>
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Fact label={t('samplePlan.trip.placed')} value={t('samplePlan.trip.placedValue', { placed: format.integer(metrics.placedCount), total: format.integer(PACKAGE_COUNT) })} />
            <Fact label={t('samplePlan.trip.payload')} value={t('samplePlan.trip.payloadValue', { used: format.weight(metrics.usedPayloadKg), max: format.weight(metrics.maxPayloadKg) })} />
          </dl>
          <PlanHow tone="dark" request={LANDING_REQUEST} result={plan.result} metrics={['placed', 'payload']}
            subject={t('samplePlan.trip.howSubject', { label: plan.id })} className="-my-1" />
        </section>
      ) : null}

      {plan && stop ? (
        <section aria-labelledby={stopId} className={cn(STAGE_SURFACE, 'flex flex-col gap-3 rounded-lg px-4 py-3')}>
          <h2 id={stopId} className={HEADING}>{t('samplePlan.stop.title', { number: state.stop, name: stopName })}</h2>
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Fact label={t('samplePlan.stop.count')} value={format.integer(stop.count)} />
            <Fact label={t('samplePlan.stop.moved')} value={format.integer(stop.moved)} />
            {stop.outOfZone ? (
              <Fact label={t('samplePlan.stop.outOfZone')}
                value={t('samplePlan.stop.outOfZoneValue', { foreign: format.integer(stop.outOfZone.foreign), stray: format.integer(stop.outOfZone.stray) })} />
            ) : null}
          </dl>
          <HowComputed tone="dark" subject={t('samplePlan.stop.howSubject', { number: state.stop })} className="-my-1" entries={[
            { key: 'moved', label: t('samplePlan.stop.moved'), text: t('samplePlan.stop.note', { label: plan.id }) },
            ...(stop.outOfZone ? [{ key: 'zone', label: t('samplePlan.stop.outOfZone'), text: t('samplePlan.stop.outOfZoneHow', {
              number: state.stop, foreign: format.integer(stop.outOfZone.foreign), stray: format.integer(stop.outOfZone.stray),
            }) }] : []),
          ]} />
        </section>
      ) : null}

      {children}
    </div>
  )
}
