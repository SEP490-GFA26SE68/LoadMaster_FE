import { StopDot } from '@/components/StopChip'
import { PLAN_LABELS } from '@/domain/models'
import { UNLOAD_STOP } from '@/features/viewer3d/landing/story-timeline'
import { useFormat, useT } from '@/lib/i18n'
import { DEFAULT_OBJECTIVE } from '../landing-plans'
import type { JourneySample } from './useJourneySample'

const PAYSLIP_ROWS = ['baseSalary', 'kgAmount', 'handlingAmount'] as const
const STOP_LABELS = ['count', 'moved', 'foreign', 'stray'] as const
const GRID = 'm-0 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4'
const ITEM = 'flex min-w-0 flex-col justify-end gap-0.5'
const LABEL = 'text-small text-ink-3 pointer-coarse:text-body-lg'
const VALUE = 'm-0 font-mono text-h2 leading-7 font-semibold text-ink-strong tabular-nums'
const BAR = 'block h-7 w-12 rounded-sm bg-n-100'

/**
 * Chặng điểm giao: bốn số của điểm 1 trên phương án mặc định của lần chạy mẫu (phương án C, cùng phương án khung 3D ở đầu trang vẽ) —
 * số kiện của điểm, số kiện giao sau phải dời mới lấy được, và hai số nằm sai vùng (`FirstStopFacts`; phương án không chia vùng thì không
 * có hai ô này). Chưa có lần chạy: nhãn kèm vạch giữ chỗ (`aria-hidden`); câu vì sao chưa có số nằm ở bảng so của chặng điều phối.
 */
export function JourneyStop({ sample }: { sample: JourneySample }) {
  const t = useT()
  const format = useFormat()
  const label = PLAN_LABELS[DEFAULT_OBJECTIVE]
  const facts = sample.plans?.find((plan) => plan.id === label)?.firstStop
  const values: Partial<Record<(typeof STOP_LABELS)[number], number>> = facts ? {
    count: facts.count,
    moved: facts.moved,
    ...(facts.outOfZone ? { foreign: facts.outOfZone.foreign, stray: facts.outOfZone.stray } : {}),
  } : {}
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4" data-journey-stop={facts ? 'ready' : 'pending'}>
      <p className="m-0 flex items-center gap-2 text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">
        <StopDot stop={UNLOAD_STOP} className="size-6 text-small pointer-coarse:size-7 pointer-coarse:text-body-lg" />
        {t('landingStage.stop.title', { number: format.integer(UNLOAD_STOP), name: t('landing.sample.stop1') })}
      </p>
      {facts ? (
        <dl className={GRID}>
          {STOP_LABELS.map((key) => {
            const value = values[key]
            return value === undefined ? null : (
              <div key={key} className={ITEM}>
                <dt className={LABEL}>{t(`landingStage.stop.${key}`)}</dt>
                <dd className={VALUE}>{format.integer(value)}</dd>
              </div>
            )
          })}
        </dl>
      ) : (
        <div aria-hidden className={GRID}>
          {STOP_LABELS.map((key) => (
            <div key={key} className={ITEM}>
              <span className={LABEL}>{t(`landingStage.stop.${key}`)}</span>
              <span className={BAR} />
            </div>
          ))}
        </div>
      )}
      {facts ? <p className="m-0 text-small text-ink-3 pointer-coarse:text-body-lg">{t('landingJourney.stop.source', { label })}</p> : null}
    </div>
  )
}

/**
 * Chặng cuối: phiếu lương minh hoạ của tài xế — đúng nhãn của màn Bảng lương, không số nào (vạch xám thay số, `aria-hidden`), kèm một câu
 * nói hoa hồng và tiền bốc dỡ tính từ đâu.
 */
export function JourneyPayslip() {
  const t = useT()
  return (
    <div className="flex max-w-105 flex-col gap-3 rounded-lg border border-border bg-bg p-4">
      <p className="m-0 font-display text-h3 font-[650] text-ink-strong font-stretch-108%">{t('landingJourney.payslip.title')}</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {PAYSLIP_ROWS.map((row) => (
          <li key={row} className="flex items-center justify-between gap-4 border-t border-line-soft py-1 text-body text-ink-2 sm:py-1.5 pointer-coarse:text-body-lg">
            {t(`payroll.statement.${row}`)}
            <span aria-hidden className="block h-4 w-20 flex-none rounded-sm bg-n-100" />
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 border-t border-border py-1 text-body font-semibold sm:py-1.5 text-ink-strong pointer-coarse:text-body-lg">
          {t('payroll.statement.totalSalary')}
          <span aria-hidden className="block h-5 w-24 flex-none rounded-sm bg-tint-blue" />
        </li>
      </ul>
      <p className="m-0 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg">{t('landingJourney.payslip.note')}</p>
    </div>
  )
}
