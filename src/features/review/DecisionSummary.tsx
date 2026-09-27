import { useFormat, useT } from '@/lib/i18n'
import type { ReviewDecision } from '@/lib/mock-db'
import { cn } from '@/lib/utils'

export type DecisionView = Pick<ReviewDecision, 'kind' | 'reason' | 'at'> & {
  readonly byName: string | null
  readonly vehicleName: string | null
}

/**
 * Câu kể một quyết định của quản lý công ty (LM-104): quyết định gì, lý do nguyên văn, xe đề xuất nếu có, ai và lúc nào. Dùng ở dòng
 * dưới thanh trên của Planner (`inline`: một dòng, xuống dòng khi hẹp — nhường chiều cao cho khung 3D) và banner của Thiết lập tối ưu
 * (`stack`) — điều phối viên đọc được lý do ở cả hai nơi họ sẽ tới tiếp.
 */
export function DecisionSummary({ decision, layout = 'stack' }: { decision: DecisionView; layout?: 'stack' | 'inline' }) {
  const t = useT()
  const format = useFormat()
  const inline = layout === 'inline'
  return (
    <span className={cn('flex min-w-0', inline ? 'flex-wrap items-baseline gap-x-2 gap-y-0.5' : 'flex-col gap-0.5')}>
      <span className="font-medium text-ink-strong">{t(`review.notice.${decision.kind}`)}</span>
      <span className="text-ink-1" data-decision-reason>{t('review.notice.reason', { reason: decision.reason })}</span>
      {decision.vehicleName ? <span className="text-ink-1">{t('review.notice.suggestedVehicle', { vehicle: decision.vehicleName })}</span> : null}
      <span className={cn('text-ink-3', inline ? 'text-small' : 'text-caption')}>
        {t('review.notice.byLine', { name: decision.byName ?? t('review.notice.someone'), time: format.time(decision.at), date: format.dayMonth(decision.at) })}
      </span>
    </span>
  )
}
