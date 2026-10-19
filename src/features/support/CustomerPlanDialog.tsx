import { Layers } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldLabel, fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { Spinner } from '@/components/ui/Spinner'
import { useCompanyNamesQuery } from '@/features/admin/useUsersQuery'
import { usePlansOnSaleQuery } from '@/features/billing/useBillingQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { PlanTier, SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { useAllCompanyContractsQuery, useAssignCompanyPlanMutation } from './useSupportQuery'

const TIER_RANK: Record<PlanTier, number> = {
  BASIC: 1,
  PRO: 2,
  ULTIMATE: 3,
}

/**
 * Hộp thoại Đổi gói khách hàng ngay trên NavBar của role SystemSupporter (Phương án A1):
 * Cho phép chọn bất kỳ công ty khách hàng nào và áp dụng/nâng cấp ngay gói Basic / Pro / Ultimate qua POST /api/contracts.
 */
export function CustomerPlanDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const companyFieldId = useId()
  const planFieldId = useId()

  const companies = useCompanyNamesQuery(true)
  const plans = usePlansOnSaleQuery()
  const contracts = useAllCompanyContractsQuery(true)
  const assignPlan = useAssignCompanyPlanMutation()

  const [companyId, setCompanyId] = useState('')
  const [planId, setPlanId] = useState('')

  useEffect(() => {
    if (!companyId && companies.data && companies.data.length > 0) {
      setCompanyId(companies.data[0]?.id ?? '')
    }
  }, [companyId, companies.data])

  const selectedContract = (contracts.data ?? []).find((c) => String(c.companyId) === companyId)
  const isActiveSub = selectedContract?.status === 'ACTIVE' && Boolean(selectedContract?.planTier)
  const currentRank = isActiveSub && selectedContract?.planTier ? TIER_RANK[selectedContract.planTier] : 0

  function isPlanDisabled(plan: SubscriptionPlan): boolean {
    return isActiveSub && TIER_RANK[plan.tier] <= currentRank
  }

  useEffect(() => {
    if (!companyId) return
    const plansList = plans.data ?? []
    if (isActiveSub && plansList.length > 0) {
      const nextUpgrade = plansList.find((p) => TIER_RANK[p.tier] > currentRank)
      if (nextUpgrade) {
        setPlanId(nextUpgrade.id)
        return
      }
    }
    if (selectedContract?.planId) {
      setPlanId(String(selectedContract.planId))
    } else if (plansList.length > 0) {
      setPlanId(plansList[0]?.id ?? '')
    }
  }, [companyId, isActiveSub, currentRank, selectedContract?.planId, plans.data])

  const selectedPlanObj = (plans.data ?? []).find((p) => p.id === planId)
  const selectedIsBlocked = selectedPlanObj ? isPlanDisabled(selectedPlanObj) : false
  const loading = companies.isPending || plans.isPending

  async function handleSubmit() {
    if (!companyId || !planId || selectedIsBlocked) return
    try {
      const updated = await assignPlan.mutateAsync({ companyId, planId })
      toast.success(`Đã cập nhật gói ${updated.planName ?? ''} cho ${updated.companyName ?? 'công ty'}!`)
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
          title="Đổi gói cước khách hàng"
          description="Cập nhật hoặc nâng cấp gói cước ngay lập tức cho công ty khách hàng theo yêu cầu hỗ trợ."
        />
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-4 px-7 py-5">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={companyFieldId}>Công ty khách hàng</FieldLabel>
              <select
                id={companyFieldId}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={cn(fieldBoxClass(false), focusClass, 'h-10 px-3 text-body text-ink-strong')}
              >
                {(companies.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedContract ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-soft bg-surface px-3.5 py-2.5 text-small">
                <span className="text-ink-2">
                  Gói hiện tại: <strong className="text-ink-strong">{selectedContract.planName ?? 'Chưa có'}</strong>
                </span>
                <Badge tone={selectedContract.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {selectedContract.status ?? 'NONE'}
                </Badge>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={planFieldId}>Gói cước áp dụng</FieldLabel>
              <select
                id={planFieldId}
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className={cn(fieldBoxClass(false), focusClass, 'h-10 px-3 text-body text-ink-strong')}
              >
                {(plans.data ?? []).map((plan) => (
                  <option key={plan.id} value={plan.id} disabled={isPlanDisabled(plan)}>
                    {plan.name} — {format.currency(plan.priceVnd)}/tháng ({plan.monthlyCredits === null ? 'Không giới hạn' : `${format.integer(plan.monthlyCredits)} credit`})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={assignPlan.isPending}>Đóng</Button>
          </DialogClose>
          <Button
            type="button"
            variant="primary"
            loading={assignPlan.isPending}
            disabled={loading || !companyId || !planId || selectedIsBlocked}
            onClick={() => void handleSubmit()}
          >
            Cập nhật gói ngay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
