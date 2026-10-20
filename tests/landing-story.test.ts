import { describe, expect, test } from 'vitest'
import { fillStep, LANDING_FILL_MS } from '@/features/viewer3d/landing-fill'
import { createStoryClock, STORY_TICK_CAP_MS } from '@/features/viewer3d/landing/story-clock'
import {
  laneArrival, laneDrop, LANE_DROP_M, loadedCount, phaseAt, STORY_MS, sweepFade, sweepX, ZONES_AT,
} from '@/features/viewer3d/landing/story-timeline'

describe('story clock', () => {
  test('stays idle until started, then plays and ends at its duration', () => {
    const clock = createStoryClock(1000)
    expect(clock.status()).toBe('idle')
    expect(clock.tick(100)).toBe(false)
    expect(clock.time()).toBe(0)
    clock.start()
    expect(clock.status()).toBe('playing')
    for (let i = 0; i < 4; i++) clock.tick(250)
    expect(clock.time()).toBe(1000)
    expect(clock.status()).toBe('ended')
    expect(clock.tick(100)).toBe(false)
    clock.start()
    expect(clock.status()).toBe('ended')
  })

  test('one tick advances at most the cap and never backwards', () => {
    const clock = createStoryClock(9000)
    clock.start()
    expect(clock.tick(5000)).toBe(true)
    expect(clock.time()).toBe(STORY_TICK_CAP_MS)
    expect(clock.tick(-40)).toBe(false)
    expect(clock.tick(0)).toBe(false)
    expect(clock.tick(Number.NaN)).toBe(false)
    expect(clock.time()).toBe(STORY_TICK_CAP_MS)
    clock.tick(16)
    expect(clock.time()).toBe(STORY_TICK_CAP_MS + 16)
  })

  test('holds form a set: paused only with a user hold, held with the others, playing when all are released', () => {
    const clock = createStoryClock(9000)
    clock.hold('offscreen')
    expect(clock.status()).toBe('idle')
    clock.start()
    expect(clock.status()).toBe('held')
    expect(clock.tick(100)).toBe(false)
    clock.hold('hidden')
    clock.hold('user')
    clock.hold('user')
    expect(clock.status()).toBe('paused')
    clock.release('user')
    expect(clock.status()).toBe('held')
    clock.release('offscreen')
    expect(clock.status()).toBe('held')
    clock.release('hidden')
    expect(clock.status()).toBe('playing')
    expect(clock.tick(100)).toBe(true)
    clock.release('user')
    expect(clock.status()).toBe('playing')
  })

  test('restart goes back to zero and plays again, keeping holds; finish jumps to the end', () => {
    const clock = createStoryClock(9000)
    clock.finish()
    expect(clock.time()).toBe(9000)
    expect(clock.status()).toBe('ended')
    clock.hold('user')
    clock.restart()
    expect(clock.time()).toBe(0)
    expect(clock.status()).toBe('paused')
    clock.release('user')
    expect(clock.status()).toBe('playing')
    clock.tick(200)
    clock.finish()
    expect(clock.time()).toBe(9000)
    expect(clock.status()).toBe('ended')
    const fresh = createStoryClock(9000)
    fresh.restart()
    expect(fresh.status()).toBe('playing')
  })
})

describe('story timeline', () => {
  test('phases follow the 2 / 2 / 5 s beats and the story lasts 9 s', () => {
    expect(STORY_MS).toBe(9000)
    expect(ZONES_AT).toBe(3400)
    expect([0, 1999, 2000, 3999, 4000, 8999, 9000, 12000].map(phaseAt))
      .toEqual(['intake', 'intake', 'optimize', 'optimize', 'loading', 'loading', 'ready', 'ready'])
  })

  test('the loaded count is fillStep of the loading phase, monotonic, and complete at the end', () => {
    expect(LANDING_FILL_MS).toBe(5000)
    let previous = 0
    for (let t = 0; t <= STORY_MS + 500; t += 37) {
      const count = loadedCount(366, t)
      expect(count).toBe(fillStep(366, t - 4000, LANDING_FILL_MS))
      expect(count).toBeGreaterThanOrEqual(previous)
      previous = count
    }
    expect(loadedCount(366, 3999)).toBe(0)
    expect(loadedCount(366, 4000)).toBe(0)
    expect(loadedCount(366, 4001)).toBe(1)
    expect(loadedCount(366, STORY_MS)).toBe(366)
    expect(loadedCount(366, STORY_MS - 1)).toBe(366)
  })

  test('lanes fill one after another, each layer drops half a metre in 250 ms, the last one lands at 1.74 s', () => {
    expect(laneArrival(0, 0)).toBe(200)
    expect(laneArrival(3, 0)).toBe(950)
    expect(laneArrival(3, 3)).toBe(1490)
    expect(laneDrop(0, 0, 0)).toBe(LANE_DROP_M)
    expect(laneDrop(0, 0, 200)).toBe(0.5)
    expect(laneDrop(0, 0, 325)).toBeCloseTo(0.0625, 10)
    expect(laneDrop(0, 0, 450)).toBe(0)
    expect(laneDrop(3, 3, 1739)).toBeGreaterThan(0)
    expect(laneDrop(3, 3, 1740)).toBe(0)
    for (let lane = 0; lane < 4; lane++) for (let layer = 0; layer < 4; layer++) expect(laneDrop(lane, layer, 1740)).toBe(0)
    let previous = Infinity
    for (let t = 1490; t <= 1740; t += 10) {
      const drop = laneDrop(3, 3, t)
      expect(drop).toBeLessThanOrEqual(previous)
      previous = drop
    }
  })

  test('the sweep runs from the front wall to the rear door between 2.2 and 3.4 s', () => {
    expect(sweepX(2199)).toBeNull()
    expect(sweepX(2200)).toBe(0)
    expect(sweepX(2800)).toBeCloseTo(3, 10)
    expect(sweepX(3400)).toBeCloseTo(6, 10)
    expect(sweepX(3401)).toBeNull()
    expect(sweepX(1000)).toBeNull()
    let previous = -1
    for (let t = 2200; t <= 3400; t += 25) {
      const x = sweepX(t)!
      expect(x).toBeGreaterThanOrEqual(previous)
      previous = x
    }
    expect(sweepFade(2100)).toBe(0)
    expect(sweepFade(2200)).toBe(0)
    expect(sweepFade(2800)).toBe(1)
    expect(sweepFade(3400)).toBe(0)
    expect(sweepFade(5000)).toBe(0)
  })
})
