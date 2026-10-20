import { useEffect, useState, useSyncExternalStore } from 'react'
import { createStoryClock, type StorySource, type StoryStatus } from '@/features/viewer3d/landing/story-clock'
import { loadedCount, phaseAt, STORY_MS, type StoryPhase } from '@/features/viewer3d/landing/story-timeline'

/** Trang đã mở chừng này ms thì chuyện mới bắt đầu: chữ của phần mở đầu hiện xong trước. */
const START_AFTER_MS = 1200
/** Kênh chậm (thẻ chuyến, nút, Lumo) báo tối đa 10 lần mỗi giây; trạng thái đổi thì báo ngay. */
const SLOW_MS = 100
/** Khung lộ từ 40 % thì chạy, dưới 20 % thì giữ lại; ở giữa giữ nguyên, để mép khung không làm chuyện chập chờn khi cuộn. */
const RUN_FROM = 0.4
const HOLD_BELOW = 0.2
const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1]

/** Pha mà thẻ chuyến và Lumo kể: `preparing` khi chuyện chưa bắt đầu. */
export type HeroPhase = 'preparing' | StoryPhase
type Snapshot = { readonly time: number; readonly status: StoryStatus }
type Inputs = { sample: boolean; frame: boolean; reduced: boolean }

/** Phần lộ của khung so với phần lộ được nhiều nhất (khung cao hơn cửa sổ thì so với cửa sổ). */
function shownRatio(entry: IntersectionObserverEntry): number {
  if (!entry.isIntersecting) return 0
  const base = Math.min(entry.boundingClientRect.height, entry.rootBounds?.height ?? Number.POSITIVE_INFINITY)
  return base > 0 ? entry.intersectionRect.height / base : entry.intersectionRatio
}

