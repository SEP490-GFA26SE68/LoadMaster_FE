import { createPlacementLayout, lifoIssues } from '@/domain/constraints'
import type { PackagePlacement } from '@/domain/models'
import { carryDistanceCm, MANUAL_HANDLING, packageHandlingSeconds, type HandlingAssumptions } from './handling-time'

/** Một kiện trong lượt xếp / dỡ: chỗ đặt và số điểm giao (1-based). */
export type HandledPackage = {
  readonly placement: PackagePlacement
  readonly stop: number
}

export type StopHandlingTime = {
  readonly stop: number
  /** Số kiện của điểm giao trong lượt */
  readonly count: number
  /** Số kiện giao sau phải dời ra rồi xếp lại để lấy kiện của điểm này (chỉ lượt dỡ) */
  readonly moved: number
  /** T_s, giây */
  readonly seconds: number
}

export type HandlingPass = {
  /** Thời gian của từng bước, cùng thứ tự với đầu vào; bước dỡ gồm cả phần dời kiện chắn được tính cho nó. */
  readonly stepSeconds: readonly number[]
  /** Theo thứ tự điểm giao xuất hiện trong lượt */
  readonly stops: readonly StopHandlingTime[]
  readonly totalSeconds: number
}

type StopAcc = { count: number; moved: number; seconds: number }

function summarize(items: readonly HandledPackage[], stepSeconds: number[], movedByStep: number[]): HandlingPass {
  const stops = new Map<number, StopAcc>()
  items.forEach(({ stop }, index) => {
    const acc = stops.get(stop) ?? { count: 0, moved: 0, seconds: 0 }
    acc.count++
    acc.moved += movedByStep[index] ?? 0
    acc.seconds += stepSeconds[index] ?? 0
    stops.set(stop, acc)
  })
  return {
    stepSeconds,
    stops: [...stops].map(([stop, acc]) => ({ stop, ...acc })),
    totalSeconds: stepSeconds.reduce((sum, seconds) => sum + seconds, 0),
  }
}

/** Lượt xếp theo thứ tự đã cho: mỗi kiện t_h + t_ngang(dᵢ), không kiện nào phải dời (xếp đúng thứ tự thì không chắn nhau). */
export function loadingPass(
  items: readonly HandledPackage[], bodyLengthCm: number, assumptions: HandlingAssumptions = MANUAL_HANDLING,
): HandlingPass {
  const stepSeconds = items.map(({ placement }) => packageHandlingSeconds(carryDistanceCm(placement, bodyLengthCm), assumptions))
  return summarize(items, stepSeconds, items.map(() => 0))
}

/**
 * Lượt dỡ theo thứ tự dỡ đã cho (Spec mục 10.1): T_s = Σᵢ∈s (t_h + t_ngang(dᵢ)) + Σ_{kiện phải dời} 2·(t_h + t_ngang(dⱼ)).
 *
 * **Kiện phải dời** ở điểm s: kiện giao **sau** s nằm trên hành lang thẳng từ mặt sau một kiện của s ra cửa — `relatedIds`
 * của `lifoIssues` (che kín lẫn che một phần: bê thẳng ra phải dọn cả hai). Mỗi kiện chắn tính **một lần cho mỗi điểm**
 * (dời ra, xếp lại chỗ cũ = hai lượt bê của chính nó), gán vào bước dỡ đầu tiên nó chắn, nên tổng các bước bằng T_s. Kiện đã dỡ
 * gỡ khỏi lưới; kiện đã dời thì xếp lại nên vẫn chắn ở điểm sau. Đây là đo khả năng lấy hàng theo hình học — khác "dỡ-xếp lại"
 * theo vùng điểm giao (`rehandlingCount`).
 */
export function unloadingPass(
  items: readonly HandledPackage[], bodyLengthCm: number, assumptions: HandlingAssumptions = MANUAL_HANDLING,
): HandlingPass {
  const layout = createPlacementLayout({ obstacles: [] }, items.map((item) => item.placement))
  const rules = {
    deliveryStopByInstanceId: new Map(items.map((item) => [item.placement.packageInstanceId, item.stop])),
    enforceLifo: true,
  }
  const secondsOf = (placement: PackagePlacement) =>
    packageHandlingSeconds(carryDistanceCm(placement, bodyLengthCm), assumptions)
  const movedAtStop = new Map<number, Set<string>>()
  const stepSeconds: number[] = []
  const movedByStep: number[] = []
  for (const { placement, stop } of items) {
    const moved = movedAtStop.get(stop) ?? new Set<string>()
    movedAtStop.set(stop, moved)
    let seconds = secondsOf(placement)
    let count = 0
    for (const issue of lifoIssues(placement, rules, layout)) {
      for (const id of issue.relatedIds ?? []) {
        if (moved.has(id)) continue
        moved.add(id)
        count++
        seconds += 2 * secondsOf(layout.placements.get(id)!)
      }
    }
    stepSeconds.push(seconds)
    movedByStep.push(count)
    layout.grid.remove(placement.packageInstanceId)
  }
  return summarize(items, stepSeconds, movedByStep)
}
