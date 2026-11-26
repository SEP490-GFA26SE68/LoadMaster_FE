import { expect, test } from 'vitest'
import {
  carryDistanceCm,
  carrySeconds,
  freeFallDropM,
  freeFallSeconds,
  loadingPass,
  MANUAL_HANDLING,
  packageHandlingSeconds,
  unloadingPass,
} from '@/domain/handling'
import { placed } from '@/test/placements'

// Số kỳ vọng lấy từ ví dụ của Spec vật lý mục 10.1, đã chạy lại bằng máy (node) trước khi ghi vào đây.

test('free fall: h = 1 m takes about 0.45 s and h = 5 cm about 0.10 s; nothing to fall takes 0', () => {
  expect(freeFallSeconds(1)).toBeCloseTo(0.4515, 4)
  expect(freeFallSeconds(0.05)).toBeCloseTo(0.101, 3)
  expect([freeFallSeconds(0), freeFallSeconds(-0.2)]).toStrictEqual([0, 0])
})

test('free fall drop grows with the square of time and lands exactly at the fall time', () => {
  expect(freeFallDropM(freeFallSeconds(1))).toBeCloseTo(1, 9)
  expect(freeFallDropM(0.2)).toBeCloseTo(0.1962, 9)
  expect(freeFallDropM(0)).toBe(0)
})

test('trapezoid carry with v = 0.8 m/s, a = 0.6 m/s²: 3 m takes about 5.08 s, 0.5 m about 1.83 s', () => {
  expect(carrySeconds(3)).toBeCloseTo(5.0833, 4)
  expect(carrySeconds(0.5)).toBeCloseTo(1.8257, 4)
  expect(carrySeconds(0)).toBe(0)
})

test('both trapezoid branches agree at d = v²/a, so the time never jumps', () => {
  const { maxSpeedMps: v, accelerationMps2: a } = MANUAL_HANDLING
  expect(carrySeconds((v * v) / a)).toBeCloseTo(2.6667, 4)
  expect(carrySeconds((v * v) / a - 1e-9)).toBeCloseTo(carrySeconds((v * v) / a), 6)
})

test('carry distance runs from the package centre to the rear door plane along X and never goes negative', () => {
  expect(carryDistanceCm({ xCm: 0, placedLengthCm: 100 }, 400)).toBe(350)
  expect(carryDistanceCm({ xCm: 350, placedLengthCm: 100 }, 400)).toBe(0)
})

test('one package costs the handling time plus the carry time', () => {
  expect(packageHandlingSeconds(300)).toBeCloseTo(4 + 5.0833, 4)
})

// Xe 400 cm. A (điểm 1) nằm sâu nhất, B (điểm 2) che kín mặt sau A — phương án xấu để có một kiện phải dời.
const deep = placed('A', [0, 0, 0], [100, 100, 100])
const behind = placed('B', [100, 0, 0], [100, 100, 100])
const sideways = placed('C', [100, 150, 0], [100, 100, 100])

test('unloading a stop counts each blocking later-stop package once, as two extra carries of its own', () => {
  const pass = unloadingPass([{ placement: deep, stop: 1 }, { placement: behind, stop: 2 }], 400)
  // A: 4 + t(3,5 m) = 9,7083 s; B: 4 + t(2,5 m) = 8,4583 s; điểm 1 = A + 2·B
  expect(pass.stepSeconds[0]).toBeCloseTo(26.625, 4)
  expect(pass.stepSeconds[1]).toBeCloseTo(8.4583, 4)
  expect(pass.stops).toStrictEqual([
    { stop: 1, count: 1, moved: 1, seconds: pass.stepSeconds[0] },
    { stop: 2, count: 1, moved: 0, seconds: pass.stepSeconds[1] },
  ])
  expect(pass.totalSeconds).toBeCloseTo(35.0833, 4)
})

test('a package that is not in the straight corridor to the door is never moved', () => {
  const pass = unloadingPass([{ placement: deep, stop: 1 }, { placement: sideways, stop: 2 }], 400)
  expect(pass.stops.map((stop) => stop.moved)).toStrictEqual([0, 0])
  expect(pass.stepSeconds[0]).toBeCloseTo(9.7083, 4)
})

test('a blocker is moved once per stop even when it blocks several packages of that stop', () => {
  const deep2 = placed('A2', [0, 0, 100], [100, 100, 100])
  const tall = placed('T', [100, 0, 0], [100, 100, 200])
  const pass = unloadingPass([{ placement: deep, stop: 1 }, { placement: deep2, stop: 1 }, { placement: tall, stop: 2 }], 400)
  expect(pass.stops[0]?.moved).toBe(1)
  expect(pass.totalSeconds).toBeCloseTo(9.7083 * 2 + 8.4583 * 3, 3)
})

test('loading never moves anything: each step is the handling time plus its own carry', () => {
  const pass = loadingPass([{ placement: deep, stop: 1 }, { placement: behind, stop: 2 }], 400)
  expect(pass.stepSeconds[0]).toBeCloseTo(9.7083, 4)
  expect(pass.stops.map((stop) => stop.moved)).toStrictEqual([0, 0])
  expect(pass.totalSeconds).toBeCloseTo(18.1667, 4)
})
