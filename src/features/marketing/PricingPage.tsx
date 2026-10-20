import { Building2, Check, Coins, Info, Layers, Route, Tag, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import { BILLING_CONSTANTS, OPTIMIZATION_ALGORITHMS } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { contactPath } from './contact-form'
import { commonPlanFeatures, PlanCard, type PlanFeature } from './PlanCard'
import { PublicPage } from './PublicPage'
import { PUBLIC_TOUCH } from './public-chrome'
import { usePublicPlansQuery } from './useMarketingQuery'

/**
 * Số cột theo số gói từ 768 px, để không hàng nào lẻ một thẻ ở 768, 1.024 hay 1.280 px: kho giữ mỗi hạng một gói đang bán nên có tối
 * đa ba thẻ. Một gói thì thẻ không giãn hết bề ngang.
 */
const GRID_COLUMNS = ['', 'md:max-w-120', 'md:grid-cols-2', 'md:grid-cols-3'] as const

/** Thuật toán bản demo chạy cho mọi gói (bộ tối ưu mô phỏng); câu lưu ý gọi nó bằng tên hạng như ô "Hạng thuật toán" của thẻ gói. */
const DEMO_ALGORITHM = OPTIMIZATION_ALGORITHMS[0]

type PlansQuery = ReturnType<typeof usePublicPlansQuery>

/**
 * Chỗ giữ của lưới gói lúc đang tải: ba thẻ (kho có tối đa ba gói đang bán) cao gần bằng thẻ thật ở từng bề ngang và loại con trỏ (đo
 * trên seed), để khối bên dưới không bị đẩy xuống khi gói về — bố cục không nhảy (CLS).
 */
const SKELETON_CARD =
  'min-h-96 pointer-coarse:min-h-106 md:min-h-115 md:pointer-coarse:min-h-136 lg:min-h-104 lg:pointer-coarse:min-h-118'

/** Thanh xám giữ chỗ một dòng chữ lúc đang tải; ẩn với trình đọc màn hình. */
function SkeletonLine({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block h-4 rounded-sm bg-line-soft', className)} />
}

/** Các gói đang bán, hoặc trạng thái tải / lỗi / rỗng — luôn là card nền đặc vì phần này đè lên dải trời (`sky-overlap`). */
function PlanGrid({ plans, common }: { plans: PlansQuery; common: readonly PlanFeature[] }) {
  const t = useT()

  if (plans.isPending) {
    return (
      <div className="relative">
        <ul aria-hidden className={cn('m-0 grid list-none gap-4 p-0', GRID_COLUMNS[3])}>
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex flex-col">
              <Card className={cn('flex flex-col gap-4 p-5 lg:p-6', SKELETON_CARD)}>
                <SkeletonLine className="h-6 w-24" />
                <SkeletonLine className="h-9 w-40" />
                <SkeletonLine className="w-3/4" />
                <SkeletonLine className="w-2/3" />
              </Card>
            </li>
          ))}
        </ul>
        <div className="absolute inset-x-0 top-24 flex justify-center">
          <Spinner label={t('pricing.loading')} />
        </div>
      </div>
    )
  }
  if (plans.isError) {
    return (
      <Card>
        <EmptyState
          mascot="error"
          compact
          title={t('pricing.error')}
          action={<Button variant="secondary" className={PUBLIC_TOUCH} onClick={() => void plans.refetch()}>{t('pricing.retry')}</Button>}
        />
      </Card>
    )
  }
  if (plans.data.length === 0) {
    return (
      <Card>
        <EmptyState mascot="empty" compact title={t('pricing.empty')} />
      </Card>
    )
  }
  return (
    <ul className={cn('m-0 grid list-none gap-4 p-0', GRID_COLUMNS[Math.min(plans.data.length, 3)])}>
      {plans.data.map((plan) => (
        <li key={plan.id} className="flex flex-col">
          <PlanCard plan={plan} common={common} />
        </li>
      ))}
    </ul>
  )
}

/** Một dòng có biểu tượng của các khối dưới thẻ gói. */
function IconLine({ icon: Icon, tone = 'text-primary', children }: { icon: LucideIcon; tone?: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon aria-hidden className={cn('mt-0.5 size-5 flex-none', tone)} strokeWidth={1.5} />
      <span className="text-pretty">{children}</span>
    </li>
  )
}

/** Khối có tiêu đề h2 dưới thẻ gói: card nền đặc, danh sách dòng có biểu tượng. */
function FactCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card role="region" aria-labelledby={id} className="flex flex-col gap-4 p-5 lg:p-6">
      <CardTitle as="h2" id={id}>{title}</CardTitle>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-body text-ink-1 pointer-coarse:text-body-lg">{children}</ul>
    </Card>
  )
}

