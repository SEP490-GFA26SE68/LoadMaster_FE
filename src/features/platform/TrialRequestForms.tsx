import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CheckCircle2, ShieldCheck, Sparkles, UserX } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import type { TrialApproval, TrialRequest } from './trial-requests-api'
import { useSubscriptionPlansQuery } from './useSubscriptionPlansQuery'

const message = (t: TFunction, key: string | undefined) => (key === undefined ? undefined : t(key as MessageKey))

const APPROVE_ERRORS = {
  companyNameRequired: 'platform.trialRequests.approve.errors.companyNameRequired',
  companyNameTooLong: 'platform.trialRequests.approve.errors.companyNameTooLong',
  companyCodeRequired: 'platform.trialRequests.approve.errors.companyCodeRequired',
  companyCodeInvalid: 'platform.trialRequests.approve.errors.companyCodeInvalid',
  taxCodeRequired: 'platform.trialRequests.approve.errors.taxCodeRequired',
  taxCodeTooLong: 'platform.trialRequests.approve.errors.taxCodeTooLong',
  trialDays: 'platform.trialRequests.approve.errors.trialDays',
  trialCredits: 'platform.trialRequests.approve.errors.trialCredits',
  noteTooLong: 'platform.trialRequests.approve.errors.noteTooLong',
} as const satisfies Record<string, MessageKey>

const approveSchema = z.object({
  companyName: z.string().trim().min(1, APPROVE_ERRORS.companyNameRequired).max(200, APPROVE_ERRORS.companyNameTooLong),
  companyCode: z
    .string()
    .trim()
    .min(1, APPROVE_ERRORS.companyCodeRequired)
    .max(50, APPROVE_ERRORS.companyCodeInvalid)
    .regex(/^[A-Za-z0-9_-]{3,50}$/, APPROVE_ERRORS.companyCodeInvalid),
  taxCode: z.string().trim().min(1, APPROVE_ERRORS.taxCodeRequired).max(50, APPROVE_ERRORS.taxCodeTooLong),
  planId: z.string(),
  trialDays: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 365, APPROVE_ERRORS.trialDays),
  trialCredits: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 0, APPROVE_ERRORS.trialCredits),
  note: z.string().trim().max(500, APPROVE_ERRORS.noteTooLong),
})

type ApproveValues = z.output<typeof approveSchema>

export function suggestCompanyCode(name?: string | null): string {
  if (!name || !name.trim()) return ''
  // Bỏ dấu tiếng Việt và chuyển sang viết hoa
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  // Bỏ các từ loại hình pháp lý phổ biến
  const withoutLegal = clean
    .replace(/\b(CONG TY|CO PHAN|TNHH|MTV|DOANH NGHIEP|TAP DOAN|CHI NHANH)\b/g, ' ')
    .trim()

  const allWords = withoutLegal.split(/[^A-Z0-9]+/).filter(Boolean)
  if (allWords.length === 0) return 'COMP_LOG'

  // Bỏ bớt từ vận tải / logistics nếu tên lõi đã đủ dài
  const meaningfulWords = allWords.filter(
    (w) => w !== 'VAN' && w !== 'TAI' && w !== 'LOGISTICS',
  )
  const coreWords = meaningfulWords.length >= 2 ? meaningfulWords : allWords

  if (coreWords.length === 1) {
    const first = coreWords[0] ?? 'COMP'
    return `${first.slice(0, 15)}_LOG`
  }

  if (coreWords.length === 2) {
    const combined = coreWords.join('_')
    return combined.length <= 25 ? combined : `${combined.slice(0, 20)}_LOG`
  }

  // Nếu tên lõi có từ 3 từ trở lên (VD: "Tan Cang Sai Gon" -> TCSG_LOG)
  const acronym = coreWords.map((w) => w[0]).join('')
  return `${acronym}_LOG`
}

/** Số ngày dùng thử mặc định khi duyệt. */
const DEFAULT_TRIAL_DAYS = '14'
const DEFAULT_TRIAL_CREDITS = '100'

/**
 * Duyệt và khởi tạo tài khoản (System Admin):
 * - Quyền quyết định gói cước, số ngày và hạn mức credits thuộc về Admin.
 * - Chuẩn hóa mã công ty (companyCode) và mã số thuế.
 * - Xác nhận 2 bước trước khi tạo tài khoản trên Keycloak và công ty trong DB.
 */
export function ApproveTrialForm(props: ApproveFormProps) {
  const t = useT()
  const query = useSubscriptionPlansQuery()
  if (query.isPending) {
    return <div role="status" aria-label={t('platform.trialRequests.loading')} className="flex justify-center py-16"><Spinner /></div>
  }
  const plans = (query.data ?? []).map((row) => row.plan).filter((plan) => /^\d+$/.test(plan.id))
  return <ApproveFields {...props} plans={plans} />
}

type ApproveFormProps = {
  request: TrialRequest
  pending: boolean
  onBack: () => void
  onSubmit: (approval: TrialApproval) => void
}

