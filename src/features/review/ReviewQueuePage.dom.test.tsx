import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { ReviewQueuePage } from './ReviewQueuePage'

/** Seam: kho dùng chung → `review-api.ts` → hook → màn `/duyet` (LM-104), không giả lập module nào. */
function renderQueue() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter><ReviewQueuePage /></MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('the seed queue shows TRIP-012 with its run choice, numbers from the result and a link to that exact revision', async () => {
  const [item] = await getMockDb().listReviewQueue()
  renderQueue()
  const card = await screen.findByRole('article', { name: item?.tripName })
  expect(card).toHaveTextContent('Tối đa thể tích · EP + DBLF')
  expect(card).toHaveTextContent('MOCK RESULT')
  expect(card).toHaveTextContent('Chạy bởi Nguyễn Thanh Tùng')
  expect(within(card).getByRole('link', { name: 'Xem và duyệt phương án của TRIP-012' }))
    .toHaveAttribute('href', `/chuyen/TRIP-012/phuong-an?revision=${item?.revisionId}`)
  expect(within(card).queryByRole('link', { name: /^So sánh/ })).toBeNull()
  expect(await screen.findByText('Chưa có quyết định nào.')).toBeInTheDocument()
})
