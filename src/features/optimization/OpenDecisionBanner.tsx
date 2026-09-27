import { Banner } from '@/components/Banner'
import { DecisionSummary } from '@/features/review/DecisionSummary'
import { useT } from '@/lib/i18n'
import { useRunHistoryQuery } from './useOptimizationRuns'

/**
 * Quyết định của quản lý công ty còn chờ điều phối xử lý (LM-104): phương án bị từ chối, bị yêu cầu tối ưu lại hoặc có đề xuất đổi xe /
 * tách chuyến, mà chưa có lần chạy nào sau đó. Chạy lại xong thì banner tự tắt. Từ chối tông đỏ, các yêu cầu khác tông hổ phách.
 */
export function OpenDecisionBanner({ tripId, className }: { tripId: string; className?: string }) {
  const t = useT()
  const decision = useRunHistoryQuery(tripId).data?.openDecision
  if (!decision) return null
  return (
    <Banner tone={decision.kind === 'rejected' ? 'danger' : 'warning'} className={className}>
      <div className="flex flex-col gap-1.5" data-open-decision={decision.kind}>
        <DecisionSummary decision={decision} />
        <span className="text-small text-ink-2">{t('optimization.decision.rerun')}</span>
      </div>
    </Banner>
  )
}
