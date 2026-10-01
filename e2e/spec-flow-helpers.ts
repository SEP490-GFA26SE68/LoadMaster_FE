import type { Locator, Page } from '@playwright/test'
import type { Role } from '@/types/user'
import { DEMO_EMAILS, DEMO_PASSWORD, expect } from './fixtures'
import { R3F_DEPS, type R3FModule } from './viewer-helpers'

/**
 * Bước dùng chung của E2E luồng Spec (LM-054). Kho dữ liệu nằm trong bộ nhớ trang: tải lại là mất, nên
 * mọi bước đi bằng thao tác UI; chỗ không có liên kết thì đổi route phía client (`navigateInApp`).
 */
export const MOCK_DB = '/src/lib/mock-db/index.ts'
export const SEED_TRIP = 'TRIP-2026-0914'

/** Đổi route không tải lại trang — giữ kho in-memory và phiên. */
export async function navigateInApp(page: Page, route: string) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
}

/** Nút tài khoản: ở thanh điều hướng của khung ứng dụng, hoặc ở thanh màn chính của kho và tài xế — mỗi màn đúng một nút. */
const accountButton = (page: Page) => page.getByRole('button', { name: /^Tài khoản / })

/**
 * Đăng xuất **trong app** từ bất kỳ màn nào, không tải lại trang: mở Hồ sơ cá nhân (vai trò nào cũng mở được và có thanh điều hướng,
 * kể cả kho, tài xế và Planner vốn là màn toàn màn hình) rồi đăng xuất bằng menu tài khoản. Giao diện phải đang ở tiếng Việt.
 *
 * Chờ màn hồ sơ dựng xong rồi mới mở menu: màn chính của kho và tài xế có nút tài khoản cùng nhãn, mở menu của màn đang rời thì menu
 * bị gỡ cùng màn đó khi route đổi và mục "Đăng xuất" không bao giờ bấm được.
 */
export async function signOutInApp(page: Page) {
  await navigateInApp(page, '/ho-so')
  await expect(page.getByRole('heading', { level: 1, name: 'Hồ sơ cá nhân', exact: true })).toBeVisible()
  await accountButton(page).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
}

/**
 * Điền form đăng nhập đang mở và chờ màn chính của vai trò dựng xong (màn chính nào cũng có nút tài khoản). Chỉ chờ URL rời
 * `/dang-nhap` là chưa đủ: màn đăng nhập còn trên trang thì lần chuyển về màn chính của nó có thể đè lên `navigateInApp` gọi ngay sau
 * đó, trang ở lại màn chính (đỏ ngẫu nhiên, LM-107).
 */
export async function signInWith(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/dang-nhap')
  await expect(accountButton(page)).toBeVisible()
}

/**
 * Đổi sang tài khoản demo của `role` mà không tải lại trang — kho in-memory và mọi thứ vừa ghi được giữ (FE-0-03: không còn vai trò
 * toàn quyền, mỗi bước của kịch bản do đúng vai trò của nó làm). Xong thì đang ở màn chính của vai trò đó; kịch bản tự mở màn cần
 * tới bằng thao tác hoặc `navigateInApp`.
 */
export async function switchUser(page: Page, role: Role) {
  await signOutInApp(page)
  await signInWith(page, DEMO_EMAILS[role])
}

/**
 * Chờ scene của canvas đang có mặt dựng xong: canvas vào DOM trước khi R3F tạo root (R3F đo khung rồi mới tạo) và trước khi
 * camera-controls gắn vào. Gọi sau khi mở lại Planner mà bước kế tiếp đọc thẳng R3F (`waitCameraSettled`, `sceneSnapshot`) — ví dụ
 * ngay sau khi đổi người dùng trong app, lúc chunk 3D đã nạp sẵn nên không còn quãng chờ tải nào che khoảng trống đó.
 *
 * Tự lặp theo animation frame trong `page.evaluate`, không dùng `page.waitForFunction`: hàm kiểm phải `await import(...)` nên là
 * async, mà `waitForFunction` coi Promise nó trả là "đã đạt" và trả về ngay sau lần gọi đầu, không chờ gì.
 */
