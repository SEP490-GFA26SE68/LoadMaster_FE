import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { PlanTier } from '@/lib/mock-db'
import { envelope, useFakeBackend } from '@/test/billing-backend-fetch'
import { TopUpDialog } from './TopUpDialog'

/**
 * Nạp credit khi nối backend: giá theo hạng gói đọc từ bảng giá của máy chủ (`GET /api/credits/pricing`), không trần số dư, nhập được số
 * credit tuỳ ý; gói đã hết hạn thì máy chủ không cho nạp.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

function servePricing(tier: PlanTier, price: number, topUpAllowed = true) {
  backend.routes['GET /api/credits/pricing'] = envelope({
    tier, pricePerCreditVnd: price, tierPrices: { BASIC: 400, PRO: 326, ULTIMATE: 263 }, optimizationCost: 2, rerunCost: 1,
    minTopUpCredits: 1, maxTopUpCredits: null, unlimited: tier === 'ULTIMATE', topUpAllowed, lowBalanceThreshold: 10,
  })
}

function renderDialog(tier: PlanTier | null, balance: number) {
  const onConfirm = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <TopUpDialog open onOpenChange={() => {}} pending={false} onConfirm={onConfirm} tier={tier} balance={balance} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return onConfirm
}

test('Basic: giá của máy chủ 400 đ mỗi credit, không trần số dư; xác nhận gửi số credit kèm thành tiền', async () => {
  const user = userEvent.setup()
  servePricing('BASIC', 400)
  const onConfirm = renderDialog('BASIC', 2600)
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText(/400 ₫ mỗi credit/)).toBeInTheDocument()
  expect(dialog).toHaveTextContent('Hạng Basic: không giới hạn số dư.')
  const input = within(dialog).getByRole('spinbutton', { name: 'Số credit muốn nạp' })
  const confirm = within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })
  await user.clear(input)
  await user.type(input, '5000')
  expect(confirm).toBeEnabled()
  expect(dialog).toHaveTextContent('Thành tiền: 2.000.000 ₫')
  await user.clear(input)
  await user.type(input, '300')
  expect(dialog).toHaveTextContent('Thành tiền: 120.000 ₫')
  await user.click(confirm)
  expect(onConfirm).toHaveBeenCalledWith(300, 120000)
  expect(backend.calls.map((call) => `${call.method} ${call.url}`)).toStrictEqual(['GET http://be.test/api/credits/pricing'])
})

test('hạng tính giá là hạng máy chủ trả: Ultimate 263 đ mỗi credit, không trần', async () => {
  const user = userEvent.setup()
  servePricing('ULTIMATE', 263)
  const onConfirm = renderDialog(null, 30000)
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText(/263 ₫ mỗi credit/)).toBeInTheDocument()
  expect(dialog).toHaveTextContent('Hạng Ultimate: không giới hạn số dư.')
  const input = within(dialog).getByRole('spinbutton', { name: 'Số credit muốn nạp' })
  await user.clear(input)
  await user.type(input, '5000')
  await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' }))
  expect(onConfirm).toHaveBeenCalledWith(5000, 1315000)
})

test('gói đã hết hạn: máy chủ không cho nạp, hộp nói lý do và nút xác nhận mờ', async () => {
  servePricing('PRO', 326, false)
  renderDialog('PRO', 40)
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('Gói cước đã hết hạn nên chưa nạp được credit. Gia hạn hoặc chọn gói mới trước.')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })).toBeDisabled()
})
