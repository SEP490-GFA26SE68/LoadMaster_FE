import { ArrowRight, Check, Coins, Tag } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { PUBLIC_PRICING } from '@/features/auth/landing'
import { useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS, type SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { PLANS_ANCHOR } from './anchors'
import { commonPlanFeatures } from './PlanCard'
import { PUBLIC_TOUCH, PUBLIC_TOUCH_TAG } from './public-chrome'
import { LineRise, LumoSays, Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'
import { usePublicPlansQuery } from './useMarketingQuery'
import { useNearViewport } from './useNearViewport'

/** Số cột theo số gói đang bán (mỗi hạng một gói, tối đa ba) để không hàng nào lẻ một thẻ — như Bảng giá. */
const COLUMNS: Readonly<Record<number, string>> = { 1: 'md:max-w-120', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }

/**
 * Một gói: tên, nhãn nhỏ "Giá trị tạm — chờ chốt" khi gói mang cờ tạm (câu giải thích nằm một lần dưới các thẻ), giá theo tháng và
 * credit mỗi tháng — số của danh mục gói. Từ 768 tới 1.023 px ba thẻ chung một hàng hẹp nên giá xuống cỡ h1 để không tràn thẻ.
 */
function PlanTile({ plan }: { plan: SubscriptionPlan }) {
  const t = useT()
  const format = useFormat()
  const titleId = `landing-plan-${plan.id}`
  return (
    <Card role="group" aria-labelledby={titleId} className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="m-0 font-display text-h2 font-[650] text-ink-strong font-stretch-108%">{plan.name}</h3>
        {plan.provisional ? <Badge shape="tag" className={PUBLIC_TOUCH_TAG}>{t('common.provisionalPlan')}</Badge> : null}
      </div>
      <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-ink-strong">
        <span className="font-display text-figure font-bold tracking-[-0.02em] tabular-nums font-stretch-108% md:max-lg:text-h1">{format.currency(plan.priceVnd)}</span>
        <span className="text-body-lg text-ink-2">{t('pricing.perMonth')}</span>
      </p>
      <p className="m-0 flex items-center gap-2 border-t border-line-soft pt-4 text-body-lg font-medium text-ink-1">
        <Coins aria-hidden className="size-5 flex-none text-primary" strokeWidth={1.5} />
        {plan.monthlyCredits === null ? t('pricing.unlimitedCredits') : t('landing.plans.credits', { count: format.integer(plan.monthlyCredits) })}
      </p>
    </Card>
  )
}

/**
 * Dưới các thẻ gói: "Mọi gói đều có" (phần chung của các gói đang bán), một câu credit với số lấy từ code (credit một lần chạy,
 * số phương án mỗi lần chạy) và câu về giá tạm chỉ khi có gói mang nhãn đó.
 */
function PlansFacts({ plans }: { plans: readonly SubscriptionPlan[] }) {
  const t = useT()
  const common = commonPlanFeatures(plans)
  return (
    <div className="flex min-w-0 flex-col gap-4 text-body-lg text-ink-2">
      {common.length > 0 ? (
        <div className="flex flex-col gap-2">
          <LineRise as="h3" className="m-0 text-body-lg font-semibold text-ink-strong" lines={[t('pricing.common.title')]} />
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-pretty text-ink-1">
            {common.map((code) => (
              <li key={code} className="flex items-start gap-2">
                <Check aria-hidden className="mt-1 size-4 flex-none text-success" strokeWidth={1.5} />
                {t(`pricing.features.${code}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="m-0 flex items-start gap-3 text-pretty">
        <Coins aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
        {t('pricing.credit.summary', { count: BILLING_CONSTANTS.optimizationCost, plans: PLAN_OBJECTIVES.length })}
      </p>
      {plans.some((plan) => plan.provisional) ? (
        <p className="m-0 flex items-start gap-3 text-pretty">
          <Tag aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
          {t('pricing.notes.provisional', { tag: t('common.provisionalPlan') })}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Phần "Gói cước" của trang giới thiệu (`#goi-cuoc`): tóm tắt các gói đang bán (cùng truy vấn với Bảng giá và form liên hệ), phần chung
 * của mọi gói, câu credit và liên kết phụ "So sánh các gói" sang Bảng giá. Không nút đăng ký hay mua. Khi có thẻ gói, Lumo (`idea`) ló lên
 * trên mép thẻ cuối hàng, mời gửi yêu cầu tư vấn (có từ lúc chờ gói, để thẻ về không đẩy phần dưới; lỗi thì không có Lumo); thẻ nhô lên cả khối, so le 70 ms; giá và credit trong thẻ không đếm, không lăn.
 */
export function LandingPlans() {
  const t = useT()
  // Chưa đọc danh mục gói (dựng cả kho mẫu) khi khách còn ở phần mở đầu
  const [sectionRef, near] = useNearViewport<HTMLElement>()
  const plans = usePublicPlansQuery(near)
  const list = plans.data ?? []
  const ready = !plans.isPending && !plans.isError && list.length > 0
  // Lumo (và khoảng đệm của nó) có ngay từ lúc chờ gói: thẻ về khi phần đã lộ thì phần đầu không cao thêm, nội dung bên dưới không nhảy
  const lumo = plans.isPending || ready
  return (
    <section ref={sectionRef} id={PLANS_ANCHOR} aria-labelledby="landing-plans" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between xl:gap-12">
        <SectionHeading id="landing-plans" title={t('landing.plans.title')} lede={t('landing.plans.lede')} className={cn('min-w-0', lumo && 'xl:pb-10')} />
        {/* Lumo đứng ngay trên mép trên của lưới thẻ, lùi khỏi góc bo của thẻ cuối hàng */}
        {lumo ? (
          <LumoSays pose="idea" px={{ base: 112, md: 144, xl: 176 }} side="bubble-left" text={t('landingStory.lumo.plans')}
            className="flex-none justify-end pr-4" bubbleClassName="max-w-sm" />
        ) : null}
      </div>

      {plans.isPending ? (
        // Giữ chỗ gần bằng lưới thẻ (đo trên seed: ba thẻ chồng nhau dưới 768 px, một hàng từ 768 px) để phần dưới không nhảy khi gói về
        <div className="flex min-h-145 items-center justify-center md:min-h-60 lg:min-h-52"><Spinner label={t('landing.plans.loading')} /></div>
      ) : !ready ? (
        <p className="m-0 mt-10 text-body-lg text-ink-2">{t('landing.plans.error')}</p>
      ) : (
        <div className={cn('grid gap-4 lg:gap-5', COLUMNS[Math.min(list.length, 3)])}>
          {list.map((plan, index) => (
            <Reveal key={plan.id} index={index} className="grid min-w-0">
              <PlanTile plan={plan} />
            </Reveal>
          ))}
        </div>
      )}

      <Reveal kind="fade" delay={450} className="mt-8 flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
        {ready ? <PlansFacts plans={list} /> : null}
        <Button asChild variant="secondary" size="lg" className={cn('flex-none', PUBLIC_TOUCH)}>
          <Link to={PUBLIC_PRICING}>
            {t('landing.plans.compare')}
            <ArrowRight aria-hidden strokeWidth={1.5} />
          </Link>
        </Button>
      </Reveal>
    </section>
  )
}
