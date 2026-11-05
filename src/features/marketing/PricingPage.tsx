import { Building2, Coins, Info, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { contactPath } from './contact-form'
import { PlanCard } from './PlanCard'
import { PublicPage } from './PublicPage'
import { PUBLIC_TOUCH } from './public-chrome'
import { usePublicPlansQuery } from './useMarketingQuery'

/** Ghi chú dưới các thẻ gói: credit là gì, bản demo tối ưu ở hạng nào, và cách có tài khoản. */
/**
 * Số cột theo số gói từ 768 px, để không hàng nào lẻ một thẻ ở 768, 1.024 hay 1.280 px: kho giữ mỗi hạng một gói đang bán nên có tối
 * đa ba thẻ. Một gói thì thẻ không giãn hết bề ngang.
 */
const GRID_COLUMNS = ['', 'md:max-w-120', 'md:grid-cols-2', 'md:grid-cols-3'] as const

const NOTES: readonly { icon: LucideIcon; key: MessageKey }[] = [
  { icon: Coins, key: 'pricing.creditNote' },
  { icon: Info, key: 'pricing.tierNote' },
  { icon: Building2, key: 'pricing.signUpNote' },
]

/** Các gói đang bán, hoặc trạng thái tải / lỗi / rỗng — luôn là card nền đặc vì phần này đè lên dải trời (`sky-overlap`). */
function PlanGrid() {
  const t = useT()
  const plans = usePublicPlansQuery()

  if (plans.isPending) {
    return (
      <Card className="flex justify-center py-16">
        <Spinner label={t('pricing.loading')} />
      </Card>
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
          <PlanCard plan={plan} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Bảng giá công khai `/bang-gia`: dải trời có tiêu đề và nút chính "Nhận tư vấn" (mở form liên hệ, loại "Báo giá"), thẻ các gói đang
 * bán đè lên dải, rồi ghi chú. Giá là giá trị tạm (`common.provisionalPlan`). Người đã đăng nhập có quyền `billing.manage` (quản trị
 * công ty) thấy thêm lối về màn gói cước của công ty; không ai đăng ký hay mua gói ở đây.
 */
export function PricingPage() {
  const t = useT()
  const can = useCan()

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
        <PlanGrid />
        <ul className="m-0 flex max-w-200 list-none flex-col gap-3 p-0 text-body text-ink-2 pointer-coarse:text-body-lg">
          {NOTES.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-start gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </PublicPage>
  )
}
