import { PLAN_LABELS, type PlanLabel } from '@/domain/models'
import { DEFAULT_OBJECTIVE } from '../landing-plans'
import { LANDING_STOP_COUNT } from '../landing-sample.mock'

/**
 * Trạng thái của trang `/phuong-an-mau` nằm trên URL để chia sẻ: mở link là ra đúng cảnh. Tham số là slug tiếng Việt không dấu —
 * `phuong-an` (a · b · c), `che-do` (`xep` xếp theo thứ tự xếp · `do` dỡ ở một điểm), `diem` (1–4, điểm đang dỡ), `goc` (góc nhìn).
 * Giá trị lạ hay thiếu thì về mặc định, không báo lỗi. Thuần, có test.
 */
export type SampleMode = 'load' | 'unload'
export const SAMPLE_VIEWS = ['goc-cheo', 'cua-sau', 'ben-hong', 'tren'] as const
export type SampleView = (typeof SAMPLE_VIEWS)[number]

export type SamplePlanState = {
  readonly plan: PlanLabel
  readonly mode: SampleMode
  /** Điểm giao đang dỡ (1 → số điểm của chuyến mẫu); ở chế độ xếp vẫn giữ để đổi sang dỡ thì về đúng điểm vừa xem. */
  readonly stop: number
  readonly view: SampleView
}

export const SAMPLE_PARAMS = { plan: 'phuong-an', mode: 'che-do', stop: 'diem', view: 'goc' } as const
const MODE_SLUGS: Record<SampleMode, string> = { load: 'xep', unload: 'do' }

export const DEFAULT_SAMPLE_STATE: SamplePlanState = { plan: PLAN_LABELS[DEFAULT_OBJECTIVE], mode: 'load', stop: 1, view: 'goc-cheo' }

const PLAN_SET = new Set<string>(Object.values(PLAN_LABELS))

function readPlan(value: string | null): PlanLabel {
  const upper = value?.trim().toUpperCase() ?? ''
  return PLAN_SET.has(upper) ? (upper as PlanLabel) : DEFAULT_SAMPLE_STATE.plan
}

function readStop(value: string | null): number {
  if (value === null || !/^\d+$/.test(value.trim())) return DEFAULT_SAMPLE_STATE.stop
  const stop = Number(value)
  return stop >= 1 && stop <= LANDING_STOP_COUNT ? stop : DEFAULT_SAMPLE_STATE.stop
}

export function readSampleState(search: URLSearchParams): SamplePlanState {
  const mode = search.get(SAMPLE_PARAMS.mode) === MODE_SLUGS.unload ? 'unload' : 'load'
  const view = search.get(SAMPLE_PARAMS.view)
  return {
    plan: readPlan(search.get(SAMPLE_PARAMS.plan)),
    mode,
    stop: readStop(search.get(SAMPLE_PARAMS.stop)),
    view: (SAMPLE_VIEWS as readonly string[]).includes(view ?? '') ? (view as SampleView) : DEFAULT_SAMPLE_STATE.view,
  }
}

/**
 * Tham số của một trạng thái: luôn có phương án và chế độ (link đọc được ngay), điểm khi dỡ hay khi khác điểm 1 (xem xếp rồi quay lại dỡ
 * vẫn đúng điểm vừa xem), góc nhìn chỉ khi khác mặc định.
 */
export function sampleSearch(state: SamplePlanState): URLSearchParams {
  const search = new URLSearchParams()
  search.set(SAMPLE_PARAMS.plan, state.plan.toLowerCase())
  search.set(SAMPLE_PARAMS.mode, MODE_SLUGS[state.mode])
  if (state.mode === 'unload' || state.stop !== DEFAULT_SAMPLE_STATE.stop) search.set(SAMPLE_PARAMS.stop, String(state.stop))
  if (state.view !== DEFAULT_SAMPLE_STATE.view) search.set(SAMPLE_PARAMS.view, state.view)
  return search
}

/** URL của trang sau khi đổi trạng thái: thay đúng bốn tham số của trang, giữ tham số khác (`lang`, `debug`). */
export function withSampleState(current: URLSearchParams, state: SamplePlanState): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const key of Object.values(SAMPLE_PARAMS)) next.delete(key)
  sampleSearch(state).forEach((value, key) => next.set(key, value))
  return next
}
