import { render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { PerfSample } from './PerfProbe'

/** R3F giả: một khung là `useFrame` rồi `addAfterEffect`, như vòng lặp thật; cảnh luôn xin khung kế (đang chuyển động). */
const r3f = vi.hoisted(() => ({
  frame: null as null | (() => void),
  after: null as null | (() => void),
  state: {
    frameloop: 'demand',
    internal: { frames: 1 },
    viewport: { dpr: 1 },
    gl: { info: { render: { calls: 20, triangles: 1000 } }, getPixelRatio: () => 1 },
  },
}))
vi.mock('@react-three/fiber', () => ({
  useThree: <T,>(selector: (state: { get: () => typeof r3f.state }) => T) => selector({ get: () => r3f.state }),
  useFrame: (callback: () => void) => { r3f.frame = callback },
  addAfterEffect: (callback: () => void) => { r3f.after = callback; return () => { r3f.after = null } },
}))

const { PerfProbe, SETTLE_MS } = await import('./PerfProbe')

let visibility: DocumentVisibilityState = 'visible'
function setVisibility(next: DocumentVisibilityState) {
  visibility = next
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Vẽ khung mỗi `stepMs` trong `durationMs` (đồng hồ giả: `performance.now` và `setInterval` cùng chạy). */
function drawFor(durationMs: number, stepMs = 16) {
  for (let t = 0; t < durationMs; t += stepMs) {
    r3f.frame?.()
    r3f.after?.()
    vi.advanceTimersByTime(stepMs)
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})
afterEach(() => {
  vi.useRealTimers()
  visibility = 'visible'
  Reflect.deleteProperty(document, 'visibilityState')
})

test('the gap while the tab was hidden is never a slow frame, and nothing is sampled while hidden', () => {
  const samples: PerfSample[] = []
  const onRest = vi.fn()
  render(<PerfProbe onSample={(sample) => samples.push(sample)} onRest={onRest} placementCount={1000} qualityTier="high" />)
  drawFor(SETTLE_MS + 1500)
  const steady = samples.at(-1)!
  expect(steady).toMatchObject({ idle: false, settling: false })
  expect(steady.frameTimeMs).toBeCloseTo(16, 0)

  // Tab ẩn giữa lúc cảnh đang chạy: trình duyệt ngưng khung hình (hoặc thưa còn 1 khung / giây)
  setVisibility('hidden')
  const before = samples.length
  vi.advanceTimersByTime(10_000)
  drawFor(5_000, 1_000)
  expect(samples.length, 'no sample while hidden').toBe(before)
  expect(onRest).not.toHaveBeenCalled()

  // Hiện lại: khoảng hở tới khung trước không phải thời gian vẽ, và vài khung đầu nằm trong quãng ổn định
  setVisibility('visible')
  drawFor(SETTLE_MS + 1500)
  const after = samples.slice(before)
  expect(after.length).toBeGreaterThan(0)
  for (const sample of after) expect(sample.frameTimeMs ?? 0, JSON.stringify(sample)).toBeLessThan(28)
  expect(after.filter((sample) => !sample.settling).at(0)?.frameTimeMs).toBeCloseTo(16, 0)
})
