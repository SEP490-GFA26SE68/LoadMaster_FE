import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LandingTry } from './LandingTry'

/**
 * "Thử với hàng của bạn" (AGENTS mục 1): jsdom không có Web Worker nên bộ tối ưu mô phỏng chạy trên luồng gọi, kết quả về ngay. Form mở với
 * xe 3,5 tấn (520 × 200 × 200 cm) và ba loại thùng cho ba điểm giao (48 + 60 + 16 = 124 kiện, 1.680 kg), nên lần chạy đầu xếp hết
 * 124 / 124 ở cả ba phương án và có đủ hàng dỡ-xếp lại, chú giải màu điểm giao.
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

  expect(await section.findByText('Đã tính xong ba phương án cho 124 kiện.')).toBeInTheDocument()
  const plans = ['A', 'B', 'C'].map((label) => within(section.getByRole('group', { name: `Phương án ${label}` })))
  expect(plans.map((plan) => plan.getByRole('heading', { level: 4 }).textContent)).toEqual([
    'APhương án A:Tối đa thể tích',
    'BPhương án B:Cân bằng tải trục',
    'CPhương án C:Ít dỡ-xếp lại',
  ])
  for (const plan of plans) {
    // Số "xếp được" chỉ hiện một lần trên thẻ (hàng số), không lặp lại bằng chữ nhỏ đè trên hình
    expect(plan.getByText('124 / 124')).toBeInTheDocument()
    expect(plan.getByRole('img', { name: /: 124 \/ 124 kiện đã xếp$/ })).toBeInTheDocument()
    // Ba điểm giao: có hàng dỡ-xếp lại
    expect(plan.getByText('Kiện dỡ-xếp lại')).toBeInTheDocument()
  }
  // Phương án B đưa trọng tâm về giữa thùng, phương án C ít kiện dỡ-xếp lại nhất: mỗi thẻ đúng một nhãn xám "Tốt nhất"
  expect(plans[1]?.getByText('Tốt nhất')).toBeInTheDocument()
  expect(plans[2]?.getByText('Tốt nhất')).toBeInTheDocument()
  expect(plans[0]?.queryByText('Tốt nhất')).not.toBeInTheDocument()
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(section.getByText(/Số do bộ tối ưu mô phỏng của LoadMaster chạy trên trình duyệt của bạn tính/)).toBeInTheDocument()
  expect(section.getByText(/không hỏi trục xe nên không tính tải trục/)).toBeInTheDocument()
  // Chú giải màu của ba điểm giao; câu "một điểm giao" không có
  expect(section.getByText('Màu kiện theo điểm giao')).toBeInTheDocument()
  for (const stop of ['Điểm 1', 'Điểm 2', 'Điểm 3']) expect(section.getByText(stop, { selector: 'li' })).toBeInTheDocument()
  expect(section.queryByText(/Mọi kiện cùng một điểm giao/)).not.toBeInTheDocument()
  // Kho mẫu: khách không tự đăng ký được, lối đi tiếp là form liên hệ
  // Chữ hiện ra là "Nhận tư vấn"; đuôi "cho hàng của bạn" chỉ cho trình đọc màn hình (khối mở đầu cũng có nút "Nhận tư vấn")
  expect(section.getByRole('link', { name: 'Nhận tư vấn cho hàng của bạn' })).toHaveAttribute('href', expect.stringContaining('#lien-he'))
  expect(section.queryByRole('link', { name: /^Đăng ký trải nghiệm/ })).not.toBeInTheDocument()

  // Đổi số sau khi tính: kết quả cũ được nói rõ là cũ
  await retype(user, field(section, 'Thùng xe', 'Dài (cm)'), '600')
  expect(section.getByText(/Số trong form đã đổi sau lần tính này/)).toBeInTheDocument()
})

/** Bỏ loại kiện 3 rồi 2: còn 48 thùng 60 × 40 × 40 cm, 15 kg, một điểm giao. */
async function keepFirstCartonType(user: ReturnType<typeof userEvent.setup>, section: Section) {
  await user.click(section.getByRole('button', { name: 'Bỏ loại kiện 3' }))
  await user.click(section.getByRole('button', { name: 'Bỏ loại kiện 2' }))
}

