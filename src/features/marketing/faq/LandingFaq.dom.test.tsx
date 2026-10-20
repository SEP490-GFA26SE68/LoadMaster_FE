import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { en } from '@/lib/i18n/en'
import { vi as viDict } from '@/lib/i18n/vi'
import { LandingFaq } from '../LandingFaq'
import { RevealProvider } from '../reveal'
import { FAQ_IDS } from './faq-items'

/**
 * Mục Hỏi đáp (`#hoi-dap`): mười `<details>` gốc theo đúng thứ tự của từ điển, câu đầu mở sẵn; nhánh `landingFaq.items` chỉ có chuỗi thuần
 * vì thẻ FAQPage (JSON-LD) đọc thẳng nó, và hai ngôn ngữ cùng một bộ mã câu hỏi.
 */
afterEach(cleanup)

function renderFaq() {
  return render(
    <MemoryRouter initialEntries={['/gioi-thieu']}>
      <I18nProvider>
        <RevealProvider>
          <LandingFaq />
        </RevealProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

test('the page order is the dictionary order, and both languages carry the same question ids', () => {
  expect([...FAQ_IDS]).toStrictEqual(Object.keys(viDict.landingFaq.items))
  expect([...FAQ_IDS]).toStrictEqual(Object.keys(en.landingFaq.items))
  expect(FAQ_IDS.length).toBeGreaterThanOrEqual(8)
  expect(FAQ_IDS.length).toBeLessThanOrEqual(10)
})

test('every question and answer is plain text: no parameters, no markup, nothing empty', () => {
  for (const items of [viDict.landingFaq.items, en.landingFaq.items]) {
    for (const { q, a } of Object.values(items)) {
      for (const text of [q, a]) {
        expect(typeof text).toBe('string')
        expect(text.trim()).not.toBe('')
        expect(text).not.toMatch(/[{}<>]/)
      }
    }
  }
})

test('ten native disclosure widgets, named by their question, the first one open', () => {
  const { container } = renderFaq()
  const section = screen.getByRole('region', { name: 'Câu hỏi thường gặp' })
  expect(section).toHaveAttribute('id', 'hoi-dap')
  const items = [...container.querySelectorAll('details')]
  expect(items).toHaveLength(FAQ_IDS.length)
  items.forEach((item, index) => {
    const copy = viDict.landingFaq.items[FAQ_IDS[index] ?? 'whatIs']
    expect(item.querySelector('summary')).toHaveTextContent(copy.q)
    expect(item).toHaveTextContent(copy.a)
    expect(item.open).toBe(index === 0)
  })
})

test('the follow-up is a secondary link to the contact form, not a second primary button', () => {
  renderFaq()
  const link = within(screen.getByRole('region', { name: 'Câu hỏi thường gặp' })).getByRole('link', { name: 'Gửi câu hỏi cho đội LoadMaster' })
  expect(link).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(link.className).not.toMatch(/primary-fill/)
})
