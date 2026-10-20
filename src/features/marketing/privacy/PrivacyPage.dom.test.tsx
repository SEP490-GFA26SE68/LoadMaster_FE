import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { PrivacyPage } from './PrivacyPage'

/** Trang chính sách bảo mật công khai: nhãn bản nháp, các mục có neo, đúng ô của form liên hệ và đúng người xem được. */
function renderPrivacy(entry = '/chinh-sach-bao-mat') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[entry]}>
            <PrivacyPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('the page is marked as a draft and every section has an anchor the table of contents links to', () => {
  renderPrivacy()
  expect(screen.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeInTheDocument()
  expect(screen.getAllByText('Bản nháp — chờ bộ phận pháp lý duyệt')).toHaveLength(1)

  const sections = screen.getAllByRole('region').filter((region) => region.id !== '')
  expect(sections.map((section) => [section.id, within(section).getByRole('heading', { level: 2 }).textContent])).toStrictEqual([
    ['thong-tin-thu-thap', 'Thông tin thu thập'],
    ['muc-dich', 'Dùng vào việc gì'],
    ['noi-luu', 'Lưu ở đâu'],
    ['ai-xem', 'Ai xem được'],
    ['thoi-gian-luu', 'Lưu bao lâu'],
    ['quyen-cua-ban', 'Quyền của bạn'],
    ['bo-nho-trinh-duyet', 'Bộ nhớ trình duyệt và cookie'],
    ['lien-he', 'Liên hệ'],
  ])
  const toc = within(screen.getByRole('navigation', { name: 'Mục lục' }))
  expect(toc.getAllByRole('link').map((link) => link.getAttribute('href'))).toStrictEqual(sections.map((section) => `/chinh-sach-bao-mat#${section.id}`))
})

test('the content says what the code does: the form fields, who can read them, where they are kept, how to reach support', () => {
  renderPrivacy()
  const collect = within(screen.getByRole('region', { name: 'Thông tin thu thập' }))
  expect(collect.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Họ tên — bắt buộc', 'Email — bắt buộc', 'Số điện thoại — không bắt buộc', 'Tên công ty — không bắt buộc',
    'Bạn cần gì — bắt buộc', 'Gói quan tâm — không bắt buộc', 'Nội dung — không bắt buộc',
  ])
  expect(within(screen.getByRole('region', { name: 'Ai xem được' })).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Hỗ trợ khách hàng', 'Quản lý nền tảng', 'Quản trị hệ thống',
  ])
  // Kho mẫu: trang nói yêu cầu chỉ nằm trong trình duyệt này
  expect(screen.getByRole('region', { name: 'Lưu ở đâu' })).toHaveTextContent('Trang bạn đang mở là bản demo')

  const contact = within(screen.getByRole('region', { name: 'Liên hệ' }))
  expect(contact.getByRole('link', { name: 'hotro@loadmaster.vn' })).toHaveAttribute('href', 'mailto:hotro@loadmaster.vn')
  // Chưa có điện thoại, địa chỉ, mã số thuế: không có dòng nào
  expect(contact.queryByText(/Điện thoại|Địa chỉ|Mã số thuế/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về trang giới thiệu' })).toHaveAttribute('href', '/gioi-thieu')
  expect(screen.queryByRole('button', { name: /Đăng ký|Mua/ })).not.toBeInTheDocument()
})

test('the table of contents and the way back keep the query string, so a chosen language stays on the URL', () => {
  renderPrivacy('/chinh-sach-bao-mat?lang=en')
  const toc = within(screen.getByRole('navigation', { name: 'Mục lục' }))
  expect(toc.getAllByRole('link')[0]).toHaveAttribute('href', '/chinh-sach-bao-mat?lang=en#thong-tin-thu-thap')
  expect(screen.getByRole('link', { name: 'Về trang giới thiệu' })).toHaveAttribute('href', '/gioi-thieu?lang=en')
})
