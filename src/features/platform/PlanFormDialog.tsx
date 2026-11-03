import { zodResolver } from '@hookform/resolvers/zod'
import { Tags } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { optionsFromLabels, SelectField } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/Switch'
import { useT } from '@/lib/i18n'
import type { PlanTier, SubscriptionPlan } from '@/lib/mock-db/billing-model'
import {
  CREDITS_INVALID,
  emptyPlanForm,
  NAME_REQUIRED,
  PLAN_NAME_MAX,
  planFormSchema,
  PRICE_INVALID,
  toPlanForm,
  toPlanInput,
  toPlanPatch,
  type PlanFormInput,
  type PlanFormValues,
} from './plan-form'
import type { CreatePlanInput, UpdatePlanInput } from './subscription-plans-api'

const NUMERIC = { type: 'number', numeric: true, inputMode: 'numeric', step: 1 } as const

/** Ô credit tắt khi chọn "không giới hạn"; đọc công tắc bằng `useWatch` ở component con để thân form không vẽ lại theo từng phím. */
function CreditsField({ form, error }: { form: UseFormReturn<PlanFormInput, unknown, PlanFormValues>; error: boolean }) {
  const t = useT()
  const { control, register } = form
  const unlimited = useWatch({ control, name: 'unlimited' })
  return (
    <div className="flex flex-col gap-3">
      <Input
        label={t('platform.form.credits')}
        required={!unlimited}
        disabled={unlimited}
        error={error && !unlimited ? t(CREDITS_INVALID) : undefined}
        {...NUMERIC}
        {...register('monthlyCredits', { valueAsNumber: true })}
      />
      <Controller
        control={control}
        name="unlimited"
        render={({ field }) => <Switch label={t('platform.form.unlimited')} checked={field.value} onCheckedChange={field.onChange} />}
      />
    </div>
  )
}

/**
 * Thêm / sửa gói cước (FE-8-02, D-90) đầy đủ các trường:
 * mã gói, tên, hạng, chu kỳ thanh toán, giá, credits, thuật toán, giới hạn xe & chuyến, tính năng, trạng thái bán.
 */
export function PlanFormDialog({ open, onOpenChange, plan, defaultTier, pending, onCreate, onUpdate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: SubscriptionPlan | null
  defaultTier: PlanTier
  pending: boolean
  onCreate: (input: CreatePlanInput) => void
  onUpdate: (planId: string, patch: UpdatePlanInput) => void
}) {
  const t = useT()
  const form = useForm<PlanFormInput, unknown, PlanFormValues>({ resolver: zodResolver(planFormSchema) })
  const { reset, register, control, formState: { errors } } = form

  useEffect(() => {
    if (!open) return
    reset(plan ? toPlanForm(plan) : emptyPlanForm(defaultTier))
  }, [open, plan, defaultTier, reset])

  const nameError = errors.name
    ? errors.name.message === 'platform.form.errors.nameTooLong'
      ? t('platform.form.errors.nameTooLong', { max: PLAN_NAME_MAX })
      : t(NAME_REQUIRED)
    : undefined

  function handleValid(values: PlanFormValues) {
    if (plan) onUpdate(plan.id, toPlanPatch(values))
    else onCreate(toPlanInput(values))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-150 max-w-[95vw]">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={Tags}
            title={plan ? t('platform.form.editTitle', { id: plan.id }) : t('platform.form.createTitle')}
            description={t('platform.form.description')}
          />
          <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-7 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mã gói (Plan Code)"
                placeholder="ví dụ: PLAN-BASIC, PLAN-PRO"
                disabled={Boolean(plan)}
                error={errors.planCode?.message}
                {...register('planCode')}
              />
              <Input
                label={t('platform.form.name')}
                placeholder={t('platform.form.namePlaceholder')}
                required
                error={nameError}
                {...register('name')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plan ? (
                <Input label={t('platform.form.tier')} value={t(`common.planTiers.${plan.tier}`)} readOnly hint={t('platform.form.tierFixed')} />
              ) : (
                <SelectField
                  control={control}
                  name="tier"
                  label={t('platform.form.tier')}
                  options={optionsFromLabels({ BASIC: t('common.planTiers.BASIC'), PRO: t('common.planTiers.PRO'), ULTIMATE: t('common.planTiers.ULTIMATE') })}
                  hint={t('platform.form.onSaleHint')}
                />
              )}
              <SelectField
                control={control}
                name="billingCycle"
                label="Chu kỳ thanh toán"
                options={[
                  { value: 'MONTHLY', label: 'Hàng tháng' },
                  { value: 'YEARLY', label: 'Hàng năm' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('platform.form.price')}
                suffix="₫"
                required
                error={errors.priceVnd ? t(PRICE_INVALID) : undefined}
                {...NUMERIC}
                {...register('priceVnd', { valueAsNumber: true })}
              />
              <SelectField
                control={control}
                name="algorithmTier"
                label="Hạng thuật toán"
                options={[
                  { value: 'EP_DBLF', label: 'Cơ bản (EP + DBLF)' },
                  { value: 'EP_DBLF_GA', label: 'Nâng cao (EP + DBLF + GA)' },
                  { value: 'EP_DBLF_GA_AI', label: 'Tối ưu AI (EP + DBLF + GA + AI)' },
                ]}
              />
            </div>

            <CreditsField form={form} error={errors.monthlyCredits !== undefined} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Số xe tối đa"
                placeholder="để trống nếu không giới hạn"
                error={errors.maxVehicles?.message}
                {...NUMERIC}
                {...register('maxVehicles', { valueAsNumber: true })}
              />
              <Input
                label="Số chuyến tối đa / tháng"
                placeholder="để trống nếu không giới hạn"
                error={errors.maxMonthlyJobs?.message}
                {...NUMERIC}
                {...register('maxMonthlyJobs', { valueAsNumber: true })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="features" className="text-small font-medium text-ink-strong">
                Tính năng chi tiết ("Gói gồm")
              </label>
              <textarea
                id="features"
                rows={4}
                className="w-full rounded-md border border-line-strong bg-surface p-2.5 text-body text-ink-strong placeholder:text-ink-muted focus:border-cyan-500 focus:outline-none"
                placeholder="- Hỗ trợ tải 3D container&#10;- Tối ưu lộ trình đa điểm&#10;- Xuất báo cáo Excel / PDF"
                {...register('features')}
              />
              <span className="text-caption text-ink-muted">
                Mỗi dòng một tính năng (bắt đầu bằng dấu "-"). Hỗ trợ xuống hàng hoặc dùng ký tự "/n-".
              </span>
            </div>

            {plan ? null : (
              <Controller
                control={control}
                name="active"
                render={({ field }) => <Switch label={t('platform.form.onSale')} checked={field.value} onCheckedChange={field.onChange} />}
              />
            )}
            <Banner tone="info">{t('platform.form.renewalNote')}</Banner>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">{t('platform.form.cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {plan ? t('platform.form.save') : t('platform.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
