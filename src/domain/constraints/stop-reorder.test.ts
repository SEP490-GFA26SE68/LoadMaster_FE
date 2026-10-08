import { expect, test } from 'vitest'
import { checkStopReorder } from '@/domain/constraints'
import { SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'

/** Hộp sàn: vị trí (x, y, z) và kích thước đã xếp (dài, rộng, cao), cm. Cửa sau ở x lớn; mặt sau của hộp là x + dài. */
function box(packageInstanceId: string, x: number, size: [number, number, number]) {
  return { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: x, yCm: 0, zCm: 0, placedLengthCm: size[0], placedWidthCm: size[1], placedHeightCm: size[2] }
}

// DEEP sâu trong thùng (mặt sau 100×100 cm² nhìn từ cửa); FRONT sát cửa
const DEEP = box('DEEP-01', 0, [100, 100, 100])
const SMALL_FRONT = box('FRONT-01', 100, [100, 40, 40]) // che 1.600 / 10.000 mặt sau của DEEP
const BIG_FRONT = box('FRONT-01', 100, [100, 100, 100]) // che kín

test('the load can be unloaded in an order when no package delivered later covers the whole rear face of one delivered earlier', () => {
  const deepFirst = (front: typeof DEEP) => checkStopReorder([{ placement: DEEP, rank: 1 }, { placement: front, rank: 2 }])
  // kiện sâu giao trước: kiện sát cửa nhỏ che một phần — cảnh báo; to che kín — không dỡ được
  expect(deepFirst(SMALL_FRONT)).toMatchObject({ blocked: [], partial: [{ packageInstanceId: 'DEEP-01', blockerIds: ['FRONT-01'], coverage: 0.16 }] })
  expect(deepFirst(BIG_FRONT)).toMatchObject({ blocked: [{ packageInstanceId: 'DEEP-01', blockerIds: ['FRONT-01'], coverage: 1 }], partial: [] })
  // kiện sát cửa giao trước (thứ tự LIFO) hoặc cùng điểm giao: không ai chắn ai
  expect(checkStopReorder([{ placement: DEEP, rank: 2 }, { placement: BIG_FRONT, rank: 1 }])).toStrictEqual({ blocked: [], partial: [] })
  expect(checkStopReorder([{ placement: DEEP, rank: 1 }, { placement: BIG_FRONT, rank: 1 }])).toStrictEqual({ blocked: [], partial: [] })
})
