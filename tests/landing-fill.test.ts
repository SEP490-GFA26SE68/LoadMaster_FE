import { expect, test } from 'vitest'
import { fillStep, LANDING_FILL_MS } from '@/features/viewer3d/landing-fill'

test('the landing fill reveals packages evenly over time and stops at the total', () => {
  expect(fillStep(210, 0)).toBe(0)
  expect(fillStep(210, -5)).toBe(0)
  expect(fillStep(210, 1)).toBe(1)
  expect(fillStep(210, LANDING_FILL_MS / 2)).toBe(105)
  expect(fillStep(210, LANDING_FILL_MS)).toBe(210)
  expect(fillStep(210, LANDING_FILL_MS * 4)).toBe(210)
})

test('a slow machine still finishes on time: the step only depends on elapsed time, never on frame count', () => {
  // 20 khung một giây: mỗi khung cách 50 ms, kiện cuối hiện đúng lúc hết thời gian xếp
  const frames = Array.from({ length: LANDING_FILL_MS / 50 + 1 }, (_, i) => fillStep(210, i * 50))
  expect(frames.at(-1)).toBe(210)
  expect(frames.every((step, i) => i === 0 || step >= frames[i - 1]!)).toBe(true)
  expect(fillStep(0, 500)).toBe(0)
  expect(fillStep(12, 500, 0)).toBe(12)
})
