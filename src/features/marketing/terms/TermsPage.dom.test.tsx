import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import { contactPath } from '../contact-form'
import { TermsPage } from './TermsPage'

/**
 * Trang Điều khoản sử dụng ở bản demo (kho mẫu): cùng khung với Chính sách bảo mật — tóm tắt, mục lục có neo, mười một mục đánh số,
 * liên kết chéo, lối hỏi là form liên hệ. Số về credit và kỳ gói đọc từ `BILLING_CONSTANTS`, không viết tay; câu theo bản đang chạy.
 */
function renderTerms(entry = '/dieu-khoan-su-dung') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[entry]}>
            <TermsPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const SECTIONS = [
  ['pham-vi-dich-vu', 'Phạm vi dịch vụ'],
  ['tai-khoan', 'Tài khoản và vai trò'],
  ['dung-thu', 'Dùng thử'],
  ['goi-cuoc-va-credit', 'Gói cước, credit, gia hạn và huỷ'],
  ['ket-qua-toi-uu', 'Kết quả tối ưu là ước lượng'],
  ['du-lieu-cong-ty', 'Dữ liệu của công ty'],
  ['hanh-vi-khong-duoc-phep', 'Những việc không được làm'],
  ['tam-ngung-cham-dut', 'Tạm ngừng và chấm dứt'],
  ['gioi-han-trach-nhiem', 'Giới hạn trách nhiệm'],
  ['thay-doi-dieu-khoan', 'Thay đổi điều khoản'],
  ['lien-he', 'Liên hệ'],
] as const

