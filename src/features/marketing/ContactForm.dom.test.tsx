import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { CONTACT_MIN_FILL_MS } from './contact-form'
import { ContactSection } from './ContactSection'

/**
 * Form liên hệ của khách: ô đồng ý bắt buộc, ô bẫy và thời gian điền tối thiểu chặn gửi tự động (không lưu, không báo thành công giả),
 * câu nói thật của bản demo kèm email hỗ trợ. Đồng hồ: `Date.now` chạy thật cộng `skew` — form ghi lúc hiện ra (jsdom không có
 * IntersectionObserver nên là lúc dựng), test dời đồng hồ qua ngưỡng mà không phải chờ thật. Seed có LH-001 → LH-003.
 */
const SLOW = { timeout: 5000 }
let skew = 0

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

beforeEach(() => {
  skew = 0
  const realNow = Date.now.bind(Date)
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + skew)
})
afterEach(() => vi.restoreAllMocks())

function renderContact(entry = '/gioi-thieu?goi=PLAN-002&loai=bao-gia') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[entry]}>
          <ContactSection />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Họ tên' }, SLOW), 'Trần Minh Quân')
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'quan@vantaiminhquan.vn')
}

async function contactCount() {
  const db = getMockDb()
  db.restoreSession('US-NT-02')
  const count = (await db.listGuestContacts()).length
  db.restoreSession(null)
  return count
}

test('the form says the demo keeps the request in this browser and links the support email', async () => {
  renderContact()
  const note = await screen.findByText(/Yêu cầu chỉ được lưu trong trình duyệt này/, {}, SLOW)
  expect(note.closest('p')?.querySelector('a')).toHaveAttribute('href', 'mailto:hotro@loadmaster.vn')
  const privacy = screen.getByRole('link', { name: 'Đọc chính sách bảo mật (mở thẻ mới)' })
  expect(privacy).toHaveAttribute('href', '/chinh-sach-bao-mat?lang=vi')
  expect(privacy).toHaveAttribute('target', '_blank')
  expect(privacy).toHaveAttribute('rel', expect.stringContaining('noopener'))
  // Ô bẫy không có tên truy cập, không nhận Tab
  const trap = document.querySelector<HTMLInputElement>('input[name="website"]')
  expect(trap).toHaveAttribute('tabindex', '-1')
  expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull()
})

test('nothing is sent until the consent box is ticked', async () => {
  const user = userEvent.setup()
  renderContact()
  await fillRequired(user)
  skew = CONTACT_MIN_FILL_MS
  const before = await contactCount()
  const consent = screen.getByRole('checkbox', { name: 'Tôi đồng ý để LoadMaster dùng thông tin này để liên hệ tư vấn' })
  expect(consent).toHaveAttribute('aria-required', 'true')

  await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await screen.findByText('Đánh dấu ô đồng ý để gửi yêu cầu')).toBeInTheDocument()
  expect(consent).toHaveAttribute('aria-invalid', 'true')
  expect(await contactCount()).toBe(before)

  await user.click(consent)
  await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
  const sent = await screen.findByRole('heading', { name: /^Đã ghi nhận yêu cầu LH-\d+$/ }, SLOW)
  expect(sent).toHaveFocus()
  expect(sent.closest('[role="status"]')).toHaveTextContent('Bản demo chỉ lưu yêu cầu trong trình duyệt này')
  expect(await contactCount()).toBe(before + 1)
})

test('a filled trap field is not saved and not reported as sent, only asked to try again', async () => {
  const user = userEvent.setup()
  renderContact()
  await fillRequired(user)
  await user.click(screen.getByRole('checkbox', { name: /Tôi đồng ý/ }))
  skew = CONTACT_MIN_FILL_MS * 10
  const before = await contactCount()
  const trap = document.querySelector<HTMLInputElement>('input[name="website"]')
  if (trap === null) throw new Error('Thiếu ô bẫy')
  await user.type(trap, 'https://spam.example')

  await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await screen.findByText('Chưa gửi được yêu cầu. Vui lòng thử lại sau giây lát.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Đã ghi nhận/ })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Họ tên' })).toHaveValue('Trần Minh Quân')
  expect(await contactCount()).toBe(before)
})

test('a send sooner than the minimum fill time is held back; the same form goes through once enough time has passed', async () => {
  const user = userEvent.setup()
  renderContact()
  await fillRequired(user)
  await user.click(screen.getByRole('checkbox', { name: /Tôi đồng ý/ }))
  const before = await contactCount()

  // Đồng hồ lùi về trước lúc form hiện ra: chắc chắn chưa đủ thời gian, kể cả trên máy chậm
  skew = -60_000
  await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await screen.findByText('Chưa gửi được yêu cầu. Vui lòng thử lại sau giây lát.')).toBeInTheDocument()
  expect(await contactCount()).toBe(before)

  skew = CONTACT_MIN_FILL_MS
  await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await screen.findByRole('heading', { name: /^Đã ghi nhận yêu cầu LH-\d+$/ }, SLOW)).toBeInTheDocument()
  expect(await contactCount()).toBe(before + 1)
})
