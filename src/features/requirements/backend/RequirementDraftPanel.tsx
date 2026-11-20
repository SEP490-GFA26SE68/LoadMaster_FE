import { Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { isApiError } from '@/lib/api-client'
import type { Formatter } from '@/lib/format'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import type { RequirementFormValues } from './requirement-form'
import { REQUIREMENT_DRAFT_MAX_CHARS, type DraftField, type RequirementDraft, type RequirementDraftPackage } from './requirement-draft-api'
import { draftToFormValues } from './requirement-draft'
import { useRequirementDraftMutation } from './useRequirementDraft'

/** Nhãn của ô form ứng với từng trường máy chủ báo thiếu. */
const FIELD_LABELS = {
  destinationText: 'requirements.form.address',
  deadline: 'requirements.form.deadlineDate',
  priority: 'requirements.form.priority',
  expectedPackageCount: 'requirements.form.expectedPackageCount',
} as const satisfies Record<DraftField, string>

function draftError(error: unknown, t: TFunction): string {
  const code = isApiError(error) ? error.code : ''
  if (code === 'ASSISTANT_MESSAGE_TOO_LONG') return t('requirements.draft.errors.tooLong', { max: REQUIREMENT_DRAFT_MAX_CHARS })
  if (code === 'ASSISTANT_RATE_LIMITED') return t('requirements.draft.errors.rateLimited')
  if (code === 'ASSISTANT_UNAVAILABLE' || code === 'ASSISTANT_BUDGET_EXCEEDED') return t('requirements.draft.errors.unavailable')
  return dataErrorMessage(error, t)
}

/**
 * Ô "Điền nhanh từ tin nhắn của khách" của form tạo yêu cầu giao (kỹ năng E của trợ lý): dán nội dung, máy chủ đọc ra bản nháp, panel
 * điền năm ô bằng `setValue`. Không tự lưu; không chạm khách hàng, kiện, toạ độ — tên bên gửi và danh sách hàng chỉ hiện để đối chiếu.
 */
export function RequirementDraftPanel({ form }: { form: UseFormReturn<RequirementFormValues> }) {
  const t = useT()
  const titleId = useId()
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ draft: RequirementDraft; filled: number } | null>(null)
  const draft = useRequirementDraftMutation()

  function handleRead() {
    const content = text.trim()
    if (content === '') return
    setResult(null)
    draft.mutate(content, {
      onSuccess: (read) => {
        const values = draftToFormValues(read)
        const keys = Object.keys(values) as (keyof typeof values)[]
        for (const key of keys) form.setValue(key, values[key] as never, { shouldDirty: true })
        if (keys.length > 0) void form.trigger(keys)
        setResult({ draft: read, filled: keys.length })
      },
    })
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 lg:col-span-2">
      <div className="flex items-start gap-2.5">
        <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} />
        <div>
          <h3 id={titleId} className="font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('requirements.draft.title')}</h3>
          <p className="text-small text-ink-3">{t('requirements.draft.intro')}</p>
        </div>
      </div>

      <Textarea label={t('requirements.draft.text')} rows={4} maxLength={REQUIREMENT_DRAFT_MAX_CHARS} value={text}
        onChange={(event) => setText(event.target.value)} hint={t('requirements.draft.disclosure')} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" loading={draft.isPending} disabled={draft.isPending || text.trim() === ''} onClick={handleRead}>
          {t('requirements.draft.submit')}
        </Button>
        <span className="font-mono text-caption tabular-nums text-ink-3">
          {t('requirements.draft.count', { count: text.length, max: REQUIREMENT_DRAFT_MAX_CHARS })}
        </span>
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-2 text-small">
        {draft.isPending ? <p className="text-ink-3">{t('requirements.draft.reading')}</p> : null}
        {result ? <DraftResult draft={result.draft} filled={result.filled} /> : null}
      </div>
      {draft.isError ? <p role="alert" className="text-small text-danger">{draftError(draft.error, t)}</p> : null}
    </section>
  )
}

function DraftResult({ draft, filled }: { draft: RequirementDraft; filled: number }) {
  const t = useT()
  const format = useFormat()
  // Khách hàng không bao giờ được điền: luôn nằm đầu danh sách cần bổ sung
  const toComplete = [t('requirements.form.customer'), ...draft.missing.map((field) => t(FIELD_LABELS[field]))]

  return (
    <>
      <p className="text-ink-1">{filled > 0 ? t('requirements.draft.filled', { count: filled }) : t('requirements.draft.nothing')}</p>
      <p className="text-ink-2">{t('requirements.draft.toComplete', { fields: format.list(toComplete) })}</p>
      {draft.customerNameGuess ? <p className="text-ink-2">{t('requirements.draft.customerGuess', { name: draft.customerNameGuess })}</p> : null}
      {draft.packages.length > 0 ? (
        <div>
          <p className="text-ink-2">{t('requirements.draft.packagesTitle')}</p>
          <ul className="mt-1 list-disc pl-5 text-ink-2">
            {draft.packages.map((item, index) => <li key={index}>{packageLine(item, t, format)}</li>)}
          </ul>
        </div>
      ) : null}
    </>
  )
}

function packageLine(item: RequirementDraftPackage, t: TFunction, format: Formatter): string {
  const parts = [item.quantity === null ? item.description : t('requirements.draft.packageLine', { quantity: format.integer(item.quantity), description: item.description })]
  if (item.lengthCm !== null && item.widthCm !== null && item.heightCm !== null) parts.push(format.dimensions(item.lengthCm, item.widthCm, item.heightCm))
  if (item.weightKg !== null) parts.push(format.weight(item.weightKg))
  return parts.join(' · ')
}