export async function waitSceneReady(page: Page) {
  await page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const started = performance.now()
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        const canvas = document.querySelector('canvas')
        if (canvas && _roots.get(canvas)?.store.getState().controls) resolve()
        else if (performance.now() - started > 30_000) reject(new Error('scene was not ready within 30 s'))
        else requestAnimationFrame(tick)
      }
      tick()
    })
  }, R3F_DEPS)
}

export type PackageInput = {
  name: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  quantity?: number
}

/** Mở panel "Kiện mới" ở Chi tiết chuyến, điền và lưu. Trả panel để test đọc thêm nếu cần. */
export async function addPackage(page: Page, input: PackageInput): Promise<Locator> {
  await page.getByRole('button', { name: 'Thêm kiện', exact: true }).first().click()
  const panel = page.getByRole('complementary', { name: 'Kiện mới' })
  await panel.getByLabel('Tên kiện').fill(input.name)
  await panel.getByLabel('Dài', { exact: true }).fill(String(input.lengthCm))
  await panel.getByLabel('Rộng', { exact: true }).fill(String(input.widthCm))
  await panel.getByLabel('Cao', { exact: true }).fill(String(input.heightCm))
  await panel.getByLabel('Khối lượng', { exact: true }).fill(String(input.weightKg))
  await panel.getByLabel('Số lượng', { exact: true }).fill(String(input.quantity ?? 1))
  await panel.getByRole('button', { name: 'Lưu kiện', exact: true }).click()
  return panel
}

/** Bấm Tối ưu ở Thiết lập tối ưu và chờ Planner mở revision mới cùng canvas. */
export async function optimizeAndOpenPlanner(page: Page) {
  const optimize = page.getByRole('button', { name: 'Tối ưu', exact: true })
  await expect(optimize).toBeEnabled()
  await optimize.click()
  await page.waitForURL(/\/phuong-an\?revision=MOCK-/, { timeout: 60_000 })
  await page.locator('canvas').waitFor()
}

/**
 * Chữ bị tràn khỏi khung (LM-071): phần tử có chữ trực tiếp mà `scrollWidth` vượt `clientWidth` hoặc nằm ngoài viewport,
 * hoặc rộng hơn nút chứa nó, cộng tràn ngang của trang. Bỏ qua chữ cố ý cắt bằng dấu ba chấm (`truncate`), `sr-only` và nhãn trong khung 3D.
 */
export async function overflowingText(page: Page) {
  return page.evaluate(() => {
    const found: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > root.clientWidth + 1) found.push(`page ${root.scrollWidth} > ${root.clientWidth}`)
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      // Nhãn neo trong khung 3D được SceneCallout giữ trong khung canvas, không thuộc bố cục màn: bỏ qua.
      if (el.closest('.sr-only, svg, div:has(> canvas), div:has(> div > canvas)')) continue
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis') continue
      const hasText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      if (!hasText) continue
      const label = `${el.tagName} "${el.textContent?.trim().slice(0, 40)}"`
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) found.push(`${label} ${el.scrollWidth} > ${el.clientWidth}`)
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && (rect.right > root.clientWidth + 1 || rect.left < -1)) found.push(`${label} outside viewport`)
      // Chữ trong nút tròn/ô cố định có thể tràn ra ngoài mà nút vẫn không cuộn: so khung chữ với khung nút chứa nó.
      const control = el.parentElement?.closest('button, a')
      const box = control?.getBoundingClientRect()
      if (box && rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1)) found.push(`${label} wider than its control`)
    }
    return found
  })
}

/** Chiều cao hiển thị của một phần tử, px. */
export async function heightOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element is not visible')
  return box.height
}
