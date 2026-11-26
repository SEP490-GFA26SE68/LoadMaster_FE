import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'

export type BestKey = 'volume' | 'payload' | 'rehandling' | 'unplaced'

const BEST: Readonly<Record<BestKey, { value: (plan: LoadPlan) => number | null; higher: boolean }>> = {
  volume: { value: (plan) => plan.volumePercent, higher: true },
  payload: { value: (plan) => plan.payloadPercent, higher: true },
  rehandling: { value: (plan) => plan.rehandlingCount, higher: false },
  unplaced: { value: (plan) => plan.unplaced.length, higher: false },
}

/**
 * Phương án có giá trị tốt nhất của một chỉ số: chỉ khi mọi phương án có số và không bằng nhau hết; hoà thì mọi phương án hoà. Đánh dấu
 * trung tính (in đậm + nhãn "Tốt nhất"), như màn so sánh của kho mẫu. Thuần.
 */
export function bestPlanIds(plans: readonly LoadPlan[], key: BestKey): ReadonlySet<string> {
  const { value, higher } = BEST[key]
  const values = plans.map(value)
  if (plans.length < 2 || values.some((item) => item === null)) return new Set()
  const numbers = values as number[]
  const best = higher ? Math.max(...numbers) : Math.min(...numbers)
  if (numbers.every((item) => item === best)) return new Set()
  return new Set(plans.filter((_, index) => numbers[index] === best).map((plan) => plan.id))
}
