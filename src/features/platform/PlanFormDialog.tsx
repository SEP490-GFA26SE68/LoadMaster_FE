import { zodResolver } from '@hookform/resolvers/zod'
import { Tags } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/Switch'
import { useT } from '@/lib/i18n'
import type { PlanInput, PlanPatch, PlanTier, SubscriptionPlan } from '@/lib/mock-db'
import {
  CREDITS_INVALID,
  CREDITS_POSITIVE,
  emptyPlanForm,
  isUnlimitedForm,
  NAME_REQUIRED,
  PLAN_NAME_MAX,
  planFormSchemaFor,
  PRICE_INVALID,
  toPlanForm,
  toPlanInput,
  toPlanPatch,
  type PlanFormInput,
  type PlanFormRules,
  type PlanFormValues,
} from './plan-form'

const NUMERIC = { type: 'number', numeric: true, inputMode: 'numeric', step: 1 } as const

/** Việc form làm được theo nguồn dữ liệu: công tắc "không giới hạn" hay credit theo hạng, công tắc mở bán, hạng chọn được khi thêm. */
export type PlanFormCatalog = PlanFormRules & { readonly saleSwitch: boolean; readonly tiers: readonly PlanTier[] }

/**
 * Ô credit tắt khi gói không giới hạn — theo công tắc, hoặc theo hạng khi `unlimitedByTier` (không có công tắc). Đọc công tắc và hạng bằng
 * `useWatch` ở component con để thân form không vẽ lại theo từng phím.
 */
function CreditsField({ form, error, rules }: { form: UseFormReturn<PlanFormInput, unknown, PlanFormValues>; error: boolean; rules: PlanFormRules }) {
  const t = useT()
  const { control, register } = form
  const [unlimitedSwitch, tier] = useWatch({ control, name: ['unlimited', 'tier'] })
  const unlimited = isUnlimitedForm({ tier, unlimited: unlimitedSwitch }, rules)
  const message = rules.unlimitedByTier ? CREDITS_POSITIVE : CREDITS_INVALID
  return (
    <div className="flex flex-col gap-3">
      <Input
        label={t('platform.form.credits')}
        required={!unlimited}
        disabled={unlimited}
        hint={rules.unlimitedByTier && unlimited ? t('platform.form.unlimitedByTier') : undefined}
        error={error && !unlimited ? t(message) : undefined}
        {...NUMERIC}
        {...register('monthlyCredits', { valueAsNumber: true })}
      />
      {rules.unlimitedByTier ? null : (
        <Controller
          control={control}
          name="unlimited"
          render={({ field }) => <Switch label={t('platform.form.unlimited')} checked={field.value} onCheckedChange={field.onChange} />}
        />
      )}
    </div>
  )
}

/**
 * Thêm / sửa gói cước (FE-8-02, D-90). `plan` vắng là thêm gói: chọn hạng trong `catalog.tiers` (mở sẵn hạng chưa có gói đang bán —
 * `defaultTier`), có công tắc "Mở bán ngay" khi `catalog.saleSwitch`. Có `plan` là sửa: hạng chỉ đọc (đổi hạng làm lệch thuật toán và
 * tính năng của công ty đang dùng), cờ bán là công tắc ở danh sách. Form nói rõ giá và credit mới áp dụng từ kỳ gia hạn kế tiếp. Kho
 * kiểm lại — `PLAN_TIER_TAKEN`, `PLAN_INVALID` hiện qua toast của màn. `code` là mã hiện ở tiêu đề khi sửa.
 */
export function PlanFormDialog({ open, onOpenChange, plan, code, defaultTier, catalog, pending, onCreate, onUpdate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: SubscriptionPlan | null
  code: string
  defaultTier: PlanTier
  catalog: PlanFormCatalog
  pending: boolean
  onCreate: (input: PlanInput) => void
  onUpdate: (planId: string, patch: PlanPatch) => void
}) {
  const t = useT()
  const rules: PlanFormRules = useMemo(() => ({ unlimitedByTier: catalog.unlimitedByTier }), [catalog.unlimitedByTier])
  const resolver = useMemo(() => zodResolver(planFormSchemaFor(rules)), [rules])
  const form = useForm<PlanFormInput, unknown, PlanFormValues>({ resolver })
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
    if (plan) onUpdate(plan.id, toPlanPatch(values, rules))
    else onCreate(toPlanInput(values, rules))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <DialogHeader
            icon={Tags}
            title={plan ? t('platform.form.editTitle', { id: code }) : t('platform.form.createTitle')}
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
                options={catalog.tiers.map((tier) => ({ value: tier, label: t(`common.planTiers.${tier}`) }))}
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
            <CreditsField form={form} error={errors.monthlyCredits !== undefined} rules={rules} />
            {plan || !catalog.saleSwitch ? null : (
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
