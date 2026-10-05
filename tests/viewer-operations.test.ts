import { expect, test } from 'vitest'
import { cargoCenterOfMass, stopOrderConsistent, timelineBins } from '@/features/viewer3d/operations/operations-model'
import { countLifoIssues, createLifoIndex } from '@/features/viewer3d/operations/unloading'
import { deriveSceneSemantics } from '@/features/viewer3d/operations/scene-semantics'
import { placementMeasurements } from '@/features/viewer3d/operations/placement-measurements'
import { createQualityPolicy, observeQuality, QUALITY_COOLDOWN_MS } from '@/features/viewer3d/quality-policy'
import { benchmarkScene, sceneBox as box } from '@/test/scene'

const plan = benchmarkScene(1000)

test('stop-order consistency never implies extraction accessibility', () => {
  // b (điểm 2) xếp trước ở gần cửa, a (điểm 1) xếp sau ở phía trong: đúng thứ tự điểm giao nhưng a bị che kín lối dỡ
  const a = box('a', 0, 0, 0, { stop: 1, step: 2 }), b = box('b', 20, 0, 0, { stop: 2, step: 1 })
  expect(stopOrderConsistent([a, b])).toBe(true)
  expect(createLifoIndex([a, b]).blockage(a)?.code).toBe('LIFO_BLOCKED')
  expect(countLifoIssues([a, b])).toStrictEqual({ blocked: 1, partial: 0 })
  expect(stopOrderConsistent([{ ...a, step: 1 }, { ...b, step: 2 }])).toBe(false)
})

test('blockers come from the domain LIFO check toward the +X rear door; hidden cargo is out of the grid', () => {
  const later = { stop: 2 }
  const target = box('target', 10), front = box('front', 0, 0, 0, later), rear = box('rear', 20, 0, 0, later)
  const side = box('side', 20, 10, 0, later), above = box('above', 20, 0, 10, later)
  expect(createLifoIndex([target, front, rear, side, above]).blockage(target)?.blockers.map((p) => p.id)).toStrictEqual(['rear'])
  const door = box('door', 710)
  expect(createLifoIndex([door, rear]).blockage(door)).toBe(null)
  const input = { kind: 'unloading', step: 0, currentId: target.id, inspectId: target.id, focusStop: 1 } as const
  expect(deriveSceneSemantics([target, rear], input).lifo?.code).toBe('LIFO_BLOCKED')
  const semantics = deriveSceneSemantics([target, rear], { ...input, unloadedIds: new Set([rear.id]) })
  expect(semantics.blockers.length).toBe(0)
  expect(semantics.lifo).toBe(null)
})

test('cargo mass uses oriented box centers weighted by cargo mass, including empty/invalid-weight case', () => {
  const a = box('a'), b = box('b', 20, 10, 10, { weightKg: 30, lengthCm: 20 })
  expect(cargoCenterOfMass([a, b])).toStrictEqual({ position: { x: 23.75, y: 12.5, z: 12.5 }, weightKg: 40 })
  expect(cargoCenterOfMass([])).toBe(null)
  expect(cargoCenterOfMass([{ ...a, weightKg: 0 }, { ...b, weightKg: NaN }])).toBe(null)
})

test('loading semantic states, focus and isolation preserve placement identity and source geometry', () => {
  const a = box('a', 0, 0, 0, { step: 1, stop: 2 }), b = box('b', 20, 0, 0, { step: 2, stop: 1 }), c = box('c', 40, 0, 0, { step: 3 })
  const items = [a, b, c], before = structuredClone(items)
  const initial = deriveSceneSemantics(items, { kind: 'loading', step: 1 })
  expect(initial.appearanceById.get('a')!.state).toBe('current')
  expect(initial.appearanceById.get('b')!.state).toBe('next')
  expect(initial.appearanceById.get('b')!.visibility).toBe('dim')
  expect(initial.appearanceById.get('c')!.visibility).toBe('hidden')
  const loaded = deriveSceneSemantics(items, { kind: 'loading', step: 2 })
  expect(loaded.appearanceById.get('a')!.tone).toBe('muted')
  expect(loaded.massPlacements.length).toBe(2)
  const focus = deriveSceneSemantics(items, { kind: 'loading', step: 1, focusStop: 2 })
  expect(focus.appearanceById.get('b')!.visibility).toBe('hidden')
  const isolate = deriveSceneSemantics(items, { kind: 'loading', step: 2, isolateId: 'b' })
  expect([...isolate.appearanceById.values()].filter((p) => p.visibility !== 'hidden').length).toBe(1)
  expect(items).toStrictEqual(before)
})

