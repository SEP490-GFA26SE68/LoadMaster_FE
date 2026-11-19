import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { contactPath } from '../contact-form'
import { PrivacyPage } from './PrivacyPage'

/**
 * Trang chính sách bảo mật công khai ở bản demo (kho mẫu): câu theo nguồn đang chạy — không máy chủ, không đăng ký công khai —, ngày cập
 * nhật định dạng theo ngôn ngữ, lối hỏi về dữ liệu là form liên hệ. Không có câu nào về hạn lưu trữ, pháp nhân hay email chưa có.
 */
function renderPrivacy() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/chinh-sach-bao-mat']}>
            <PrivacyPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('the policy has a title, the last update date and five sections', () => {
  renderPrivacy()
  expect(screen.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeInTheDocument()
  expect(screen.getByText('Cập nhật lần cuối: 19/11/2026')).toBeInTheDocument()
  const main = screen.getByRole('main')
  expect(within(main).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual([
    'Form liên hệ',
    'Đăng ký dùng thử và đăng ký trả phí',
    'Khi dùng ứng dụng',
    'Trên trình duyệt của bạn',
    'Hỏi về dữ liệu của bạn',
  ])
})

test('the contact section lists exactly the fields the form sends, with their labels from the form', () => {
  renderPrivacy()
  const contact = screen.getByRole('region', { name: 'Form liên hệ' })
  expect(within(contact).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Họ tên (bắt buộc)',
    'Email (bắt buộc)',
    'Bạn cần gì (bắt buộc)',
    'Số điện thoại (nếu bạn điền)',
    'Tên công ty (nếu bạn điền)',
    'Gói quan tâm (nếu bạn điền)',
    'Nội dung (nếu bạn điền)',
  ])
  expect(contact).toHaveTextContent('Chỉ Hỗ trợ khách hàng và Quản trị hệ thống của đội LoadMaster đọc và xử lý yêu cầu liên hệ.')
  // Bản demo: yêu cầu chỉ nằm trong trình duyệt, không có câu "gửi tới máy chủ"
  expect(contact).toHaveTextContent('Bản demo này chưa nối máy chủ')
  expect(contact).not.toHaveTextContent('Yêu cầu được gửi tới máy chủ của LoadMaster.')
})

test('the demo build says what it does: no public sign-up, sign-in with sample accounts, sessionStorage only, no tracking', () => {
  renderPrivacy()
  expect(screen.getByRole('region', { name: 'Đăng ký dùng thử và đăng ký trả phí' })).toHaveTextContent(
    'Bản này chưa mở đăng ký công khai: tài khoản công ty do đội LoadMaster tạo sau khi nhận yêu cầu liên hệ.',
  )
  const app = screen.getByRole('region', { name: 'Khi dùng ứng dụng' })
  expect(app).toHaveTextContent('Bản demo này đăng nhập bằng tài khoản mẫu ngay trong trình duyệt')
  expect(app).not.toHaveTextContent('Keycloak')
  const browser = screen.getByRole('region', { name: 'Trên trình duyệt của bạn' })
  expect(browser).toHaveTextContent('Ứng dụng không dùng localStorage')
  expect(browser).toHaveTextContent('LoadMaster không gắn công cụ thống kê truy cập, quảng cáo hay theo dõi người xem nào.')
  expect(browser).toHaveTextContent('Lumo trả lời ngay trên trình duyệt')
})

test('questions about data go to the contact form; no email, phone, address or retention period is written anywhere', () => {
  renderPrivacy()
  const questions = screen.getByRole('region', { name: 'Hỏi về dữ liệu của bạn' })
  expect(within(questions).getByRole('link', { name: 'Mở form liên hệ' })).toHaveAttribute('href', contactPath({ type: 'INQUIRY' }))
  const main = screen.getByRole('main')
  expect(main.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull()
  expect(main.textContent).not.toMatch(/@|lưu trong \d|ngày kể từ|Mã số thuế:/)
})

test('reads in English, with the date in English', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderPrivacy()
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
  expect(screen.getByText('Last updated: Nov 19, 2026')).toBeInTheDocument()
  expect(within(screen.getByRole('main')).getAllByRole('heading', { level: 2 })).toHaveLength(5)
})
