import { describe, expect, test } from 'vitest'
import { fillStep, LANDING_FILL_MS } from '@/features/viewer3d/landing-fill'
import { createStoryClock, STORY_TICK_CAP_MS } from '@/features/viewer3d/landing/story-clock'
import { EXHAUST_AT, PUFFS, puffAt, SMOKE_END, SMOKE_START, smokeActive } from '@/features/viewer3d/landing/exhaust-smoke'
import {
  DEPART_AT, DEPART_M, departDistance, departPitch, doorsShut, ENGINE_AT, laneArrival, laneDrop, LANE_DROP_M, loadedCount, phaseAt,
  READY_AT, ROLL_AT, ROLL_MS, STORY_MS, sweepFade, sweepX, ZONES_AT,
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

  test('finish can stop at a given moment (reduced motion stops at ready), clamped to the story', () => {
    const clock = createStoryClock(STORY_MS)
    clock.finish(READY_AT)
    expect(clock.time()).toBe(9000)
    expect(clock.status()).toBe('ended')
    expect(clock.tick(100)).toBe(false)
    clock.finish(-50)
    expect(clock.time()).toBe(0)
    expect(clock.status()).toBe('ended')
    clock.finish(STORY_MS + 1000)
    expect(clock.time()).toBe(STORY_MS)
    clock.restart()
    expect(clock.time()).toBe(0)
    expect(clock.status()).toBe('playing')
  })
})

describe('story timeline', () => {
  test('phases follow the 2 / 2 / 5 / 2 / 4 s beats and the story lasts 15 s', () => {
    expect(STORY_MS).toBe(15000)
    expect(ZONES_AT).toBe(3400)
    expect(READY_AT).toBe(9000)
    expect(DEPART_AT).toBe(11000)
    expect([0, 1999, 2000, 3999, 4000, 8999, 9000, 10999, 11000, 15000].map(phaseAt))
      .toEqual(['intake', 'intake', 'optimize', 'optimize', 'loading', 'loading', 'ready', 'ready', 'depart', 'depart'])
  })

  test('depart: doors shut first, the engine starts, then the truck rolls 1.3 m forward smoothly and stands still before the end', () => {
    expect([READY_AT, DEPART_AT - 1, DEPART_AT, STORY_MS].map(doorsShut)).toEqual([false, false, true, true])
    expect(DEPART_AT).toBeLessThan(ENGINE_AT)
    expect(ENGINE_AT).toBeLessThan(ROLL_AT)
    expect(DEPART_M).toBe(1.3)
    for (const t of [0, READY_AT, DEPART_AT, ROLL_AT]) expect(departDistance(t)).toBe(0)
    expect(departDistance(ROLL_AT + ROLL_MS / 2)).toBeCloseTo(0.65, 10)
    expect(departDistance(ROLL_AT + ROLL_MS)).toBeCloseTo(DEPART_M, 10)
    expect(departDistance(STORY_MS)).toBeCloseTo(DEPART_M, 10)
    let previous = 0
    for (let t = ROLL_AT; t <= STORY_MS; t += 20) {
      const distance = departDistance(t)
      expect(distance).toBeGreaterThanOrEqual(previous)
      expect(distance - previous).toBeLessThan(0.025)
      previous = distance
    }
  })

  test('depart pitch: the nose lifts on launch and dips on braking, tiny, back to exactly 0 at rest', () => {
    for (const t of [0, READY_AT, ROLL_AT, STORY_MS, STORY_MS + 500]) expect(departPitch(t)).toBeCloseTo(0, 12)
    expect(departPitch(ROLL_AT + 350)).toBeLessThan(0)
    expect(departPitch(ROLL_AT + ROLL_MS)).toBeGreaterThan(0)
    for (let t = 0; t <= STORY_MS; t += 25) expect(Math.abs(departPitch(t))).toBeLessThanOrEqual(0.012)
  })
})

describe('exhaust smoke', () => {
  test('puffs start with the engine and all fade out before the story ends, so the scene can rest', () => {
    expect(SMOKE_START).toBe(ENGINE_AT)
    expect(SMOKE_END).toBeLessThan(STORY_MS)
    expect(smokeActive(ENGINE_AT - 1)).toBe(false)
    expect(smokeActive(ENGINE_AT)).toBe(true)
    expect(smokeActive(STORY_MS)).toBe(false)
    expect(smokeActive(READY_AT)).toBe(false)
    for (const puff of PUFFS) {
      expect(puffAt(puff, puff.birth - 1)).toBeNull()
      expect(puffAt(puff, puff.birth + puff.life)).toBeNull()
    }
  })

  test('a puff rises, grows and fades; it stays where it was born while the truck rolls on', () => {
    const puff = PUFFS[PUFFS.length - 1]!
    const early = puffAt(puff, puff.birth + 100)!, late = puffAt(puff, puff.birth + puff.life - 100)!
    expect(late.center[1]).toBeGreaterThan(early.center[1])
    expect(late.size).toBeGreaterThan(early.size)
    expect(late.alpha).toBeLessThan(early.alpha)
    for (let age = 0; age < puff.life; age += 50) expect(puffAt(puff, puff.birth + age)!.alpha).toBeLessThanOrEqual(puff.peak)
    // Sinh lúc xe đã lăn: miệng ống xả lùi về đầu xe đúng quãng đã lăn lúc đó, không theo xe về sau
    expect(puff.birth).toBeGreaterThan(ROLL_AT)
    const born = puffAt(puff, puff.birth)!
    expect(born.center[0]).toBeCloseTo(EXHAUST_AT[0] - departDistance(puff.birth) + puff.jitter[0], 10)
  })
})

describe('story timeline (loading)', () => {

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
