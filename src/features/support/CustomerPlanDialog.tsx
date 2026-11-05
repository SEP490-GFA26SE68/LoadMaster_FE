import { Layers } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldLabel, fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { Spinner } from '@/components/ui/Spinner'
import { useCompanyNamesQuery } from '@/features/admin/useUsersQuery'
import { usePlansOnSaleQuery } from '@/features/billing/useBillingQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { defaultPlanChoice, planLocked } from './plan-upgrade'
import { useAssignCompanyPlanMutation, useCompanyContractsQuery } from './useSupportQuery'

/**
 * Hộp thoại "Đổi gói cước khách hàng" của Hỗ trợ khách hàng, mở từ thanh điều hướng khi nguồn đổi được gói
 * (`SUPPORT_SOURCE.planAssign`): chọn một công ty khách và áp ngay gói Basic / Pro / Ultimate. Gói đang dùng chỉ nâng lên hạng cao hơn.
 */
export function CustomerPlanDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const companyFieldId = useId()
  const planFieldId = useId()

  const companies = useCompanyNamesQuery(true)
  const plans = usePlansOnSaleQuery()
  const contracts = useCompanyContractsQuery(true)
  const assignPlan = useAssignCompanyPlanMutation()

  const [companyChoice, setCompanyChoice] = useState<string | null>(null)
  const [planChoice, setPlanChoice] = useState<{ companyId: string; planId: string } | null>(null)
  const companyId = companyChoice ?? companies.data?.[0]?.id ?? ''
  const contract = (contracts.data ?? []).find((item) => item.companyId === companyId)
  const current = contract?.plan ?? null
  const status = contract?.status ?? null
  const planOptions = plans.data ?? []
  const planId = planChoice?.companyId === companyId ? planChoice.planId : defaultPlanChoice(planOptions, current, status)
  const selectedPlan = planOptions.find((plan) => plan.id === planId)
  const selectedIsBlocked = selectedPlan === undefined || planLocked(selectedPlan, current, status)
  const loading = companies.isPending || plans.isPending

  async function handleSubmit() {
    if (!companyId || selectedIsBlocked) return
    try {
      const updated = await assignPlan.mutateAsync({ companyId, planId })
      const companyName = updated.companyName ?? companies.data?.find((item) => item.id === companyId)?.name ?? t('support.customerPlan.companyFallback')
      toast.success(t('support.customerPlan.updated', { plan: updated.plan?.name ?? selectedPlan.name, company: companyName }))
      onClose()
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-135">
        <DialogHeader
          icon={Layers}
          title={t('support.customerPlan.title')}
          description={t('support.customerPlan.description')}
        />
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-4 px-7 py-5">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={companyFieldId}>{t('support.customerPlan.company')}</FieldLabel>
              <select
                id={companyFieldId}
                value={companyId}
                onChange={(event) => setCompanyChoice(event.target.value)}
                className={cn(fieldBoxClass(false), focusClass, 'h-10 px-3 text-body text-ink-strong')}
              >
                {(companies.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {contract ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-soft bg-surface px-3.5 py-2.5 text-small">
                <span className="text-ink-2">
                  {t('support.customerPlan.current')} <strong className="text-ink-strong">{current?.name ?? t('support.customerPlan.none')}</strong>
                </span>
                {status ? <Badge tone={status === 'ACTIVE' ? 'success' : status === 'CANCELLED' ? 'warning' : 'danger'}>{t(`billing.plan.status.${status}`)}</Badge> : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={planFieldId}>{t('support.customerPlan.plan')}</FieldLabel>
              <select
                id={planFieldId}
                value={planId}
                onChange={(event) => setPlanChoice({ companyId, planId: event.target.value })}
                className={cn(fieldBoxClass(false), focusClass, 'h-10 px-3 text-body text-ink-strong')}
              >
                {(plans.data ?? []).map((plan) => (
                  <option key={plan.id} value={plan.id} disabled={planLocked(plan, current, status)}>
                    {t('support.customerPlan.planOption', {
                      name: plan.name,
                      price: format.currency(plan.priceVnd),
                      credits: plan.monthlyCredits === null ? t('support.customerPlan.unlimited') : t('support.customerPlan.credits', { amount: format.integer(plan.monthlyCredits) }),
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={assignPlan.isPending}>{t('support.customerPlan.close')}</Button>
          </DialogClose>
          <Button
            type="button"
            variant="primary"
            loading={assignPlan.isPending}
            disabled={loading || !companyId || selectedIsBlocked}
            onClick={() => void handleSubmit()}
          >
            {t('support.customerPlan.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