function ApproveFields({ request, pending, onBack, onSubmit, plans }: ApproveFormProps & { plans: readonly SubscriptionPlan[] }) {
  const t = useT()
  const [confirmValues, setConfirmValues] = useState<ApproveValues | null>(null)
  const interested = plans.find((plan) => plan.id === request.interestedPlanId)
  const defaultCode = request.companyCode || suggestCompanyCode(request.companyName)

  const form = useForm<z.input<typeof approveSchema>, unknown, ApproveValues>({
    resolver: zodResolver(approveSchema),
    defaultValues: {
      companyName: request.companyName ?? '',
      companyCode: defaultCode,
      taxCode: request.taxCode ?? '',
      planId: (interested ?? plans[0])?.id ?? '',
      trialDays: request.trialDays ? String(request.trialDays) : DEFAULT_TRIAL_DAYS,
      trialCredits: request.trialCredits !== null && request.trialCredits !== undefined ? String(request.trialCredits) : DEFAULT_TRIAL_CREDITS,
      note: request.managerNote ?? '',
    },
  })
  const { errors } = form.formState
  const watchedDays = form.watch('trialDays')
  const watchedCredits = form.watch('trialCredits')

  function handleSubmit(values: ApproveValues) {
    setConfirmValues(values)
  }

  function handleConfirmed() {
    if (!confirmValues) return
    onSubmit({
      companyName: confirmValues.companyName,
      companyCode: confirmValues.companyCode.toUpperCase(),
      taxCode: confirmValues.taxCode,
      planId: confirmValues.planId === '' ? undefined : Number(confirmValues.planId),
      trialDays: Number(confirmValues.trialDays),
      trialCredits: Number(confirmValues.trialCredits),
      note: confirmValues.note === '' ? undefined : confirmValues.note,
    })
  }

  return (
    <>
      <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
        <DialogHeader
          icon={Building2}
          tone="info"
          title={t('platform.trialRequests.approve.title', { name: request.fullName })}
          description={t('platform.trialRequests.approve.description', { email: request.email })}
        />
        <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto px-7 py-5">
          {/* Card 1: Thông tin định danh doanh nghiệp */}
          <div className="rounded-xl border border-line-soft bg-surface p-4 shadow-xs">
            <div className="mb-3 flex items-center gap-2 text-small font-semibold text-ink-strong">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{t('platform.trialRequests.approve.companySection')}</span>
            </div>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <Input
                  label={t('platform.trialRequests.approve.companyName')}
                  required
                  error={message(t, errors.companyName?.message)}
                  {...form.register('companyName')}
                />
                <Input
                  label={t('platform.trialRequests.approve.companyCode')}
                  required
                  readOnly
                  hint={t('platform.trialRequests.approve.companyCodeHint')}
                  error={message(t, errors.companyCode?.message)}
                  className="bg-surface-subtle cursor-not-allowed font-mono font-bold tracking-wider text-ink-1 select-none"
                  {...form.register('companyCode')}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('platform.trialRequests.approve.taxCode')}
                  required
                  className="font-mono"
                  error={message(t, errors.taxCode?.message)}
                  {...form.register('taxCode')}
                />
                {request.companyAddress ? (
                  <div className="flex flex-col justify-center rounded-lg bg-surface-subtle px-3 py-2 text-caption">
                    <span className="font-medium text-ink-3">{t('platform.trialRequests.detail.companyAddress')}</span>
                    <span className="line-clamp-2 text-ink-1">{request.companyAddress}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Card 2: Cấu hình gói cước & Hạn mức dùng thử */}
          <div className="rounded-xl border border-line-soft bg-surface p-4 shadow-xs">
            <div className="mb-3 flex items-center gap-2 text-small font-semibold text-ink-strong">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>{t('platform.trialRequests.approve.quotaSection')}</span>
            </div>
            <div className="space-y-4">
              {plans.length === 0 ? (
                <p className="m-0 text-body text-ink-2">{t('platform.trialRequests.approve.noPlans')}</p>
              ) : (
                <SelectField
                  control={form.control}
                  name="planId"
                  label={t('platform.trialRequests.approve.plan')}
                  hint={request.interestedPlanName ? t('platform.trialRequests.approve.planHint', { name: request.interestedPlanName }) : undefined}
                  options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('platform.trialRequests.approve.trialDays')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  required
                  error={message(t, errors.trialDays?.message)}
                  {...form.register('trialDays')}
                />
                <Input
                  label={t('platform.trialRequests.approve.trialCredits')}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  required
                  error={message(t, errors.trialCredits?.message)}
                  {...form.register('trialCredits')}
                />
              </div>

              {/* Callout tóm tắt quyền lợi */}
              <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-caption text-ink-1">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-primary" />
                <div>
                  {t('platform.trialRequests.approve.quotaSummary', {
                    email: request.email,
                    days: watchedDays || DEFAULT_TRIAL_DAYS,
                    credits: watchedCredits || DEFAULT_TRIAL_CREDITS,
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Ghi chú phê duyệt */}
          <div className="space-y-3">
            {request.managerNote ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-caption">
                <div className="mb-1.5 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{t('platform.trialRequests.approve.managerNoteQuote', { name: request.managerReviewedByName || 'System Manager' })}</span>
                </div>
                <p className="m-0 whitespace-pre-wrap font-medium text-ink-1">{request.managerNote}</p>
              </div>
            ) : null}

            <Textarea
              label={t('platform.trialRequests.approve.note')}
              rows={2}
              error={message(t, errors.note?.message)}
              {...form.register('note')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onBack}>
            {t('platform.trialRequests.approve.back')}
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {t('platform.trialRequests.approve.submit')}
          </Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmValues !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmValues(null)
        }}
        title={t('platform.trialRequests.approve.confirmTitle')}
        description={t('platform.trialRequests.approve.confirmMessage', {
          company: confirmValues?.companyName ?? '',
          email: request.email,
        })}
        confirmLabel={t('platform.trialRequests.approve.confirmButton')}
        cancelLabel={t('platform.trialRequests.approve.cancelButton')}
        pending={pending}
        onConfirm={handleConfirmed}
      />
    </>
  )
}

const REJECTION_RULES = ['INVALID_TAX', 'UNREACHABLE', 'DUPLICATE', 'OUT_OF_SCOPE', 'OTHER'] as const
type RejectionRule = (typeof REJECTION_RULES)[number]

const REJECT_ERRORS = {
  reasonRequired: 'platform.trialRequests.reject.errors.reasonRequired',
  reasonTooLong: 'platform.trialRequests.reject.errors.reasonTooLong',
} as const satisfies Record<string, MessageKey>

const rejectSchema = z.object({ reason: z.string().trim().min(1, REJECT_ERRORS.reasonRequired).max(1000, REJECT_ERRORS.reasonTooLong) })
type RejectValues = z.output<typeof rejectSchema>

/** Câu mặc định của ô lý do theo lý do chuẩn; "Lý do khác" để trống cho người duyệt tự viết. */
function ruleDetail(rule: RejectionRule, t: TFunction): string {
  return rule === 'OTHER' ? '' : t(`platform.trialRequests.rules.${rule}.detail`)
}

/** Từ chối một yêu cầu: chọn lý do chuẩn điền sẵn câu vào ô lý do, người duyệt sửa được; lý do bắt buộc kèm Double Check. */
export function RejectTrialForm({ request, pending, onBack, onSubmit }: {
  request: TrialRequest
  pending: boolean
  onBack: () => void
  onSubmit: (reason: string) => void
}) {
  const t = useT()
  const [rule, setRule] = useState<RejectionRule>('INVALID_TAX')
  const [pendingReason, setPendingReason] = useState<string | null>(null)

  const form = useForm<z.input<typeof rejectSchema>, unknown, RejectValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: ruleDetail('INVALID_TAX', t) },
  })

  function handleRule(value: string) {
    const next = REJECTION_RULES.find((item) => item === value) ?? 'OTHER'
    setRule(next)
    form.setValue('reason', ruleDetail(next, t), { shouldDirty: true })
  }

  function handleConfirmed() {
    if (!pendingReason) return
    onSubmit(pendingReason)
  }

  return (
    <>
      <form noValidate onSubmit={form.handleSubmit((values) => setPendingReason(values.reason))}>
        <DialogHeader
          icon={UserX}
          tone="danger"
          title={t('platform.trialRequests.reject.title', { name: request.fullName })}
          description={t('platform.trialRequests.reject.description')}
        />
        <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 py-5">
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-2 text-small font-semibold text-ink-2">{t('platform.trialRequests.reject.rule')}</legend>
            <RadioGroup value={rule} onValueChange={handleRule}>
              {REJECTION_RULES.map((item) => (
                <RadioGroupItem key={item} value={item} label={t(`platform.trialRequests.rules.${item}.label`)} />
              ))}
            </RadioGroup>
          </fieldset>
          <Textarea
            label={t('platform.trialRequests.reject.reason')}
            required
            rows={4}
            error={message(t, form.formState.errors.reason?.message)}
            {...form.register('reason')}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onBack}>{t('platform.trialRequests.reject.back')}</Button>
          <Button type="submit" variant="danger" loading={pending}>{t('platform.trialRequests.reject.submit')}</Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={pendingReason !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReason(null)
        }}
        title={t('platform.trialRequests.reject.confirmTitle')}
        description={t('platform.trialRequests.reject.confirmMessage', {
          company: request.companyName || request.fullName,
          email: request.email,
        })}
        danger
        confirmLabel={t('platform.trialRequests.reject.confirmButton')}
        cancelLabel={t('platform.trialRequests.reject.cancelButton')}
        pending={pending}
        onConfirm={handleConfirmed}
      />
    </>
  )
}
