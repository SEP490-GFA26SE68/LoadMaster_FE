import { Badge } from '@/components/ui/Badge'
import { PLAN_LABELS, PLAN_OBJECTIVES } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import { cn } from '@/lib/utils'
import { LANDING_REQUEST } from '../landing-sample.mock'
import { FIGURE_LABELS, FIGURE_ORDER, usePlanFigures } from '../usePlanFigures'
import type { JourneySample } from './useJourneySample'

/**
 * Cổng hiệu năng của bộ tối ưu mô phỏng (`services/optimization/mock-optimization.bench.ts`, LM-024): 1.000 kiện, cả ba phương án của
 * một lần chạy, p95 không quá 1 giây trên máy phát triển. File bench không thuộc mã của ứng dụng nên hai số chép lại ở đây; đổi cổng
 * thì đổi cùng lúc.
 */
const BENCH = { packages: 1000, seconds: 1 } as const
/** Số kiện của yêu cầu mẫu (cố định). */
const PACKAGE_COUNT = LANDING_REQUEST.packages.reduce((sum, line) => sum + line.quantity, 0)

const CELL = 'border-t border-line-soft px-3 py-2.5 text-right align-top'
const BAR = 'ml-auto block h-5 w-12 rounded-sm bg-n-100'

/**
 * Bảng so ba phương án của chặng điều phối: hàng là bốn chỉ số, cột là A · B · C (chữ cái kèm mục tiêu), số của lần chạy mẫu trên trình
 * duyệt của người xem — cùng lần chạy với khung 3D ở đầu trang. Số tốt nhất in đậm kèm nhãn xám "Tốt nhất" (không tô xanh hay đỏ). Chưa
 * có số: vạch giữ chỗ (`aria-hidden`) và một câu nói vì sao. Dưới bảng là hai số cố định của lần chạy (credit, thời gian), mỗi số một
 * câu nguồn.
 */
export function JourneyPlans({ sample }: { sample: JourneySample }) {
  const t = useT()
  const format = useFormat()
  const figures = usePlanFigures(sample.plans)
  return (
    <div className="flex flex-col gap-4">
      <PlanStack figures={figures} />
      {/* Dưới 640 px bảng chỉ còn cho trình đọc màn hình (cần khoảng 450 px); mắt đọc ba khối phương án ở trên */}
      <div className="overflow-x-auto rounded-lg border border-border bg-bg max-sm:sr-only">
        <table className="w-full min-w-[22rem] border-collapse text-body pointer-coarse:text-body-lg">
          <caption className="sr-only">{t('landingJourney.plans.caption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2.5 text-left text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">{t('landingJourney.plans.metric')}</th>
              {PLAN_OBJECTIVES.map((objective) => (
                <th key={objective} scope="col" className="px-3 py-2.5 text-right align-bottom font-normal">
                  <span className="block font-display text-h2 leading-7 font-bold text-ink-strong font-stretch-112%">{PLAN_LABELS[objective]}</span>
                  <span className="block text-small leading-tight text-balance text-ink-2 pointer-coarse:text-body-lg">{t(`runs.objectives.${objective}`)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIGURE_ORDER.map((metric, row) => (
              <tr key={metric}>
                <th scope="row" className="border-t border-line-soft px-3 py-2.5 text-left font-medium text-ink-2">{t(FIGURE_LABELS[metric])}</th>
                {PLAN_OBJECTIVES.map((objective) => {
                  const figure = figures?.get(PLAN_LABELS[objective])?.[row]
                  return (
                    <td key={objective} className={CELL}>
                      {figure ? (
                        <span className="flex flex-col items-end gap-1">
                          <span className={cn('font-mono whitespace-nowrap text-ink-strong tabular-nums', figure.best ? 'font-semibold' : 'font-normal')}>{figure.value ?? '—'}</span>
                          {figure.best ? <Badge shape="tag" className="pointer-coarse:text-body-lg">{t('landingStage.plans.best')}</Badge> : null}
                        </span>
                      ) : <span aria-hidden className={BAR} />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg" data-journey-plans={sample.state}>
        {sample.state === 'ready'
          ? t('landingJourney.plans.source', { count: format.integer(PACKAGE_COUNT) })
          : t(`landingJourney.plans.${sample.state}`)}
      </p>
      <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact
          value={t('landingJourney.facts.credit.value', { count: BILLING_CONSTANTS.optimizationCost })}
          label={t('landingJourney.facts.credit.label')}
          source={t('landingJourney.facts.credit.source')}
        />
        <Fact
          value={t('landingJourney.facts.speed.value', { seconds: format.integer(BENCH.seconds) })}
          label={t('landingJourney.facts.speed.label', { count: format.integer(BENCH.packages) })}
          source={t('landingJourney.facts.speed.source')}
        />
      </dl>
    </div>
  )
}

/**
 * Dưới 640 px: ba khối phương án xếp dọc, mỗi khối bốn chỉ số hai cột — cùng số, cùng nhãn "Tốt nhất" với bảng. Chỉ là hình
 * (`aria-hidden`): ở cỡ này bảng vẫn có cho trình đọc màn hình, nên không đọc hai lần.
 */
function PlanStack({ figures }: { figures: ReturnType<typeof usePlanFigures> }) {
  const t = useT()
  return (
    <ul aria-hidden className="m-0 flex list-none flex-col gap-2 p-0 sm:hidden">
      {PLAN_OBJECTIVES.map((objective) => {
        const rows = figures?.get(PLAN_LABELS[objective])
        return (
          <li key={objective} className="rounded-lg border border-border bg-bg px-4 py-3">
            <p className="m-0 flex items-baseline gap-2">
              <span className="font-display text-h2 leading-7 font-bold text-ink-strong font-stretch-112%">{PLAN_LABELS[objective]}</span>
              <span className="text-body text-ink-2 pointer-coarse:text-body-lg">{t(`runs.objectives.${objective}`)}</span>
            </p>
            {/* Mỗi chỉ số chiếm hai hàng của lưới (subgrid): nhãn xuống hai dòng ở một cột thì số hai cột vẫn thẳng hàng */}
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {FIGURE_ORDER.map((metric, row) => {
                const figure = rows?.[row]
                return (
                  <div key={metric} className="row-span-2 grid min-w-0 grid-rows-subgrid content-start gap-y-0.5">
                    <span className="text-small text-ink-3 pointer-coarse:text-body-lg">{t(FIGURE_LABELS[metric])}</span>
                    {figure ? (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 self-start">
                        <span className={cn('font-mono whitespace-nowrap text-ink-strong tabular-nums pointer-coarse:text-body-lg', figure.best ? 'font-semibold' : 'font-normal')}>{figure.value ?? '—'}</span>
                        {figure.best ? <Badge shape="tag" className="pointer-coarse:text-body-lg">{t('landingStage.plans.best')}</Badge> : null}
                      </span>
                    ) : <span className="block h-5 w-12 rounded-sm bg-n-100" />}
                  </div>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Một số cố định: số lớn, nhãn ngay sau, câu nguồn dưới cùng. */
function Fact({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-border pt-3">
      <dt className="text-body-lg font-semibold text-ink-strong">{label}</dt>
      <dd className="order-first m-0 font-display text-h1 font-bold whitespace-nowrap text-ink-strong tabular-nums font-stretch-112%">{value}</dd>
      <dd className="m-0 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg">{source}</dd>
    </div>
  )
}
