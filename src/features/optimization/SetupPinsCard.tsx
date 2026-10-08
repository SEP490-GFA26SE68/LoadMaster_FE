import { Pin } from 'lucide-react'
import { useId } from 'react'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import type { ConstraintIssue } from '@/domain/constraints'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import type { PinOffer } from './optimization-api'

/**
 * Lựa chọn "Giữ kiện đã ghim" của Thiết lập tối ưu (FE-BL-02), đứng trên ba mục đánh số khi có gì để giữ: kiện ghim của một phương án
 * (mở từ Planner) hoặc kiện kho đã xếp lên xe trước khi kiện hỏng đưa chuyến về Đã lập kế hoạch. Công tắc kèm câu nói rõ nó làm gì; bật
 * mà bộ kiện không đứng vững một mình (`issues`) thì liệt kê từng lý do — nút Tối ưu bị chặn tới khi tắt công tắc, lần chạy bình
 * thường. Kiện đã xếp không giữ được (tựa lên kiện hỏng) thì chỉ có câu nói những kiện nào và lần chạy là bình thường.
 */
export function SetupPinsCard({ offer, keep, onKeepChange, issues }: {
  offer: PinOffer
  keep: boolean
  onKeepChange: (keep: boolean) => void
  issues: readonly ConstraintIssue[]
}) {
  const t = useT()
  const format = useFormat()
  const hintId = useId()
  const count = offer.placements.length
  const keepable = count > 0
  const hint = !keepable
    ? t('optimization.pins.blocked', { count: offer.blocked.length, packages: format.list(offer.blocked) })
    : keep
    ? t(`optimization.pins.on.${offer.source}`, { count, revision: offer.revisionId ?? '' })
    : t('optimization.pins.off')
  return (
    <Card className="flex flex-col gap-2 px-7 py-4.5 max-sm:px-4">
      <h2 className="flex items-center gap-2 font-display text-h3 font-[650] text-ink-strong">
        <Pin className="size-4 text-primary" strokeWidth={1.5} aria-hidden />{t('optimization.pins.title')}
      </h2>
      {keepable ? (
        <Switch label={t('optimization.pins.switch', { count })} checked={keep} aria-describedby={hintId} onCheckedChange={onKeepChange} />
      ) : null}
      <p id={hintId} className="text-small text-ink-2">{hint}</p>
      {keepable && keep && issues.length > 0 ? (
        <div role="alert" className="flex flex-col gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-small text-ink-strong">
          <p className="font-semibold">{t('optimization.pins.invalid', { count: issues.length })}</p>
          <ul className="m-0 list-disc pl-5">
            {issues.map((issue, index) => <li key={`${issue.code}-${issue.packageInstanceId ?? index}`}>{formatIssue(issue, t, format)}</li>)}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
