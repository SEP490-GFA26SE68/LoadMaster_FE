import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { lastDays, MAX_RANGE_DAYS, QUICK_RANGES, rangeDays, rangeIssue, type RangeIssue } from './assistant-stats'
import type { RouteStatsRange } from './assistant-stats-api'

/** Lỗi gắn vào ô nào: thiếu ngày thì ô đang trống, sai thứ tự hay quá dài thì ô "Đến ngày". */
const rangeSchema = z
  .object({ from: z.string(), to: z.string() })
  .superRefine(({ from, to }, ctx) => {
    const issue = rangeIssue(from, to)
    if (issue === null) return
    const path = issue === 'invalid' && rangeIssue(from, from) !== null ? 'from' : 'to'
    ctx.addIssue({ code: 'custom', path: [path], message: issue })
  })

type RangeValues = z.infer<typeof rangeSchema>

function issueText(issue: string | undefined, values: RangeValues, t: TFunction): string | undefined {
  switch (issue as RangeIssue | undefined) {
    case 'invalid': return t('assistantStats.range.errors.invalid')
    case 'order': return t('assistantStats.range.errors.order')
    case 'tooLong': return t('assistantStats.range.errors.tooLong', { max: MAX_RANGE_DAYS, days: rangeDays(values.from, values.to) })
    default: return undefined
  }
}

/**
 * Khoảng ngày của màn số đếm xu hướng: ba nút chọn nhanh (7 · 30 · 90 ngày tới hôm nay, giờ Việt Nam) và hai ô ngày kèm nút "Xem".
 * Máy chủ đếm tối đa 90 ngày một lần: khoảng dài hơn, sai thứ tự hay thiếu ngày thì form không gửi và nói lý do dưới ô. Giá trị đã gửi
 * nằm trên URL (`tu`, `den`), màn đọc từ đó; form giữ bản nháp của mình và theo URL khi URL đổi (chọn nhanh, quay lại trang).
 */
export function AssistantStatsRange({ today, from, to, onApply }: {
  today: string
  from: string
  to: string
  onApply: (range: RouteStatsRange) => void
}) {
  const t = useT()
  const form = useForm<RangeValues>({ resolver: zodResolver(rangeSchema), defaultValues: { from, to } })
  const { errors } = form.formState

  useEffect(() => {
    form.reset({ from, to })
  }, [form, from, to])

  const values = form.getValues()

  return (
    <section aria-labelledby="assistant-stats-range" className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border border-border bg-bg px-4 py-3">
      <h2 id="assistant-stats-range" className="sr-only">{t('assistantStats.range.legend')}</h2>
      <div role="group" aria-label={t('assistantStats.range.quick')} className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((days) => {
          const range = lastDays(today, days)
          const pressed = range.from === from && range.to === to
          return (
            <Button
              key={days}
              variant="secondary"
              aria-pressed={pressed}
              className={cn(pressed && 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-50')}
              onClick={() => onApply(range)}
            >
              {t('assistantStats.range.lastDays', { count: days })}
            </Button>
          )
        })}
      </div>
      <form
        noValidate
        className="flex flex-wrap items-start gap-3"
        onSubmit={(event) => void form.handleSubmit((submitted) => onApply(submitted))(event)}
      >
        <div className="w-44">
          <Input type="date" label={t('assistantStats.range.from')} error={issueText(errors.from?.message, values, t)} {...form.register('from')} />
        </div>
        <div className="w-44">
          <Input type="date" label={t('assistantStats.range.to')} error={issueText(errors.to?.message, values, t)} {...form.register('to')} />
        </div>
        {/* Nhãn của ô nhập cao 24 px: nút đứng ngang hàng với ô, không với nhãn */}
        <Button type="submit" variant="secondary" className="mt-6">{t('assistantStats.range.apply')}</Button>
      </form>
    </section>
  )
}
