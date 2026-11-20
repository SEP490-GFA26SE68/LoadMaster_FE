import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { contactPath } from '../contact-form'
import { PrivacyPage } from './PrivacyPage'

/**
 * Trang chính sách bảo mật công khai ở bản demo (kho mẫu), trong khung chung của trang pháp lý: tóm tắt, mục lục có neo, mười hai mục
 * đánh số, liên kết sang Điều khoản sử dụng và lối hỏi là form liên hệ. Câu theo nguồn đang chạy — không máy chủ, không đăng ký công khai.
 * Không pháp nhân, email, điện thoại hay hạn lưu nào chưa có.
 */
function renderPrivacy(entry = '/chinh-sach-bao-mat') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
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

const SECTIONS = [
  ['pham-vi', 'Phạm vi và mục đích'],
  ['form-lien-he', 'Form liên hệ'],
  ['dang-ky', 'Đăng ký dùng thử và đăng ký trả phí'],
  ['tai-khoan', 'Tài khoản và đăng nhập'],
  ['du-lieu-van-hanh', 'Dữ liệu vận hành của công ty'],
  ['thiet-bi', 'Vị trí và camera của thiết bị'],
  ['ban-thu-va-tro-ly', 'Bản thử trên trang giới thiệu và trợ lý'],
  ['ben-thu-ba', 'Bên thứ ba nhận dữ liệu'],
  ['trinh-duyet', 'Trên trình duyệt của bạn'],
  ['thoi-gian-luu', 'Thời gian lưu'],
  ['quyen-cua-ban', 'Quyền của bạn'],
  ['thay-doi', 'Thay đổi chính sách'],
] as const

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('the policy has a title, the last update date, a short summary and twelve numbered sections', () => {
  renderPrivacy()
  expect(screen.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeInTheDocument()
  expect(screen.getByText('Cập nhật lần cuối: 21/11/2026')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Tóm tắt nhanh' })).getAllByRole('listitem')).toHaveLength(5)
  for (const [id, title] of SECTIONS) {
    const section = screen.getByRole('region', { name: title })
    expect(section).toHaveAttribute('id', id)
    expect(within(section).getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
  }
})

test('the table of contents links to every section anchor in order and marks the section of the URL anchor', () => {
  renderPrivacy('/chinh-sach-bao-mat?lang=vi#tai-khoan')
  // Hai bản mục lục (thu gọn trên điện thoại, cột dính từ 1.024 px), cùng một danh sách
  const tocs = screen.getAllByRole('navigation', { name: 'Mục lục' })
  expect(tocs).toHaveLength(2)
  for (const toc of tocs) {
    const links = within(toc).getAllByRole('link')
    expect(links.map((link) => [link.getAttribute('href'), link.textContent])).toStrictEqual(
      SECTIONS.map(([id, title], index) => [`/chinh-sach-bao-mat?lang=vi#${id}`, `${String(index + 1).padStart(2, '0')}${title}`]),
    )
    expect(within(toc).getByRole('link', { current: 'location' })).toHaveAccessibleName('Tài khoản và đăng nhập')
  }
  expect(screen.getByText('12 mục')).toBeInTheDocument()
})

test('the document switch and the related card lead to the terms of use, keeping the language', () => {
  renderPrivacy('/chinh-sach-bao-mat?lang=vi')
  const docs = screen.getByRole('navigation', { name: 'Điều khoản và chính sách' })
  expect(within(docs).getByRole('link', { current: 'page' })).toHaveTextContent('Chính sách bảo mật')
  expect(within(docs).getByRole('link', { name: 'Điều khoản sử dụng' })).toHaveAttribute('href', '/dieu-khoan-su-dung?lang=vi')
  expect(screen.getByRole('link', { name: 'Đọc Điều khoản sử dụng' })).toHaveAttribute('href', '/dieu-khoan-su-dung?lang=vi')
  // Không nút chính: in trang là nút phụ trên dải trời
  expect(screen.getByRole('button', { name: 'In trang này' })).toBeInTheDocument()
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

test('the demo build says what it does: no public sign-up, sample sign-in, sessionStorage only, no tracking, no server-only data', () => {
  renderPrivacy()
  expect(screen.getByRole('region', { name: 'Đăng ký dùng thử và đăng ký trả phí' })).toHaveTextContent(
    'Bản này chưa mở đăng ký công khai: tài khoản công ty do đội LoadMaster tạo sau khi nhận yêu cầu liên hệ.',
  )
  const account = screen.getByRole('region', { name: 'Tài khoản và đăng nhập' })
  expect(account).toHaveTextContent('Bản demo này đăng nhập bằng tài khoản mẫu ngay trong trình duyệt')
  expect(account).not.toHaveTextContent(/Keycloak|ký thoả thuận/)
  const company = screen.getByRole('region', { name: 'Dữ liệu vận hành của công ty' })
  expect(company).toHaveTextContent('Yêu cầu hỗ trợ người dùng công ty gửi từ menu tài khoản')
  expect(company).not.toHaveTextContent('bảng lương')
  const device = screen.getByRole('region', { name: 'Vị trí và camera của thiết bị' })
  expect(device).toHaveTextContent('Ở bản demo này, vị trí chỉ hiện trong chính trình duyệt này')
  expect(device).toHaveTextContent('Vị trí đó chỉ dùng ngay trên điện thoại, không được gửi đi.')
  const browser = screen.getByRole('region', { name: 'Trên trình duyệt của bạn' })
  expect(browser).toHaveTextContent('Ứng dụng không dùng localStorage')
  expect(browser).toHaveTextContent('LoadMaster không gắn công cụ thống kê truy cập, quảng cáo hay theo dõi người xem nào.')
  const local = screen.getByRole('region', { name: 'Bản thử trên trang giới thiệu và trợ lý' })
  expect(local).toHaveTextContent('Lumo trả lời ngay trên trình duyệt')
  expect(local).not.toHaveTextContent('Mô tả hàng bằng lời')
  expect(screen.getByRole('region', { name: 'Bên thứ ba nhận dữ liệu' })).not.toHaveTextContent('Anthropic')
  const retention = screen.getByRole('region', { name: 'Thời gian lưu' })
  expect(retention).toHaveTextContent('đóng hoặc tải lại mọi thẻ là mọi thứ trở về dữ liệu mẫu')
  expect(retention).not.toHaveTextContent('chưa ấn định')
})

test('questions go to the contact form; no email, phone, address, tax code or invented retention period is written anywhere', () => {
  renderPrivacy()
  const closing = screen.getByRole('heading', { level: 2, name: 'Còn câu hỏi?' }).parentElement
  expect(closing).not.toBeNull()
  expect(within(closing as HTMLElement).getByRole('link', { name: 'Mở form liên hệ' })).toHaveAttribute('href', contactPath({ type: 'INQUIRY' }))
  const main = screen.getByRole('main')
  expect(main.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull()
  expect(main.textContent).not.toMatch(/@|lưu trong \d|Mã số thuế:|Địa chỉ:/)
})

test('reads in English, with the date in English and the same anchors', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderPrivacy()
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
  expect(screen.getByText('Last updated: Nov 21, 2026')).toBeInTheDocument()
  const [toc] = screen.getAllByRole('navigation', { name: 'Contents' })
  expect(toc).toBeDefined()
  expect(within(toc as HTMLElement).getAllByRole('link').map((link) => link.getAttribute('href'))).toStrictEqual(
    SECTIONS.map(([id]) => `/chinh-sach-bao-mat#${id}`),
  )
  expect(screen.getByRole('link', { name: 'Read the terms of use' })).toHaveAttribute('href', '/dieu-khoan-su-dung')
})