function createDriver() {
  const clock = createStoryClock(STORY_MS)
  const fast = new Set<() => void>()
  const slow = new Set<() => void>()
  const born = performance.now()
  const flags = { sample: false, frame: false, reduced: false, due: false, visible: typeof IntersectionObserver !== 'function', hidden: false }
  let snap: Snapshot = { time: 0, status: 'idle' }
  let sentAt = Number.NEGATIVE_INFINITY
  /** Thời gian đã báo trên kênh nhanh: kênh đó chỉ báo khi thời gian đổi — mỗi lần báo là khung 3D vẽ thêm một khung hình. */
  let fastTime = clock.time()
  let frame = 0
  let last = 0
  let live = false

  const publish = (force: boolean) => {
    const time = clock.time()
    if (time !== fastTime) {
      fastTime = time
      for (const listener of fast) listener()
    }
    const now = performance.now()
    const next: Snapshot = { time: clock.time(), status: clock.status() }
    if (next.time === snap.time && next.status === snap.status) return
    if (!force && next.status === snap.status && now - sentAt < SLOW_MS) return
    sentAt = now
    snap = next
    for (const listener of slow) listener()
  }
  const loop = (now: number) => {
    frame = 0
    const moved = clock.tick(now - last)
    last = now
    if (live && clock.status() === 'playing') frame = requestAnimationFrame(loop)
    if (moved) publish(clock.status() === 'ended')
  }
  /** Sau mọi thay đổi: bắt đầu (hay đặt thẳng về cuối khi giảm chuyển động) nếu đủ điều kiện, chạy hay dừng vòng khung hình, báo hai kênh. */
  const settle = () => {
    if (flags.sample && flags.reduced && clock.status() !== 'ended') clock.finish()
    if (clock.status() === 'idle' && flags.sample && flags.frame && flags.due && flags.visible && !flags.hidden) clock.start()
    const playing = live && clock.status() === 'playing'
    if (playing && frame === 0) {
      last = performance.now()
      frame = requestAnimationFrame(loop)
    }
    if (!playing && frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    publish(true)
  }

  return {
    /** Thời gian của chuyện cho khung 3D: báo mỗi khi thời gian đổi (mỗi khung hình lúc đang chạy), đứng yên thì không báo. */
    story: { time: () => clock.time(), subscribe: (listener) => { fast.add(listener); return () => { fast.delete(listener) } } } satisfies StorySource,
    subscribe: (listener: () => void) => { slow.add(listener); return () => { slow.delete(listener) } },
    snapshot: () => snap,
    /** Nút ba trạng thái: đang chạy (hay đang giữ vì khung bị che) → tạm dừng · tạm dừng → chạy tiếp · hết → chạy lại từ thùng rỗng. */
    toggle() {
      const status = clock.status()
      if (status === 'ended') {
        clock.release('user')
        clock.restart()
      } else if (status === 'paused') clock.release('user')
      else if (status !== 'idle') clock.hold('user')
      settle()
    },
    /** Ref callback của khung: một IntersectionObserver giữ chuyện lại khi khung lộ dưới 20 %, chạy tiếp từ 40 %. */
    observe(el: HTMLElement | null) {
      if (!el || typeof IntersectionObserver !== 'function') return
      const observer = new IntersectionObserver((entries) => {
        const ratio = shownRatio(entries[entries.length - 1]!)
        if (ratio >= RUN_FROM - 1e-3) clock.release('offscreen')
        else if (ratio < HOLD_BELOW) clock.hold('offscreen')
        else return
        flags.visible = ratio >= RUN_FROM - 1e-3
        settle()
      }, { threshold: THRESHOLDS })
      observer.observe(el)
      return () => observer.disconnect()
    },
    connect() {
      live = true
      const timer = window.setTimeout(() => { flags.due = true; settle() }, Math.max(0, START_AFTER_MS - (performance.now() - born)))
      const handleVisibility = () => {
        flags.hidden = document.hidden
        if (flags.hidden) clock.hold('hidden')
        else clock.release('hidden')
        settle()
      }
      document.addEventListener('visibilitychange', handleVisibility)
      handleVisibility()
      return () => {
        live = false
        window.clearTimeout(timer)
        document.removeEventListener('visibilitychange', handleVisibility)
        settle()
      }
    },
    update(inputs: Inputs) {
      Object.assign(flags, inputs)
      settle()
    },
  }
}

export type StoryDriver = ReturnType<typeof createDriver>

/**
 * Người chạy chuyện của khung 3D trang giới thiệu: một đồng hồ `story-clock` và một vòng `requestAnimationFrame` chỉ chạy khi chuyện đang
 * chạy. Bắt đầu khi phương án mẫu đã tính, khung hình đầu đã vẽ, khung lộ từ 40 % và trang đã mở 1,2 giây; giữ lại khi khung lộ dưới
 * 20 %, khi tab ẩn, hoặc khi người xem bấm tạm dừng. Không có IntersectionObserver thì coi khung luôn lộ. Giảm chuyển động: đặt thẳng về
 * cuối ngay khi phương án đã tính. Hai kênh: `story` mỗi khung hình (khung 3D), `subscribe` tối đa 10 lần mỗi giây (thẻ chuyến, Lumo, nút).
 */
export function useStoryDriver({ sampleReady, frameReady, reducedMotion }: { sampleReady: boolean; frameReady: boolean; reducedMotion: boolean }): StoryDriver {
  const [driver] = useState(createDriver)
  useEffect(() => driver.connect(), [driver])
  useEffect(() => driver.update({ sample: sampleReady, frame: frameReady, reduced: reducedMotion }), [driver, sampleReady, frameReady, reducedMotion])
  return driver
}

export function useStoryStatus(driver: StoryDriver): StoryStatus {
  return useSyncExternalStore(driver.subscribe, () => driver.snapshot().status)
}

export function useStoryPhase(driver: StoryDriver): HeroPhase {
  return useSyncExternalStore(driver.subscribe, () => {
    const { status, time } = driver.snapshot()
    return status === 'idle' ? 'preparing' : phaseAt(time)
  })
}

/** Số kiện đang nằm trong thùng theo thời gian của kênh chậm (thẻ chuyến). */
export function useStoryLoaded(driver: StoryDriver, total: number): number {
  return useSyncExternalStore(driver.subscribe, () => loadedCount(total, driver.snapshot().time))
}
