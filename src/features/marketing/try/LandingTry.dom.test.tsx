import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LandingTry } from './LandingTry'

/**
 * "Thử với hàng của bạn" (AGENTS mục 1): jsdom không có Web Worker nên bộ tối ưu mô phỏng chạy trên luồng gọi, kết quả về ngay. Form mở với
 * xe 3,5 tấn (520 × 200 × 200 cm) và 120 thùng 60 × 40 × 40 cm cho một điểm giao, nên lần chạy đầu xếp hết 120 / 120 ở cả ba phương án.
 */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

function renderTry(lang: 'vi' | 'en' = 'vi') {
  if (lang === 'en') window.history.replaceState(null, '', '/?lang=en')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <I18nProvider>
          <LandingTry />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return within(screen.getByRole('region', { name: lang === 'en' ? 'Try it with your cargo' : 'Thử với hàng của bạn' }))
}

type Section = ReturnType<typeof renderTry>

function field(section: Section, group: string, name: string) {
  return within(section.getByRole('group', { name: group })).getByRole('textbox', { name })
}

async function retype(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, text: string) {
  await user.clear(input)
  await user.type(input, text)
}

test('the visitor runs the optimiser in the browser and gets three plans side by side, without a MOCK RESULT tag', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  const runButton = section.getByRole('button', { name: 'Tính ba phương án' })
  // Nút phụ: nút chính duy nhất của trang ở phần mở đầu
  expect(runButton.className).not.toMatch(/from-primary-fill/)
  expect(section.getByText('Bấm “Tính ba phương án” để xem kết quả với số đang nhập.')).toBeInTheDocument()

  await user.click(runButton)

  expect(await section.findByText('Đã tính xong ba phương án cho 120 kiện.')).toBeInTheDocument()
  const plans = ['A', 'B', 'C'].map((label) => within(section.getByRole('group', { name: `Phương án ${label}` })))
  expect(plans.map((plan) => plan.getByRole('heading', { level: 4 }).textContent)).toEqual([
    'APhương án A:Tối đa thể tích',
    'BPhương án B:Cân bằng tải trục',
    'CPhương án C:Ít dỡ-xếp lại',
  ])
  for (const plan of plans) {
    expect(plan.getByText('120 / 120', { selector: 'dd span' })).toBeInTheDocument()
    expect(plan.getByRole('img', { name: /: 120 \/ 120 kiện đã xếp$/ })).toBeInTheDocument()
    // Một điểm giao: không có hàng dỡ-xếp lại
    expect(plan.queryByText('Kiện dỡ-xếp lại')).not.toBeInTheDocument()
  }
  // Phương án B đưa trọng tâm về giữa thùng: tốt nhất ở hàng đó, nhãn xám "Tốt nhất"
  expect(plans[1]?.getByText('Tốt nhất')).toBeInTheDocument()
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(section.getByText(/Số do bộ tối ưu mô phỏng của LoadMaster chạy trên trình duyệt của bạn tính/)).toBeInTheDocument()
  expect(section.getByText(/không hỏi trục xe nên không tính tải trục/)).toBeInTheDocument()
  expect(section.getByText(/Mọi kiện cùng một điểm giao nên không kiện nào phải dỡ-xếp lại/)).toBeInTheDocument()
  // Kho mẫu: khách không tự đăng ký được, lối đi tiếp là form liên hệ
  // Chữ hiện ra là "Nhận tư vấn"; đuôi "cho hàng của bạn" chỉ cho trình đọc màn hình (khối mở đầu cũng có nút "Nhận tư vấn")
  expect(section.getByRole('link', { name: 'Nhận tư vấn cho hàng của bạn' })).toHaveAttribute('href', expect.stringContaining('#lien-he'))
  expect(section.queryByRole('link', { name: /^Đăng ký trải nghiệm/ })).not.toBeInTheDocument()

  // Đổi số sau khi tính: kết quả cũ được nói rõ là cũ
  await retype(user, field(section, 'Thùng xe', 'Dài (cm)'), '600')
  expect(section.getByText(/Số trong form đã đổi sau lần tính này/)).toBeInTheDocument()
})

