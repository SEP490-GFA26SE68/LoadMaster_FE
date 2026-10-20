import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { PublicHeader } from './PublicHeader'

/**
 * Đầu trang công khai: nút quả địa cầu thay hai nút VI | EN, nút "Liên hệ" gọn cho màn hẹp, nền đặc hơn khi cuộn qua phần mở đầu, và
 * chỉ báo kính nằm dưới mục của phần đang đọc (chỉ để nhìn). jsdom không dựng bố cục nên vị trí các phần là số giả cho `getBoundingClientRect`.
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

function renderHeader(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <PublicHeader />
            <main>
              <section className="landing-cinema" data-testid="hero" />
              <section id="tinh-nang" data-testid="features" />
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
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

test('the language control is one globe button without text; picking English translates the header in place', async () => {
  const user = userEvent.setup()
  const banner = renderHeader('/gioi-thieu')
  expect(banner.queryByRole('group', { name: 'Ngôn ngữ giao diện' })).not.toBeInTheDocument()
  const globe = banner.getByRole('button', { name: 'Ngôn ngữ giao diện' })
  expect(globe).toHaveTextContent(/^$/)
  expect(globe).toHaveAttribute('title', 'Ngôn ngữ giao diện: Tiếng Việt')

  await user.click(globe)
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toStrictEqual(['VI Tiếng Việt', 'EN English'])
  await user.click(screen.getByRole('menuitemradio', { name: 'EN English' }))
  expect(banner.getByRole('button', { name: 'Interface language' })).toHaveAttribute('title', 'Interface language: English')
  expect(banner.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/dang-nhap')
})

test('narrow screens get a contact button outside the menu; sign-in keeps its name when only its icon shows', () => {
  const banner = renderHeader('/gioi-thieu')
  // Mục Liên hệ của hàng điều hướng (từ 1.024 px) và nút gọn (dưới 1.024 px) cùng đích; CSS chỉ hiện một trong hai
  const contacts = banner.getAllByRole('link', { name: 'Liên hệ' })
  expect(contacts).toHaveLength(2)
  for (const link of contacts) expect(link).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(banner.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap')
  expect(banner.getByRole('button', { name: 'Menu trang' })).toBeInTheDocument()
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
  place(screen.getByTestId('features'), { top: -1400, bottom: -200 })
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
  expect(nav.getByRole('link', { name: 'Tính năng' })).not.toHaveAttribute('data-active')

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
  const nav = within(banner.getByRole('navigation', { name: 'Mục của trang giới thiệu' }))
  expect(nav.queryAllByRole('link').filter((link) => link.hasAttribute('data-active'))).toHaveLength(0)
  expect(nav.getByRole('link', { name: 'Bảng giá' })).toHaveAttribute('aria-current', 'page')
})
