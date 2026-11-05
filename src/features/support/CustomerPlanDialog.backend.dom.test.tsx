import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall, type FakeReply } from '@/test/fake-backend'
import { CompanyPanel } from './CompanyPanel'
import { CustomerPlanDialog } from './CustomerPlanDialog'

/**
 * Hỗ trợ khách hàng đổi gói cho công ty khách khi nối backend (`support`, tên công ty `companies`, danh mục gói `billing`): hộp thoại
 * mở từ thanh điều hướng và ô "Đổi gói nhanh" của khung công ty đều gửi `POST /api/contracts`; gói đang dùng chỉ nâng lên hạng cao hơn,
 * yêu cầu đã đóng thì không đổi được.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: {
    authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['support', 'companies', 'billing']), keycloak: { url: '', realm: '', clientId: '' },
  },
  usesBackend: (feature: string) => ['support', 'companies', 'billing'].includes(feature),
}))

const SLOW = { timeout: 5000 }

const PLAN = { planCode: 'BASIC', algorithmTier: 'EP_DBLF', features: '[]', billingCycle: 'MONTHLY', maxVehicles: 5, maxMonthlyJobs: 100, active: true, activeCompanyCount: 0 }
const PLANS = [
  { ...PLAN, id: 1, name: 'Basic', priceVnd: 1200000, tier: 'BASIC', monthlyCredits: 3000 },
  { ...PLAN, id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 4900000, tier: 'PRO', monthlyCredits: 15000 },
  { ...PLAN, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 7900000, tier: 'ULTIMATE', monthlyCredits: null },
]
const CONTRACT = {
  id: 2, companyId: 1, companyName: 'Vận tải Acme', planId: 1, planName: 'Basic', planTier: 'BASIC', status: 'ACTIVE',
  startedAt: '2026-10-19 10:00:00', expiresAt: '2026-11-19 10:00:00', autoRenew: true,
}

let backend: { readonly calls: FakeCall[] }
let contract = CONTRACT

function assigned(call: FakeCall): FakeReply {
  const { planId } = call.body as { planId: number }
  const plan = PLANS.find((item) => item.id === planId)
  if (plan === undefined) throw new Error(`Không có gói ${planId}`)
  return { body: envelope({ ...contract, planId, planName: plan.name, planTier: plan.tier }) }
}

beforeEach(() => {
  contract = CONTRACT
  connectApiAuth(() => Promise.resolve('token-1'))
  backend = stubBackend({
    'GET /api/companies/options': { body: envelope([{ id: 1, companyName: 'Vận tải Acme' }]) },
    'GET /api/subscription/plans': { body: PLANS },
    'GET /api/contracts': () => ({ body: envelope([contract]) }),
    'POST /api/contracts': assigned,
    'GET /api/credits/balance': { body: envelope({ companyId: 1, balance: 2450, isUnlimited: false }) },
    'GET /api/credits/transactions': {
      body: envelope({ content: [{ id: 101, amount: 500, type: 'PURCHASE', reference: 'TOPUP-1', refunded: false, createdAt: '2026-10-19 10:00:00' }], last: true }),
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

function renderWith(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        {children}
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const assignBody = () => backend.calls.find((call) => call.method === 'POST' && call.path === '/api/contracts')?.body

test('the dialog picks a customer company and applies a higher plan at once', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  renderWith(<CustomerPlanDialog onClose={onClose} />)

  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('Basic', {}, SLOW)).toBeInTheDocument()
  await user.selectOptions(within(dialog).getByLabelText('Gói cước áp dụng'), '2')
  await user.click(within(dialog).getByRole('button', { name: 'Cập nhật gói ngay' }))

  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(assignBody()).toEqual({ companyId: 1, planId: 2, autoRenew: true })
})

test('the company panel reads the balance and recent credits, and only offers higher tiers for quick change', async () => {
  const user = userEvent.setup()
  contract = { ...CONTRACT, planId: 2, planName: 'Pro', planTier: 'PRO' }
  renderWith(<CompanyPanel companyId="1" ticketClosed={false} />)

  const panel = await screen.findByRole('region', { name: 'Thông tin công ty' })
  expect(await within(panel).findByText('2.450', {}, SLOW)).toBeInTheDocument()
  expect(within(panel).getByText('+500')).toBeInTheDocument()
  const select = within(panel).getByLabelText('Đổi gói nhanh')
  expect(await within(select).findByRole('option', { name: /Basic/ }, SLOW)).toBeDisabled()
  expect(within(select).getByRole('option', { name: /Pro/ })).toBeDisabled()
  expect(within(select).getByRole('option', { name: /Ultimate/ })).toBeEnabled()

  await user.selectOptions(select, '3')
  await user.click(within(panel).getByRole('button', { name: 'Cập nhật gói ngay' }))
  await waitFor(() => expect(assignBody()).toEqual({ companyId: 1, planId: 3, autoRenew: true }))
})

test('a closed ticket blocks the quick plan change and says why', async () => {
  renderWith(<CompanyPanel companyId="1" ticketClosed />)
  const panel = await screen.findByRole('region', { name: 'Thông tin công ty' })
  expect(await within(panel).findByText('Yêu cầu hỗ trợ đã đóng — mở lại yêu cầu trước khi đổi gói.', {}, SLOW)).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Cập nhật gói ngay' })).toBeDisabled()
})
