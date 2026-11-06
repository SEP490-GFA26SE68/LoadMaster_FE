import { ArrowRight, Coins } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { PUBLIC_PRICING } from '@/features/auth/landing'
import { useFormat, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH, PUBLIC_TOUCH_TAG } from './public-chrome'
import { SectionHeading } from './SectionHeading'
import { usePublicPlansQuery } from './useMarketingQuery'

/** Số cột theo số gói đang bán (mỗi hạng một gói, tối đa ba) để không hàng nào lẻ một thẻ — như Bảng giá. */
const COLUMNS: Readonly<Record<number, string>> = { 1: 'md:max-w-120', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }

/** Một gói: tên, nhãn "Giá trị tạm — chờ chốt" khi gói mang cờ tạm, giá theo tháng và credit mỗi tháng — số của danh mục gói. */
function PlanTile({ plan }: { plan: SubscriptionPlan }) {
  const t = useT()
  const format = useFormat()
  const titleId = `landing-plan-${plan.id}`
  return (
    <Card role="group" aria-labelledby={titleId} className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="m-0 font-display text-h2 font-[650] text-ink-strong font-stretch-108%">{plan.name}</h3>
        {plan.provisional ? <Badge shape="tag" tone="warning" outlined className={PUBLIC_TOUCH_TAG}>{t('common.provisionalPlan')}</Badge> : null}
      </div>
      <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-ink-strong">
        <span className="font-display text-figure font-bold tracking-[-0.02em] tabular-nums font-stretch-108%">{format.currency(plan.priceVnd)}</span>
        <span className="text-body-lg text-ink-2">{t('pricing.perMonth')}</span>
      </p>
      <p className="m-0 flex items-center gap-2 border-t border-line-soft pt-4 text-body-lg font-medium text-ink-1">
        <Coins aria-hidden className="size-5 flex-none text-primary" strokeWidth={1.5} />
        {plan.monthlyCredits === null ? t('common.unlimitedCredits') : t('landing.plans.credits', { count: format.integer(plan.monthlyCredits) })}
      </p>
    </Card>
  )
}

/**
 * Phần "Gói cước" của trang giới thiệu (`#goi-cuoc`): tóm tắt các gói đang bán (cùng truy vấn với Bảng giá và form liên hệ), câu nói một
 * lần chạy tối ưu 3D dùng một credit, và liên kết phụ "So sánh các gói" sang Bảng giá. Không nút đăng ký hay mua.
 */
export function LandingPlans() {
  const t = useT()
  const plans = usePublicPlansQuery()
  const list = plans.data ?? []
  return (
    <section id="goi-cuoc" aria-labelledby="landing-plans" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-plans" title={t('landing.plans.title')} lede={t('landing.plans.lede')} />

      {plans.isPending ? (
        <div className="flex justify-center py-12"><Spinner label={t('landing.plans.loading')} /></div>
      ) : plans.isError || list.length === 0 ? (
        <p className="m-0 mt-10 text-body-lg text-ink-2">{t('landing.plans.error')}</p>
      ) : (
        <div className={cn('mt-10 grid gap-4 lg:gap-5', COLUMNS[Math.min(list.length, 3)])}>
          {list.map((plan) => <PlanTile key={plan.id} plan={plan} />)}
        </div>
      )}

      <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 flex items-start gap-3 text-body-lg text-ink-2">
          <Coins aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
          {t('landing.plans.credit')}
        </p>
        <Button asChild variant="secondary" size="lg" className={cn('flex-none', PUBLIC_TOUCH)}>
          <Link to={PUBLIC_PRICING}>
            {t('landing.plans.compare')}
            <ArrowRight aria-hidden strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </section>
  )
}
