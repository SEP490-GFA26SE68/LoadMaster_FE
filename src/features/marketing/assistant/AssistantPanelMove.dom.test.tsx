import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { AssistantLauncher } from './AssistantLauncher'
import { assistantSession } from './assistant-session'

/**
 * Dời khung chat bằng phím (tay nắm "Di chuyển khung chat"), về chỗ mặc định, nhớ chỗ qua đóng / mở lại; dưới 768 px không có tay nắm.
 * jsdom không dàn trang: khung nhìn đặt 1.366 × 768, khung 380 × 400, và hộp của khung tính từ `style` mà khung đang mang (không có thì là
 * góc trên trái 600 × 300). Kéo bằng chuột ở E2E (`assistant-drag.spec.ts`).
 */
const ANSWER = { timeout: 4000 }
const VIEW = { width: 1366, height: 768 }
const PANEL = { width: 380, height: 400 }

let media: MatchMediaControl

function stubLayout(dialog: HTMLElement) {
  Object.defineProperty(dialog, 'offsetWidth', { configurable: true, value: PANEL.width })
  Object.defineProperty(dialog, 'offsetHeight', { configurable: true, value: PANEL.height })
  dialog.getBoundingClientRect = () => {
    const px = (value: string) => (value && value !== 'auto' ? Number.parseFloat(value) : null)
    const { left, right, top, bottom } = dialog.style
    const x = px(left) ?? (px(right) === null ? 600 : VIEW.width - px(right)! - PANEL.width)
    const y = px(top) ?? (px(bottom) === null ? 300 : VIEW.height - px(bottom)! - PANEL.height)
    return DOMRect.fromRect({ x, y, ...PANEL })
  }
}

async function openPanel() {
  const user = userEvent.setup()
  const launcher = screen.getByRole('button', { name: 'Hỏi Lumo' })
  await user.click(launcher)
  const dialog = await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER)
  stubLayout(dialog)
  return { user, launcher, dialog, panel: within(dialog) }
}

function renderLauncher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <AssistantLauncher />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeAll(async () => {
  await import('./AssistantPanel')
}, 30_000)

beforeEach(() => {
  media = installMatchMedia()
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: VIEW.width })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: VIEW.height })
})

afterEach(() => {
  cleanup()
  media.restore()
  assistantSession.reset()
  sessionStorage.clear()
  delete (document.documentElement as { clientWidth?: number }).clientWidth
  delete (document.documentElement as { clientHeight?: number }).clientHeight
})

test('the grip moves the panel with the arrow keys, Home brings it back, and "Back to default place" only shows once moved', async () => {
  renderLauncher()
  const { user, dialog, panel } = await openPanel()
  const grip = panel.getByRole('button', { name: 'Di chuyển khung chat' })
  expect(grip).toHaveAttribute('aria-keyshortcuts', expect.stringContaining('ArrowLeft'))
  expect(grip).toHaveAttribute('aria-keyshortcuts', expect.stringContaining('Home'))
  expect(panel.queryByRole('button', { name: 'Về chỗ mặc định' })).not.toBeInTheDocument()

  // 600 → 584: gần mép phải hơn (cách 402 px), mép dưới cách 68 px
  grip.focus()
  await user.keyboard('{ArrowLeft}')
  expect(dialog.style.right).toBe('402px')
  expect(dialog.style.bottom).toBe('68px')
  expect(dialog.style.left).toBe('auto')
  expect(panel.getByText('Khung chat cách mép phải 402 px, mép dưới 68 px.')).toBeInTheDocument()
  expect(panel.getByRole('button', { name: 'Về chỗ mặc định' })).toBeInTheDocument()

  // Shift + mũi tên lên: 64 px
  await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
  expect(dialog.style.bottom).toBe('132px')

  await user.keyboard('{Home}')
  expect(dialog.style.right).toBe('')
  expect(dialog.style.bottom).toBe('')
  expect(assistantSession.get().placement).toBeNull()
  expect(panel.queryByRole('button', { name: 'Về chỗ mặc định' })).not.toBeInTheDocument()
  expect(panel.getByText('Khung chat đã về chỗ mặc định.')).toBeInTheDocument()
  expect(grip).toHaveFocus()
})

test('the chosen place survives closing and reopening the panel; the reset button returns it to the default', async () => {
  renderLauncher()
  const { user, launcher, panel } = await openPanel()
  panel.getByRole('button', { name: 'Di chuyển khung chat' }).focus()
  await user.keyboard('{ArrowDown}')
  expect(assistantSession.get().placement).toEqual({ x: 'right', dx: 386, y: 'bottom', dy: 52 })

  await user.click(panel.getByRole('button', { name: 'Đóng trợ lý' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(launcher)
  const reopened = await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER)
  expect(reopened.style.right).toBe('386px')
  expect(reopened.style.bottom).toBe('52px')

  await user.click(within(reopened).getByRole('button', { name: 'Về chỗ mặc định' }))
  expect(reopened.style.right).toBe('')
  expect(assistantSession.get().placement).toBeNull()
})

test('below 768 px the panel is a full-screen sheet: no grip, no reset button, no inline position', async () => {
  media.set('(max-width: 767.98px)', true)
  assistantSession.setPlacement({ x: 'left', dx: 40, y: 'top', dy: 120 })
  renderLauncher()
  const { dialog, panel } = await openPanel()
  expect(panel.queryByRole('button', { name: 'Di chuyển khung chat' })).not.toBeInTheDocument()
  expect(panel.queryByRole('button', { name: 'Về chỗ mặc định' })).not.toBeInTheDocument()
  expect(dialog.style.left).toBe('')
  expect(dialog.style.top).toBe('')
})
