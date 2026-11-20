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

const CELL = 'border-t border-line-soft px-1.5 py-2 text-right align-top sm:px-3 sm:py-2.5'
const BAR = 'ml-auto block h-5 w-12 rounded-sm bg-n-100'

/** Dán từ cuối vào từ đứng trước bằng khoảng trắng không ngắt: cột hẹp xuống dòng thành "0,4" / "điểm %", không để "%" đứng riêng. */
function keepUnit(value: string): string {
  return value.replace(/ (\S+)$/, ' $1')
}

/**
 * Bảng so ba phương án của chặng điều phối: hàng là bốn chỉ số, cột là A · B · C (chữ cái kèm mục tiêu), số của lần chạy mẫu trên trình
 * duyệt của người xem — cùng lần chạy với khung 3D ở đầu trang. Số tốt nhất in đậm kèm nhãn xám "Tốt nhất" (không tô xanh hay đỏ). Chưa
 * có số: vạch giữ chỗ (`aria-hidden`) và một câu nói vì sao. Dưới 640 px bảng tràn hết bề ngang, chia cột cố định, lề ô hẹp lại; tên
 * mục tiêu và giá trị xuống dòng ("17,5" / "điểm %") nên bảng vừa cả điện thoại 360 px. Dưới bảng là hai số cố định của lần chạy
 * (credit, thời gian) đứng cạnh nhau, mỗi số một câu nguồn.
 */
export function JourneyPlans({ sample }: { sample: JourneySample }) {
  const t = useT()
  const format = useFormat()
  const figures = usePlanFigures(sample.plans)
  return (
    <div className="flex flex-col gap-4">
      {/* Dưới 640 px bảng tràn hết bề ngang (bỏ viền hai bên) và chia cột cố định: ba cột số đủ chỗ cho nhãn "Tốt nhất" 16 px */}
      <div className="relative -mx-4 overflow-x-auto border-y border-border bg-bg sm:mx-0 sm:rounded-lg sm:border-x">
        <table className="w-full table-fixed border-collapse text-body pointer-coarse:text-body-lg sm:table-auto">
          <caption className="sr-only">{t('landingJourney.plans.caption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-1/4 px-1.5 py-2 text-left align-bottom text-small font-semibold text-ink-2 pointer-coarse:text-body-lg sm:w-auto sm:px-3">{t('landingJourney.plans.metric')}</th>
              {PLAN_OBJECTIVES.map((objective) => (
                <th key={objective} scope="col" className="px-1.5 py-2 text-right align-bottom font-normal sm:px-3 sm:py-2.5">
                  <span className="block font-display text-h2 leading-7 font-bold text-ink-strong font-stretch-112%">{PLAN_LABELS[objective]}</span>
                  <span className="block text-small leading-tight text-balance text-ink-2 pointer-coarse:text-body-lg">{t(`runs.objectives.${objective}`)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIGURE_ORDER.map((metric, row) => (
              <tr key={metric}>
                <th scope="row" className="border-t border-line-soft px-1.5 py-2 text-left align-top font-medium text-ink-2 sm:px-3 sm:py-2.5">{t(FIGURE_LABELS[metric])}</th>
                {PLAN_OBJECTIVES.map((objective) => {
                  const figure = figures?.get(PLAN_LABELS[objective])?.[row]
                  return (
                    <td key={objective} className={CELL}>
                      {figure ? (
                        <span className="flex flex-col items-end gap-1">
                          <span className={cn('font-mono text-ink-strong tabular-nums sm:whitespace-nowrap', figure.best ? 'font-semibold' : 'font-normal')}>{figure.value === null ? '—' : keepUnit(figure.value)}</span>
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
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6">
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

/** Một số cố định: số lớn, nhãn ngay sau, câu nguồn dưới cùng. */
function Fact({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-border pt-3">
      <dt className="text-body-lg font-semibold text-ink-strong">{label}</dt>
      <dd className="order-first m-0 font-display text-h2 font-bold whitespace-nowrap text-ink-strong tabular-nums font-stretch-112% sm:text-h1">{value}</dd>
      <dd className="m-0 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg">{source}</dd>
    </div>
  )
}
