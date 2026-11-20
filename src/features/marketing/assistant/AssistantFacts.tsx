import { Badge } from '@/components/ui/Badge'
import { PLAN_OBJECTIVES } from '@/domain/models/plan-objective'
import { ROUTING_CONSTANTS } from '@/domain/routing'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import type { SubscriptionPlan } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { usePublicPlansQuery } from '../useMarketingQuery'
import { CHAPTERS } from '../journey/journey-model'
import type { FactId } from './assistant-kb'

const ROLE_DEVICES: readonly [Role, 'desktop' | 'desktopTablet' | 'tablet' | 'phone'][] = [
  ['dispatcher', 'desktop'],
  ['warehouse', 'tablet'],
  ['driver', 'phone'],
  ['companyManager', 'desktopTablet'],
  ['companyAdmin', 'desktop'],
]

const LIST = 'm-0 flex list-disc flex-col gap-1 pl-5 marker:text-ink-3'

/** Credit tháng của một gói bằng lời: "3.000 credit mỗi tháng" hoặc "không giới hạn credit". */
export function planCredits(plan: SubscriptionPlan, t: TFunction, integer: (value: number) => string): string {
  return plan.monthlyCredits === null ? t('assistant.facts.unlimited') : t('assistant.advisor.credits', { count: integer(plan.monthlyCredits) })
}

/** Danh mục gói đang bán (cùng truy vấn với Bảng giá): tên, giá, credit; gói mang cờ tạm có nhãn "Giá trị tạm — chờ chốt". */
function PlanList() {
  const t = useT()
  const format = useFormat()
  const plans = usePublicPlansQuery()
  if (plans.isPending) return <p className="m-0 text-ink-3">{t('assistant.facts.loadingPlans')}</p>
  if (plans.isError) return <p className="m-0">{t('landing.plans.error')}</p>
  if (plans.data.length === 0) return <p className="m-0">{t('pricing.empty')}</p>
  // Mọi gói đều mang cờ tạm thì một nhãn dưới danh sách, không lặp ở từng dòng
  const allProvisional = plans.data.every((plan) => plan.provisional)
  const badge = (className?: string) => <Badge shape="tag" tone="warning" outlined className={className}>{t('common.provisionalPlan')}</Badge>
  return (
    <>
      <ul className={LIST}>
        {plans.data.map((plan) => (
          <li key={plan.id}>
            {t('assistant.facts.planLine', {
              name: plan.name,
              price: format.currency(plan.priceVnd),
              credits: planCredits(plan, t, format.integer),
            })}
            {plan.provisional && !allProvisional ? badge('ml-2 align-middle') : null}
          </li>
        ))}
      </ul>
      {allProvisional ? <p className="m-0">{badge()}</p> : null}
    </>
  )
}

/** Phần trả lời dựng từ dữ liệu — mọi số lấy từ danh mục gói hoặc hằng của code, không viết tay. */
export function AssistantFact({ id }: { id: FactId }) {
  const t = useT()
  switch (id) {
    case 'planList':
      return <PlanList />
    case 'creditCost':
      return <p className="m-0">{t('landing.plans.credit', { count: BILLING_CONSTANTS.optimizationCost })}</p>
    case 'steps':
      return (
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 marker:text-ink-3">
          {CHAPTERS.map((chapter) => <li key={chapter}>{t(`landingJourney.chapters.${chapter}.title`)}</li>)}
        </ol>
      )
    case 'roleDevices':
      return (
        <ul className={LIST}>
          {ROLE_DEVICES.map(([role, device]) => (
            <li key={role}>{t('assistant.facts.roleLine', { role: t(`roles.${role}`), device: t(`assistant.facts.devices.${device}`) })}</li>
          ))}
        </ul>
      )
    case 'objectives':
      return (
        <>
          <p className="m-0">{t('assistant.facts.objectives', { count: PLAN_OBJECTIVES.length })}</p>
          <ul className={LIST}>
            {PLAN_OBJECTIVES.map((objective) => <li key={objective}>{t(`runs.objectives.${objective}`)}</li>)}
          </ul>
        </>
      )
    case 'restRule':
      return (
        <p className="m-0">
          {t('assistant.facts.restRule', {
            rest: ROUTING_CONSTANTS.REST_MINUTES,
            drive: ROUTING_CONSTANTS.MAX_CONTINUOUS_DRIVING_MINUTES / 60,
          })}
        </p>
      )
  }
}
