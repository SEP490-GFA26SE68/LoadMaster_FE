import { test as base, type Page, type PageScreenshotOptions, type TestInfo } from '@playwright/test'
import type { Role } from '@/types/user'

export { expect } from '@playwright/test'

/**
 * Tài khoản demo công khai theo vai trò (seed kho, `src/lib/mock-db/seed-users.ts`), chung mật khẩu: tài khoản đầu tiên của vai trò —
 * tám vai trò của backend (nhân sự công ty là của Long Bình).
 */
export const DEMO_EMAILS: Readonly<Record<Role, string>> = {
  systemAdmin: 'quantri@loadmaster.vn',
  systemManager: 'nentang@loadmaster.vn',
  systemSupporter: 'hotro@loadmaster.vn',
  companyAdmin: 'qtcongty@loadmaster.vn',
  manager: 'quanly@loadmaster.vn',
  dispatcher: 'dieuphoi@loadmaster.vn',
  warehouse: 'kho@loadmaster.vn',
  driver: 'taixe@loadmaster.vn',
}
export const DEMO_PASSWORD = 'loadmaster'

export const PLANNER_ROUTE = '/chuyen/TRIP-2026-0914/phuong-an'

type ViewerFixtures = {
  /** Gom thêm `console.error`; bản `.mjs` chỉ bật ở suite vận hành và scene-first. */
  collectConsoleErrors: boolean
  /** Lỗi trình duyệt của `page`. Test tự khẳng định mảng rỗng ở cuối kịch bản, như bản `.mjs`. */
  browserErrors: string[]
  /**
   * Mở route cần đăng nhập rồi đăng nhập bằng tài khoản demo của `role` (mặc định điều phối) qua form thật. `RequireAuth`
   * ghi nhớ route kèm query nên app quay lại đúng route. Phiên nằm trong sessionStorage của tab, vì vậy mọi `page.goto`
   * sau đó trong cùng test vẫn giữ đăng nhập. Không còn vai trò toàn quyền (FE-0-01): kịch bản đi qua màn của nhiều vai trò đăng
   * nhập đúng vai trò của từng bước, đổi người ngay trong app bằng `switchUser` (`spec-flow-helpers.ts`) — tải lại trang là mất kho
   * in-memory.
   */
  login: (route: string, role?: Role) => Promise<void>
}

export const test = base.extend<ViewerFixtures>({
  collectConsoleErrors: [false, { option: true }],
  // Playwright đọc tham số đầu bằng destructuring để suy ra phụ thuộc; fixture này không cần gì.
  // oxlint-disable-next-line no-empty-pattern
  browserErrors: async ({}, provide) => {
    await provide([])
  },
  page: async ({ page, browserErrors, collectConsoleErrors }, provide) => {
    page.on('pageerror', (error) => browserErrors.push(error.message))
    if (collectConsoleErrors) {
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(message.text())
      })
    }
    await provide(page)
  },
  login: async ({ page, hasTouch }, provide) => {
    await provide(async (route, role = 'dispatcher') => {
      await page.goto(route)
      await page.getByLabel('Email', { exact: true }).fill(DEMO_EMAILS[role])
      await page.getByLabel('Mật khẩu', { exact: true }).fill(DEMO_PASSWORD)
      const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true })
      await (hasTouch ? submit.tap() : submit.click())
      await page.waitForURL((url) => url.pathname !== '/dang-nhap')
    })
  },
})

/** Ảnh và số đo từng được ghi vào `node_modules/.tmp/…`; nay đính kèm vào báo cáo Playwright. */
export async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' })
}

/** `E2E_SCREENSHOT_DIR=docs/screenshots/<bộ>` thì ghi thêm file `<tên>.png` để cập nhật bộ ảnh tài liệu. */
export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string, options: PageScreenshotOptions = {}) {
  const dir = process.env.E2E_SCREENSHOT_DIR
  await testInfo.attach(name, { body: await page.screenshot(dir ? { ...options, path: `${dir}/${name}.png` } : options), contentType: 'image/png' })
}