const { optimizationCost, periodDays, lowCreditRatio } = BILLING_CONSTANTS

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('the terms have a title, the last update date, five summary points and eleven numbered sections', () => {
  renderTerms()
  expect(screen.getByRole('heading', { level: 1, name: 'Điều khoản sử dụng' })).toBeInTheDocument()
  expect(screen.getByText('Cập nhật lần cuối: 21/11/2026')).toBeInTheDocument()
  const summary = within(screen.getByRole('region', { name: 'Tóm tắt nhanh' })).getAllByRole('listitem')
  expect(summary).toHaveLength(5)
  expect(summary[1]).toHaveTextContent(`Một lần chạy tối ưu xếp hàng 3D dùng ${optimizationCost} credit`)
  for (const [id, title] of SECTIONS) {
    const section = screen.getByRole('region', { name: title })
    expect(section).toHaveAttribute('id', id)
    expect(within(section).getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
  }
})

test('the table of contents links to every section anchor and marks the section of the URL anchor', () => {
  renderTerms('/dieu-khoan-su-dung#goi-cuoc-va-credit')
  for (const toc of screen.getAllByRole('navigation', { name: 'Mục lục' })) {
    expect(within(toc).getAllByRole('link').map((link) => link.getAttribute('href'))).toStrictEqual(
      SECTIONS.map(([id]) => `/dieu-khoan-su-dung#${id}`),
    )
    expect(within(toc).getByRole('link', { current: 'location' })).toHaveAccessibleName('Gói cước, credit, gia hạn và huỷ')
  }
  expect(screen.getByText('11 mục')).toBeInTheDocument()
})

test('plans and credits read their numbers from the billing constants and say the prices may be provisional', () => {
  renderTerms()
  const billing = screen.getByRole('region', { name: 'Gói cước, credit, gia hạn và huỷ' })
  expect(billing).toHaveTextContent(`Một kỳ gói dài ${periodDays} ngày.`)
  expect(billing).toHaveTextContent('credit còn thừa, kể cả credit đã mua thêm, không cộng dồn sang kỳ sau')
  expect(billing).toHaveTextContent(`Một lần chạy tối ưu xếp hàng 3D dùng ${optimizationCost} credit, kể cả khi lần chạy đó cho ra ba phương án.`)
  expect(billing).toHaveTextContent(`khi số dư xuống tới ${lowCreditRatio * 100}% credit tháng của gói`)
  expect(billing).toHaveTextContent('Gói mang nhãn "Giá trị tạm — chờ chốt" là giá chưa chốt và có thể đổi.')
  expect(billing).toHaveTextContent('Huỷ gói thì gói không gia hạn nữa, nhưng vẫn dùng được tới hết kỳ đã trả.')
  expect(within(billing).getByRole('link', { name: 'Xem Bảng giá' })).toHaveAttribute('href', '/bang-gia')
  // Bản demo: gói hết hạn không khoá, thanh toán giả lập
  expect(billing).toHaveTextContent('Ở bản demo này, gói đã hết hạn vẫn dùng được số credit còn lại')
  expect(billing).toHaveTextContent('Bản demo này dùng thanh toán giả lập')
  expect(billing).not.toHaveTextContent('nhân viên của công ty không dùng được ứng dụng')
})

test('the demo build has no public trial; results are estimates the company must check before the vehicle leaves', () => {
  renderTerms()
  expect(screen.getByRole('region', { name: 'Dùng thử' })).toHaveTextContent('Bản này chưa mở đăng ký dùng thử công khai')
  const account = screen.getByRole('region', { name: 'Tài khoản và vai trò' })
  expect(account).toHaveTextContent('Điều phối viên, Nhân viên kho, Tài xế, Quản lý công ty và Quản trị công ty')
  expect(account).toHaveTextContent('Tài khoản quản trị công ty đầu tiên do đội LoadMaster tạo khi mở công ty.')
  const results = screen.getByRole('region', { name: 'Kết quả tối ưu là ước lượng' })
  expect(within(results).getAllByRole('listitem')).toHaveLength(3)
  expect(results).toHaveTextContent('Chúng là ước lượng để tham khảo, không phải phép đo trên xe thật.')
  expect(results).toHaveTextContent('MOCK RESULT')
  expect(screen.getByRole('region', { name: 'Tạm ngừng và chấm dứt' })).not.toHaveTextContent('Công ty hết gói đang hiệu lực')
})

test('cross-links lead to the privacy policy and the contact form; no email, phone, address or tax code is written', () => {
  renderTerms('/dieu-khoan-su-dung?lang=vi')
  const docs = screen.getByRole('navigation', { name: 'Điều khoản và chính sách' })
  expect(within(docs).getByRole('link', { current: 'page' })).toHaveTextContent('Điều khoản sử dụng')
  const toPrivacy = screen.getAllByRole('link', { name: 'Đọc Chính sách bảo mật' })
  // Mục "Dữ liệu của công ty" và thẻ "Đọc cùng"
  expect(toPrivacy).toHaveLength(2)
  for (const link of toPrivacy) expect(link).toHaveAttribute('href', '/chinh-sach-bao-mat?lang=vi')
  expect(screen.getByRole('link', { name: 'Mở form liên hệ' })).toHaveAttribute('href', contactPath({ type: 'INQUIRY' }))
  const main = screen.getByRole('main')
  expect(main.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull()
  expect(main.textContent).not.toMatch(/@|Mã số thuế:|Địa chỉ:|Điều \d+|Nghị định|Luật /)
})

test('reads in English with the same anchors and numbers', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderTerms()
  expect(screen.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeInTheDocument()
  expect(screen.getByText('Last updated: Nov 21, 2026')).toBeInTheDocument()
  const billing = screen.getByRole('region', { name: 'Plans, credits, renewal and cancellation' })
  expect(billing).toHaveTextContent(`A plan period lasts ${periodDays} days.`)
  expect(billing).toHaveTextContent(`One 3D load optimization run uses ${optimizationCost} credits`)
  expect(billing).toHaveTextContent('A plan labelled “Provisional value — pending”')
  const [toc] = screen.getAllByRole('navigation', { name: 'Contents' })
  expect(within(toc as HTMLElement).getAllByRole('link')).toHaveLength(SECTIONS.length)
})
