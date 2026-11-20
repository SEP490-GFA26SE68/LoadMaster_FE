import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeReply } from '@/test/fake-backend'
import { assistantSession, GUEST_KEY_STORAGE } from '../assistant/assistant-session'
import { LandingTry } from './LandingTry'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

/**
 * "Mô tả hàng bằng lời" khi trợ lý AI chạy trên máy chủ (AGENTS mục 1, "Thử với hàng của bạn"): máy chủ đọc mô tả ra số, form được điền,
 * khách vẫn tự bấm "Tính ba phương án" — bộ tối ưu không chạy. Ô máy chủ không đọc được để trống và hiện lỗi, kèm danh sách "Cần bạn nhập
 * thêm"; không nhận ra kiện nào hay máy chủ lỗi thì form giữ nguyên. Form mở với xe 520 × 200 × 200 cm, 3.500 kg và hai loại thùng.
 */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const PATH = 'POST /api/assistant/public/try-extract'
const DESCRIPTION = 'Xe 5 tấn thùng 6 m. 200 thùng 40×30×30 nặng 12,5 kg giao điểm 1, 20 kiện 120×100×150 80 kg giao điểm 2.'
const ANSWER = { timeout: 4000 }
const carton = (patch: Record<string, unknown> = {}) => ({ lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 12.5, quantity: 200, stop: 1, ...patch })
const FULL = {
  truck: { lengthCm: 600, widthCm: 230, heightCm: 240, payloadKg: 5000 },
  cartons: [carton(), carton({ lengthCm: 120, widthCm: 100, heightCm: 150, weightKg: 80, quantity: 20, stop: 2 })],
  assumptions: ['Thùng xe 5 tấn: lấy lòng thùng 600 × 230 × 240 cm.'],
  missing: [],
}

