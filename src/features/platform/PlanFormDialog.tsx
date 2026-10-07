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
import type { PlanInput, PlanPatch, PlanTier, SubscriptionPlan } from '@/lib/mock-db'
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
 * Thêm / sửa gói cước (FE-8-02, D-90). `plan` vắng là thêm gói: chọn hạng (mở sẵn hạng chưa có gói đang bán — `defaultTier`), có công tắc
 * "Mở bán ngay". Có `plan` là sửa: hạng chỉ đọc (đổi hạng làm lệch thuật toán và tính năng của công ty đang dùng), cờ bán là công tắc ở danh
 * sách. Form nói rõ giá và credit mới áp dụng từ kỳ gia hạn kế tiếp. Kho kiểm lại — `PLAN_TIER_TAKEN`, `PLAN_INVALID` hiện qua toast của màn.
 */
export function PlanFormDialog({ open, onOpenChange, plan, defaultTier, pending, onCreate, onUpdate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: SubscriptionPlan | null
  defaultTier: PlanTier
  pending: boolean
  onCreate: (input: PlanInput) => void
  onUpdate: (planId: string, patch: PlanPatch) => void
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
      <DialogContent className="w-140">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={Tags}
            title={plan ? t('platform.form.editTitle', { id: plan.id }) : t('platform.form.createTitle')}
            description={t('platform.form.description')}
          />
          <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 py-5">
            <Input label={t('platform.form.name')} placeholder={t('platform.form.namePlaceholder')} required error={nameError} {...register('name')} />
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
            <Input
              label={t('platform.form.price')}
              suffix="₫"
              required
              error={errors.priceVnd ? t(PRICE_INVALID) : undefined}
              {...NUMERIC}
              {...register('priceVnd', { valueAsNumber: true })}
            />
            <CreditsField form={form} error={errors.monthlyCredits !== undefined} />
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
