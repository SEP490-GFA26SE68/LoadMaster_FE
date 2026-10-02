import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { heightOf, MOCK_DB, navigateInApp, switchUser } from './spec-flow-helpers'

/**
 * Nhãn in theo mẫu mới và màn Tra cứu kiện (FE-3b-05, FE-3b-06). Kho nằm trong bộ nhớ trang: sau lần đăng nhập đầu, mọi bước đi bằng
 * liên kết trong app hoặc `navigateInApp`, không tải lại trang.
 * Seed neo 14/09/2026: `PK-0054` (`PB-HUE-2609-01`) hàng dễ vỡ đi Phú Bài; `PK-0063` (`BV-VIN-2609-05`) mang cờ "Không tìm thấy";
 * `PK-PN-0005` là kiện của công ty Phương Nam.
 */
test.use({ collectConsoleErrors: true })

const LONG_CODE = 'VSIP2A-KHO3-LOC12-DOT-2609-KIEN-000187-LO-HANG-XUAT-KHAU-091'
const LONG_DESTINATION = 'Kho trung chuyển số 3, Lô C12-C14 đường N4, Khu công nghiệp Việt Nam – Singapore II-A, phường Vĩnh Tân, thành phố Tân Uyên, tỉnh Bình Dương (giao tại cổng số 2, liên hệ bảo vệ ca ngày trước khi vào ạ)'

