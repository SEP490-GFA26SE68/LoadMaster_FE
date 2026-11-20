import { ArrowRight, Coins, Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { PUBLIC_PRICING } from '@/features/auth/landing'
import { useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS, type SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { advise } from './assistant/assistant-advisor'
import { DEFAULT_STOP, PlanAdvisorSlider, runsAt } from './PlanAdvisorSlider'
import { PUBLIC_TOUCH, PUBLIC_TOUCH_TAG } from './public-chrome'
import { SectionHeading } from './SectionHeading'
import { usePublicPlansQuery } from './useMarketingQuery'
import { useNearViewport } from './useNearViewport'

/** Số cột theo số gói đang bán (mỗi hạng một gói, tối đa ba) để không hàng nào lẻ một thẻ — như Bảng giá. */
const COLUMNS: Readonly<Record<number, string>> = { 1: 'md:max-w-120', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }

/**
 * Một gói: tên, giá theo tháng và credit mỗi tháng — số của danh mục gói (gói mang cờ tạm được nói một lần dưới tiêu đề của phần, không
 * gắn nhãn trên từng thẻ). `advised`:
 * gói rẻ nhất đủ dùng cho số lần chạy đang chọn ở thanh kéo — viền `--primary` kèm nhãn chữ, không chỉ màu.
 */
function PlanTile({ plan, advised }: { plan: SubscriptionPlan; advised: boolean }) {
  const t = useT()
  const format = useFormat()
  const titleId = `landing-plan-${plan.id}`
  return (
    <Card role="group" aria-labelledby={titleId} data-advised={advised || undefined}
      className={cn('flex flex-col gap-3 p-4 sm:gap-4 sm:p-6', advised && 'border-primary ring-1 ring-primary')}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="m-0 font-display text-h2 font-[650] text-ink-strong font-stretch-108%">{plan.name}</h3>
        {advised ? <Badge shape="tag" tone="cyan" className={PUBLIC_TOUCH_TAG}>{t('landing.plans.advisor.fits')}</Badge> : null}
      </div>
      <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-ink-strong">
        <span className="font-display text-figure font-bold tracking-[-0.02em] tabular-nums font-stretch-108%">{format.currency(plan.priceVnd)}</span>
        <span className="text-body-lg text-ink-2">{t('pricing.perMonth')}</span>
      </p>
      <p className="m-0 flex items-center gap-2 border-t border-line-soft pt-3 text-body-lg font-medium text-ink-1 sm:pt-4">
        <Coins aria-hidden className="size-5 flex-none text-primary" strokeWidth={1.5} />
        {plan.monthlyCredits === null ? t('common.unlimitedCredits') : t('landing.plans.credits', { count: format.integer(plan.monthlyCredits) })}
      </p>
    </Card>
  )
}

/**
 * Phần "Gói cước" của trang giới thiệu (`#goi-cuoc`): tóm tắt các gói đang bán (cùng truy vấn với Bảng giá và form liên hệ), câu nói một
 * lần chạy tối ưu 3D dùng bao nhiêu credit (`BILLING_CONSTANTS.optimizationCost`, như máy chủ), thanh kéo "số lần chạy mỗi tháng" chỉ ra
 * gói rẻ nhất đủ dùng (`PlanAdvisorSlider`, cùng phép tính với trợ lý), và liên kết phụ "So sánh các gói" sang Bảng giá. Gói mang cờ tạm
 * (`provisional`) được nói bằng **một câu** dưới tiêu đề, kèm tên các gói đó — không nhãn trên từng thẻ. Không nút đăng ký hay mua.
 */
export function LandingPlans() {
  const t = useT()
  const format = useFormat()
  // Chưa đọc danh mục gói khi khách còn ở phần mở đầu: truy vấn bật khi phần này tới gần khung nhìn
  const [sectionRef, near] = useNearViewport<HTMLElement>()
  const plans = usePublicPlansQuery(near)
  const list = plans.data ?? []
  const [stop, setStop] = useState(DEFAULT_STOP)
  const advice = advise(runsAt(stop), list)
  const provisional = list.filter((plan) => plan.provisional).map((plan) => plan.name)
  return (
    <section ref={sectionRef} id="goi-cuoc" aria-labelledby="landing-plans" className="scroll-mt-24 px-4 py-8 sm:py-12 md:px-shell lg:py-16">
      <SectionHeading id="landing-plans" title={t('landing.plans.title')} lede={t('landing.plans.lede')} />

      {plans.isPending ? (
        <div className="flex justify-center py-12"><Spinner label={t('landing.plans.loading')} /></div>
      ) : plans.isError || list.length === 0 ? (
        <p className="m-0 mt-10 text-body-lg text-ink-2">{t('landing.plans.error')}</p>
      ) : (
        <>
          {provisional.length > 0 ? (
            <p className="m-0 mt-4 flex items-start gap-2 text-body text-ink-2 pointer-coarse:text-body-lg">
              <Info aria-hidden className="mt-0.5 size-4 flex-none text-warning" strokeWidth={1.5} />
              {t('landing.plans.provisional', { names: format.list(provisional) })}
            </p>
          ) : null}
          <div className={cn('mt-8 grid gap-4 lg:gap-5', COLUMNS[Math.min(list.length, 3)])}>
            {list.map((plan) => <PlanTile key={plan.id} plan={plan} advised={plan.id === advice.plan?.id} />)}
          </div>
          <PlanAdvisorSlider stop={stop} advice={advice} onStop={setStop} />
        </>
      )}

      <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 flex items-start gap-3 text-body-lg text-ink-2">
          <Coins aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
          {t('landing.plans.credit', { count: BILLING_CONSTANTS.optimizationCost })}
        </p>
        {/* Nút dồn sát mép phải — đúng chỗ nút "Hỏi Lumo": nút đó nâng lên khi chạm */}
        <Button asChild variant="secondary" size="lg" className={cn('flex-none', PUBLIC_TOUCH)} data-assistant-avoid>
          <Link to={PUBLIC_PRICING}>
            {t('landing.plans.compare')}
            <ArrowRight aria-hidden strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </section>
  )
}
