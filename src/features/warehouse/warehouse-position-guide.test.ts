import { expect, test } from 'vitest'
import { positionGuide } from './warehouse-position-guide'

const box = { innerLengthCm: 600, innerWidthCm: 240, innerHeightCm: 250, doorWidthCm: 240, doorHeightCm: 250 }
const item = { x: 100, y: 20, z: 50, lengthCm: 80, widthCm: 40, heightCm: 30, rotation: 0 }

test('six face distances use minimum-corner business cm, not scene centers', () => {
  expect(positionGuide(box, item)).toMatchObject({
    issue: null, distances: { front: 100, rear: 420, left: 20, right: 180, floor: 50, roof: 170 },
  })
})
test.each([
  [0, ['L', 'W', 'H']], [1, ['W', 'L', 'H']], [2, ['L', 'H', 'W']],
  [3, ['W', 'H', 'L']], [4, ['H', 'L', 'W']], [5, ['H', 'W', 'L']],
])('rotation %i maps original edges to X/Y/Z exactly', (rotation, axes) => {
  const result = positionGuide(box, { ...item, rotation })
  expect(result.axes).toEqual(axes)
  expect(result.distances?.rear).toBe(420) // packed dimensions are never rotated again
})
test('touching floor/front/left and roof/rear/right gives exactly zero', () => {
  expect(positionGuide(box, { ...item, x: 0, y: 0, z: 0 }).distances).toEqual({ front: 0, rear: 520, left: 0, right: 200, floor: 0, roof: 220 })
  expect(positionGuide(box, { ...item, x: 520, y: 200, z: 220 }).distances).toEqual({ front: 520, rear: 0, left: 200, right: 0, floor: 220, roof: 0 })
})
test('outside bounds stays negative and warns, never clamps', () => {
  const result = positionGuide(box, { ...item, x: -2, y: 210, z: 230 })
  expect(result.issue).toBe('outside')
  expect(result.distances).toEqual({ front: -2, rear: 522, left: 210, right: -10, floor: 230, roof: -10 })
})
test.each([null, -1, 6, 1.5, Number.NaN])('unknown rotation %s is never guessed', (rotation) => {
  expect(positionGuide(box, { ...item, rotation }).axes).toBeNull()
})
test('missing geometry does not become zero', () => {
  expect(positionGuide(box, { ...item, x: null })).toMatchObject({ issue: 'missing', distances: null })
  expect(positionGuide(null, item)).toMatchObject({ issue: 'missing', distances: null })
})
test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('invalid dimensions %s do not produce a guide', (lengthCm) => {
  expect(positionGuide(box, { ...item, lengthCm }).distances).toBeNull()
})