test('with one carton type left there is one stop: no rehandling row, no legend, and the note says why', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  // Bỏ một loại kiện: con trỏ về nút "Thêm loại kiện"
  await user.click(section.getByRole('button', { name: 'Bỏ loại kiện 3' }))
  expect(section.queryByRole('group', { name: 'Loại kiện 3' })).not.toBeInTheDocument()
  expect(section.getByRole('button', { name: 'Thêm loại kiện' })).toHaveFocus()
  await user.click(section.getByRole('button', { name: 'Bỏ loại kiện 2' }))
  // Loại cuối cùng không có nút bỏ
  expect(section.queryByRole('button', { name: /^Bỏ loại kiện/ })).not.toBeInTheDocument()

  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  expect(await section.findByText('Đã tính xong ba phương án cho 48 kiện.')).toBeInTheDocument()
  expect(within(section.getByRole('group', { name: 'Phương án C' })).queryByText('Kiện dỡ-xếp lại')).not.toBeInTheDocument()
  expect(section.queryByText('Màu kiện theo điểm giao')).not.toBeInTheDocument()
  expect(section.getByText(/Mọi kiện cùng một điểm giao nên không kiện nào phải dỡ-xếp lại/)).toBeInTheDocument()
})

test('a fourth carton type takes the focus and is the last one: the add button goes away until a type is removed', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  await user.click(section.getByRole('button', { name: 'Thêm loại kiện' }))
  expect(field(section, 'Loại kiện 4', 'Dài (cm)')).toHaveFocus()
  expect(section.queryByRole('button', { name: 'Thêm loại kiện' })).not.toBeInTheDocument()

  await user.click(section.getByRole('button', { name: 'Bỏ loại kiện 4' }))
  expect(section.queryByRole('group', { name: 'Loại kiện 4' })).not.toBeInTheDocument()
  expect(section.getByRole('button', { name: 'Thêm loại kiện' })).toHaveFocus()
})

test('cartons the truck cannot take are listed per carton type with the translated reason', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  await keepFirstCartonType(user, section)
  await retype(user, field(section, 'Thùng xe', 'Tải trọng (kg)'), '300')
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  // 300 kg cho 48 thùng 15 kg: 20 thùng lên xe, 28 thùng ở lại
  expect(await section.findByText('Đã tính xong ba phương án cho 48 kiện.')).toBeInTheDocument()
  for (const label of ['A', 'B', 'C']) {
    const plan = within(section.getByRole('group', { name: `Phương án ${label}` }))
    expect(plan.getByText('20 / 48')).toBeInTheDocument()
    expect(plan.getByText('Loại kiện 1: 28 kiện — Vượt tải trọng tối đa của xe')).toBeInTheDocument()
  }
})

test('a carton bigger than the body cross-section reads as too tall or wide, not as a door that is too small', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  // Lòng thùng mặc định 200 × 200 cm: thùng 250 cm mọi chiều không vào được hướng nào
  for (const name of ['Dài (cm)', 'Rộng (cm)', 'Cao (cm)']) await retype(user, field(section, 'Loại kiện 3', name), '250')
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  expect(await section.findByText('Đã tính xong ba phương án cho 124 kiện.')).toBeInTheDocument()
  const plan = within(section.getByRole('group', { name: 'Phương án A' }))
  expect(plan.getByText('Loại kiện 3: 16 kiện — Cao hoặc rộng hơn lòng thùng')).toBeInTheDocument()
  expect(plan.queryByText(/lọt cửa/)).not.toBeInTheDocument()
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
  // 600 + 60 + 341 = 1.001
  await retype(user, field(section, 'Loại kiện 1', 'Số kiện'), '600')
  const last = field(section, 'Loại kiện 3', 'Số kiện')
  await retype(user, last, '341')
  expect(section.getByText('Tổng 1.001 / 1.000 kiện')).toBeInTheDocument()
  await user.click(section.getByRole('button', { name: 'Tính ba phương án' }))

  expect(await section.findByText('Bản thử xếp tối đa 1.000 kiện mỗi lần')).toBeInTheDocument()
  expect(last).toHaveAttribute('aria-invalid', 'true')
  expect(section.queryByRole('group', { name: 'Phương án A' })).not.toBeInTheDocument()

  // Sửa tổng ở loại kiện khác: lỗi ở loại cuối tự hết, không chờ lần bấm kế tiếp
  await retype(user, field(section, 'Loại kiện 1', 'Số kiện'), '500')
  expect(section.getByText('Tổng 901 / 1.000 kiện')).toBeInTheDocument()
  await waitFor(() => expect(last).not.toHaveAttribute('aria-invalid', 'true'))
  expect(section.queryByText('Bản thử xếp tối đa 1.000 kiện mỗi lần')).not.toBeInTheDocument()
})

test('in English the section, figures and numbers follow the selected language', async () => {
  const user = userEvent.setup()
  const section = renderTry('en')
  await user.click(await section.findByRole('button', { name: 'Work out three plans' }))

  expect(await section.findByText('Three plans ready for 124 cartons.')).toBeInTheDocument()
  const plan = within(section.getByRole('group', { name: 'Plan A' }))
  expect(plan.getByText('Volume used')).toBeInTheDocument()
  // 12.048 m³ / 20.8 m³
  expect(plan.getByText('57.9%')).toBeInTheDocument()
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
})
