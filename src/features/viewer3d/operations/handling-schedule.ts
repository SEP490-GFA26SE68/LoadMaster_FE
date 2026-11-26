import { loadingPass, MANUAL_HANDLING, unloadingPass, type HandlingPass } from '@/domain/handling'
import type { ScenePlacement } from '../scene-types'
import { toPackagePlacement, unloadSequence } from './unloading'

export type LoadingTiming = HandlingPass & {
  /** Giây thật của kiện có `step` = khoá */
  readonly secondsByStep: ReadonlyMap<number, number>
}

export type UnloadingTiming = HandlingPass & {
  /** Giây thật của bước dỡ kiện có mã = khoá, gồm phần dời kiện chắn tính cho nó */
  readonly secondsById: ReadonlyMap<string, number>
}

/** Thời gian thật ước tính của hai lượt xếp và dỡ trên một bản placement; mỗi lượt chỉ tính ở lần hỏi đầu. */
export type PlannerTiming = {
  loading(): LoadingTiming
  unloading(): UnloadingTiming
}

const itemOf = (p: ScenePlacement) => ({ placement: toPackagePlacement(p), stop: p.stop })

/**
 * Lịch thời gian thật của Planner (Spec vật lý 10.1, 10.3) theo giả định bốc tay `MANUAL_HANDLING` (chưa xác nhận — màn ghi là
 * ước tính). **Lười** như `createLifoIndex`: lượt dỡ dựng lưới domain để tìm kiện chắn, nên chỉ tính khi đang dỡ hoặc khi hộp Chi
 * tiết cần thời gian dỡ từng điểm. Lượt dỡ đi theo đúng thứ tự `unloadSequence` mà mô phỏng dỡ dùng.
 */
export function createPlannerTiming(placements: readonly ScenePlacement[], innerLengthCm: number): PlannerTiming {
  let loading: LoadingTiming | undefined
  let unloading: UnloadingTiming | undefined
  return {
    loading() {
      if (loading) return loading
      const ordered = [...placements].sort((a, b) => a.step - b.step || a.id.localeCompare(b.id))
      const pass = loadingPass(ordered.map(itemOf), innerLengthCm)
      const secondsByStep = new Map<number, number>()
      ordered.forEach((p, index) => secondsByStep.set(p.step, (secondsByStep.get(p.step) ?? 0) + pass.stepSeconds[index]!))
      return (loading = { ...pass, secondsByStep })
    },
    unloading() {
      if (unloading) return unloading
      const { ordered } = unloadSequence(placements)
      const pass = unloadingPass(ordered.map(itemOf), innerLengthCm)
      return (unloading = { ...pass, secondsById: new Map(ordered.map((p, index) => [p.id, pass.stepSeconds[index]!])) })
    },
  }
}

/** Khoảng chờ giữa hai bước khi phát: giây thật của bước kế tiếp ÷ hệ số. Thiếu số (không có kiện ở bước đó) thì dùng t_h. */
export function playbackDelayMs(seconds: number | undefined, timeScale: number): number {
  return ((seconds ?? MANUAL_HANDLING.handlingSeconds) * 1000) / timeScale
}
