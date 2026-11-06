import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldLabel, fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { usePlansOnSaleQuery } from '@/features/billing/useBillingQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { defaultPlanChoice, planLocked } from './plan-upgrade'
import { useAssignCompanyPlanMutation, type SupportPanel } from './useSupportQuery'

/**
 * "Đổi gói nhanh" trong khung công ty của `/ho-tro` (chỉ khi `SUPPORT_SOURCE.planAssign`): Hỗ trợ khách hàng áp ngay một gói cho công ty
 * đã gửi yêu cầu. Gói đang dùng chỉ nâng lên hạng cao hơn (`plan-upgrade.ts`); yêu cầu đã đóng thì phải mở lại trước.
 */
export function QuickPlanChange({ companyId, panel, ticketClosed }: { companyId: string; panel: SupportPanel; ticketClosed: boolean }) {
  const t = useT()
  const format = useFormat()
  const fieldId = useId()
  const hintId = useId()
  const plans = usePlansOnSaleQuery()
  const assign = useAssignCompanyPlanMutation()
  const options = plans.data ?? []
  const [choice, setChoice] = useState<string | null>(null)
  const selected = choice ?? defaultPlanChoice(options, panel.plan, panel.planStatus)
  const plan = options.find((item) => item.id === selected)
  const blocked = ticketClosed || plan === undefined || planLocked(plan, panel.plan, panel.planStatus)

  function handleApply() {
    if (blocked) return
    assign.mutate({ companyId, planId: selected }, {
      onSuccess: (contract) => {
        setChoice(null)
        toast.success(t('support.customerPlan.updated', { plan: contract.plan?.name ?? plan.name, company: contract.companyName ?? panel.companyName }))
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-line-soft bg-surface p-3">
      <FieldLabel htmlFor={fieldId}>{t('support.customerPlan.quickTitle')}</FieldLabel>
      <select
        id={fieldId}
        value={selected}
        disabled={ticketClosed}
        aria-describedby={ticketClosed ? hintId : undefined}
        onChange={(event) => setChoice(event.target.value)}
        className={cn(fieldBoxClass(false), focusClass, 'h-9 px-2.5 text-small text-ink-strong')}
      >
        {options.map((item) => (
          <option key={item.id} value={item.id} disabled={planLocked(item, panel.plan, panel.planStatus)}>
            {t('support.customerPlan.planOption', {
              name: item.name,
              price: format.currency(item.priceVnd),
              credits: item.monthlyCredits === null
                ? t('support.customerPlan.unlimited')
                : t('support.customerPlan.credits', { amount: format.integer(item.monthlyCredits) }),
            })}
          </option>
        ))}
      </select>
      {ticketClosed ? <p id={hintId} className="m-0 text-fine text-ink-2">{t('support.customerPlan.ticketClosed')}</p> : null}
      <Button type="button" variant="secondary" size="sm" loading={assign.isPending} disabled={blocked} onClick={handleApply}>
        {t('support.customerPlan.submit')}
      </Button>
    </div>
  )
}
