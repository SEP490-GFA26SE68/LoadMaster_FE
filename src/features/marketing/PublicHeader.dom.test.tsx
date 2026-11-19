import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { PublicHeader } from './PublicHeader'

/**
 * Đầu trang công khai ở chế độ kho mẫu: điều khiển của khách và của người đã đăng nhập, nền đặc hơn khi cuộn qua phần mở đầu, chỉ báo
 * kính nằm dưới mục của phần đang đọc (chỉ để nhìn) và vạch tiến độ cuộn. jsdom không dựng bố cục nên vị trí các phần là số giả cho
 * `getBoundingClientRect`; bề rộng thật của các điều khiển đo ở `e2e/public-header.spec.ts`. Lối đăng ký khi nối backend:
 * `PricingPage.backend.dom.test.tsx`.
 */

type Box = { top: number; bottom: number }

function rect({ top, bottom }: Box): DOMRect {
  return { top, bottom, left: 0, right: 0, x: 0, y: top, width: 0, height: bottom - top, toJSON: () => ({}) }
}

/** Đặt chỗ của một phần tử trên màn (theo khung nhìn). */
function place(element: Element, box: Box) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(box))
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
  act(() => {
    fireEvent.scroll(window)
  })
}

function renderHeader(path: string, { progress = false }: { progress?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={[path]}>
            <PublicHeader progress={progress} />
            <main>
              <section className="landing-cinema" data-testid="hero" />
              <section data-testid="problems" />
              <section id="cach-hoat-dong" data-testid="how" />
              <section id="lien-he" data-testid="contact" />
            </main>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return within(screen.getByRole('banner'))
}

beforeEach(() => {
  sessionStorage.clear()
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 6000 })
})
afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

test('a guest on the sample store gets the three page links, the language controls, sign-in and the menu button — no sign-up', () => {
  const banner = renderHeader('/gioi-thieu')
  const nav = within(banner.getByRole('navigation', { name: 'Mục của trang giới thiệu' }))
  expect(nav.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toStrictEqual([
    ['Cách hoạt động', '/gioi-thieu#cach-hoat-dong'],
    ['Bảng giá', '/bang-gia'],
    ['Liên hệ', '/gioi-thieu#lien-he'],
  ])
  // Không có nút "Liên hệ" gọn ngoài hàng mục: chỗ đó là của nút đăng ký khi nối backend
  expect(banner.getAllByRole('link', { name: 'Liên hệ' })).toHaveLength(1)
  // Hai nút VI | EN (từ 640 px) và nút mở menu ngôn ngữ (hẹp hơn) cùng có trong DOM; CSS chỉ hiện một trong hai
  expect(banner.getByRole('group', { name: 'Ngôn ngữ giao diện' })).toBeInTheDocument()
  expect(banner.getByRole('button', { name: /^Ngôn ngữ giao diện/ })).toBeInTheDocument()
  expect(banner.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap')
  expect(banner.getByRole('button', { name: 'Menu trang' })).toBeInTheDocument()
  expect(banner.queryByRole('link', { name: /Đăng ký/ })).not.toBeInTheDocument()
})

test('picking English translates the header in place', async () => {
  const user = userEvent.setup()
  const banner = renderHeader('/gioi-thieu')
  await user.click(within(banner.getByRole('group', { name: 'Ngôn ngữ giao diện' })).getByRole('button', { name: /English/ }))
  expect(await banner.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/dang-nhap')
  expect(banner.getByRole('navigation', { name: 'Site sections' })).toBeInTheDocument()
})

test('someone signed in gets "Vào ứng dụng" to the home screen of the role instead of sign-in', () => {
  signedInAs('dispatcher')
  const banner = renderHeader('/gioi-thieu')
  expect(banner.getByRole('link', { name: 'Vào ứng dụng' })).toHaveAttribute('href', '/chuyen')
  expect(banner.queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument()
})

test('the header turns more solid once the hero has scrolled under it, and back at the top', () => {
  renderHeader('/gioi-thieu')
  const header = screen.getByRole('banner')
  place(header, { top: 0, bottom: 64 })
  const hero = screen.getByTestId('hero')
  expect(header).not.toHaveAttribute('data-scrolled')

  // Còn trong phần mở đầu: chưa đổi
  place(hero, { top: -200, bottom: 500 })
  scrollTo(200)
  expect(header).not.toHaveAttribute('data-scrolled')

  place(hero, { top: -800, bottom: -100 })
  scrollTo(800)
  expect(header).toHaveAttribute('data-scrolled')

  place(hero, { top: 0, bottom: 700 })
  scrollTo(0)
  expect(header).not.toHaveAttribute('data-scrolled')
})

test('on the landing page the glass indicator sits under the section being read, visually only', () => {
  const banner = renderHeader('/gioi-thieu')
  place(screen.getByTestId('problems'), { top: -1400, bottom: -200 })
  place(screen.getByTestId('how'), { top: -100, bottom: 900 })
  place(screen.getByTestId('contact'), { top: 2400, bottom: 3200 })
  scrollTo(2000)

  const navigation = banner.getByRole('navigation', { name: 'Mục của trang giới thiệu' })
  // Khay kính như thanh của ứng dụng; chỉ báo trượt là phần tử trang trí của khay
  expect(navigation).toHaveClass('glass-nav')
  const indicator = navigation.querySelector('.glass-follow')
  expect(indicator).toHaveAttribute('aria-hidden')
  const nav = within(navigation)
  const how = nav.getByRole('link', { name: 'Cách hoạt động' })
  expect(how).toHaveAttribute('data-active')
  expect(indicator).not.toHaveAttribute('hidden')
  expect(how).not.toHaveAttribute('aria-current')
  expect(nav.getByRole('link', { name: 'Liên hệ' })).not.toHaveAttribute('data-active')

  // Giữa hai phần (phần khác của trang): không mục nào
  place(screen.getByTestId('how'), { top: -1200, bottom: -200 })
  scrollTo(3100)
  expect(nav.queryAllByRole('link').filter((link) => link.hasAttribute('data-active'))).toHaveLength(0)
  expect(indicator).toHaveAttribute('hidden')
})

test('on the pricing page no section is highlighted and Pricing is the current page', () => {
  const banner = renderHeader('/bang-gia')
  place(screen.getByTestId('how'), { top: -100, bottom: 900 })
  scrollTo(1000)
  const navigation = banner.getByRole('navigation', { name: 'Mục của trang giới thiệu' })
  const nav = within(navigation)
  expect(nav.queryAllByRole('link').filter((link) => link.hasAttribute('data-active'))).toHaveLength(0)
  expect(nav.getByRole('link', { name: 'Bảng giá' })).toHaveAttribute('aria-current', 'page')
  expect(navigation.querySelector('.glass-follow')).not.toHaveAttribute('hidden')
})

test('the scroll progress bar is decoration and only drawn when the page asks for it', () => {
  const { unmount } = render(
    <I18nProvider>
      <AuthProvider source="mock">
        <MemoryRouter initialEntries={['/bang-gia']}>
          <PublicHeader />
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
  expect(screen.getByRole('banner').querySelector('.landing-progress')).toBeNull()
  unmount()

  renderHeader('/gioi-thieu', { progress: true })
  expect(screen.getByRole('banner').querySelector('.landing-progress')).toHaveAttribute('aria-hidden')
})
