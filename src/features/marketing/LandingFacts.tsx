import { ORIENTATION_CODES, roundCm, roundKg } from '@/domain/geometry'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { PICKUP_RULES } from '@/domain/pickup'
import { useFormat, useT } from '@/lib/i18n'
import { ROLES } from '@/types/user'
import { LumoSays, Odometer, Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'

/** Bước làm tròn của domain, lấy từ chính hai hàm làm tròn: 0,06 cm lên một bước 0,1 cm, 0,006 kg lên một bước 0,01 kg. */
const LENGTH_STEP_CM = roundCm(0.06)
const WEIGHT_STEP_KG = roundKg(0.006)

/**
 * Cổng hiệu năng của bộ tối ưu mô phỏng (`services/optimization/mock-optimization.bench.ts`, LM-024): 1.000 kiện, cả ba phương án của
 * một lần chạy, p95 không quá 1 giây trên máy phát triển. File bench không thuộc mã của ứng dụng nên hai số chép lại ở đây; đổi cổng
 * thì đổi cùng lúc.
 */
const BENCH = { packages: 1000, seconds: 1 } as const

/** Số cột của lưới từ 1.024 px: ô cùng hàng hiện so le theo cột, ô hàng dưới hiện khi chính nó cuộn tới. */
const COLUMNS = 3

type Fact = { key: string; value: string; label: string; source: string }

/**
 * Dải "Con số kiểm được" (`#con-so`), cuối khối tối của phần mở đầu: sáu con số, mỗi số có câu nguồn — hằng số trong mã của ứng dụng
 * (số hướng đặt, số phương án, bước làm tròn, số luật nhận hàng, số vai trò) hoặc cổng hiệu năng của bộ tối ưu mô phỏng. Lumo (`explain`)
 * ló lên trên mép của lưới, nói đây là số cố định của ứng dụng. Khi cuộn tới, mỗi ô nhô lên, vạch cyan kéo ra, số lăn kiểu đồng hồ cơ
 * (`Odometer`) **một lần** rồi dừng đúng chuỗi đã format — ô số giữ nguyên bề rộng, trình đọc màn hình chỉ nhận chuỗi đó; không đếm tăng
 * dần. Giảm chuyển động hay không có IntersectionObserver: số đứng yên ngay từ đầu.
 */
export function LandingFacts() {
  const t = useT()
  const format = useFormat()
  const facts: readonly Fact[] = [
    { key: 'orientations', value: format.integer(ORIENTATION_CODES.length), label: t('landing.facts.orientations.label'), source: t('landing.facts.orientations.source') },
    { key: 'plans', value: format.integer(PLAN_OBJECTIVES.length), label: t('landing.facts.plans.label'), source: t('landing.facts.plans.source') },
    { key: 'precision', value: format.length(LENGTH_STEP_CM), label: t('landing.facts.precision.label'), source: t('landing.facts.precision.source', { kg: format.weight(WEIGHT_STEP_KG) }) },
    {
      key: 'speed',
      value: t('landing.facts.speed.value', { seconds: format.integer(BENCH.seconds) }),
      label: t('landing.facts.speed.label', { count: format.integer(BENCH.packages) }),
      source: t('landing.facts.speed.source'),
    },
    { key: 'pickup', value: format.integer(PICKUP_RULES.length), label: t('landing.facts.pickup.label'), source: t('landing.facts.pickup.source') },
    { key: 'roles', value: format.integer(ROLES.length), label: t('landing.facts.roles.label'), source: t('landing.facts.roles.source') },
  ]
  return (
    <section id="con-so" aria-labelledby="landing-facts" className="relative scroll-mt-24 border-t border-landing-hairline px-4 py-14 md:px-shell lg:py-18">
      {/* Lumo đứng ngay trên mép trên của lưới (từ 1.280 px: cạnh tiêu đề) để ló lên trên đường kẻ của các ô */}
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between xl:gap-12">
        <SectionHeading id="landing-facts" tone="dark" title={t('landing.facts.title')} lede={t('landing.facts.lede')} className="min-w-0 xl:pb-10" />
        <LumoSays
          pose="explain"
          px={{ base: 112, md: 144, xl: 176 }}
          side="bubble-left"
          text={t('landingStory.lumo.facts')}
          className="flex-none justify-end"
          bubbleClassName="max-w-sm"
        />
      </div>
      <dl className="m-0 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact, index) => (
          <Reveal key={fact.key} index={index % COLUMNS} className="relative flex min-w-0 flex-col gap-2 border-t border-landing-hairline pt-6">
            <Reveal as="span" kind="fill-x" aria-hidden className="absolute -top-px left-0 h-px w-10 bg-cyan-300" />
            <Reveal as="dt" kind="fade" delay={200} className="text-body-lg font-semibold text-sky-text">
              {fact.label}
            </Reveal>
            <dd className="order-first m-0 font-display text-figure font-bold tracking-[-0.02em] whitespace-nowrap text-sky-text tabular-nums font-stretch-112%">
              <Odometer value={fact.value} delay={100} />
            </dd>
            <Reveal as="dd" kind="fade" delay={300} className="m-0 text-small text-pretty text-sky-text-3 pointer-coarse:text-body-lg">
              {fact.source}
            </Reveal>
          </Reveal>
        ))}
      </dl>
    </section>
  )
}
