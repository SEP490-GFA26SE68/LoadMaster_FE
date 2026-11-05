import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { SubscriptionHistoryPage } from './SubscriptionHistoryPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/nen-tang/lich-su-goi']}>
          <SubscriptionHistoryPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('SubscriptionHistoryPage — kho mẫu', () => {
  beforeEach(() => {
    signedInAs('systemManager')
  })

  it('liệt kê gói hiện tại của từng công ty, nói rõ dữ liệu mẫu chưa có kỳ trước, và mở chi tiết hợp đồng', async () => {
    const user = userEvent.setup()
    renderPage()

    const longBinh = await screen.findByRole('button', { name: /Long Bình/ })
    expect(screen.getByRole('button', { name: /Phương Nam/ })).toBeInTheDocument()
    expect(screen.getByText('Dữ liệu mẫu chỉ giữ gói hiện tại của mỗi công ty, chưa có các kỳ trước.')).toBeInTheDocument()

    await user.click(longBinh)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Hợp đồng gói cước của công ty')).toBeInTheDocument()
    expect(within(dialog).getByText('PRO')).toBeInTheDocument()
    expect(within(dialog).getByText('Hằng tháng')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
