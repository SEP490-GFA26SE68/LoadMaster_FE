import { Coins, Gauge, GitCompareArrows, ListChecks, ScanQrCode, UsersRound, type LucideIcon } from 'lucide-react'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { PICKUP_RULES } from '@/domain/pickup'
import { useFormat, useLocale, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import { VERIFY_METHODS } from '@/lib/mock-db/verify-model'
import { COMPANY_ROLES } from '@/types/user'
import { LumoSays, Odometer, Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'

/**
 * Cổng hiệu năng của bộ tối ưu mô phỏng (`services/optimization/mock-optimization.bench.ts`, LM-024): 1.000 kiện, cả ba phương án của
 * một lần chạy, p95 không quá 1 giây trên máy phát triển. File bench không thuộc mã của ứng dụng nên hai số chép lại ở đây; đổi cổng
 * thì đổi cùng lúc.
 */
const BENCH = { packages: 1000, seconds: 1 } as const

/** Số cột của lưới từ 1.024 px: ô cùng hàng hiện so le theo cột, ô hàng dưới hiện khi chính nó cuộn tới. */
const COLUMNS = 3

type Fact = { key: string; icon: LucideIcon; value: string; label: string; source: string }

/** Sáu con số, mỗi số một nguồn trong code; thứ tự là thứ tự đọc của lưới (trái sang phải, trên xuống dưới). */
function useFacts(): readonly Fact[] {
  const t = useT()
  const format = useFormat()
  const { locale } = useLocale()
  // Tên vai trò đứng giữa câu: viết thường từ tên thứ hai ("Quản trị công ty, quản lý công ty, …")
  const roleNames = COMPANY_ROLES.map((role, index) => (index === 0 ? t(`roles.${role}`) : t(`roles.${role}`).toLocaleLowerCase(locale)))
  return [
    { key: 'plans', icon: GitCompareArrows, value: format.integer(PLAN_OBJECTIVES.length), label: t('landing.facts.plans.label'), source: t('landing.facts.plans.source') },
    {
      key: 'credit',
      icon: Coins,
      value: t('landing.facts.credit.value', { count: BILLING_CONSTANTS.optimizationCost }),
      label: t('landing.facts.credit.label'),
      source: t('landing.facts.credit.source'),
    },
    {
      key: 'speed',
      icon: Gauge,
      value: t('landing.facts.speed.value', { seconds: format.integer(BENCH.seconds) }),
      label: t('landing.facts.speed.label', { count: format.integer(BENCH.packages) }),
      source: t('landing.facts.speed.source'),
    },
    { key: 'pickup', icon: ListChecks, value: format.integer(PICKUP_RULES.length), label: t('landing.facts.pickup.label'), source: t('landing.facts.pickup.source') },
    { key: 'verify', icon: ScanQrCode, value: format.integer(VERIFY_METHODS.length), label: t('landing.facts.verify.label'), source: t('landing.facts.verify.source') },
    {
      key: 'roles',
      icon: UsersRound,
      value: format.integer(COMPANY_ROLES.length),
      label: t('landing.facts.roles.label'),
      source: t('landing.facts.roles.source', { roles: format.list(roleNames) }),
    },
  ]
}

/**
 * Dải "Con số kiểm được" (`#con-so`), cuối khối tối của phần mở đầu: sáu con số người mua quan tâm, mỗi số có câu nguồn — hằng số trong mã
 * của ứng dụng (số phương án, credit mỗi lần chạy, số luật nhận hàng, số cách đối chiếu, số vai trò trong công ty) hoặc ngưỡng của bài đo
 * hiệu năng của bộ tối ưu mô phỏng. Lumo (`explain`) ló lên trên mép của lưới, nói đây là số cố định của ứng dụng. Khi cuộn tới, mỗi ô nhô
 * lên, vạch cyan kéo ra, số lăn kiểu đồng hồ cơ (`Odometer`) **một lần** rồi dừng đúng chuỗi đã format — ô số giữ nguyên bề rộng, trình
 * đọc màn hình chỉ nhận chuỗi đó; không đếm tăng dần. Biểu tượng của ô chỉ trang trí. Giảm chuyển động hay không có IntersectionObserver:
 * số đứng yên ngay từ đầu.
 */
export function LandingFacts() {
  const t = useT()
  const facts = useFacts()
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
        {facts.map((fact, index) => {
          const Icon = fact.icon
          return (
            <Reveal key={fact.key} index={index % COLUMNS} className="relative flex min-w-0 flex-col gap-2 border-t border-landing-hairline pt-6">
              <Reveal as="span" kind="fill-x" aria-hidden className="absolute -top-px left-0 h-px w-10 bg-cyan-300" />
              <Reveal as="span" kind="pop" delay={250} aria-hidden className="absolute top-6 right-0 grid size-10 place-items-center rounded-md border border-landing-hairline text-cyan-300">
                <Icon className="size-5" strokeWidth={1.5} />
              </Reveal>
              <Reveal as="dt" kind="fade" delay={200} className="text-body-lg font-semibold text-sky-text">
                {fact.label}
              </Reveal>
              <dd className="order-first m-0 pr-12 font-display text-figure font-bold tracking-[-0.02em] whitespace-nowrap text-sky-text tabular-nums font-stretch-112%">
                <Odometer value={fact.value} delay={100} />
              </dd>
              <Reveal as="dd" kind="fade" delay={300} className="m-0 text-small text-pretty text-sky-text-3 pointer-coarse:text-body-lg">
                {fact.source}
              </Reveal>
            </Reveal>
          )
        })}
      </dl>
    </section>
  )
}