test('unloading focus hides previous/delivered cargo, ghosts future stops and marks LIFO blockers', () => {
  const target = box('target', 10, 0, 0, { stop: 2 }), blocker = box('blocker', 30, 0, 0, { stop: 3 }), past = box('past', 50)
  const view = deriveSceneSemantics([target, blocker, past], { kind: 'unloading', step: 0, focusStop: 2, currentId: target.id })
  expect(view.appearanceById.get('past')!.visibility).toBe('hidden')
  expect(view.appearanceById.get('blocker')!.visibility).toBe('dim')
  const inspected = deriveSceneSemantics([target, blocker, past], { kind: 'unloading', step: 0, focusStop: 2, currentId: target.id, inspectId: target.id })
  expect(inspected.appearanceById.get('blocker')!.tone).toBe('blocker')
  expect(inspected.blockers.map((p) => p.id)).toStrictEqual([blocker.id])
  expect(inspected.massPlacements.length).toBe(2)
})

test('timeline bins stay bounded and cover all 1,000 placements exactly once', () => {
  const bins = timelineBins(plan.placements)
  expect(bins.length <= 80).toBeTruthy()
  expect(bins[0]!.start).toBe(0)
  expect(bins.at(-1)!.end).toBe(1000)
  expect(bins.reduce((sum, bin) => sum + bin.end - bin.start, 0)).toBe(1000)
  expect(timelineBins([])).toStrictEqual([])
})

test('measurements use actual extents in cm, not mock row spacing', () => {
  const p = box('a', 20, 30, 40)
  const m = placementMeasurements(p, [p], plan.vehicle)
  expect([m.frontCm, m.leftCm, m.floorCm, m.rearCm, m.rightCm, m.ceilingCm]).toStrictEqual([20, 30, 40, 690, 195, 190])
})

test('quality adaptation has consecutive samples, hysteresis, cooldown and ignores idle/sparse intervals', () => {
  let q = createQualityPolicy('high')
  for (let i = 0; i < 2; i++) q = observeQuality(q, { frameTimeMs: 40, idle: false }, i * 500)
  expect(q.tier).toBe('high')
  q = observeQuality(q, { frameTimeMs: 40, idle: false }, 1000)
  expect(q.tier).toBe('balanced')
  for (let i = 0; i < 10; i++) q = observeQuality(q, { frameTimeMs: 10, idle: false }, 2000 + i * 500)
  expect(q.tier, 'cooldown prevents an immediate upgrade').toBe('balanced')
  q = observeQuality(q, { frameTimeMs: null, idle: true }, 20_000)
  for (let i = 0; i < 7; i++) q = observeQuality(q, { frameTimeMs: 10, idle: false }, 21_000 + i * 500)
  expect(q.tier).toBe('balanced')
  q = observeQuality(q, { frameTimeMs: 10, idle: false }, 25_000)
  expect(q.tier).toBe('high')
  expect(QUALITY_COOLDOWN_MS >= 10_000).toBeTruthy()
})

test('measure operations derivation and approval heuristic at 1,000 placements', () => {
  const start = performance.now()
  for (let i = 0; i < 100; i++) deriveSceneSemantics(plan.placements, { kind: 'loading', step: i + 1 })
  const deriveMs = (performance.now() - start) / 100
  const approvalStart = performance.now()
  const lifo = countLifoIssues(plan.placements)
  console.log('OPERATIONS_BENCHMARK', JSON.stringify({ count: 1000, deriveMeanMs: deriveMs,
    approvalMs: performance.now() - approvalStart, lifo }))
})
