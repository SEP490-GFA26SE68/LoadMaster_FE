import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LandingTry } from './LandingTry'

/**
 * "Thử với xe của bạn" (AGENTS mục 1, 5, 6): jsdom không có Web Worker nên bộ tối ưu mô phỏng chạy trên luồng gọi, kết quả về ngay. Form mở
 * với xe "Truck 6m" và kiện "Carton A" của Spec (4 kiện), nên lần tính đầu xếp 4 / 4. Nút "Tính thử" là nút phụ.
 */
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

function renderTry() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <LandingTry />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return within(screen.getByRole('region', { name: 'Thử với xe của bạn' }))
}

function group(section: ReturnType<typeof renderTry>, name: string) {
  return within(section.getByRole('group', { name }))
}

test('the visitor runs the mock optimiser in the browser and sees what was loaded (no MOCK RESULT tag on the public page)', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  expect(section.getByText(/Hình trên là lòng thùng theo số đang nhập/)).toBeInTheDocument()
  expect(section.getByRole('img', { name: /chưa có kiện/ })).toBeInTheDocument()
  const runButton = section.getByRole('button', { name: 'Tính thử' })
  expect(runButton.className).not.toMatch(/from-primary-fill/)

  await user.click(runButton)

  expect(await section.findByRole('status')).toHaveTextContent('Đã tính xong: xếp được 4 / 4 kiện, dùng 3,6% thể tích.')
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  const figures = within(section.getByText('Kiện xếp được').closest('dl')!)
  expect(figures.getByText('4 / 4')).toBeInTheDocument()
  expect(figures.getByText('3,6%')).toBeInTheDocument()
  expect(figures.getByText('120 kg')).toBeInTheDocument()
  expect(figures.getByText('trên 5.000 kg')).toBeInTheDocument()
  expect(section.getByText('Xếp được hết mọi kiện.')).toBeInTheDocument()
  expect(section.getByRole('img', { name: /đã xếp 4 kiện/ })).toBeInTheDocument()

  // Đổi số sau khi tính: kết quả cũ được nói rõ là cũ
  const truck = group(section, 'Lòng thùng xe')
  await user.clear(truck.getByRole('textbox', { name: 'Dài (cm)' }))
  await user.type(truck.getByRole('textbox', { name: 'Dài (cm)' }), '720')
  expect(section.getByText(/Số trong form đã đổi sau lần tính này/)).toBeInTheDocument()
})

test('cartons the truck cannot take are listed per carton type with the translated reason', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  const truck = group(section, 'Lòng thùng xe')
  await user.clear(truck.getByRole('textbox', { name: 'Tải trọng (kg)' }))
  await user.type(truck.getByRole('textbox', { name: 'Tải trọng (kg)' }), '100')
  await user.click(section.getByRole('button', { name: 'Tính thử' }))

  expect(await section.findByText('Kiện chưa xếp')).toBeInTheDocument()
  // 4 kiện × 30 kg trên tải trọng 100 kg: 3 kiện lên xe
  expect(section.getByText('Loại kiện 1: 1 kiện — Vượt tải trọng tối đa của xe')).toBeInTheDocument()
  expect(section.getByRole('status')).toHaveTextContent('xếp được 3 / 4 kiện')
})

test('a wrong field blocks the run and says why, in the field', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  const truck = group(section, 'Lòng thùng xe')
  const width = truck.getByRole('textbox', { name: 'Rộng (cm)' })
  await user.clear(width)
  await user.type(width, '400')
  await user.click(section.getByRole('button', { name: 'Tính thử' }))

  expect(await truck.findByText('Từ 100 đến 260')).toBeInTheDocument()
  expect(width).toHaveAttribute('aria-invalid', 'true')
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(section.getByRole('status')).toBeEmptyDOMElement()
})

test('truck presets fill the body from the sample trucks and show which one is in use', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  const truck = group(section, 'Lòng thùng xe')
  const presets = within(truck.getByRole('group', { name: 'Xe mẫu' }))
  expect(presets.getByRole('button', { name: 'Thùng 6 m · 5 tấn' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(presets.getByRole('button', { name: 'Thùng 8,5 m · 9 tấn' }))

  expect(truck.getByRole('textbox', { name: 'Dài (cm)' })).toHaveValue('850')
  expect(truck.getByRole('textbox', { name: 'Tải trọng (kg)' })).toHaveValue('9000')
  expect(presets.getByRole('button', { name: 'Thùng 8,5 m · 9 tấn' })).toHaveAttribute('aria-pressed', 'true')
  expect(presets.getByRole('button', { name: 'Thùng 6 m · 5 tấn' })).toHaveAttribute('aria-pressed', 'false')
})

test('a second carton type can be added, filled from the sample carton and removed; the trial cap counts both', async () => {
  const user = userEvent.setup()
  const section = renderTry()
  await user.click(section.getByRole('button', { name: 'Thêm loại kiện thứ hai' }))
  const second = group(section, 'Loại kiện 2')
  expect(second.getByRole('textbox', { name: 'Dài (cm)' })).toHaveFocus()
  expect(section.queryByRole('button', { name: 'Thêm loại kiện thứ hai' })).not.toBeInTheDocument()

  await user.click(second.getByRole('button', { name: 'Dùng Carton A cho loại kiện 2' }))
  expect(second.getByRole('textbox', { name: 'Dài (cm)' })).toHaveValue('120')
  await user.clear(second.getByRole('textbox', { name: 'Số kiện' }))
  await user.type(second.getByRole('textbox', { name: 'Số kiện' }), '397')
  expect(section.getByText('Tổng 401 / 400 kiện')).toBeInTheDocument()
  await user.click(section.getByRole('button', { name: 'Tính thử' }))
  expect(await second.findByText('Bản thử xếp tối đa 400 kiện mỗi lần')).toBeInTheDocument()

  await user.click(second.getByRole('button', { name: 'Bỏ loại kiện 2' }))
  expect(section.queryByRole('group', { name: 'Loại kiện 2' })).not.toBeInTheDocument()
  expect(section.getByRole('button', { name: 'Thêm loại kiện thứ hai' })).toHaveFocus()
})

test('in English the figures use English number formats and the reason codes are translated', async () => {
  window.history.replaceState(null, '', '/?lang=en')
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <LandingTry />
      </I18nProvider>
    </QueryClientProvider>,
  )
  const section = within(screen.getByRole('region', { name: 'Try it with your truck' }))
  expect(section.getByRole('button', { name: '8.5 m body · 9 t' })).toBeInTheDocument()
  await user.click(section.getByRole('button', { name: 'Try it' }))
  expect(await section.findByRole('status')).toHaveTextContent('Done: 4 / 4 cartons loaded, 3.6% of the volume used.')
  expect(section.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(section.getByText('of 5,000 kg')).toBeInTheDocument()
})
