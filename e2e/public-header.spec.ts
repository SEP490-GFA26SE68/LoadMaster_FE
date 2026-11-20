import type { Page } from '@playwright/test'
import { attachJson, attachScreenshot, expect, test } from './fixtures'

/**
 * Đầu trang công khai của khách khi có đủ lối đăng ký ("Đăng ký trải nghiệm" từ 768 px, "Đăng ký dùng ngay" từ 1.280 px): ở mỗi bề
 * rộng 360 → 1.440 px, tiếng Việt và tiếng Anh, chuột và cảm ứng, không điều khiển nào tràn khỏi đầu trang, đè lên điều khiển khác
 * hay xuống hai dòng, và trang không cuộn ngang.
 *
 * Lối đăng ký chỉ có khi nhóm `registration` nối backend, còn E2E chạy trên kho mẫu. Spec trả lời thay dev server cho đúng một module
 * — `registration-capabilities.ts`, bảng "việc làm được theo nguồn" của nhóm đó — nên app vẽ đúng các điều khiển của chế độ nối
 * backend mà không cần backend, Keycloak hay một dev server thứ hai; code của app không có công tắc nào cho test. Đổi tên hay dời
 * module đó thì các nút đăng ký không hiện và spec đỏ ngay ở bước kiểm điều khiển đang hiện.
 */
const WIDTHS = [360, 390, 640, 768, 1024, 1280, 1366, 1440] as const
const HEIGHT = 800
const TOUCH = { deviceScaleFactor: 1, isMobile: true, hasTouch: true }

const LABELS = {
  vi: { nav: 'Mục của trang giới thiệu', menu: 'Menu trang', signIn: 'Đăng nhập', trial: 'Đăng ký trải nghiệm', registerNow: 'Đăng ký dùng ngay', language: 'Ngôn ngữ giao diện' },
  en: { nav: 'Site sections', menu: 'Site menu', signIn: 'Sign in', trial: 'Try for free', registerNow: 'Get started', language: 'Interface language' },
} as const

type Pointer = 'fine' | 'coarse'
type Lang = keyof typeof LABELS

/** Hàng mục của trang: từ 1.024 px với chuột, từ 1.366 px trên máy cảm ứng; hẹp hơn là nút menu. */
const navRowFrom = (pointer: Pointer) => (pointer === 'fine' ? 1024 : 1366)

async function withSignUp(page: Page) {
  await page.route('**/src/features/registration/registration-capabilities.ts*', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'export const REGISTRATION_CAPABILITIES = { publicSignUp: true }\n' }),
  )
}

/** Chờ bố cục đứng yên sau khi đổi bề rộng: font đã tải, hai khung hình đã vẽ. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

/**
 * Điều khiển đang hiện của đầu trang (liên kết, nút, khay mục): tràn khỏi hàng điều khiển (kể cả lấn vào lề ngang), đè nhau, xuống hai
 * dòng; và trang cuộn ngang. `slack` là số px còn trống của hàng sau khi trừ các nhóm và khe giữa chúng — ghi vào báo cáo để thấy mốc nào sát.
 */
function headerProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > root.clientWidth) problems.push(`page scrolls sideways: ${root.scrollWidth} > ${root.clientWidth}`)
    const header = document.querySelector('header')
    if (!header) return { problems: ['no header on the page'], slack: 0 }
    const frame = header.getBoundingClientRect()
    // Lề ngang của hàng điều khiển cũng là ngoài: nút lấn vào lề chưa làm trang cuộn ngang nhưng đã là tràn
    const row = header.querySelector<HTMLElement>(':scope > div') ?? header
    const rowStyle = getComputedStyle(row)
    const rowRect = row.getBoundingClientRect()
    const left = rowRect.left + parseFloat(rowStyle.paddingLeft)
    const right = rowRect.right - parseFloat(rowStyle.paddingRight)

    const controls = [...header.querySelectorAll<HTMLElement>('a, button, nav')]
      .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
        label: `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.innerText).trim().replace(/\s+/g, ' ').slice(0, 40)}"`,
      }))

    for (const { element, rect, label } of controls) {
      if (rect.left < left - 0.5 || rect.right > right + 0.5 || rect.top < frame.top - 0.5 || rect.bottom > frame.bottom + 0.5) {
        problems.push(`outside the header row (${Math.round(rect.left)}–${Math.round(rect.right)}, row is ${Math.round(left)}–${Math.round(right)}): ${label}`)
      }
      if (element.tagName === 'NAV') continue
      // Số dòng chữ đang hiện của điều khiển, bỏ chữ chỉ cho trình đọc màn hình
      const tops: number[] = []
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || node.parentElement?.closest('.sr-only')) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const line of range.getClientRects()) if (line.width > 0) tops.push(line.top)
      }
      tops.sort((a, b) => a - b)
      const lines = tops.filter((top, index) => index === 0 || top - (tops[index - 1] ?? top) > 6).length
      if (lines > 1) problems.push(`wraps to ${lines} lines: ${label}`)
    }

    controls.forEach((a, index) => {
      for (const b of controls.slice(index + 1)) {
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue
        const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)
        const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top)
        if (overlapX > 0.5 && overlapY > 0.5) problems.push(`overlap by ${Math.round(overlapX)} px: ${a.label} and ${b.label}`)
      }
    })
    const groups = [...row.children].filter((child) => child.getClientRects().length > 0 && getComputedStyle(child).position !== 'absolute')
    const used = groups.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + parseFloat(rowStyle.columnGap || '0') * (groups.length - 1)
    const slack = Math.round(right - left - used)
    return { problems, slack }
  })
}

for (const pointer of ['fine', 'coarse'] as const satisfies readonly Pointer[]) {
  test.describe(`public header, ${pointer} pointer`, () => {
    test.use(pointer === 'coarse' ? TOUCH : {})

    for (const lang of ['vi', 'en'] as const satisfies readonly Lang[]) {
      test(`a guest with both sign-up entry points sees no control overflow, overlap or wrap from 360 to 1,440 px (${lang})`, async ({ page, browserErrors }, testInfo) => {
        const labels = LABELS[lang]
        await withSignUp(page)
        await page.setViewportSize({ width: WIDTHS[0], height: HEIGHT })
        await page.goto(`/gioi-thieu?lang=${lang}`)
        const banner = page.getByRole('banner')
        await expect(banner.getByRole('link', { name: labels.signIn, exact: true })).toBeVisible()
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(pointer === 'coarse')

        const slackByWidth: Record<number, number> = {}
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: HEIGHT })
          await settle(page)
          const at = `${width} px`

          // Điều khiển đang hiện đúng theo mốc: thiếu một nút thì phép đo bên dưới không còn nói gì về nút đó
          await expect(banner.getByRole('link', { name: labels.signIn, exact: true }), at).toBeVisible()
          await expect(banner.getByRole('link', { name: labels.trial, exact: true }), at).toBeVisible({ visible: width >= 768 })
          await expect(banner.getByRole('link', { name: labels.registerNow, exact: true }), at).toBeVisible({ visible: width >= 1280 })
          const row = width >= navRowFrom(pointer)
          await expect(banner.getByRole('navigation', { name: labels.nav, exact: true }), at).toBeVisible({ visible: row })
          await expect(banner.getByRole('button', { name: labels.menu, exact: true }), at).toBeVisible({ visible: !row })
          await expect(banner.getByRole('group', { name: labels.language, exact: true }), at).toBeVisible({ visible: width >= 640 })
          await expect(banner.getByRole('button', { name: labels.language, exact: true }), at).toBeVisible({ visible: width < 640 })

          const { problems, slack } = await headerProblems(page)
          slackByWidth[width] = slack
          if (problems.length > 0) await attachScreenshot(page, testInfo, `public-header-${pointer}-${lang}-${width}`)
          expect.soft(problems, at).toEqual([])
        }
        await attachJson(testInfo, `public-header-slack-${pointer}-${lang}`, slackByWidth)
        expect(browserErrors).toEqual([])
      })
    }
  })
}
