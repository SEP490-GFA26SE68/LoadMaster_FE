import { expect, test } from 'vitest'
import { FIGURE_HEIGHT, FIGURE_WIDTH, packageFigure } from './package-figure'

const points = (value: string) => value.split(' ').map((pair) => pair.split(',').map(Number) as [number, number])

test.each([
  { lengthCm: 60, widthCm: 50, heightCm: 50 },
  { lengthCm: 240, widthCm: 20, heightCm: 10 },
  { lengthCm: 10, widthCm: 10, heightCm: 200 },
])('every face of a $lengthCm × $widthCm × $heightCm package stays inside the 146 × 120 frame', (size) => {
  const figure = packageFigure(size, '#E69F00')
  for (const face of figure.faces) {
    for (const [x, y] of points(face.points)) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(FIGURE_WIDTH)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(FIGURE_HEIGHT)
    }
  }
})

test('the three dimension lines carry the package size in cm, not the drawn length', () => {
  const figure = packageFigure({ lengthCm: 60, widthCm: 50, heightCm: 40 }, '#56B4E9')
  expect(figure.dimensions.map(({ axis, valueCm }) => [axis, valueCm])).toStrictEqual([['length', 60], ['width', 50], ['height', 40]])
  // Đường cao dựng đứng: cùng hoành độ, đỉnh nằm trên đáy
  const height = figure.dimensions[2]
  expect(height?.from.x).toBe(height?.to.x)
  expect(height?.to.y).toBeLessThan(height?.from.y ?? 0)
})

// Giá trị lấy từ ChiTietChuyenKien.html (mặt trái #8f6300, mặt phải #bd8200; nắp bản mẫu #eebc4c, lệch 1 do làm tròn)
test('faces keep the stop colour: darker left, mid right, lighter top', () => {
  const figure = packageFigure({ lengthCm: 60, widthCm: 50, heightCm: 50 }, '#E69F00')
  expect(figure.faces.map((face) => face.fill)).toStrictEqual(['#8f6300', '#bd8200', '#eebc4d'])
})