/** Kiện kho kiện đọc thẳng từ kho của trang — độc lập với giao diện đang kiểm. */
function storePackage(page: Page, id: string) {
  return page.evaluate(async ({ db, packageId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const pkg = await getMockDb().getPackage(packageId)
    return { qrToken: pkg.qrToken, flags: pkg.flags, status: pkg.status }
  }, { db: MOCK_DB, packageId: id })
}

async function lookUp(page: Page, code: string) {
  await page.getByRole('textbox', { name: 'Mã QR hoặc mã kiện của bên gửi', exact: true }).fill(code)
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click()
}

test('the token read on a printed label looks the same package up; the A4 sheet holds four labels a page with nothing cut', async ({ page, login, browserErrors }) => {
  await login('/kien-hang', 'dispatcher')
  await expect(page.getByRole('row', { name: /PK-0088/ })).toBeVisible()
  // Một kiện có mã và điểm đến dài nhất form cho phép, hàng dễ vỡ: trường hợp xấu nhất của nhãn
  const long = await page.evaluate(async ({ db, code, destination }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    return (await getMockDb().createPackage({ packageCode: code, lengthCm: 120.5, widthCm: 100.5, heightCm: 100.5, weightKg: 1250.75, handlingClass: 'FRAGILE', destination })).id
  }, { db: MOCK_DB, code: LONG_CODE, destination: LONG_DESTINATION })
  expect([LONG_CODE.length, LONG_DESTINATION.length, long]).toStrictEqual([60, 200, 'PK-0089'])

  await navigateInApp(page, `/kien-hang/nhan?kien=PK-0054,PK-0001,${long},PK-0078,PK-0063`)
  await expect(page.getByText('5 nhãn có thể in', { exact: true })).toBeVisible()
  const sheet = page.getByRole('region', { name: 'Trang nhãn QR' })
  const label = sheet.getByRole('article', { name: 'PK-0054', exact: true })
  for (const text of ['Mã bên gửiPB-HUE-2609-01', 'Loại hàngDễ vỡ', 'Kích thước50 × 40 × 30 cm', 'Khối lượng9,5 kg', 'Điểm đếnKCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', 'PK-0054', 'LoadMaster']) {
    await expect(label).toContainText(text)
  }
  // Dòng "Hàng dễ vỡ" chỉ có ở kiện dễ vỡ: PK-0054 và kiện dài, không có ở thùng nước suối PK-0001
  await expect(sheet.getByText('Hàng dễ vỡ', { exact: true })).toHaveCount(2)
  await expect(sheet.getByRole('article', { name: 'PK-0001', exact: true }).getByText('Hàng dễ vỡ', { exact: true })).toHaveCount(0)
  const token = (await label.getByRole('img', { name: /^Mã QR LM-/ }).getAttribute('aria-label'))?.replace('Mã QR ', '') ?? ''
  expect(token).toBe((await storePackage(page, 'PK-0054')).qrToken)
  await expect(label.getByText(token, { exact: true })).toBeVisible()

  // Bản in: mỗi nhãn 93 × 134 mm, hai cột vừa bề rộng A4 trừ lề (190 mm); không nhãn nào có chữ tràn hay bị cắt
  await page.emulateMedia({ media: 'print' })
  const printed = await page.evaluate(() => {
    const mm = (px: number) => Math.round((px * 25.4) / 96 * 10) / 10
    const sheetBox = document.querySelector('[data-label-sheet]')!.getBoundingClientRect()
    const labels = [...document.querySelectorAll<HTMLElement>('[data-label-sheet] article')].map((article) => {
      const box = article.getBoundingClientRect()
      const inside = [...article.querySelectorAll<HTMLElement>('*')].every((node) => {
        const rect = node.getBoundingClientRect()
        return rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5 && rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5
      })
      const cut = [...article.querySelectorAll<HTMLElement>('span, p')].filter((node) => node.scrollWidth > node.clientWidth + 1 || getComputedStyle(node).textOverflow === 'ellipsis').length
      return { id: article.getAttribute('aria-label'), width: mm(box.width), height: mm(box.height), inside, cut, left: mm(box.left - sheetBox.left) }
    })
    return { sheetWidth: mm(sheetBox.width), visibleOutsideSheet: [...document.body.children].filter((node) => !node.hasAttribute('data-label-sheet') && getComputedStyle(node).display !== 'none').length, labels }
  })
  expect(printed.visibleOutsideSheet).toBe(0)
  expect(printed.labels.map(({ id, width, height, inside, cut }) => ({ id, width, height, inside, cut }))).toStrictEqual(
    ['PK-0054', 'PK-0001', long, 'PK-0078', 'PK-0063'].map((id) => ({ id, width: 93, height: 134, inside: true, cut: 0 })),
  )
  // Hai cột: nhãn thứ hai bắt đầu sau nhãn đầu 93 + 4 mm, nhãn thứ ba xuống hàng
  expect(printed.labels.map((item) => item.left)).toStrictEqual([0, 97, 0, 97, 0])
  await page.emulateMedia({ media: 'screen' })

  // Gõ mã đọc trên nhãn ở Tra cứu kiện (mở từ Kho kiện): ra đúng kiện đó
  await page.getByRole('link', { name: 'Về kho kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await page.getByRole('link', { name: 'Tra cứu kiện', exact: true }).click()
  await page.waitForURL(/\/tra-cuu-kien$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tra cứu kiện', exact: true })).toBeVisible()
  await lookUp(page, token.toLowerCase().replaceAll('-', ' '))
  const card = page.getByRole('region', { name: 'Kiện PB-HUE-2609-01', exact: true })
  await expect(card).toContainText('PK-0054')
  await expect(card).toContainText('KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế')
  await expect(card.getByText('Đã nhập', { exact: true })).toBeVisible()
  await expect(card.getByText('Dễ vỡ', { exact: true })).toBeVisible()

  // In lại nhãn từ Tra cứu kiện: một nhãn, vẫn mã cũ; nút quay lại về đúng kiện đang tra
  await card.getByRole('link', { name: 'In lại nhãn', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan' && url.searchParams.get('kien') === 'PK-0054')
  await expect(page.getByText('1 nhãn có thể in', { exact: true })).toBeVisible()
  await expect(sheet.getByRole('img', { name: `Mã QR ${token}`, exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về tra cứu kiện', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/tra-cuu-kien' && url.searchParams.get('ma') === 'PK-0054')
  await expect(card).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('the warehouse scans a package flagged "not found": the flag is cleared and the dispatcher is told; a foreign code is simply not found', async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  await expect(page.getByRole('list', { name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  const flagged = await storePackage(page, 'PK-0063')
  expect(flagged.flags).toStrictEqual(['NOT_FOUND'])
  // Mã QR của một kiện Phương Nam, đọc khi kho chưa lọc theo phiên rồi trả lại phiên của nhân viên kho
  const foreign = await page.evaluate(async (db) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    const session = store.sessionUser()?.id ?? null
    store.restoreSession(null)
    const pkg = await store.getPackage('PK-PN-0005')
    store.restoreSession(session)
    return { qrToken: pkg.qrToken, packageCode: pkg.packageCode, destination: pkg.destination }
  }, MOCK_DB)

  await page.getByRole('link', { name: 'Tra cứu kiện', exact: true }).click()
  await page.waitForURL(/\/tra-cuu-kien$/)
  await expect(page.getByText('Quét hoặc nhập mã để xem kiện', { exact: true })).toBeVisible()

  // Kiện của công ty khác: "Không tìm thấy", không lộ dữ liệu — theo mã QR lẫn mã của bên gửi
  for (const code of [foreign.qrToken, foreign.packageCode]) {
    await lookUp(page, code)
    await expect(page.getByText(`Không có kiện nào của công ty bạn mang mã ${code}. Xem lại mã in trên nhãn.`, { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: /^Kiện / })).toHaveCount(0)
    await expect(page.getByText(foreign.destination)).toHaveCount(0)
  }

  // Quét (máy thử không có camera: nhập mã in dưới hình QR trong hộp thoại quét) kiện đang mang cờ
  await page.getByRole('button', { name: 'Quét mã QR', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Quét mã QR của kiện' })
  await dialog.getByRole('textbox', { name: 'Nhập mã', exact: true }).fill(flagged.qrToken)
  await dialog.getByRole('button', { name: 'Xác nhận mã', exact: true }).click()
  await expect(dialog).toBeHidden()
  const card = page.getByRole('region', { name: 'Kiện BV-VIN-2609-05', exact: true })
  await expect(card.getByText('Đã gỡ cờ "Không tìm thấy" của kiện BV-VIN-2609-05. Điều phối viên thấy việc này ở chuông thông báo.', { exact: true })).toBeVisible()
  await expect(card.getByText('Không có cờ', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /^Gỡ cờ/ })).toHaveCount(0)
  expect((await storePackage(page, 'PK-0063')).flags).toStrictEqual([])

  // Lối về màn kho; rồi điều phối viên thấy việc này ở chuông và mở được kiện ở Kho kiện
  await page.getByRole('link', { name: 'Về màn kho', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kho')
  await switchUser(page, 'dispatcher')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const found = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Kho tìm thấy lại kiện' })
  await expect(found).toHaveCount(1)
  await expect(found).toContainText('PK-0063')
  await found.click()
  await page.waitForURL((url) => url.pathname === '/kien-hang' && url.searchParams.get('q') === 'PK-0063')
  await expect(page.getByRole('row', { name: /PK-0063/ })).toContainText('Đã nhập')
  expect(browserErrors).toStrictEqual([])
})

test('tablet: the warehouse lookup has 56 px targets and 16 px text, and a package shows its trip and stop', { tag: '@tablet' }, async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  const open = page.getByRole('link', { name: 'Tra cứu kiện', exact: true })
  expect(await heightOf(open)).toBeGreaterThanOrEqual(56)
  await open.tap()
  await page.waitForURL(/\/tra-cuu-kien$/)
  await expect(page.getByText('Quét hoặc nhập mã để xem kiện', { exact: true })).toBeVisible()

  // Kiện đầu tiên của chuyến đã duyệt TRIP-2026-0914, tra bằng mã QR của nó
  const label = await page.evaluate(async (db) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const [first] = await getMockDb().listTripLabels('TRIP-2026-0914')
    return first
  }, MOCK_DB)
  const input = page.getByRole('textbox', { name: 'Mã QR hoặc mã kiện của bên gửi', exact: true })
  await input.fill(label?.qrToken ?? '')
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).tap()
  const card = page.getByRole('region', { name: 'Kiện PKG-001-01', exact: true })
  await expect(card.getByText('Đã gán chuyến', { exact: true })).toBeVisible()
  await expect(card).toContainText('TRIP-2026-0914')
  await expect(card).toContainText('Điểm 1 · ')
  // Nhân viên kho không mở được Chi tiết chuyến: mã chuyến là chữ, không phải liên kết
  await expect(card.getByRole('link', { name: 'TRIP-2026-0914', exact: true })).toHaveCount(0)

  for (const control of [
    input, page.getByRole('button', { name: 'Tra cứu', exact: true }), page.getByRole('button', { name: 'Quét mã QR', exact: true }),
    page.getByRole('link', { name: 'Về màn kho', exact: true }), card.getByRole('link', { name: 'In lại nhãn', exact: true }),
  ]) expect(await heightOf(control)).toBeGreaterThanOrEqual(56)
  // Mọi chữ của vùng nội dung từ 16 px
  const small = await page.locator('main').evaluate((main) => [...main.querySelectorAll<HTMLElement>('*')]
    .filter((node) => !node.closest('svg, .sr-only') && [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()))
    .filter((node) => Number.parseFloat(getComputedStyle(node).fontSize) < 16)
    .map((node) => `${node.tagName} "${node.textContent?.trim().slice(0, 30)}" ${getComputedStyle(node).fontSize}`))
  expect(small).toStrictEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  // In lại nhãn rồi quay lại: nhân viên kho về Tra cứu kiện, không về Kho kiện
  await card.getByRole('link', { name: 'In lại nhãn', exact: true }).tap()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan')
  await expect(page.getByText('1 nhãn có thể in', { exact: true })).toBeVisible()
  expect(await heightOf(page.getByRole('button', { name: 'In nhãn', exact: true }))).toBeGreaterThanOrEqual(56)
  await page.getByRole('link', { name: 'Về tra cứu kiện', exact: true }).tap()
  await page.waitForURL((url) => url.pathname === '/tra-cuu-kien')
  await expect(card).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