afterEach(() => {
  cleanup()
  assistantSession.reset()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

function renderTry(reply: FakeReply) {
  const backend = stubBackend({ [PATH]: reply })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <I18nProvider>
          <LandingTry />
          <Toaster />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const section = within(screen.getByRole('region', { name: 'Thử với hàng của bạn' }))
  const user = userEvent.setup()
  const describe = async () => {
    await user.click(section.getByRole('textbox', { name: 'Mô tả hàng bằng lời' }))
    await user.paste(DESCRIPTION)
    await user.click(section.getByRole('button', { name: 'Điền giúp tôi' }))
  }
  return { section, user, describe, calls: backend.calls }
}

type Section = ReturnType<typeof renderTry>['section']

const field = (section: Section, group: string, name: string) => within(section.getByRole('group', { name: group })).getByRole('textbox', { name })
const values = (section: Section, group: string) =>
  ['Dài (cm)', 'Rộng (cm)', 'Cao (cm)', group === 'Thùng xe' ? 'Tải trọng (kg)' : 'Nặng (kg)', ...(group === 'Thùng xe' ? [] : ['Số kiện'])]
    .map((name) => (field(section, group, name) as HTMLInputElement).value)

const IDLE = 'Bấm “Tính ba phương án” để xem kết quả với số đang nhập.'

test('the server reads the description and the form is filled, but nothing is computed until the visitor presses the run button', async () => {
  const { section, describe, calls } = renderTry({ body: envelope(FULL) })
  // Ô trống: nút mờ; có mô tả, bộ đếm và dòng nói mô tả đi đâu
  expect(section.getByRole('button', { name: 'Điền giúp tôi' })).toBeDisabled()
  expect(section.getByRole('textbox', { name: 'Mô tả hàng bằng lời' })).toHaveAccessibleDescription(/0 \/ 1\.000 ký tự.*máy chủ LoadMaster và Anthropic/)
  // Dòng riêng tư dưới form không còn nói "không gửi lên máy chủ" khi ngay trên có ô gửi mô tả đi
  expect(section.getByText(/^Số trong form chỉ nằm trên trình duyệt này\. Chỉ mô tả bằng lời ở trên được gửi đi/)).toBeInTheDocument()
  expect(section.queryByText(/không gửi lên máy chủ/)).not.toBeInTheDocument()

  await describe()

  expect(await section.findByText('Đã điền thùng xe và 2 loại kiện. Kiểm lại rồi bấm “Tính ba phương án”.', {}, ANSWER)).toBeInTheDocument()
  expect(values(section, 'Thùng xe')).toEqual(['600', '230', '240', '5000'])
  expect(values(section, 'Loại kiện 1')).toEqual(['40', '30', '30', '12,5', '200'])
  expect(values(section, 'Loại kiện 2')).toEqual(['120', '100', '150', '80', '20'])
  expect(within(section.getByRole('group', { name: 'Loại kiện 2' })).getByRole('combobox', { name: 'Điểm giao' })).toHaveTextContent('Điểm 2')
  expect(within(section.getByRole('list', { name: 'Lumo đã giả định' })).getByText(FULL.assumptions[0]!)).toBeInTheDocument()
  expect(section.queryByRole('list', { name: 'Cần bạn nhập thêm' })).not.toBeInTheDocument()
  // Bộ tối ưu chưa chạy
  expect(section.getByText(IDLE)).toBeInTheDocument()
  expect(section.queryByText(/^Đã tính xong ba phương án/)).not.toBeInTheDocument()

  expect(calls).toHaveLength(1)
  expect(calls[0]?.body).toStrictEqual({ text: DESCRIPTION, locale: 'vi', guestKey: sessionStorage.getItem(GUEST_KEY_STORAGE) })
  expect(sessionStorage.getItem(GUEST_KEY_STORAGE)).toBeTruthy()
})

test('a field the server could not read stays empty with its error, is listed under "Cần bạn nhập thêm", and no toast appears', async () => {
  const reply = { truck: null, cartons: [carton({ weightKg: null })], assumptions: [], missing: ['cartons[0].weightKg'] }
  const { section, describe } = renderTry({ body: envelope(reply) })

  await describe()

  const missing = await section.findByRole('list', { name: 'Cần bạn nhập thêm' }, ANSWER)
  expect(within(missing).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Khối lượng — loại kiện 1'])
  expect(section.getByText('Đã điền 1 loại kiện, thùng xe giữ nguyên. Kiểm lại rồi bấm “Tính ba phương án”.')).toBeInTheDocument()
  // Xe không có trong mô tả: giữ thùng xe đang có; một loại kiện thay hai loại cũ
  expect(values(section, 'Thùng xe')).toEqual(['520', '200', '200', '3500'])
  expect(values(section, 'Loại kiện 1')).toEqual(['40', '30', '30', '', '200'])
  expect(section.queryByRole('group', { name: 'Loại kiện 2' })).not.toBeInTheDocument()
  expect(await within(section.getByRole('group', { name: 'Loại kiện 1' })).findByRole('textbox', { name: 'Nặng (kg)' })).toHaveAttribute('aria-invalid', 'true')
  expect(document.querySelector('[data-sonner-toast]')).toBeNull()
  expect(section.getByText(IDLE)).toBeInTheDocument()
})

test('no carton recognised: the form stays as it was and the box says so', async () => {
  const { section, describe } = renderTry({ body: envelope({ truck: { lengthCm: 600, widthCm: 230, heightCm: 240, payloadKg: 5000 }, cartons: [], assumptions: [], missing: ['cartons'] }) })

  await describe()

  expect(await section.findByText(/^Chưa nhận ra kiện hàng nào trong mô tả, nên form giữ nguyên/, {}, ANSWER)).toBeInTheDocument()
  expect(values(section, 'Thùng xe')).toEqual(['520', '200', '200', '3500'])
  expect(values(section, 'Loại kiện 1')).toEqual(['60', '40', '40', '15', '80'])
  expect(values(section, 'Loại kiện 2')).toEqual(['80', '60', '50', '30', '20'])
  expect(section.queryByRole('list', { name: 'Cần bạn nhập thêm' })).not.toBeInTheDocument()
})

test('the server cannot read the description: the form stays as it was and an error line says nothing was filled', async () => {
  const { section, describe } = renderTry({ status: 503, body: { success: false, code: 'ASSISTANT_UNAVAILABLE', message: 'Model down' } })

  await describe()

  expect(await section.findByRole('alert', {}, ANSWER)).toHaveTextContent('Lumo chưa đọc được mô tả lúc này nên chưa điền giúp được. Bạn nhập số vào form nhé.')
  expect(values(section, 'Thùng xe')).toEqual(['520', '200', '200', '3500'])
  expect(values(section, 'Loại kiện 1')).toEqual(['60', '40', '40', '15', '80'])
  expect(values(section, 'Loại kiện 2')).toEqual(['80', '60', '50', '30', '20'])
  expect(section.queryByText(/^Đã điền/)).not.toBeInTheDocument()
  expect(document.querySelector('[data-sonner-toast]')).toBeNull()
})

test('filling the form after a run marks the three plans as computed with the old numbers', async () => {
  const { section, user, describe } = renderTry({ body: envelope(FULL) })
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))
  expect(await section.findByText('Đã tính xong ba phương án cho 100 kiện.', {}, ANSWER)).toBeInTheDocument()

  await describe()

  expect(await section.findByText('Số trong form đã đổi sau lần tính này — bấm “Tính ba phương án” để tính lại.', {}, ANSWER)).toBeInTheDocument()
})