/**
 * Hai khối dưới thẻ gói: "Mọi gói đều có" (phần chung của các gói đang bán — thẻ gói chỉ còn phần riêng) và "Credit tính thế nào", số
 * lấy từ code: credit một lần chạy (`BILLING_CONSTANTS.optimizationCost`), số phương án mỗi lần chạy (`PLAN_OBJECTIVES`), tối ưu tuyến
 * không tốn credit. Không có giá credit: giá nạp chưa chốt, không viết số không có nguồn.
 */
function PricingFacts({ common, pending }: { common: readonly PlanFeature[]; pending: boolean }) {
  const t = useT()
  // Đang tải: giữ chỗ khối "Mọi gói đều có" (hai dòng) để khối credit không đổi chỗ khi gói về
  const showCommon = pending || common.length > 0
  return (
    <div className={cn('grid gap-4', showCommon && 'lg:grid-cols-2')}>
      {showCommon ? (
        <FactCard id="pricing-common" title={t('pricing.common.title')}>
          {pending ? (
            <li aria-hidden className="flex flex-col gap-3 py-0.5">
              <SkeletonLine className="h-5 w-3/5" />
              <SkeletonLine className="h-5 w-1/2" />
            </li>
          ) : common.map((code) => (
            <IconLine key={code} icon={Check} tone="text-success">{t(`pricing.features.${code}`)}</IconLine>
          ))}
        </FactCard>
      ) : null}
      <FactCard id="pricing-credit" title={t('pricing.credit.title')}>
        <IconLine icon={Coins}>{t('pricing.credit.run', { count: BILLING_CONSTANTS.optimizationCost })}</IconLine>
        <IconLine icon={Layers}>{t('pricing.credit.plans', { count: PLAN_OBJECTIVES.length })}</IconLine>
        <IconLine icon={Route}>{t('pricing.credit.route')}</IconLine>
      </FactCard>
    </div>
  )
}

/**
 * Lưu ý một lần cho mọi thẻ: hạng thuật toán là mức của bản chạy chính thức, bản demo tối ưu cùng một hạng cho mọi gói (gỡ mâu thuẫn giữa
 * ô "Hạng thuật toán" của thẻ và kết quả trên bản demo); câu về giá tạm chỉ khi có gói mang nhãn đó; cách có tài khoản.
 */
function PricingNotes({ provisional }: { provisional: boolean }) {
  const t = useT()
  return (
    <section aria-labelledby="pricing-notes" className="flex max-w-200 flex-col gap-3">
      <h2 id="pricing-notes" className="m-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">
        {t('pricing.notes.title')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-body text-ink-2 pointer-coarse:text-body-lg">
        <IconLine icon={Info}>{t('pricing.notes.tier', { tier: t(`pricing.tiers.${DEMO_ALGORITHM}`) })}</IconLine>
        {provisional ? <IconLine icon={Tag}>{t('pricing.notes.provisional', { tag: t('common.provisionalPlan') })}</IconLine> : null}
        <IconLine icon={Building2}>{t('pricing.notes.signUp')}</IconLine>
      </ul>
    </section>
  )
}

/**
 * Bảng giá công khai `/bang-gia`: dải trời có tiêu đề và nút chính "Nhận tư vấn" (mở form liên hệ, loại "Báo giá"), thẻ các gói đang
 * bán đè lên dải, khối "Mọi gói đều có" và "Credit tính thế nào", rồi lưu ý. Người đã đăng nhập có quyền `billing.manage` (quản trị
 * công ty) thấy thêm lối về màn gói cước của công ty; không ai đăng ký hay mua gói ở đây.
 */
export function PricingPage() {
  const t = useT()
  const can = useCan()
  const plans = usePublicPlansQuery()
  const list = plans.data ?? []
  const common = commonPlanFeatures(list)

  return (
    <PublicPage>
      <section aria-labelledby="pricing-title" className="sky">
        <div className="flex flex-col items-start gap-4 px-4 pt-8 pb-[calc(var(--sky-overlap)+2rem)] md:px-shell lg:pt-12">
          <h1 id="pricing-title" className="m-0 font-display text-display leading-10 font-bold tracking-[-0.5px] text-sky-text font-stretch-112%">
            {t('pricing.title')}
          </h1>
          <p className="m-0 max-w-150 text-body-lg text-sky-text-2">{t('pricing.lede')}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="primary" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={contactPath({ type: 'PRICING' })}>{t('pricing.cta')}</Link>
            </Button>
            {can('billing.manage') ? (
              <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
                <Link to="/goi-cuoc">{t('pricing.manage')}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="sky-overlap flex flex-col gap-8 px-4 pb-14 md:px-shell lg:pb-18">
        <PlanGrid plans={plans} common={common} />
        <PricingFacts common={common} pending={plans.isPending} />
        <PricingNotes provisional={list.some((plan) => plan.provisional)} />
      </div>
    </PublicPage>
  )
}
