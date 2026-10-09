import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { OptimizationCredit } from './optimization-api'
import { useCreditUsageText } from './useCreditUsageText'

/**
 * Thẻ "Credit" ở cột phải Thiết lập tối ưu (FE-8-05): một lần chạy tốn bao nhiêu và còn bao nhiêu (số dư hiện tại), hạng thuật toán của
 * gói (Ultimate thêm "AI Optimizer — chưa có"). Bị chặn — hết credit, gói hết hạn — thì dòng credit mờ đi và lý do hiện ngay tại đây
 * (cũng nằm trên nút Tối ưu), không để bấm rồi mới báo lỗi. Mock chạy EP + DBLF cho mọi hạng nên thẻ nói rõ.
 */
export function SetupCreditPanel({ credit }: { credit: OptimizationCredit | undefined }) {
  const t = useT()
  const usageText = useCreditUsageText()
  if (credit === undefined) return null
  return (
    <Card role="region" aria-labelledby="setup-credit" className="px-4.5 py-4">
      <h2 id="setup-credit" className="font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t('optimization.credit.title')}</h2>
      <p data-credit-usage className={cn('mt-2 text-body font-semibold tabular-nums', credit.block ? 'text-text-disabled' : 'text-ink-strong')}>
        {credit.planName === null ? t('optimization.credit.noPlan') : usageText(credit)}
      </p>
      {credit.block ? <p role="alert" className="mt-1 text-small font-semibold text-warning">{t(`optimization.credit.blocked.${credit.block}`)}</p> : null}
      {credit.planName !== null && credit.algorithmTier !== null ? (
        <dl className="m-0 mt-3 flex flex-col gap-1 border-t border-line-soft pt-3 text-small">
          <dt className="text-ink-3">{t('optimization.credit.tier', { plan: credit.planName })}</dt>
          <dd data-algorithm-tier className="m-0 font-semibold text-ink-strong">{t(`optimization.credit.tiers.${credit.algorithmTier}`)}</dd>
          {credit.algorithmTier === 'EP_DBLF_GA_AI' ? <dd className="m-0 text-ink-2">{t('optimization.credit.aiOptimizer')}</dd> : null}
          <dd className="m-0 text-fine text-ink-3">{t('optimization.credit.tierNote')}</dd>
        </dl>
      ) : null}
    </Card>
  )
}