test('a second carton type for another stop brings the rehandling row and the stop legend', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  await user.click(section.getByRole('button', { name: 'Thêm loại kiện' }))
  expect(field(section, 'Loại kiện 2', 'Dài (cm)')).toHaveFocus()

  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  expect(await section.findByText('Đã tính xong ba phương án cho 180 kiện.')).toBeInTheDocument()
  expect(within(section.getByRole('group', { name: 'Phương án C' })).getByText('Kiện dỡ-xếp lại')).toBeInTheDocument()
  expect(section.getByText('Màu kiện theo điểm giao')).toBeInTheDocument()
  expect(section.getByText('Điểm 2', { selector: 'li' })).toBeInTheDocument()

  // Bỏ loại kiện 2: con trỏ về nút "Thêm loại kiện"
  await user.click(section.getByRole('button', { name: 'Bỏ loại kiện 2' }))
  expect(section.queryByRole('group', { name: 'Loại kiện 2' })).not.toBeInTheDocument()
  expect(section.getByRole('button', { name: 'Thêm loại kiện' })).toHaveFocus()
})

test('cartons the truck cannot take are listed per carton type with the translated reason', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  await retype(user, field(section, 'Thùng xe', 'Tải trọng (kg)'), '1000')
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  // 1.000 kg cho thùng 15 kg: 66 thùng lên xe, 54 thùng ở lại
  expect(await section.findByText('Đã tính xong ba phương án cho 120 kiện.')).toBeInTheDocument()
  for (const label of ['A', 'B', 'C']) {
    const plan = within(section.getByRole('group', { name: `Phương án ${label}` }))
    expect(plan.getByText('66 / 120', { selector: 'dd span' })).toBeInTheDocument()
    expect(plan.getByText('Loại kiện 1: 54 kiện — Vượt tải trọng tối đa của xe')).toBeInTheDocument()
  }
})

test('a wrong field blocks the run and says why, in the field', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  const width = field(section, 'Thùng xe', 'Rộng (cm)')
  await retype(user, width, '400')
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  expect(await section.findByText('Từ 100 đến 260')).toBeInTheDocument()
  expect(width).toHaveAttribute('aria-invalid', 'true')
  // Không chạy: cột kết quả vẫn ở trạng thái chờ
  expect(section.getByText('Bấm “Tính ba phương án” để xem kết quả với số đang nhập.')).toBeInTheDocument()
  expect(section.queryByRole('group', { name: 'Phương án A' })).not.toBeInTheDocument()
})

test('the trial loads at most 1,000 cartons in total: the cap shows on the quantity of the last carton type', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  await user.click(section.getByRole('button', { name: 'Thêm loại kiện' }))
  await retype(user, field(section, 'Loại kiện 1', 'Số kiện'), '600')
  const last = field(section, 'Loại kiện 2', 'Số kiện')
  await retype(user, last, '401')
  expect(section.getByText('Tổng 1.001 / 1.000 kiện')).toBeInTheDocument()
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  expect(await section.findByText('Bản thử xếp tối đa 1.000 kiện mỗi lần')).toBeInTheDocument()
  expect(last).toHaveAttribute('aria-invalid', 'true')
  expect(section.queryByRole('group', { name: 'Phương án A' })).not.toBeInTheDocument()
})

test('in English the section, figures and numbers follow the selected language', async () => {
  const user = userEvent.setup()
  const section = renderTry('en')
  await user.click(await section.findByRole('button', { name: 'Work out three plans' }))

  expect(await section.findByText('Three plans ready for 120 cartons.')).toBeInTheDocument()
  const plan = within(section.getByRole('group', { name: 'Plan A' }))
  expect(plan.getByText('Volume used')).toBeInTheDocument()
  expect(plan.getByText('55.4%')).toBeInTheDocument()
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
})
