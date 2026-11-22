import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { RequirementFormDialog } from './RequirementFormDialog'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

// Chỉ điều phối viên tạo được yêu cầu giao, nên form chỉ có ô dán tin nhắn với điều phối viên
vi.mock('@/features/auth/AuthProvider', () => {
  const auth = { user: { id: 'US-0002', fullName: 'Lê Quốc Bảo', email: 'dieuphoi@longbinh.vn', role: 'dispatcher', status: 'active' } }
  return { useAuth: () => auth, useAuthSafe: () => auth }
})

/**
 * Kỹ năng E của trợ lý: điều phối viên dán tin nhắn của khách, máy chủ đọc ra bản nháp, panel điền năm ô của form tạo yêu cầu giao.
 * Bản nháp không bao giờ tự lưu và không chạm khách hàng, kiện, toạ độ — điều phối viên vẫn phải chọn khách rồi tự bấm Tạo yêu cầu.
 */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const CUSTOMERS = {
  success: true, page: 0, size: 100, totalElements: 1, totalPages: 1, last: true,
  data: [{ id: 3, companyId: 1, name: 'Nước Suối An Phú', contactPhone: '0909000111', address: '5 Nguyễn Trãi, Quận 5' }],
}

const DRAFT = {
  destinationText: 'Kho Bình Dương, 12 Đại lộ Bình Dương, Thuận An',
  deadline: '2030-11-25T10:00:00',
  priority: 'HIGH',
  expectedPackageCount: 46,
  note: 'Gọi anh Tâm trước 30 phút.',
  customerNameGuess: 'Nước Suối An Phú',
  packages: [{ description: 'thùng nước 20 lít', quantity: 46, lengthCm: 30, widthCm: 30, heightCm: 50, weightKg: 21 }],
  missing: [],
}

const PASTED = 'Bên em Nước Suối An Phú gửi 46 thùng nước 20L tới Kho Bình Dương, 12 Đại lộ Bình Dương, Thuận An trước 10h ngày 25/11, gấp nhé.'

function routes(draft: FakeRoutes[string]): FakeRoutes {
  return {
    'GET /api/customers': { body: CUSTOMERS },
    'GET /api/packages': { body: { success: true, data: [], last: true } },
    'POST /api/assistant/requirement-draft': draft,
  }
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RequirementFormDialog open onOpenChange={() => {}} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => connectApiAuth(() => Promise.resolve('token-1')))
afterEach(() => vi.unstubAllGlobals())

test('đọc tin nhắn của khách điền điểm đến, hạn, ưu tiên, số kiện, ghi chú; khách hàng vẫn trống và không có lần lưu nào', async () => {
  const user = userEvent.setup()
  const { calls } = stubBackend(routes({ body: envelope(DRAFT) }))
  renderDialog()

  const dialog = within(await screen.findByRole('dialog'))
  const panel = within(dialog.getByRole('region', { name: 'Điền nhanh từ tin nhắn của khách' }))
  expect(panel.getByText(/rồi tới Anthropic/)).toBeInTheDocument()
  await dialog.findByRole('combobox', { name: 'Khách hàng / Chủ hàng' })

  await user.click(panel.getByRole('textbox', { name: 'Nội dung khách gửi' }))
  await user.paste(PASTED)
  await user.click(panel.getByRole('button', { name: 'Đọc và điền form' }))

  expect(await panel.findByText('Đã điền 7 ô từ nội dung khách gửi. Xem lại trước khi lưu.')).toBeInTheDocument()
  expect(calls.filter((call) => call.path === '/api/assistant/requirement-draft')).toEqual([
    expect.objectContaining({ method: 'POST', body: { text: PASTED } }),
  ])

  expect(dialog.getByRole('textbox', { name: 'Tên điểm đến' })).toHaveValue(DRAFT.destinationText)
  expect(dialog.getByRole('textbox', { name: 'Địa chỉ' })).toHaveValue(DRAFT.destinationText)
  expect(dialog.getByLabelText(/^Hạn giao/)).toHaveValue('2030-11-25')
  expect(dialog.getByLabelText(/^Giờ/)).toHaveValue('10:00')
  expect(dialog.getByRole('combobox', { name: 'Ưu tiên' })).toHaveTextContent('Cao')
  expect(dialog.getByRole('spinbutton', { name: 'Số kiện dự kiến' })).toHaveValue(46)
  expect(dialog.getByRole('textbox', { name: 'Ghi chú' })).toHaveValue(DRAFT.note)

  // Khách hàng chỉ được gợi tên, không được chọn; danh sách hàng chỉ để đối chiếu
  expect(panel.getByText('Cần bạn bổ sung: Khách hàng / Chủ hàng.')).toBeInTheDocument()
  expect(panel.getByText(/Bên gửi trong tin nhắn: Nước Suối An Phú/)).toBeInTheDocument()
  expect(panel.getByText(/46 × thùng nước 20 lít/)).toBeInTheDocument()
  expect(dialog.getByRole('combobox', { name: 'Khách hàng / Chủ hàng' })).not.toHaveTextContent('Nước Suối An Phú')

  await user.click(dialog.getByRole('button', { name: 'Tạo yêu cầu' }))
  expect((await dialog.findAllByText('Vui lòng chọn khách hàng')).length).toBeGreaterThan(0)
  expect(dialog.getByRole('combobox', { name: 'Khách hàng / Chủ hàng' })).toHaveAttribute('aria-invalid', 'true')
  expect(calls.some((call) => call.path === '/api/delivery-requirements')).toBe(false)
})

test('máy chủ báo vượt giới hạn lượt dùng: panel nói thẳng và không điền gì', async () => {
  const user = userEvent.setup()
  stubBackend(routes({ status: 429, body: { success: false, code: 'ASSISTANT_RATE_LIMITED', message: 'Too many requests' } }))
  renderDialog()

  const dialog = within(await screen.findByRole('dialog'))
  const panel = within(dialog.getByRole('region', { name: 'Điền nhanh từ tin nhắn của khách' }))
  await user.click(panel.getByRole('textbox', { name: 'Nội dung khách gửi' }))
  await user.paste(PASTED)
  await user.click(panel.getByRole('button', { name: 'Đọc và điền form' }))

  expect(await panel.findByRole('alert')).toHaveTextContent('Bạn đã dùng trợ lý AI nhiều lần trong giờ qua.')
  expect(dialog.getByRole('textbox', { name: 'Địa chỉ' })).toHaveValue('')
})

test('nút đọc mờ khi chưa dán gì', async () => {
  stubBackend(routes({ body: envelope(DRAFT) }))
  renderDialog()
  const dialog = within(await screen.findByRole('dialog'))
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Đọc và điền form' })).toBeDisabled())
})
