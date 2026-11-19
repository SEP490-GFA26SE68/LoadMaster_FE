import { expandPackages } from '@/domain/cargo'
import { roundCm } from '@/domain/geometry'
import { PLAN_LABELS, type OptimizationRequest, type OptimizationResult, type PlanLabel, type PlanObjective, type UnplacedPackage } from '@/domain/models'
import { bestCandidates, candidateAxles } from '@/lib/candidate-metrics'
import type { CandidatePlan } from '@/services/optimization'
import type { TryInput } from './try-form'

/**
 * Số của một lần thử — đọc từ ba phương án của **một** lần chạy bộ tối ưu mô phỏng, không tính lại phương án nào. Thuần, có test.
 */

/** Kiện chưa xếp của một phương án, gộp theo loại kiện (0–3) rồi theo lý do, giữ thứ tự gặp trong kết quả. */
export type TryUnplaced = { readonly kind: number; readonly reason: UnplacedPackage['reasonCode']; readonly count: number }

/** Chỉ số được so giữa ba phương án; mỗi chỉ số có hàng của nó ở thẻ phương án. */
export type TryMetric = 'placed' | 'volume' | 'balance' | 'rehandling'

export type TryPlan = {
  readonly id: PlanLabel
  readonly objective: PlanObjective
  readonly result: OptimizationResult
  readonly placedCount: number
  readonly volumePercent: number
  /**
   * Trọng tâm hàng lệch khỏi giữa chiều dài thùng, cm (`|x − dài / 2|`, theo `metrics.centerOfGravityCm`). Xe của bản thử không có trục,
   * nên đây là thứ phương án "cân bằng tải trục" làm cho nhỏ nhất. `null` khi không kiện nào lên xe.
   */
  readonly balanceCm: number | null
  readonly rehandlingCount: number | null
  readonly unplaced: readonly TryUnplaced[]
  /**
   * Phương án đứng trước có đúng cách xếp này (cùng chỗ, cùng hướng từng kiện): hai mục tiêu chọn trùng một cách xếp thì bộ tối ưu trả hai
   * phương án giống hệt nhau, và màn nói thẳng như vậy thay vì để khách đoán vì sao số trùng.
   */
  readonly sameAs: PlanLabel | null
}

export type TryOutcome = {
  readonly input: TryInput
  readonly request: OptimizationRequest
  readonly totalCount: number
  /**
   * Hàng có từ hai điểm giao trở lên. Chỉ khi đó số dỡ-xếp lại mới có nghĩa: một điểm giao thì mọi kiện cùng vùng, số luôn là 0 — màn bỏ
   * hàng đó và nói vì sao.
   */
  readonly multiStop: boolean
  readonly plans: readonly TryPlan[]
  /** Nhãn các phương án tốt nhất ở từng chỉ số; vắng khi mọi phương án bằng nhau hay có phương án không có số. */
  readonly best: Partial<Record<TryMetric, ReadonlySet<PlanLabel>>>
}

function unplacedOf(request: OptimizationRequest, result: OptimizationResult): TryUnplaced[] {
  const { packageIdByInstanceId } = expandPackages(request.packages)
  const kindIds = request.packages.map(({ id }) => id)
  const groups = new Map<string, TryUnplaced>()
  for (const item of result.unplacedPackages) {
    const kind = Math.max(0, kindIds.indexOf(packageIdByInstanceId.get(item.packageInstanceId) ?? ''))
    const key = `${kind}:${item.reasonCode}`
    groups.set(key, { kind, reason: item.reasonCode, count: (groups.get(key)?.count ?? 0) + 1 })
  }
  return [...groups.values()]
}

/** Dấu vân của một cách xếp: chỗ và hướng của từng kiện, theo thứ tự trong kết quả. */
function layoutKey(result: OptimizationResult): string {
  return JSON.stringify(result.placements.map((p) => [p.packageInstanceId, p.xCm, p.yCm, p.zCm, p.orientation]))
}

function balanceOf(request: OptimizationRequest, result: OptimizationResult): number | null {
  const center = result.metrics.centerOfGravityCm
  if (center === undefined || result.placements.length === 0) return null
  return roundCm(Math.abs(center.x - request.vehicle.innerLengthCm / 2))
}

/** Phương án có số nhỏ nhất (hoà thì mọi phương án hoà); mọi phương án bằng nhau, hay có phương án không có số: không ai. */
function lowest(plans: readonly TryPlan[], value: (plan: TryPlan) => number | null): ReadonlySet<PlanLabel> | undefined {
  const values = plans.map(value)
  if (!values.every((item): item is number => item !== null) || new Set(values).size < 2) return undefined
  const target = Math.min(...values)
  return new Set(plans.filter((_, index) => values[index] === target).map((plan) => plan.id))
}

/**
 * Ba phương án của một lần thử theo thứ tự A · B · C, kèm "tốt nhất" như màn So sánh: thể tích, số kiện chưa xếp và số dỡ-xếp lại qua
 * `bestCandidates`; lệch trọng tâm (làm tròn 0,1 cm — đúng số hiện ra) nhỏ hơn là tốt hơn.
 */
export function tryOutcome(input: TryInput, request: OptimizationRequest, candidates: readonly CandidatePlan[]): TryOutcome {
  const multiStop = new Set(request.packages.map((line) => line.deliveryStop)).size > 1
  const layouts = candidates.map(({ result }) => layoutKey(result))
  const plans = candidates.map(({ objective, result }, index): TryPlan => {
    const twin = layouts.findIndex((layout) => layout === layouts[index])
    return {
      id: PLAN_LABELS[objective],
      objective,
      result,
      placedCount: result.placements.length,
      volumePercent: result.metrics.volumeUtilizationPercent,
      balanceCm: balanceOf(request, result),
      rehandlingCount: multiStop ? (result.metrics.rehandlingCount ?? null) : null,
      unplaced: unplacedOf(request, result),
      sameAs: twin < index ? PLAN_LABELS[(candidates[twin] as CandidatePlan).objective] : null,
    }
  })
  const compared = bestCandidates(plans.map((plan) => ({
    id: plan.id,
    volumeUtilizationPercent: plan.volumePercent,
    unplacedCount: plan.result.metrics.unplacedCount,
    ...(plan.rehandlingCount === null ? {} : { rehandlingCount: plan.rehandlingCount }),
    axles: candidateAxles({ request, result: plan.result }),
  })))
  const labels = (set: ReadonlySet<string> | undefined) => set && new Set(plans.filter((plan) => set.has(plan.id)).map((plan) => plan.id))
  const best: Partial<Record<TryMetric, ReadonlySet<PlanLabel>>> = {}
  const entries: [TryMetric, ReadonlySet<PlanLabel> | undefined][] = [
    ['placed', labels(compared.unplaced)],
    ['volume', labels(compared.volume)],
    ['balance', lowest(plans, (plan) => plan.balanceCm)],
    ['rehandling', labels(compared.rehandling)],
  ]
  for (const [metric, set] of entries) if (set) best[metric] = set
  return { input, request, totalCount: expandPackages(request.packages).instances.length, multiStop, plans, best }
}
