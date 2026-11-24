import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { fieldBoxClass, fieldLabelClass, FieldMessage, focusClass } from '@/components/ui/field-styles'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePublicPlansQuery } from '../useMarketingQuery'
import { advise, isValidRuns, MAX_RUNS, QUICK_RUNS } from './assistant-advisor'
import { planCredits } from './AssistantFacts'
import { CHAT_TOUCH, Chip, HandoffButton } from './AssistantChips'

const RUNS_INVALID = 'assistant.advisor.invalid' satisfies MessageKey
const runsSchema = z.object({
  runs: z.number({ error: RUNS_INVALID }).refine(isValidRuns, RUNS_INVALID),
})
type RunsInput = z.input<typeof runsSchema>

/** Trợ lý vừa hỏi số lần chạy mỗi tháng: ba mức chọn nhanh và ô nhập số. */
export function AdvisorAsk({ onRuns, disabled }: { onRuns: (label: string, runs: number) => void; disabled?: boolean }) {
  const t = useT()
  const format = useFormat()
  const inputId = useId()
  const errorId = useId()
  const form = useForm<RunsInput>({ resolver: zodResolver(runsSchema), defaultValues: { runs: Number.NaN } })
  const error = form.formState.errors.runs
  const label = (runs: number) => t('assistant.advisor.quick', { count: runs })

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t('assistant.advisor.quickLabel')} className="flex flex-wrap gap-2">
        {QUICK_RUNS.map((runs) => (
          <Chip key={runs} disabled={disabled} onClick={() => onRuns(label(runs), runs)}>{label(runs)}</Chip>
        ))}
      </div>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ runs }) => onRuns(label(runs), runs))}
        className="flex flex-col gap-1.5"
      >
        <label htmlFor={inputId} className={fieldLabelClass}>{t('assistant.advisor.runsLabel')}</label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_RUNS}
            step={1}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(fieldBoxClass(Boolean(error)), focusClass, 'h-9 w-28 px-3 font-mono tabular-nums pointer-coarse:h-12 in-[.assistant-touch]:h-14', CHAT_TOUCH)}
            {...form.register('runs', { valueAsNumber: true })}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={disabled} className={cn('pointer-coarse:h-12 in-[.assistant-touch]:h-14', CHAT_TOUCH)}>
            {t('assistant.advisor.submit')}
          </Button>
        </div>
        {error ? <FieldMessage id={errorId} error={t(RUNS_INVALID, { max: format.integer(MAX_RUNS) })} /> : null}
      </form>
    </div>
  )
}

/** Phép tính gói: số lần × credit một lần = credit cần, rồi gói đang bán rẻ nhất đủ dùng. */
export function AdvisorResult({ runs, onHandoff }: { runs: number; onHandoff: () => void }) {
  const t = useT()
  const format = useFormat()
  const plans = usePublicPlansQuery()
  const advice = advise(runs, plans.data ?? [])

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0">
        {t('assistant.advisor.math', { count: advice.runs, cost: advice.cost, credits: advice.credits })}
      </p>
      {plans.isPending ? <p className="m-0 text-ink-3">{t('assistant.facts.loadingPlans')}</p> : null}
      {plans.isError ? <p className="m-0">{t('landing.plans.error')}</p> : null}
      {plans.isSuccess && advice.plan ? (
        <p className="m-0">
          {t('assistant.advisor.pick', {
            name: advice.plan.name,
            price: format.currency(advice.plan.priceVnd),
            credits: planCredits(advice.plan, t, format.integer),
          })}
          {advice.plan.provisional ? (
            <Badge shape="tag" tone="warning" outlined className="ml-2 align-middle">{t('common.provisionalPlan')}</Badge>
          ) : null}
        </p>
      ) : null}
      {plans.isSuccess && !advice.plan ? (
        <>
          <p className="m-0">{t('assistant.advisor.none', { credits: advice.credits })}</p>
          <HandoffButton strong onHandoff={onHandoff} />
        </>
      ) : null}
      <p className="m-0 text-small text-ink-3 in-[.assistant-touch]:text-body-lg">{t('assistant.advisor.caveat')}</p>
    </div>
  )
}
