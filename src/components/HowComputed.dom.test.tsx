import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { HowComputed, type HowEntry } from './HowComputed'

/** "Tính thế nào?" (AGENTS mục 1): nút mở phần giải thích công thức ngay dưới nhóm số; phần giải thích chỉ dựng khi mở. */
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

const ENTRIES: readonly HowEntry[] = [
  { key: 'volume', label: 'Lấp đầy thể tích', text: 'Tổng thể tích 352 kiện đã xếp (30,0 m³) ÷ thể tích lòng thùng (36,0 m³) = 83,3%.' },
  { key: 'unplaced', label: 'Chưa xếp', text: '366 kiện của lần chạy − 352 kiện đã xếp = 14.' },
]

function renderHow(props: Partial<Parameters<typeof HowComputed>[0]> = {}) {
  render(
    <I18nProvider>
      <HowComputed entries={ENTRIES} {...props} />
    </I18nProvider>,
  )
}

test('the button opens and closes the formulas right below it, and says so to assistive technology', async () => {
  const user = userEvent.setup()
  renderHow({ note: 'Số của đúng lần chạy này.' })
  const toggle = screen.getByRole('button', { name: 'Tính thế nào?' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  // Chưa mở: phần giải thích chưa dựng
  expect(screen.queryByText(ENTRIES[0]!.text)).not.toBeInTheDocument()
  const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  expect(panel).not.toBeNull()
  expect(panel).not.toBeVisible()

  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(panel).toBeVisible()
  expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Lấp đầy thể tích', 'Chưa xếp'])
  expect(screen.getByText(ENTRIES[0]!.text)).toBeInTheDocument()
  expect(screen.getByText(ENTRIES[1]!.text)).toBeInTheDocument()
  expect(screen.getByText('Số của đúng lần chạy này.')).toBeInTheDocument()

  // Bàn phím: nút vẫn giữ focus, Enter đóng lại
  expect(toggle).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(ENTRIES[0]!.text)).not.toBeInTheDocument()
})

test('with a subject the button says which figures it explains, so several buttons on a page have different names', () => {
  renderHow({ subject: 'Phương án B' })
  expect(screen.getByRole('button', { name: 'Tính thế nào? — Phương án B' })).toHaveTextContent('Tính thế nào?')
})

test('on a dark surface the focus ring is the cyan one of the sky band', () => {
  renderHow({ tone: 'dark' })
  expect(screen.getByRole('button', { name: 'Tính thế nào?' }).className).toContain('focus-visible:outline-cyan-300')
})

test('the touch target is 44 px, 56 px with 16 px text on touch devices', () => {
  renderHow()
  const { className } = screen.getByRole('button', { name: 'Tính thế nào?' })
  expect(className).toContain('min-h-11')
  expect(className).toContain('pointer-coarse:min-h-14')
  expect(className).toContain('pointer-coarse:text-body-lg')
})

test('without anything to explain there is no button', () => {
  renderHow({ entries: [] })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
