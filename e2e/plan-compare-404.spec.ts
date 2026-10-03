import { expect, test } from './fixtures'

/**
 * LM-100: So sánh phương án `/chuyen/:tripId/so-sanh` (LM-051) — mọi cột revision mang MOCK RESULT, mở revision đang chọn vào
 * Planner; tiêu đề tab theo màn. FE-5b-06: có `?lan-chay=` thì là ba thẻ phương án ứng viên của lần chạy đó. Đường dẫn lạ ra màn 404,
 * nút về màn chính mở đúng màn của vai trò.
 */
test.use({ collectConsoleErrors: true })

const TRIP_ID = 'TRIP-2026-0914'

test('compare plans: every revision column is MOCK RESULT and the chosen one opens in the Planner', async ({ page, login, browserErrors }) => {
  // Điều phối viên duyệt (FE-0-07): mở bản chưa duyệt thì có nút Duyệt
  await login(`/chuyen/${TRIP_ID}/so-sanh`, 'dispatcher')
  await expect(page.getByRole('heading', { level: 1, name: 'So sánh phương án', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(`So sánh phương án ${TRIP_ID} · LoadMaster`)
  // Dải trời V2.3: đường dẫn về chi tiết chuyến thay cho nút quay lại
  await expect(page.getByRole('navigation', { name: 'Vị trí trang' }).getByRole('link', { name: TRIP_ID, exact: true }))
    .toHaveAttribute('href', `/chuyen/${TRIP_ID}`)

  // Seed: ba phương án ứng viên của một lần chạy (REV-001-A, REV-001-B, REV-001) và bản đã duyệt REV-002 tạo từ REV-001 — mỗi bản
  // một cột, đầu cột có radio chọn bản
  const radios = page.getByRole('radio')
  await expect(radios).toHaveCount(4)
  await expect(page.getByRole('columnheader').filter({ hasText: 'MOCK RESULT' })).toHaveCount(4)
  await expect(page.getByRole('columnheader').filter({ hasText: /Phương án [ABC]/ })).toHaveCount(4)
  await expect(page.getByRole('radio', { name: 'REV-002', exact: true })).toBeChecked()

  await page.getByRole('radio', { name: 'REV-001', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'REV-001', exact: true })).toBeChecked()
  await expect(page.getByText('Đang chọn: REV-001', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Mở REV-001 trong 3D', exact: true }).click()
  await page.waitForURL(`/chuyen/${TRIP_ID}/phuong-an?revision=REV-001`)
  await page.locator('canvas').waitFor()
  const header = page.locator('header').first()
  await expect(header).toContainText('MOCK RESULT')
  // REV-001 chưa duyệt: Planner mở đúng bản đó (bản đã duyệt REV-002 không có nút Duyệt)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(`Phương án ${TRIP_ID} · LoadMaster`)
  expect(browserErrors).toStrictEqual([])
})

test('compare the three candidate plans of a run: deadlines once, cards A, B, C with a neutral best mark, each opens in the Planner (FE-5b-06)', async ({ page, login, browserErrors }) => {
  await login(`/chuyen/${TRIP_ID}/so-sanh?lan-chay=RUN-002`, 'dispatcher')
  await expect(page.getByRole('heading', { level: 1, name: 'So sánh phương án', exact: true })).toBeVisible()
  await expect(page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })).toContainText('Lần chạy RUN-002 · 3 phương án ứng viên')

  // Lần chạy: tên thuật toán đã chạy; mức hạn các điểm giao hiện một lần, phía trên ba thẻ
  const run = page.getByRole('region', { name: 'Lần chạy RUN-002', exact: true })
  await expect(run.locator('[data-run-settings]')).toContainText('EP + DBLF (mock)')
  const deadlines = page.getByRole('region', { name: 'Mức hạn các điểm giao', exact: true })
  await expect(deadlines).toHaveCount(1)
  await expect(deadlines.getByRole('listitem')).toHaveCount(4)
  await expect(deadlines.getByRole('listitem').first()).toContainText(/Dự kiến đến \d{2}:\d{2}/)

  // Ba thẻ cạnh nhau, mỗi thẻ mang MOCK RESULT, ảnh thu nhỏ SVG và đủ các chỉ số
  const cards = page.locator('[data-candidate]')
  await expect(cards).toHaveCount(3)
  const tops = await cards.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)))
  expect(new Set(tops).size, 'the three cards sit side by side').toBe(1)
  for (const [label, objective] of [['A', 'Tối đa thể tích'], ['B', 'Cân bằng tải trục'], ['C', 'Ít dỡ-xếp lại']] as const) {
    const card = page.getByRole('region', { name: `Phương án ${label} — ${objective}`, exact: true })
    await expect(card.getByText('MOCK RESULT', { exact: true })).toBeVisible()
    await expect(card.getByRole('img', { name: /^Sơ đồ xếp hàng của REV-001.*: 132 \/ 132 kiện đã xếp$/ })).toBeVisible()
    for (const metric of ['volume', 'payload', 'frontAxle', 'rearAxle', 'axleGap', 'centerOfGravity', 'rehandling', 'unplaced', 'runtime']) {
      await expect(card.locator(`[data-metric="${metric}"]`), `${label}: ${metric}`).toBeVisible()
    }
    await expect(card.getByRole('link', { name: `Mở phương án ${label} trong Planner`, exact: true })).toBeVisible()
  }

  // Tốt nhất: B cân tải hai trục nhất, C không kiện nào dỡ-xếp lại. Dấu là nhãn xám — không xanh lá, không đỏ
  await expect(page.locator('[data-best]')).toHaveCount(2)
  await expect(page.locator('[data-candidate="B"] [data-metric="axleGap"][data-best]')).toContainText('Tốt nhất')
  await expect(page.locator('[data-candidate="C"] [data-metric="rehandling"][data-best]')).toContainText('0 kiện')
  const markColours = await page.locator('[data-best]').getByText('Tốt nhất', { exact: true }).evaluateAll((marks) =>
    marks.map((mark) => { const { color, backgroundColor } = getComputedStyle(mark); return [color, backgroundColor] }))
  // token của nhãn trung tính: chữ --n-700 trên nền --n-100
  expect(markColours).toStrictEqual([['rgb(57, 77, 84)', 'rgb(231, 239, 241)'], ['rgb(57, 77, 84)', 'rgb(231, 239, 241)']])

  // Thẻ đã duyệt có nhãn và lối tới bản đã duyệt; màn không có nút primary
  const approvedCard = page.locator('[data-candidate="C"]')
  await expect(approvedCard.getByText('Đã duyệt', { exact: true })).toBeVisible()
  await expect(approvedCard.getByRole('link', { name: 'Mở bản đã duyệt REV-002', exact: true })).toHaveAttribute('href', `/chuyen/${TRIP_ID}/phuong-an?revision=REV-002`)
  await expect(page.locator('[data-candidate="A"]').getByText('Đã duyệt', { exact: true })).toHaveCount(0)
  await expect(page.locator('a.text-on-primary, button.text-on-primary')).toHaveCount(0)

  // Mở phương án A trong Planner: đúng bản đó, chưa duyệt nên có nút Duyệt
  await page.getByRole('link', { name: 'Mở phương án A trong Planner', exact: true }).click()
  await page.waitForURL(`/chuyen/${TRIP_ID}/phuong-an?revision=REV-001-A`)
  await page.locator('canvas').waitFor()
  await expect(page.locator('header').first()).toContainText('MOCK RESULT')
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('an unknown path shows the 404 screen and its home button opens the role home', async ({ page, login }) => {
  await login('/tai-xe', 'driver')
  await page.goto('/duong-dan-khong-co')
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang', exact: true })).toBeVisible()
  await expect(page.getByText('404', { exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Không tìm thấy trang · LoadMaster')

  // Tài xế không mở được bảng điều khiển `/`: nút về màn chính phải đưa về "Chuyến của tôi", không ra màn 403
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/tai-xe')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến của tôi', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Chuyến của tôi · LoadMaster')
})
