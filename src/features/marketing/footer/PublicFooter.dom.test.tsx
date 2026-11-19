import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { signedInAs } from '@/test/signed-in'
import { PublicFooter } from '../PublicFooter'
import { PublicPage } from '../PublicPage'
import { PAGE_TOP_ID } from './back-to-top'

/**
 * Chân trang của các trang công khai: liên kết chỉ tới thứ đang có (neo đi kèm đường dẫn trang giới thiệu nên bấm từ Bảng giá vẫn tới
 * đúng phần), nút "Lên đầu trang", dải đường có xe tải (chỉ để nhìn), và không có dòng nào `SITE_INFO` chưa có — hôm nay là cả email,
 * điện thoại, địa chỉ lẫn mã số thuế. Kho mẫu không có lối đăng ký nào (bản nối máy chủ: `PublicFooter.backend.dom.test.tsx`).
 */
let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

function renderWith(ui: ReactNode, entry = '/bang-gia') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function linksOf(region: HTMLElement) {
  return within(region).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  io?.restore()
  io = null
  media?.restore()
  media = null
  sessionStorage.clear()
  vi.restoreAllMocks()
})

test('the footer is a labelled landmark with one link column per area; anchors carry the landing page path', () => {
  renderWith(<PublicFooter />)
  const footer = screen.getByRole('contentinfo', { name: 'Thông tin và liên kết của LoadMaster' })

  expect(linksOf(within(footer).getByRole('navigation', { name: 'Sản phẩm' }))).toStrictEqual([
    ['Tính năng', '/gioi-thieu#tinh-nang'],
    ['Cách hoạt động', '/gioi-thieu#cach-hoat-dong'],
    ['Gói cước', '/gioi-thieu#goi-cuoc'],
    ['Bảng giá', '/bang-gia'],
  ])
  expect(linksOf(within(footer).getByRole('navigation', { name: 'Hỗ trợ' }))).toStrictEqual([
    ['Liên hệ tư vấn', '/gioi-thieu#lien-he'],
  ])
  // Kho mẫu: khách không tự đăng ký được, cột Tài khoản chỉ có lối đăng nhập
  expect(linksOf(within(footer).getByRole('navigation', { name: 'Tài khoản' }))).toStrictEqual([
    ['Đăng nhập', '/dang-nhap'],
  ])
  // Không liên kết nào tới trang chưa có (chính sách bảo mật, hỏi đáp) hay ra ngoài app
  const hrefs = within(footer).getAllByRole('link').map((link) => link.getAttribute('href'))
  expect(hrefs.every((href) => /^\/(gioi-thieu#(tinh-nang|cach-hoat-dong|goi-cuoc|lien-he)|bang-gia|dang-nhap)$/.test(href ?? ''))).toBe(true)
  // Trang đang mở là trang riêng (Bảng giá); neo trong trang giới thiệu không phải "trang hiện tại"
  expect(within(footer).getByRole('link', { name: 'Bảng giá' })).toHaveAttribute('aria-current', 'page')
  expect(within(footer).getByRole('link', { name: 'Tính năng' })).not.toHaveAttribute('aria-current')

  // Tiêu đề cột là tiêu đề thật: trình đọc màn hình nhảy được tới từng cột
  expect(within(footer).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual([
    'Sản phẩm', 'Dành cho', 'Hỗ trợ', 'Tài khoản',
  ])
})

test('"Built for" lists the five operating roles of a company by their dictionary names, as text rather than links', () => {
  renderWith(<PublicFooter />)
  const roles = screen.getByRole('list', { name: 'Dành cho' })
  expect(within(roles).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Điều phối viên', 'Nhân viên kho', 'Tài xế', 'Quản lý công ty', 'Quản trị công ty',
  ])
  expect(within(roles).queryByRole('link')).not.toBeInTheDocument()
})

test('the brand block: logo, a secondary consultation link and the language control — no email, phone, address or tax code', () => {
  renderWith(<PublicFooter />, '/gioi-thieu')
  const footer = screen.getByRole('contentinfo')
  expect(within(footer).getByRole('img', { name: 'LoadMaster' })).toBeInTheDocument()

  const cta = within(footer).getByRole('link', { name: 'Nhận tư vấn cho đội xe của bạn' })
  expect(cta).toHaveAttribute('href', '/gioi-thieu#lien-he')
  // Nút phụ (kính) — nút chính duy nhất của trang giới thiệu là "Nhận tư vấn" ở phần mở đầu
  expect(cta.className).not.toMatch(/from-primary-fill-from/)
  expect(within(footer).getByRole('button', { name: 'Ngôn ngữ giao diện' })).toBeInTheDocument()

  // SITE_INFO chưa có email, số điện thoại, địa chỉ, mã số thuế: không dòng nào, không khối <address>, không liên kết mailto: / tel:
  expect(footer.querySelector('address')).toBeNull()
  expect(footer.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull()
  expect(within(footer).queryByText('Email hỗ trợ')).not.toBeInTheDocument()
  expect(within(footer).queryByText('Điện thoại')).not.toBeInTheDocument()
  expect(within(footer).queryByText('Địa chỉ')).not.toBeInTheDocument()
  expect(within(footer).queryByText(/Mã số thuế/)).not.toBeInTheDocument()

  expect(within(footer).getByText(`© ${new Date().getFullYear()} LoadMaster`)).toBeInTheDocument()
  // Ghi công thiết kế thay câu về bản demo; không nhãn MOCK RESULT
  expect(within(footer).getByText('Design by Kangnahyun')).toBeInTheDocument()
  expect(within(footer).queryByText(/MOCK/)).not.toBeInTheDocument()
})

test('signed in, the account column opens the app at the role home, like the header', async () => {
  signedInAs('dispatcher')
  renderWith(<PublicFooter />)
  const account = screen.getByRole('navigation', { name: 'Tài khoản' })
  expect(await within(account).findByRole('link', { name: 'Vào ứng dụng' })).toHaveAttribute('href', '/chuyen')
  expect(linksOf(account)).toStrictEqual([['Vào ứng dụng', '/chuyen']])
})

test('reads in English', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderWith(<PublicFooter />)
  const footer = screen.getByRole('contentinfo', { name: 'LoadMaster information and links' })
  expect(within(footer).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual([
    'Product', 'Built for', 'Support', 'Account',
  ])
  expect(linksOf(within(footer).getByRole('navigation', { name: 'Product' }))).toStrictEqual([
    ['Features', '/gioi-thieu#tinh-nang'],
    ['How it works', '/gioi-thieu#cach-hoat-dong'],
    ['Plans', '/gioi-thieu#goi-cuoc'],
    ['Pricing', '/bang-gia'],
  ])
  expect(within(footer).getByRole('link', { name: 'Ask for a consultation' })).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(within(footer).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/dang-nhap')
  expect(within(footer).getByText('Dispatcher')).toBeInTheDocument()
  expect(within(footer).getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
})

test('"Back to top" scrolls smoothly to the top and moves focus to the top of the page, so the next Tab reaches the skip link', async () => {
  const user = userEvent.setup()
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  renderWith(<PublicPage><p>Nội dung</p></PublicPage>)

  await user.click(screen.getByRole('button', { name: 'Lên đầu trang' }))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  const top = document.getElementById(PAGE_TOP_ID)
  expect(top).toHaveFocus()
  expect(top).toHaveTextContent('Đầu trang')
  await user.tab()
  expect(screen.getByRole('link', { name: 'Bỏ qua tới nội dung chính' })).toHaveFocus()
})

test('with reduced motion, "Back to top" jumps instead of animating', async () => {
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': true })
  const user = userEvent.setup()
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  renderWith(<PublicFooter />)
  await user.click(screen.getByRole('button', { name: 'Lên đầu trang' }))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
})

test('the road strip is decorative; the truck waits off-road and drives in once when the strip comes into view', () => {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({})
  const { container } = renderWith(<PublicFooter />)
  const road = container.querySelector<HTMLElement>('.footer-road')
  expect(road).toHaveAttribute('aria-hidden', 'true')
  expect(road?.dataset.road).toBe('ready')

  io.trigger(road as HTMLElement, { isIntersecting: false })
  expect(road?.dataset.road).toBe('ready')
  io.trigger(road as HTMLElement)
  expect(road?.dataset.road).toBe('go')
  // Một lần: thôi theo dõi sau khi xe chạy
  expect(io.instances.every((observer) => observer.targets.size === 0)).toBe(true)
})

test('with reduced motion, or without IntersectionObserver, the truck is simply parked', () => {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': true })
  const { container, unmount } = renderWith(<PublicFooter />)
  expect(container.querySelector<HTMLElement>('.footer-road')?.dataset.road).toBeUndefined()
  expect(io.instances).toHaveLength(0)
  unmount()

  io.restore()
  io = null
  media.restore()
  media = null
  const again = renderWith(<PublicFooter />)
  expect(again.container.querySelector<HTMLElement>('.footer-road')?.dataset.road).toBeUndefined()
})
