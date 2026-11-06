import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { searchSources, type SearchSources } from './quick-search'
import { SearchResults } from './SearchResults'

const TOKEN = '63abd059-f710-4bf5-abe1-a1c120f2c6d9'

function renderPool(pool: SearchSources['pool'], query: string) {
  const sources: SearchSources = { trips: [], vehicles: [], users: [], requirements: [], pool, packageTypes: [] }
  const groups = searchSources(sources, query, ['pool'])
  const keys = groups.flatMap((group) => group.results.map((result) => result.key))
  render(
    <I18nProvider>
      <SearchResults
        listId="results" query={query} groups={groups} activeIndex={-1} indexOf={new Map(keys.map((key, index) => [key, index]))}
        optionId={(index) => `option-${index}`} onHover={() => {}} onOpen={() => {}}
      />
    </I18nProvider>,
  )
}

test('kiện của máy chủ: dòng đầu là mã của bên gửi, dòng phụ là trạng thái và loại hàng — không phải mã số hay mã QR', () => {
  renderPool([{ id: '7', label: 'QA PK-0007', qrToken: TOKEN, typeName: '', query: TOKEN, status: 'IMPORTED', handlingClass: 'FRAGILE' }], 'qa pk')
  const option = screen.getByRole('option')
  expect(option).toHaveTextContent('QA PK-0007')
  expect(option).toHaveTextContent('Đã nhập · Dễ vỡ')
  expect(option).not.toHaveTextContent(TOKEN)
  expect(option.textContent).not.toMatch(/^7/)
})

test('kiện của kho mẫu giữ nguyên: mã của kho, tên loại kiện · mã của bên gửi', () => {
  renderPool([{ id: 'PK-0001', reference: 'MP-DA12-0914', qrToken: 'LM-ZB4R-3W83-412N', typeName: 'Thùng dầu ăn 12 chai' }], 'pk-0001')
  const option = screen.getByRole('option')
  expect(option).toHaveTextContent('PK-0001')
  expect(option).toHaveTextContent('Thùng dầu ăn 12 chai · MP-DA12-0914')
})
