import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { contactPath } from '../contact-form'
import { LandingFaq } from './LandingFaq'

/**
 * Phần Hỏi đáp của trang giới thiệu: câu hỏi và câu trả lời là của trợ lý Lumo (không chữ riêng), nên câu "Dùng thử thế nào?" đổi theo
 * việc khách tự đăng ký được hay không — như trong khung chat.
 */
const caps = vi.hoisted(() => ({ publicSignUp: false }))
vi.mock('@/features/registration/registration-capabilities', () => ({ REGISTRATION_CAPABILITIES: caps }))

const QUESTIONS = [
  'Dùng thử thế nào?',
  'Một lần tối ưu tốn bao nhiêu credit?',
  'Ai trong công ty dùng LoadMaster?',
  'Nhập kiện hàng thế nào?',
  'Dữ liệu công ty tôi có tách riêng không?',
  'Cần hỗ trợ khi đang dùng thì sao?',
]

function renderFaq() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <LandingFaq />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** Mục `<details>` có dòng câu hỏi `question`. */
function itemOf(question: string): HTMLDetailsElement {
  const item = [...document.querySelectorAll('details')].find((details) => details.querySelector('summary')?.textContent === question)
  if (!item) throw new Error(`Không có câu hỏi "${question}"`)
  return item
}

function linksOf(item: HTMLElement) {
  return [...item.querySelectorAll('a')].map((link) => [link.textContent, link.getAttribute('href')])
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  caps.publicSignUp = false
  sessionStorage.clear()
})

test('the FAQ is a titled section at #hoi-dap with six of the assistant questions, each closed at first', () => {
  renderFaq()
  const section = screen.getByRole('region', { name: 'Hỏi đáp' })
  expect(section).toHaveAttribute('id', 'hoi-dap')
  expect(within(section).getByRole('heading', { level: 2, name: 'Hỏi đáp' })).toBeInTheDocument()
  const items = [...section.querySelectorAll('details')]
  expect(items.map((item) => item.querySelector('summary')?.textContent)).toStrictEqual(QUESTIONS)
  expect(items.every((item) => !item.open)).toBe(true)
  // Mũi tên chỉ để nhìn
  expect(items.every((item) => item.querySelector('summary svg')?.getAttribute('aria-hidden') === 'true')).toBe(true)
})

test('a question opens and closes with a click on its row', async () => {
  const user = userEvent.setup()
  renderFaq()
  const credit = itemOf('Một lần tối ưu tốn bao nhiêu credit?')
  const summary = credit.querySelector('summary') as HTMLElement
  await user.click(summary)
  expect(credit.open).toBe(true)
  await user.click(summary)
  expect(credit.open).toBe(false)
})

test('in the demo store a guest cannot sign up alone: the trial answer points to the contact form', () => {
  renderFaq()
  const start = itemOf('Dùng thử thế nào?')
  expect(start).toHaveTextContent('Bạn gửi yêu cầu dùng thử qua form liên hệ.')
  expect(linksOf(start)).toStrictEqual([['Gửi yêu cầu dùng thử', contactPath({ type: 'DEMO_REQUEST' })]])
})

test('when guests can sign up themselves, the trial answer and its links change — and a signed-in visitor is back to the contact form', async () => {
  caps.publicSignUp = true
  const { unmount } = renderFaq()
  const start = itemOf('Dùng thử thế nào?')
  expect(start).toHaveTextContent('Bạn tự đăng ký dùng thử gói Basic')
  expect(linksOf(start)).toStrictEqual([
    ['Đăng ký trải nghiệm', '/dang-ky-trai-nghiem'],
    ['Đăng ký dùng ngay', '/dang-ky'],
  ])
  // Câu khác không phụ thuộc việc tự đăng ký
  expect(itemOf('Cần hỗ trợ khi đang dùng thì sao?').textContent).not.toMatch(/Đăng ký/)
  unmount()

  signedInAs('dispatcher')
  renderFaq()
  const signedIn = itemOf('Dùng thử thế nào?')
  expect(signedIn).toHaveTextContent('Bạn gửi yêu cầu dùng thử qua form liên hệ.')
  expect(linksOf(signedIn)).toStrictEqual([['Gửi yêu cầu dùng thử', contactPath({ type: 'DEMO_REQUEST' })]])
})

test('reads in English', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderFaq()
  const section = screen.getByRole('region', { name: 'FAQ' })
  expect([...section.querySelectorAll('summary')].map((summary) => summary.textContent)[0]).toBe('How can I try it?')
})
