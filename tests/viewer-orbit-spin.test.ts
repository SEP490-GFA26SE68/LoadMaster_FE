import { describe, expect, test } from 'vitest'
import { ORBIT_SPIN_MAX_DT, ORBIT_SPIN_MS, orbitSpinStep } from '@/features/viewer3d/scene/orbit-spin'

const TURN = Math.PI * 2

function spin(frameSeconds: number) {
  let rotated = 0, frames = 0
  for (;;) {
    const { step, done } = orbitSpinStep(rotated, frameSeconds)
    rotated += step
    frames++
    if (done || frames > 100_000) return { rotated, frames }
  }
}

describe('orbitSpinStep', () => {
  test('a full spin takes between 8 and 10 seconds of real time', () => {
    expect(ORBIT_SPIN_MS).toBeGreaterThanOrEqual(8_000)
    expect(ORBIT_SPIN_MS).toBeLessThanOrEqual(10_000)
  })

  test('steps at 60 FPS add up to exactly one turn, in about ORBIT_SPIN_MS', () => {
    const { rotated, frames } = spin(1 / 60)
    expect(rotated).toBe(TURN)
    expect(frames).toBeGreaterThanOrEqual(Math.floor((ORBIT_SPIN_MS / 1000) * 60))
    expect(frames).toBeLessThanOrEqual(Math.ceil((ORBIT_SPIN_MS / 1000) * 60) + 1)
  })

  test('an uneven frame rate still ends on exactly one turn', () => {
    let rotated = 0, i = 0
    for (;;) {
      const { step, done } = orbitSpinStep(rotated, [0.016, 0.033, 0.007, 0.05][i++ % 4]!)
      rotated += step
      if (done) break
    }
    expect(rotated).toBe(TURN)
  })

  test('a long frame (tab hidden, slow machine) is clamped so the camera does not jump', () => {
    expect(orbitSpinStep(0, 2).step).toBeCloseTo((TURN * ORBIT_SPIN_MAX_DT * 1000) / ORBIT_SPIN_MS)
    expect(orbitSpinStep(0, 2).done).toBe(false)
  })

  test('a zero or negative frame does not move; the last step lands on the turn and reports done', () => {
    expect(orbitSpinStep(1, 0)).toEqual({ step: 0, done: false })
    expect(orbitSpinStep(1, -1)).toEqual({ step: 0, done: false })
    const last = orbitSpinStep(TURN - 1e-4, 0.05)
    expect(last).toEqual({ step: TURN - (TURN - 1e-4), done: true })
  })
})
