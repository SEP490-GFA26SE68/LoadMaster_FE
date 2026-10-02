import { expect, test } from 'vitest'
import { isSceneIdle } from './perf-idle'

test('a scene still drawing is never idle, however slow the frames are', () => {
  // Máy yếu: 2 FPS (500 ms/frame) nhưng frame cuối vẫn xin frame tiếp
  expect(isSceneIdle(true, 500)).toBe(false)
  expect(isSceneIdle(true, 40)).toBe(false)
})

test('a stopped loop is idle only after the quiet gap', () => {
  expect(isSceneIdle(false, 40)).toBe(false)
  expect(isSceneIdle(false, 250)).toBe(true)
  expect(isSceneIdle(false, 900)).toBe(true)
})

test('a frame requested after the last one keeps the scene busy until it is drawn', () => {
  // Máy yếu: frame cuối không tự xin frame tiếp, nhưng ngay sau đó react-spring (hoặc con trỏ) xin thêm một frame và 400 ms sau
  // frame ấy vẫn chưa vẽ xong
  expect(isSceneIdle(false, 400, 1)).toBe(false)
  expect(isSceneIdle(false, 400, 0)).toBe(true)
})
