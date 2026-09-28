import { expect, test } from 'vitest'
import { resolveEffectiveScene } from '@/features/viewer3d/viewer-draft'
import { commitCommand, createDraftHistory, travelHistory } from '@/features/viewer3d/editor/draft-history'
import { createEditorEngine } from '@/features/viewer3d/editor/editor-engine'
import { EDITOR_RULES, overlaps } from '@/features/viewer3d/editor/geometry'
import { snapPosition } from '@/features/viewer3d/editor/snapping'
import { seededRandom } from '@/test/placements'
import { benchmarkScene, sceneBox as box } from '@/test/scene'

const model = benchmarkScene(1000)
const vehicle = model.vehicle

test('touching faces do not overlap; even 0.1 cm penetration does', () => {
  expect(overlaps(box('a'), box('b', 10))).toBe(false)
  expect(overlaps(box('a'), box('b', 9.9))).toBe(true)
})

test('snapping attracts only load-bearing obstacle faces; a non-bearing obstacle never invites a drop', () => {
  const obstacle = { id: 'O', type: 'COOLING_UNIT' as const, xCm: 100, yCm: 0, zCm: 0, lengthCm: 50, widthCm: 50, heightCm: 46 }
  const p = box('a', 100, 0, 0)
  // 47,6 cm: mặt trên vật cản 46 cách 1,6 cm (≤ 2), mốc lưới gần nhất 50 cách 2,4 cm (> 2).
  const bearing = snapPosition(p, { x: 100, y: 0, z: 47.6 }, [], { ...vehicle, obstacles: [{ ...obstacle, loadBearing: true }] }, ['z'])
  const plain = snapPosition(p, { x: 100, y: 0, z: 47.6 }, [], { ...vehicle, obstacles: [{ ...obstacle, loadBearing: false }] }, ['z'])
  expect([bearing.position.z, bearing.sources]).toStrictEqual([46, [{ axis: 'z', kind: 'obstacle', id: 'O' }]])
  expect([plain.position.z, plain.sources]).toStrictEqual([47.6, []])
})

test('snapping chooses floor/walls/5 cm grid/cargo faces within 2 cm, with fixed axes', () => {
  const p = box('a')
  expect(snapPosition(p, { x: 0.8, y: 225.8, z: 1.2 }, [], vehicle).position).toStrictEqual({ x: 0, y: 225, z: 0 })
  expect(snapPosition(p, { x: 15.14, y: 50, z: 0 }, [], vehicle).position).toStrictEqual({ x: 15, y: 50, z: 0 })
  const neighbor = box('b', 26.7, 0, 0)
  const snapped = snapPosition(p, { x: 17.2, y: 0, z: 0 }, [neighbor], vehicle)
  expect(snapped.position.x).toBe(16.7)
  expect(snapped.sources.some((s) => s.kind === 'package' && s.id === 'b')).toBeTruthy()
  expect(overlaps({ ...p, position: snapped.position }, neighbor)).toBe(false)
  expect(snapPosition(p, { x: 17.2, y: 70, z: 0 }, [neighbor], vehicle).position.x, 'remote face does not attract').toBe(17.2)
  expect(snapPosition(p, { x: 0.8, y: 0.8, z: 1.2 }, [], vehicle, ['x', 'y']).position.z).toBe(1.2)
  const first = snapPosition(p, { x: 17.22, y: 0, z: 0 }, [neighbor], vehicle)
  expect(snapPosition(p, first.position, [neighbor], vehicle).position, 'no conversion drift').toStrictEqual(first.position)
})

test('200 back-and-forth drags that end on a 120.7 cm package face land on 0.1 cm multiples with no false overlap', () => {
  // 100,4 + 120,7 = 221,10000000000002 trong máy: mặt kiện phải được làm tròn, không tạo chồng lấn giả.
  const p = box('a', 0, 0, 0, { lengthCm: 120.7 }), neighbor = box('b', 221.1, 0, 0, { lengthCm: 50 })
  const random = seededRandom(7)
  let position = p.position
  for (let i = 0; i < 200; i++) {
    const requested = { ...position, x: 100.4 + (random() - 0.5) * 3 }
    position = snapPosition({ ...p, position }, requested, [neighbor], vehicle, ['x']).position
    expect(Math.round(position.x * 10) / 10, `drag ${i}`).toBe(position.x)
  }
  const dropped = snapPosition({ ...p, position }, { ...position, x: 100.9 }, [neighbor], vehicle, ['x']).position
  expect([dropped.x, overlaps({ ...p, position: dropped }, neighbor)]).toStrictEqual([100.4, false])
})

