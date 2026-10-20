import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { tierBesideName } from '@/lib/plan-tier'
import { cn } from '@/lib/utils'
import { contactPath } from './contact-form'
import { PUBLIC_TOUCH, PUBLIC_TOUCH_TAG } from './public-chrome'

/** Mã tính năng của gói có câu ở `pricing.features`, theo thứ tự hiện ra; mã lạ (gói tạo sau, chưa có câu) không hiện thay vì hiện mã thô. */
export const PLAN_FEATURES = ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM', 'UNLIMITED_CREDITS'] as const
export type PlanFeature = (typeof PLAN_FEATURES)[number]

/** Tính năng có câu của một gói, theo thứ tự `PLAN_FEATURES`. */
export function knownFeatures(plan: Pick<SubscriptionPlan, 'features'>): PlanFeature[] {
  return PLAN_FEATURES.filter((code) => plan.features.includes(code))
}

/**
 * Phần chung "Mọi gói đều có": tính năng mọi gói đang bán đều có. Gói lấy tính năng theo hạng (`TIER_FEATURES`, kể cả khi backend không
 * gửi), nên với đủ ba hạng là tối ưu xếp hàng 3D và tối ưu tuyến. Không có gói nào thì không có phần chung.
 */
export function commonPlanFeatures(plans: readonly Pick<SubscriptionPlan, 'features'>[]): PlanFeature[] {
  if (plans.length === 0) return []
  return PLAN_FEATURES.filter((code) => plans.every((plan) => plan.features.includes(code)))
}

/**
 * Thẻ một gói đang bán ở Bảng giá: tên (kèm hạng khi tên gói khác tên hạng), nhãn nhỏ "Giá trị tạm — chờ chốt" khi gói mang cờ tạm (câu
 * giải thích nằm một lần dưới các thẻ), giá theo tháng, credit mỗi tháng, hạng thuật toán (Cơ bản / Nâng cao — lời của khách, không tên
 * thuật toán), phần riêng của gói ngoài "Mọi gói đều có", và nút phụ "Liên hệ tư vấn" mở form liên hệ đã chọn sẵn gói; tên gói trong nút
 * chỉ cho trình đọc màn hình, nên tên truy cập bắt đầu bằng đúng chữ hiện ra. Không nút đăng ký hay mua: tài khoản công ty do đội
 * LoadMaster mở sau khi trao đổi.
 */
export function PlanCard({ plan, common }: { plan: SubscriptionPlan; common: readonly PlanFeature[] }) {
  const t = useT()
  const format = useFormat()
  const tierLabel = tierBesideName(plan.name, t(`common.planTiers.${plan.tier}`))
  const titleId = `plan-${plan.id}`
  const extras = knownFeatures(plan).filter((code) => !common.includes(code))

  return (
    <Card role="group" aria-labelledby={titleId} className="flex h-full flex-col gap-5 p-5 lg:p-6">
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle as="h2" id={titleId} className="text-h2 leading-7">{plan.name}</CardTitle>
          {tierLabel === null ? null : <Badge tone="cyan" shape="tag" className={PUBLIC_TOUCH_TAG}>{tierLabel}</Badge>}
        </div>
        {plan.provisional ? <Badge shape="tag" className={PUBLIC_TOUCH_TAG}>{t('common.provisionalPlan')}</Badge> : null}
      </div>

      <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-ink-strong">
        <span className="font-display text-[26px] leading-8 font-bold tabular-nums">{format.currency(plan.priceVnd)}</span>
        <span className="text-body text-ink-2 pointer-coarse:text-body-lg">{t('pricing.perMonth')}</span>
      </p>

      {/* Nhãn không xuống dòng; giá trị không vừa bên cạnh thì xuống hàng riêng, căn phải (thẻ hẹp ở điện thoại) */}
      <dl className="m-0 flex flex-col divide-y divide-line-soft border-y border-line-soft text-body pointer-coarse:text-body-lg">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
          <dt className="whitespace-nowrap text-ink-2">{t('pricing.credits')}</dt>
          <dd className="m-0 ml-auto text-right font-semibold text-ink-strong tabular-nums">
            {plan.monthlyCredits === null ? t('common.unlimitedCredits') : format.integer(plan.monthlyCredits)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
          <dt className="whitespace-nowrap text-ink-2">{t('pricing.algorithm')}</dt>
          <dd className="m-0 ml-auto text-right font-semibold text-ink-strong">{t(`pricing.tiers.${plan.algorithmTier}`)}</dd>
        </div>
      </dl>

      {extras.length === 0 ? (
        <p className="m-0 flex items-start gap-2.5 text-body text-ink-2 pointer-coarse:text-body-lg">
          <Check aria-hidden className="mt-0.5 size-4 flex-none text-success" strokeWidth={1.5} />
          {t('pricing.commonOnly')}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <h3 className="m-0 text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">{t('pricing.extras')}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body text-ink-1 pointer-coarse:text-body-lg">
            {extras.map((code) => (
              <li key={code} className="flex items-start gap-2.5">
                <Plus aria-hidden className="mt-0.5 size-4 flex-none text-primary" strokeWidth={1.5} />
                {t(`pricing.features.${code}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button asChild variant="secondary" className={cn('mt-auto w-full', PUBLIC_TOUCH)}>
        <Link to={contactPath({ planId: plan.id, type: 'PRICING' })}>
          {t('pricing.contactPlan')}{' '}
          <span className="sr-only">{t('pricing.contactPlanName', { name: plan.name })}</span>
        </Link>
      </Button>
    </Card>
  )
}
