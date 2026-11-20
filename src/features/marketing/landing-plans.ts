import { expandPackages } from '@/domain/cargo'
import { checkStopReorder } from '@/domain/constraints'
import { PLAN_LABELS, type OptimizationRequest, type OptimizationResult, type PlanLabel, type PlanObjective } from '@/domain/models'
import { locateInZones } from '@/domain/zones'
import { UNLOAD_STOP } from '@/features/viewer3d/landing/story-timeline'
import { candidateAxles, type CandidateFigures } from '@/lib/candidate-metrics'
import type { CandidatePlan } from '@/services/optimization'

/** Phương án khung 3D vẽ khi mở trang: C — ít dỡ-xếp lại, đúng phương án mà chuyện "tới điểm nào lấy hàng điểm đó" kể. */
export const DEFAULT_OBJECTIVE: PlanObjective = 'MIN_REHANDLING'

/** Việc ở điểm giao đầu của một phương án, mọi số đọc từ chính các chỗ xếp của phương án đó. */
export type FirstStopFacts = {
  /** Kiện của điểm có chỗ trong thùng: số hộp dỡ ra ở điểm này. */
  readonly count: number
  /**
   * Kiện của điểm giao sau phải dời ra mới lấy được hàng của điểm này: hợp các kiện chắn lối dỡ (`checkStopReorder`, kiện giao muộn
   * hơn nằm giữa kiện của điểm và cửa sau, che kín hay một phần).
   */
  readonly moved: number
  /**
   * Kiện nằm sai vùng ở chỗ của điểm này (`locateInZones`; mỗi kiện là một lần dỡ-xếp lại của phương án): `foreign` — kiện của điểm
   * khác nằm trong vùng của điểm; `stray` — kiện của điểm nằm ngoài vùng của nó. `null` khi phương án không chia vùng.
   */
  readonly outOfZone: { readonly foreign: number; readonly stray: number } | null
}

/** Một phương án của bộ chọn A · B · C: chỉ số để so (`bestCandidates`, `id` là nhãn) và việc ở điểm giao đầu. */
export type LandingPlan = CandidateFigures & {
  readonly id: PlanLabel
  readonly objective: PlanObjective
  readonly result: OptimizationResult
  readonly firstStop: FirstStopFacts
}

function stopsOf(request: OptimizationRequest): ReadonlyMap<string, number> {
  return new Map(expandPackages(request.packages).instances.map((instance) => [instance.packageInstanceId, instance.deliveryStop]))
}

/** Việc ở điểm giao `stop` của phương án: số kiện dỡ, số kiện chắn lối phải dời, số kiện nằm ngoài vùng của điểm. */
export function firstStopFacts(request: OptimizationRequest, result: OptimizationResult, stop = UNLOAD_STOP): FirstStopFacts {
  const stopOf = stopsOf(request)
  const rankOf = (id: string) => {
    const rank = stopOf.get(id)
    if (rank === undefined) throw new Error(`Không có điểm giao cho kiện ${id}`)
    return rank
  }
  const mine = result.placements.filter((placement) => rankOf(placement.packageInstanceId) === stop)
  const ids = new Set(mine.map((placement) => placement.packageInstanceId))
  const { blocked, partial } = checkStopReorder(result.placements.map((placement) => ({ placement, rank: rankOf(placement.packageInstanceId) })))
  const moved = new Set([...blocked, ...partial].filter((blockage) => ids.has(blockage.packageInstanceId)).flatMap((blockage) => blockage.blockerIds))
  const zones = result.stopZones
  const own = zones?.find((zone) => zone.stopId === stop)
  if (!zones?.length || !own) return { count: mine.length, moved: moved.size, outOfZone: null }
  let foreign = 0, stray = 0
  for (const placement of result.placements) {
    const ofStop = ids.has(placement.packageInstanceId)
    const { zoneId } = locateInZones(zones, { xCm: placement.xCm, lengthCm: placement.placedLengthCm }, rankOf(placement.packageInstanceId))
    if (ofStop && zoneId !== own.id) stray += 1
    else if (!ofStop && zoneId === own.id) foreign += 1
  }
  return { count: mine.length, moved: moved.size, outOfZone: { foreign, stray } }
}

/** Ba phương án của một lần chạy, theo thứ tự A · B · C của lần chạy. */
export function landingPlans(request: OptimizationRequest, plans: readonly CandidatePlan[]): LandingPlan[] {
  return plans.map(({ objective, result }): LandingPlan => ({
    id: PLAN_LABELS[objective],
    objective,
    result,
    volumeUtilizationPercent: result.metrics.volumeUtilizationPercent,
    unplacedCount: result.metrics.unplacedCount,
    ...(result.metrics.rehandlingCount === undefined ? {} : { rehandlingCount: result.metrics.rehandlingCount }),
    axles: candidateAxles({ request, result }),
    firstStop: firstStopFacts(request, result),
  }))
}
