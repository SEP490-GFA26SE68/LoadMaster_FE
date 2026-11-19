import { useMemo } from 'react'
import type { PlanLabel } from '@/domain/models'
import { bestCandidates, type CandidateMetric } from '@/lib/candidate-metrics'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import type { LandingPlan } from './landing-plans'

/**
 * Bốn chỉ số để so ba phương án A · B · C của chuyến mẫu — dùng chung cho bộ chọn dưới khung 3D (`StagePlans`) và bảng so của chặng điều
 * phối (`JourneyPlans`). `value` là chữ đã định dạng theo ngôn ngữ, `null` khi phương án không có số đó (xe chưa khai trục); `best`: tốt
 * nhất trong ba (`bestCandidates` — hoà thì mọi phương án hoà, ba bằng nhau thì không ai); `marked`: có phương án nào được đánh dấu ở chỉ
 * số này.
 */
export type PlanFigure = { metric: CandidateMetric; label: MessageKey; value: string | null; best: boolean; marked: boolean }

export const FIGURE_LABELS = {
  volume: 'landingStage.plans.volume',
  axleGap: 'landingStage.plans.axleGap',
  rehandling: 'landingStage.plans.rehandling',
  unplaced: 'landingStage.plans.unplaced',
} as const satisfies Record<CandidateMetric, MessageKey>
export const FIGURE_ORDER = ['volume', 'axleGap', 'rehandling', 'unplaced'] as const satisfies readonly CandidateMetric[]

/** Chỉ số của từng phương án theo `FIGURE_ORDER` (đủ bốn, kể cả chỉ số không có số); `plans` rỗng: `null`. */
export function usePlanFigures(plans: readonly LandingPlan[] | null): ReadonlyMap<PlanLabel, readonly PlanFigure[]> | null {
  const t = useT()
  const format = useFormat()
  return useMemo(() => {
    if (!plans) return null
    const best = bestCandidates(plans)
    return new Map(plans.map((plan) => {
      const gap = plan.axles.status === 'computed' ? plan.axles.gapPercent : undefined
      const values: Record<CandidateMetric, string | null> = {
        volume: format.percent(plan.volumeUtilizationPercent),
        axleGap: gap === undefined ? null : t('landingStage.plans.axleGapValue', { value: format.decimal(gap) }),
        rehandling: plan.rehandlingCount === undefined ? null : format.integer(plan.rehandlingCount),
        unplaced: format.integer(plan.unplacedCount),
      }
      const figures = FIGURE_ORDER.map((metric): PlanFigure => ({
        metric, label: FIGURE_LABELS[metric], value: values[metric], best: best[metric]?.has(plan.id) ?? false, marked: (best[metric]?.size ?? 0) > 0,
      }))
      return [plan.id, figures] as const
    }))
  }, [plans, t, format])
}
