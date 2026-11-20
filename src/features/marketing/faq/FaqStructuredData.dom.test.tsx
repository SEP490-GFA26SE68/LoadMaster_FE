import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { LandingFaq } from './LandingFaq'

/**
 * Khối JSON-LD `FAQPage` của phần Hỏi đáp phải nói đúng điều trang đang hiện: cùng câu hỏi, cùng câu trả lời (không kèm liên kết xem
 * thêm), theo ngôn ngữ và theo việc khách tự đăng ký được hay không.
 */
const caps = vi.hoisted(() => ({ publicSignUp: false }))
vi.mock('@/features/registration/registration-capabilities', () => ({ REGISTRATION_CAPABILITIES: caps }))

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

type Question = { name: string; acceptedAnswer: { '@type': string; text: string } }

function structuredData(): { '@type': string; mainEntity: Question[] } {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  expect(scripts).toHaveLength(1)
  return JSON.parse(scripts[0]?.textContent ?? '')
}

/** Câu hỏi và câu trả lời đang hiện: đoạn văn và danh sách của từng mục, bỏ nhóm liên kết xem thêm. */
function visibleFaq(): [string, string][] {
  return [...document.querySelectorAll('details')].map((item) => {
    const blocks = [...item.querySelectorAll('.faq-answer p, .faq-answer ul')].filter((block) => block.closest('[role="group"]') === null)
    const texts = blocks.map((block) =>
      block.tagName === 'UL' ? [...block.querySelectorAll('li')].map((line) => line.textContent).join('; ') : block.textContent,
    )
    return [item.querySelector('summary')?.textContent ?? '', texts.join(' ')]
  })
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  caps.publicSignUp = false
  sessionStorage.clear()
})

test('the FAQ block repeats the six visible questions and answers, word for word', () => {
  renderFaq()
  const data = structuredData()
  expect(data['@type']).toBe('FAQPage')
  expect(data.mainEntity).toHaveLength(6)
  expect(data.mainEntity.map((question) => [question.name, question.acceptedAnswer.text])).toStrictEqual(visibleFaq())
  // Số credit mỗi lần chạy và vai trò — thiết bị nằm trong câu trả lời, không chỉ câu dẫn
  expect(data.mainEntity[1]?.acceptedAnswer.text).toMatch(/^Một lần chạy tối ưu 3D dùng 2 credit/)
  expect(data.mainEntity[2]?.acceptedAnswer.text).toContain('Tài xế: điện thoại')
})

test('the trial answer follows whether guests can sign up themselves', () => {
  caps.publicSignUp = true
  renderFaq()
  const data = structuredData()
  expect(data.mainEntity[0]?.acceptedAnswer.text).toMatch(/^Bạn tự đăng ký dùng thử gói Basic/)
  expect(data.mainEntity.map((question) => [question.name, question.acceptedAnswer.text])).toStrictEqual(visibleFaq())
})

test('the block is written in the chosen language', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderFaq()
  const data = structuredData()
  expect(data.mainEntity[0]?.name).toBe('How can I try it?')
  expect(data.mainEntity.map((question) => [question.name, question.acceptedAnswer.text])).toStrictEqual(visibleFaq())
})
