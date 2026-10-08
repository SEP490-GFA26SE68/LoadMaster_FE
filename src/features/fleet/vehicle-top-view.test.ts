import { expect, test } from 'vitest'
import { topViewOf } from './vehicle-top-view'

test('the top view is the cargo space to scale, obstacles at their declared corner, the door on the rear edge', () => {
  // Hyundai HD210 của seed: thùng 720 × 235 cm, hốc bánh 110 × 25 cm ở x = 420 cm, y = 0 và y = 210 cm; 0,14 px mỗi cm
  const view = topViewOf({
    innerLengthCm: 720,
    innerWidthCm: 235,
    obstacles: [
      { id: 'OBS-001', type: 'WHEEL_ARCH', xCm: 420, yCm: 0, zCm: 0, lengthCm: 110, widthCm: 25, heightCm: 32, loadBearing: false },
      { id: 'OBS-002', type: 'WHEEL_ARCH', xCm: 420, yCm: 210, zCm: 0, lengthCm: 110, widthCm: 25, heightCm: 32, loadBearing: false },
    ],
  })
  expect(view.width).toBe(100.8)
  expect(view.height).toBe(32.9)
  expect(view.obstacles[0]).toEqual({ x: 58.8, y: 0, width: 15.4, height: 3.5 })
  expect(view.obstacles[1]).toEqual({ x: 58.8, y: 29.4, width: 15.4, height: 3.5 })
  expect(view.door).toEqual({ x: 98.8, y: 0, width: 2, height: 32.9 })
})
