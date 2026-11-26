import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'

/**
 * Thẻ của màn So sánh theo lần chạy bản máy chủ. Phương án mang `duplicateOf` trỏ tới một phương án có trong lần chạy thì thẻ thu gọn và
 * `sameAs` là phương án **gốc** của chuỗi (C trùng B, B trùng A → C cùng cách xếp với A); nhãn trỏ tới phương án vắng, hay chuỗi vòng,
 * thì thẻ đầy đủ như thường. Thuần.
 */
export type RunPlanCard = { readonly plan: LoadPlan; readonly sameAs: LoadPlan | null }

export function runPlanCards(plans: readonly LoadPlan[]): RunPlanCard[] {
  const byLabel = new Map(plans.flatMap((plan) => (plan.label ? [[plan.label, plan] as const] : [])))
  const rootOf = (plan: LoadPlan): LoadPlan | null => {
    const seen = new Set<string>([plan.id])
    let current = plan
    while (current.duplicateOf) {
      const next = byLabel.get(current.duplicateOf)
      if (!next || seen.has(next.id)) return null
      seen.add(next.id)
      current = next
    }
    return current === plan ? null : current
  }
  return plans.map((plan) => ({ plan, sameAs: plan.duplicateOf ? rootOf(plan) : null }))
}

/** Số kiện xếp được của các phương án so với tổng kiện của lần chạy: một số khi mọi phương án bằng nhau, không thì khoảng; lần chạy không có kiện nào thì `null`. */
export function placedSummary(plans: readonly LoadPlan[]): { readonly min: number; readonly max: number; readonly total: number } | null {
  const placed = plans.map((plan) => plan.placements.length)
  const total = Math.max(...plans.map((plan) => plan.placements.length + plan.unplaced.length))
  if (plans.length === 0 || total === 0) return null
  return { min: Math.min(...placed), max: Math.max(...placed), total }
}
