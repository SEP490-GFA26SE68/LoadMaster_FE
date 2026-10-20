/**
 * Đồng hồ của chuyện trong khung 3D trang giới thiệu: thời gian tính từ lúc chuyện bắt đầu, chỉ tiến khi có người gọi `tick`.
 * Thuần — không Three.js, không React, không hẹn giờ: nơi chạy chuyện (trang giới thiệu) tự gọi `tick` theo khung hình và tự giữ
 * lại khi khung bị che, khi tab ẩn, hoặc khi người xem bấm tạm dừng. Khung 3D chỉ đọc thời gian qua `StorySource`.
 */

/** Một nhịp tiến tối đa chừng này ms: tab vừa hiện lại hay máy giật một khung thì chuyện không nhảy cóc qua cả một pha. */
export const STORY_TICK_CAP_MS = 250

/** Lý do giữ chuyện lại: người xem bấm tạm dừng · khung lộ quá ít · tab đang ẩn. */
export type StoryHold = 'user' | 'offscreen' | 'hidden'

/**
 * `idle` chưa bắt đầu · `playing` đang chạy · `held` dừng vì khung bị che hoặc tab ẩn (tự chạy tiếp) · `paused` người xem bấm tạm
 * dừng · `ended` đã tới cuối (hoặc được đặt thẳng về cuối).
 */
export type StoryStatus = 'idle' | 'playing' | 'held' | 'paused' | 'ended'

/** Thứ khung 3D đọc: thời gian lúc này và một kênh báo mỗi khi thời gian đổi. */
export type StorySource = {
  time(): number
  subscribe(listener: () => void): () => void
}

export type StoryClock = {
  readonly durationMs: number
  /** ms tính từ lúc chuyện bắt đầu, trong 0…`durationMs` */
  time(): number
  status(): StoryStatus
  /** `idle` → chạy; trạng thái khác thì không làm gì */
  start(): void
  /** Tiến `min(STORY_TICK_CAP_MS, max(0, deltaMs))` khi đang chạy; trả `true` khi thời gian đổi. */
  tick(deltaMs: number): boolean
  /** Các lý do giữ là một tập hợp, thêm hay bỏ ở trạng thái nào cũng được. */
  hold(reason: StoryHold): void
  release(reason: StoryHold): void
  /** Về 0 và chạy lại (kể cả khi đã hết), giữ nguyên các lý do đang giữ. */
  restart(): void
  /** Đặt thẳng về cuối: giảm chuyển động, hoặc khi chuyện không cần chạy. */
  finish(): void
}

export function createStoryClock(durationMs: number): StoryClock {
  const duration = Math.max(0, durationMs)
  const holds = new Set<StoryHold>()
  let started = false
  let finished = false
  let elapsed = 0

  const status = (): StoryStatus => {
    if (!started) return 'idle'
    if (finished || elapsed >= duration) return 'ended'
    if (holds.has('user')) return 'paused'
    return holds.size > 0 ? 'held' : 'playing'
  }

  return {
    durationMs: duration,
    time: () => elapsed,
    status,
    start() {
      started = true
    },
    tick(deltaMs) {
      if (status() !== 'playing' || !(deltaMs > 0)) return false
      const next = Math.min(duration, elapsed + Math.min(STORY_TICK_CAP_MS, deltaMs))
      if (next === elapsed) return false
      elapsed = next
      return true
    },
    hold(reason) {
      holds.add(reason)
    },
    release(reason) {
      holds.delete(reason)
    },
    restart() {
      started = true
      finished = false
      elapsed = 0
    },
    finish() {
      started = true
      finished = true
      elapsed = duration
    },
  }
}
