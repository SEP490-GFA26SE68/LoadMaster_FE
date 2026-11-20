import { describe, expect, test } from 'vitest'
import { fillStep, LANDING_FILL_MS } from '@/features/viewer3d/landing-fill'
import { createStoryClock, STORY_TICK_CAP_MS } from '@/features/viewer3d/landing/story-clock'
import { EXHAUST_AT, PUFFS, puffAt, SMOKE_END, SMOKE_START, smokeActive } from '@/features/viewer3d/landing/exhaust-smoke'
import {
  ARRIVE_AT, arriveDim, BACK_AT, DELIVERED_AT, DEPART_AT, DEPART_M, departDistance, departPitch, DOCK_AT, DOORS_OPEN_AT, doorsShut, ENGINE_AT,
  laneArrival, laneDrop, LANE_DROP_M, LANE_DROP_MS, LOADING_AT, loadedCount, phaseAt, READY_AT, ROLL_AT, ROLL_MS, STOP_SCENE_AT, STORY_MS,
  sweepFade, sweepX, truckOffset, UNLOAD_AT, UNLOAD_DROP_M, unloadArrival, unloadDrop, unloadedCount, ZONES_AT,
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

  test('seek jumps to a moment and plays on from there, from any state, keeping holds; the moment is clamped', () => {
    const clock = createStoryClock(STORY_MS)
    clock.seek(LOADING_AT)
    expect(clock.time()).toBe(LOADING_AT)
    expect(clock.status()).toBe('playing')
    expect(clock.tick(100)).toBe(true)
    expect(clock.time()).toBe(LOADING_AT + 100)
    clock.finish()
    expect(clock.status()).toBe('ended')
    clock.seek(LOADING_AT)
    expect(clock.status()).toBe('playing')
    clock.hold('user')
    clock.seek(READY_AT)
    expect(clock.time()).toBe(READY_AT)
    expect(clock.status()).toBe('paused')
    clock.release('user')
    clock.seek(-20)
    expect(clock.time()).toBe(0)
    clock.seek(STORY_MS + 10)
    expect(clock.time()).toBe(STORY_MS)
    expect(clock.status()).toBe('ended')
    clock.seek(Number.NaN)
    expect(clock.time()).toBe(0)
    expect(clock.status()).toBe('playing')
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
  test('phases follow the 2 / 2 / 5 / 2 / 4 / 4.4 / 3.2 / 1 s beats and the story lasts 23.6 s, under 25 s', () => {
    expect(ZONES_AT).toBe(3400)
    expect(READY_AT).toBe(9000)
    expect(DEPART_AT).toBe(11000)
    expect(ARRIVE_AT).toBe(15000)
    expect(UNLOAD_AT).toBe(19400)
    expect(DELIVERED_AT).toBe(22600)
    expect(STORY_MS).toBe(23600)
    expect(STORY_MS).toBeLessThanOrEqual(25000)
    expect([0, 1999, 2000, 3999, 4000, 8999, 9000, 10999, 11000, 14999, 15000, 19399, 19400, 22599, 22600, STORY_MS].map(phaseAt))
      .toEqual(['intake', 'intake', 'optimize', 'optimize', 'loading', 'loading', 'ready', 'ready', 'depart', 'depart',
        'arrive', 'arrive', 'unload', 'unload', 'delivered', 'delivered'])
  })

  test('depart: doors shut first, the engine starts, then the truck rolls 1.3 m forward smoothly and stands still before arriving', () => {
    expect([READY_AT, DEPART_AT - 1, DEPART_AT, ARRIVE_AT].map(doorsShut)).toEqual([false, false, true, true])
    expect(DEPART_AT).toBeLessThan(ENGINE_AT)
    expect(ENGINE_AT).toBeLessThan(ROLL_AT)
    expect(DEPART_M).toBe(1.3)
    for (const t of [0, READY_AT, DEPART_AT, ROLL_AT]) expect(departDistance(t)).toBe(0)
    expect(departDistance(ROLL_AT + ROLL_MS / 2)).toBeCloseTo(0.65, 10)
    expect(departDistance(ROLL_AT + ROLL_MS)).toBeCloseTo(DEPART_M, 10)
    expect(departDistance(STORY_MS)).toBeCloseTo(DEPART_M, 10)
    let previous = 0
    for (let t = ROLL_AT; t <= ARRIVE_AT; t += 20) {
      const distance = departDistance(t)
      expect(distance).toBeGreaterThanOrEqual(previous)
      expect(distance - previous).toBeLessThan(0.025)
      previous = distance
    }
  })

  test('depart pitch: the nose lifts on launch and dips on braking, tiny, back to exactly 0 at rest', () => {
    for (const t of [0, READY_AT, ROLL_AT, ARRIVE_AT, BACK_AT, UNLOAD_AT, STORY_MS, STORY_MS + 500]) expect(departPitch(t)).toBeCloseTo(0, 12)
    expect(departPitch(ROLL_AT + 350)).toBeLessThan(0)
    expect(departPitch(ROLL_AT + ROLL_MS)).toBeGreaterThan(0)
    // Lùi vào chỗ dỡ: ngược chiều với lúc rời kho
    expect(departPitch(BACK_AT + 350)).toBeGreaterThan(0)
    expect(departPitch(DOCK_AT)).toBeLessThan(0)
    for (let t = 0; t <= STORY_MS; t += 25) expect(Math.abs(departPitch(t))).toBeLessThanOrEqual(0.012)
  })

  test('arrival: the frame darkens, the stop scene swaps in while fully dark, then it brightens as the truck backs 1.3 m into the dock', () => {
    expect([0, ARRIVE_AT - 1, ARRIVE_AT].map(arriveDim)).toEqual([0, 0, 0])
    expect(arriveDim(ARRIVE_AT + 250)).toBeCloseTo(0.5, 10)
    expect(arriveDim(STOP_SCENE_AT)).toBe(1)
    expect(arriveDim(BACK_AT)).toBe(1)
    expect(arriveDim(BACK_AT + 300)).toBeCloseTo(0.5, 10)
    expect([BACK_AT + 600, DOCK_AT, STORY_MS].map(arriveDim)).toEqual([0, 0, 0])
    for (const t of [ARRIVE_AT, STOP_SCENE_AT, BACK_AT]) expect(truckOffset(t)).toBeCloseTo(DEPART_M, 10)
    for (const t of [0, READY_AT, DOCK_AT, STORY_MS]) expect(truckOffset(t)).toBeCloseTo(0, 10)
    let previous = DEPART_M
    for (let t = BACK_AT; t <= DOCK_AT; t += 20) {
      const offset = truckOffset(t)
      expect(offset).toBeLessThanOrEqual(previous + 1e-12)
      expect(previous - offset).toBeLessThan(0.03)
      previous = offset
    }
    // Cửa đóng suốt lúc xe đi và lùi, mở lại khi xe đã vào chỗ dỡ, trước khi dỡ
    expect([DOCK_AT, DOORS_OPEN_AT - 1, DOORS_OPEN_AT, UNLOAD_AT, STORY_MS].map(doorsShut)).toEqual([true, true, false, false, false])
    expect(DOORS_OPEN_AT).toBeLessThan(UNLOAD_AT)
  })

  test('unload: the stop-1 count is fillStep of the unload phase; each box leaves the truck at its moment and drops onto the stack', () => {
    let previous = 0
    for (let t = 0; t <= STORY_MS; t += 37) {
      const count = unloadedCount(96, t)
      expect(count).toBe(fillStep(96, t - UNLOAD_AT, DELIVERED_AT - UNLOAD_AT))
      expect(count).toBeGreaterThanOrEqual(previous)
      previous = count
    }
    expect(unloadedCount(96, UNLOAD_AT)).toBe(0)
    expect(unloadedCount(96, DELIVERED_AT)).toBe(96)
    expect(unloadedCount(96, STORY_MS)).toBe(96)
    expect(unloadedCount(0, STORY_MS)).toBe(0)
    for (const rank of [0, 1, 47, 95]) {
      const at = unloadArrival(rank, 96)
      expect(unloadedCount(96, at + 1)).toBeGreaterThan(rank)
      expect(unloadDrop(rank, 96, at)).toBe(UNLOAD_DROP_M)
      expect(unloadDrop(rank, 96, at + LANE_DROP_MS)).toBe(0)
    }
    expect(unloadArrival(95, 96) + LANE_DROP_MS).toBeLessThan(STORY_MS)
  })
})

describe('exhaust smoke', () => {
  test('puffs start with the engine and all fade out before the story ends, so the scene can rest', () => {
    expect(SMOKE_START).toBe(ENGINE_AT)
    expect(SMOKE_END).toBeLessThan(ARRIVE_AT)
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
