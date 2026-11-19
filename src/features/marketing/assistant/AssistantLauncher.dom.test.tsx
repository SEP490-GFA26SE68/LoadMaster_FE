import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { LandingPage } from '../LandingPage'
import { assistantSession } from './assistant-session'

/**
 * Trợ lý "Hỏi Lumo" trên trang giới thiệu: mở / đóng và focus, câu hỏi gợi ý → câu trả lời, tính gói, câu không có trong tài liệu → chuyển
 * câu hỏi sang form liên hệ. jsdom không có `matchMedia` nên khung chat ở dạng máy tính (thẻ không modal). Câu trả lời tới sau 500 ms.
 */
const ANSWER = { timeout: 4000 }

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search + location.hash}</p>
}

function renderLanding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <Routes>
              <Route path="/gioi-thieu" element={<><LandingPage /><Where /></>} />
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function openAssistant() {
  const user = userEvent.setup()
  renderLanding()
  const launcher = screen.getByRole('button', { name: 'Hỏi Lumo' })
  expect(launcher).toHaveAttribute('aria-expanded', 'false')
  await user.click(launcher)
  const panel = await screen.findByRole('dialog', { name: 'Lumo' })
  return { user, launcher, panel: within(panel) }
}

afterEach(() => {
  cleanup()
  assistantSession.reset()
  sessionStorage.clear()
})

test('passive until asked: opens on click with the transparency line, focus in the input; Esc closes and returns focus', async () => {
  renderLanding()
  // Không tự mở: trang vừa mở chỉ có nút
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  cleanup()

  const { user, launcher, panel } = await openAssistant()
  expect(launcher).toHaveAttribute('aria-expanded', 'true')
  expect(panel.getByText('Lumo trả lời từ tài liệu của LoadMaster — không phải nhân viên tư vấn.')).toBeInTheDocument()
  expect(panel.getByRole('log', { name: 'Cuộc trò chuyện với Lumo' })).toHaveAttribute('aria-live', 'polite')
  await waitFor(() => expect(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' })).toHaveFocus())
  // Bốn câu hỏi gợi ý; chưa hỏi gì thì không có "Bắt đầu lại"
  expect(within(panel.getByRole('group', { name: 'Câu hỏi gợi ý' })).getAllByRole('button')).toHaveLength(4)
  expect(panel.queryByRole('button', { name: 'Bắt đầu lại' })).not.toBeInTheDocument()

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(launcher).toHaveFocus()
  expect(launcher).toHaveAttribute('aria-expanded', 'false')
})

test('a suggested question gets a short answer from the catalogue, follow-ups and a way to a person; restart clears it', async () => {
  const { user, panel } = await openAssistant()
  await user.click(panel.getByRole('button', { name: 'Giá các gói?' }))
  const log = within(panel.getByRole('log'))
  expect(log.getByText('Giá các gói?')).toBeInTheDocument()
  expect(await log.findByText(/^Mỗi gói tính theo tháng/, {}, ANSWER)).toBeInTheDocument()
  expect(await log.findByText(/^Basic: .+ mỗi tháng, 3\.000 credit mỗi tháng$/, {}, ANSWER)).toBeInTheDocument()
  expect(log.getByRole('link', { name: 'Mở bảng giá' })).toHaveAttribute('href', '/bang-gia')
  expect(log.getByRole('button', { name: 'Chưa đúng ý? Hỏi đội LoadMaster' })).toBeInTheDocument()
  expect(log.getByRole('group', { name: 'Hỏi tiếp' })).toBeInTheDocument()

  await user.click(panel.getByRole('button', { name: 'Bắt đầu lại' }))
  expect(log.queryByText('Giá các gói?', { selector: 'p' })).not.toBeInTheDocument()
  expect(panel.getByRole('group', { name: 'Câu hỏi gợi ý' })).toBeInTheDocument()
  expect(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' })).toHaveFocus()
})

test('plan advisor: runs × 2 credits, the cheapest plan on sale that covers it; a typed number works too', async () => {
  const { user, panel } = await openAssistant()
  await user.click(panel.getByRole('button', { name: 'Gói nào hợp với công ty tôi?' }))
  const quick = await panel.findByRole('group', { name: 'Chọn nhanh số lần chạy mỗi tháng' }, ANSWER)
  await user.click(within(quick).getByRole('button', { name: '2.000 lần mỗi tháng' }))
  expect(await panel.findByText('2.000 lần × 2 credit mỗi lần = 4.000 credit mỗi tháng.', {}, ANSWER)).toBeInTheDocument()
  expect(await panel.findByText(/^Gói rẻ nhất đủ dùng: Pro — /, {}, ANSWER)).toBeInTheDocument()
  expect(panel.getByText('Đây chỉ là ước tính theo số lần chạy bạn nhập.')).toBeInTheDocument()

  // Hỏi lại, lần này gõ số vào ô hỏi
  await user.click(panel.getByRole('button', { name: 'Gói nào hợp với công ty tôi?' }))
  await panel.findAllByRole('group', { name: 'Chọn nhanh số lần chạy mỗi tháng' }, ANSWER)
  await user.type(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }), 'khoảng 6.000 lần{Enter}')
  expect(await panel.findByText('6.000 lần × 2 credit mỗi lần = 12.000 credit mỗi tháng.', {}, ANSWER)).toBeInTheDocument()
  expect(panel.getByText(/^Gói rẻ nhất đủ dùng: Ultimate — /)).toBeInTheDocument()
})

test('the advisor number field rejects what is not a whole number of runs', async () => {
  const { user, panel } = await openAssistant()
  await user.click(panel.getByRole('button', { name: 'Gói nào hợp với công ty tôi?' }))
  const field = await panel.findByRole('spinbutton', { name: 'Số lần chạy mỗi tháng' }, ANSWER)
  await user.type(field, '0')
  await user.click(panel.getByRole('button', { name: 'Tính gói' }))
  expect(await panel.findByText('Nhập số nguyên từ 1 đến 100.000.')).toBeInTheDocument()
  expect(field).toHaveAttribute('aria-invalid', 'true')
})

test('a question outside the documents says so, and hands the questions to the contact form', async () => {
  const { user, panel } = await openAssistant()
  await user.type(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }), 'Thời tiết hôm nay thế nào?{Enter}')
  expect(await panel.findByText(/^Mình chưa có câu trả lời cho câu này/, {}, ANSWER)).toBeInTheDocument()

  await user.click(panel.getByRole('button', { name: 'Gửi câu hỏi cho đội LoadMaster' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByTestId('where')).toHaveTextContent('/gioi-thieu?loai=hoi-thong-tin#lien-he')
  const message = await screen.findByRole('textbox', { name: 'Nội dung' }, ANSWER)
  await waitFor(() => expect(message).toHaveValue('Câu hỏi tôi đã hỏi trợ lý Lumo:\n- Thời tiết hôm nay thế nào?'))
})
