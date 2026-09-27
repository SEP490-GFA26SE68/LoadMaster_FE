import { expect, test } from 'vitest'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { settleAfterMove } from './gravity'

/** Trọng lực khi chỉnh tay (LM-108): kiện đang tựa lên kiện bị kéo đi thì rơi xuống mặt đỡ gần nhất. */

function box(id: string, x: number, y: number, z: number, size: [number, number, number] = [50, 40, 30], pinned = false): ScenePlacement {
  const [lengthCm, widthCm, heightCm] = size
  return { id, position: { x, y, z }, lengthCm, widthCm, heightCm, pinned } as ScenePlacement
}

const move = (placements: ScenePlacement[], id: string, x: number) =>
  placements.map((placement) => placement.id === id ? { ...placement, position: { ...placement.position, x } } : placement)

test('pulling the bottom package out drops the one resting on it to the floor', () => {
  const before = [box('A', 0, 0, 0), box('B', 0, 0, 30)]
  expect(settleAfterMove('A', before, move(before, 'A', 200))).toStrictEqual([{ id: 'B', position: { x: 0, y: 0, z: 0 } }])
})

test('a package still partly over its support does not fall', () => {
  const before = [box('A', 0, 0, 0), box('B', 0, 0, 30)]
  expect(settleAfterMove('A', before, move(before, 'A', 20))).toStrictEqual([])
})

test('a whole stack falls in a chain, each package landing on the one below', () => {
  const before = [box('A', 0, 0, 0), box('B', 0, 0, 30), box('C', 0, 0, 60)]
  expect(settleAfterMove('A', before, move(before, 'A', 200))).toStrictEqual([
    { id: 'B', position: { x: 0, y: 0, z: 0 } },
    { id: 'C', position: { x: 0, y: 0, z: 30 } },
  ])
})

test('a falling package lands on the highest surface below it: another package or a load-bearing obstacle', () => {
  const before = [box('A', 0, 0, 20), box('B', 0, 0, 50), box('D', 40, 0, 0, [50, 40, 12])]
  expect(settleAfterMove('A', before, move(before, 'A', 300))).toStrictEqual([{ id: 'B', position: { x: 0, y: 0, z: 12 } }])
  const plain = [box('A', 0, 0, 20), box('B', 0, 0, 50)]
  const obstacle = { xCm: 0, yCm: 0, zCm: 0, lengthCm: 30, widthCm: 30, heightCm: 20 }
  expect(settleAfterMove('A', plain, move(plain, 'A', 300), [obstacle])).toStrictEqual([{ id: 'B', position: { x: 0, y: 0, z: 20 } }])
})

test('a pinned package stays where it is', () => {
  const before = [box('A', 0, 0, 0), box('B', 0, 0, 30, undefined, true)]
  expect(settleAfterMove('A', before, move(before, 'A', 200))).toStrictEqual([])
})

test('packages beside the moved one, not on it, never move', () => {
  const before = [box('A', 0, 0, 0), box('B', 100, 0, 0), box('C', 100, 0, 30)]
  expect(settleAfterMove('A', before, move(before, 'A', 300))).toStrictEqual([])
})
