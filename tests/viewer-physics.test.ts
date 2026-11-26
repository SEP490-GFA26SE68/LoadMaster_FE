import { expect, test } from 'vitest'
import { cargoAtStep } from '@/features/viewer3d/operations/cargo-at-step'
import { GRAVITY_MARK_FLOATS, writeGravityMark } from '@/features/viewer3d/operations/gravity-mark'
import { formatDuration } from '@/features/viewer3d/operations/handling-format'
import { createPlannerTiming, playbackDelayMs } from '@/features/viewer3d/operations/handling-schedule'
import { createTranslator } from '@/lib/i18n'
import { createFormatter } from '@/lib/format'
import { sceneBox } from '@/test/scene'

// Hai khối 1 m³ trong thùng dài 400 cm — cùng hình với ví dụ của `@/domain/handling`: A (điểm 1) sâu trong cùng, B (điểm 2) ngay sau
// A phía cửa nên chắn lối dỡ A. Số giây là số đã kiểm bằng máy ở test domain: d(A) = 3,5 m → 9,7083 s, d(B) = 2,5 m → 8,4583 s.
const metre = { lengthCm: 100, widthCm: 100, heightCm: 100, unloadingOrder: 0 }
const a = sceneBox('A', 0, 0, 0, { ...metre, stop: 1, step: 2 })
const b = sceneBox('B', 100, 0, 0, { ...metre, stop: 2, step: 1 })

test('Planner timing: each loading step is its own handling time; unloading A also carries the blocker B out and back', () => {
  const timing = createPlannerTiming([a, b], 400)
  expect(timing.loading().secondsByStep.get(1)).toBeCloseTo(8.4583, 4)
  expect(timing.loading().secondsByStep.get(2)).toBeCloseTo(9.7083, 4)
  expect(timing.loading().totalSeconds).toBeCloseTo(18.1667, 4)
  expect(timing.unloading().secondsById.get('A')).toBeCloseTo(26.625, 3)
  expect(timing.unloading().secondsById.get('B')).toBeCloseTo(8.4583, 4)
  expect(timing.unloading().stops.map((stop) => [stop.stop, stop.moved])).toStrictEqual([[1, 1], [2, 0]])
  expect(timing.unloading()).toBe(timing.unloading())
})

test('playback waits real seconds ÷ factor; a step without a package waits the handling time', () => {
  expect(playbackDelayMs(20, 10)).toBe(2000)
  expect(playbackDelayMs(8.4583, 1)).toBeCloseTo(8458.3, 1)
  expect(playbackDelayMs(undefined, 10)).toBe(400)
})

test('cargo at the viewed step: loaded so far while loading, not yet unloaded while unloading, otherwise the whole plan', () => {
  const c = sceneBox('C', 200, 0, 0, { stop: 2, step: 3 })
  const all = [a, b, c]
  const loading = { kind: 'loading', totalSteps: 3, unloadedIds: new Set<string>(), unloadTotal: 3 } as const
  expect(cargoAtStep(all, { ...loading, step: 1 })).toStrictEqual({ placements: [b], at: { step: 1, total: 3 } })
  expect(cargoAtStep(all, { ...loading, step: 3 })).toStrictEqual({ placements: all, at: null })
  const unloading = { ...loading, kind: 'unloading', step: 0 } as const
  expect(cargoAtStep(all, unloading)).toStrictEqual({ placements: all, at: null })
  expect(cargoAtStep(all, { ...unloading, unloadedIds: new Set(['B']) })).toStrictEqual({ placements: [a, c], at: { step: 1, total: 3 } })
})

test('G mark: a vertical from the floor to G, a cross at its foot, a line to the body centre and a cross there (scene units)', () => {
  const out = writeGravityMark(new Float32Array(GRAVITY_MARK_FLOATS), { x: 200, y: 100, z: 50 }, { innerLengthCm: 400, innerWidthCm: 240 })
  const segments = Array.from({ length: 6 }, (_, i) => Array.from(out.slice(i * 6, i * 6 + 6), (v) => Math.round(v * 1000) / 1000))
  expect(segments).toStrictEqual([
    [2, 0.01, 1, 2, 0.5, 1],
    [1.9, 0.01, 1, 2.1, 0.01, 1],
    [2, 0.01, 0.9, 2, 0.01, 1.1],
    [2, 0.01, 1, 2, 0.01, 1.2],
    [1.9, 0.01, 1.2, 2.1, 0.01, 1.2],
    [2, 0.01, 1.1, 2, 0.01, 1.3],
  ])
})

test('estimated durations read in whole seconds, minutes and hours', () => {
  const t = createTranslator('vi')
  const format = createFormatter('vi-VN')
  expect(formatDuration(44.6, t, format)).toBe('45 giây')
  expect(formatDuration(180, t, format)).toBe('3 phút')
  expect(formatDuration(200.2, t, format)).toBe('3 phút 20 giây')
  expect(formatDuration(3900, t, format)).toBe('1 giờ 5 phút')
})
