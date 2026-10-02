import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Bản đồ tuyến dùng chung (FE-4b-07) trên trang tài liệu `/thanh-phan` — công khai, không đăng nhập. CI không có khoá Goong
 * (`VITE_GOONG_MAPTILES_KEY` trống): bản đồ phải dựng trên nền trống, vẫn vẽ mốc, không gọi nguồn gạch nào và không lỗi console.
 */
test.use({ collectConsoleErrors: true })

/** Khoảng cách trên màn hình giữa mốc kho và mốc điểm giao xa nhất: lớn lên khi phóng to. */
async function markerSpread(markers: Locator) {
  const boxes = await markers.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()).map(({ x, y }) => ({ x, y })))
  const [first] = boxes
  if (!first) return 0
  return Math.max(...boxes.map((box) => Math.hypot(box.x - first.x, box.y - first.y)))
}

test('the route map mounts without a map key: canvas, depot and stop markers, keyboard zoom, no tile requests', async ({ page, browserErrors }) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (/goong|openstreetmap|tile\./i.test(new URL(request.url()).hostname)) external.push(request.url())
  })

  await page.goto('/thanh-phan')
  const region = page.getByRole('region', { name: 'Bản đồ tuyến TRIP-2026-0914', exact: true })
  await region.scrollIntoViewIfNeeded()

  const canvas = region.locator('canvas.maplibregl-canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAccessibleName('Bản đồ tương tác')
  await expect(canvas).toHaveAccessibleDescription(/phím \+ và − để phóng to, thu nhỏ/)
  // Sơ đồ SVG chỉ là hình chờ lúc tải chunk bản đồ
  await expect(region.locator('svg[data-route-sketch]')).toHaveCount(0)

  // Kho + bốn điểm giao của chuyến mẫu, số trên mốc theo thứ tự mock tối ưu tuyến xếp
  const markers = region.locator('.maplibregl-marker')
  await expect(markers).toHaveCount(5)
  await expect(markers.filter({ hasText: /^\d$/ })).toHaveText(['4', '3', '2', '1'])
  await expect(region.getByRole('listitem')).toHaveCount(5)

  // Canvas phủ kín khung (khung MapLibre cao 0 thì canvas về mặc định 300 px và mọi thứ bị cắt mất); mọi mốc nằm trong khung
  // bản đồ sau khi canh theo tuyến
  const frame = await region.boundingBox()
  expect((await canvas.boundingBox())?.height).toBeCloseTo((frame?.height ?? 0) - 2, 0)
  for (const box of await markers.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.x).toBeGreaterThanOrEqual(frame?.x ?? 0)
    expect(box.x + box.width).toBeLessThanOrEqual((frame?.x ?? 0) + (frame?.width ?? 0))
    expect(box.y).toBeGreaterThanOrEqual(frame?.y ?? 0)
    expect(box.y + box.height).toBeLessThanOrEqual((frame?.y ?? 0) + (frame?.height ?? 0))
  }

  // Phóng to bằng nút (Enter) rồi bằng phím + trên bản đồ; thu nhỏ bằng phím −
  const fitted = await markerSpread(markers)
  await region.getByRole('button', { name: 'Phóng to', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => markerSpread(markers)).toBeGreaterThan(fitted * 1.5)
  // Đọc độ giãn sau khi hoạt ảnh phóng đã dừng: lấy mẫu giữa chừng thì phím kế tiếp so với một mốc còn đang lớn dần (máy CI chậm)
  const settled = async () => {
    let last = -1
    await expect.poll(async () => {
      const now = Math.round(await markerSpread(markers))
      const same = now === last
      last = now
      return same
    }, { intervals: [300] }).toBe(true)
    return last
  }
  const zoomed = await settled()
  await canvas.focus()
  await page.keyboard.press('+')
  await expect.poll(() => markerSpread(markers)).toBeGreaterThan(zoomed * 1.5)
  await settled()
  await page.keyboard.press('-')
  await settled()
  await page.keyboard.press('-')
  await expect.poll(() => markerSpread(markers)).toBeLessThan(zoomed)
  await region.getByRole('button', { name: 'Xem toàn tuyến', exact: true }).click()
  await expect.poll(async () => Math.round(await markerSpread(markers))).toBe(Math.round(fitted))

  expect(external).toStrictEqual([])
  expect(browserErrors).toStrictEqual([])
})