test('mixed history commands undo/redo exact patches without mutating 1,000-placement snapshot', () => {
  const before = structuredClone(model.placements)
  const id = model.placements[0]!.id
  let h = createDraftHistory()
  h = commitCommand(model, h, 'MOVE', id, { position: { x: 3, y: 2, z: 0 } })
  h = commitCommand(model, h, 'ROTATE', id, { orientation: 'HWL' })
  h = commitCommand(model, h, 'PIN', id, { pinned: true })
  h = commitCommand(model, h, 'UNPIN', id, { pinned: false })
  const edited = h.draft
  h = commitCommand(model, h, 'RESET_PLACEMENT', id)
  expect(h.draft.patches.size).toBe(0)
  h = travelHistory(h, 'undo')
  expect(h.draft).toStrictEqual(edited)
  h = commitCommand(model, h, 'MOVE', model.placements[2]!.id, { position: { x: 3.5, y: 50, z: 0 } })
  expect(h.future.length).toBe(0)
  const twoEdits = h.draft
  h = commitCommand(model, h, 'RESET_DRAFT')
  expect(h.draft.patches.size).toBe(0)
  h = travelHistory(h, 'undo')
  expect(h.draft).toStrictEqual(twoEdits)
  h = travelHistory(h, 'redo')
  expect(h.draft.patches.size).toBe(0)
  expect(resolveEffectiveScene(model, h.draft).placements[999]).toBe(model.placements[999])
  expect(model.placements).toStrictEqual(before)
})

test('history ignores no-ops, branches after undo, and stays bounded', () => {
  const id = model.placements[0]!.id
  let h = createDraftHistory()
  expect(commitCommand(model, h, 'RESET_DRAFT')).toBe(h)
  expect(commitCommand(model, h, 'MOVE', 'missing', { pinned: true })).toBe(h)
  for (let i = 0; i < EDITOR_RULES.historyLimit + 5; i++) h = commitCommand(model, h, 'MOVE', id, { position: { x: i, y: 0, z: 0 } })
  expect(h.past.length).toBe(EDITOR_RULES.historyLimit)
  expect(h.past.at(-1)!.changes.length).toBe(1)
  h = travelHistory(h, 'undo')
  h = commitCommand(model, h, 'PIN', id, { pinned: true })
  expect(h.future.length).toBe(0)
})

test('measure snapping + constraint-engine check at each benchmark count (no hardware-dependent assertion)', () => {
  const results = []
  for (const count of [132, 300, 500, 1000] as const) {
    const data = benchmarkScene(count), engine = createEditorEngine(data)!, times: number[] = []
    for (let i = 0; i < 600; i++) {
      const p = data.placements[i % count]!
      const start = performance.now()
      const position = snapPosition(p, { ...p.position, x: p.position.x + (i % 20) / 10 }, data.placements, data.vehicle).position
      engine.sync(data.placements)
      engine.check({ ...p, position })
      if (i >= 100) times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    results.push({ count, medianMs: times[250], p95Ms: times[475], maxMs: times.at(-1) })
  }
  console.log('EDITOR_BENCHMARK', JSON.stringify(results))
  // Engine thật mỗi lần kiểm: vượt mặc định 5 s khi máy/CI đang tải nặng.
}, 30_000)

test('dragging back within 6 cm of the plan position snaps exactly home on that axis, ahead of any other face (LM-108)', () => {
  const p = box('a', 100, 50, 0)
  const home = { x: 100, y: 50, z: 0 }
  // 105,5 cm: lưới 105 chỉ cách 0,5 cm nhưng vị trí gốc (cách 5,5 cm ≤ 6) thắng
  expect(snapPosition(p, { x: 105.5, y: 50, z: 0 }, [], vehicle, ['x'], home))
    .toMatchObject({ position: { x: 100, y: 50, z: 0 }, sources: [{ axis: 'x', kind: 'original' }] })
  // 106,5 cm: xa hơn 6 cm thì về luật hút thường (lưới 105 cách 1,5 cm)
  expect(snapPosition(p, { x: 106.5, y: 50, z: 0 }, [], vehicle, ['x'], home).position.x).toBe(105)
  // Chỉ trục đang kéo được hút: y lệch 3 cm vẫn giữ nguyên khi kéo theo x
  expect(snapPosition(p, { x: 102, y: 53, z: 0 }, [], vehicle, ['x'], home).position).toStrictEqual({ x: 100, y: 53, z: 0 })
})
