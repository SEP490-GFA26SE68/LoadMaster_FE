import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test, vi } from 'vitest'
import type { PlanDto } from '@/lib/billing-backend-api'
import { I18nProvider } from '@/lib/i18n'
import { useFakeBackend } from '@/test/billing-backend-fetch'
import { PlansPage } from './PlansPage'

/**
 * Danh mục gói khi nối backend: backend chỉ liệt kê gói đang bán, mỗi hạng một gói, Ultimate luôn không giới hạn — màn không có công
 * tắc bán, chỉ thêm được gói cho hạng còn trống, ô credit của Ultimate tắt kèm lý do.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()
const SLOW = { timeout: 5000 }

const BASIC: PlanDto = {
  id: 1, planCode: 'BASIC', name: 'Basic', priceVnd: 490000, tier: 'BASIC', monthlyCredits: 100, algorithmTier: 'EP_DBLF',
  features: '["OPTIMIZATION_3D","ROUTE_OPTIMIZATION"]', billingCycle: 'MONTHLY', maxVehicles: 5, maxMonthlyJobs: 100, active: true, activeCompanyCount: 1,
}
const PRO: PlanDto = { ...BASIC, id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA', activeCompanyCount: 0 }
const ULTIMATE: PlanDto = { ...BASIC, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 3990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI', activeCompanyCount: 0 }

function renderPlans() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/nen-tang/goi']}>
          <PlansPage />
        </MemoryRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('no on-sale switch, the plan code under the name; every tier taken: Add plan is dimmed with the reason', async () => {
  backend.routes['GET /api/subscription/plans'] = [PRO, ULTIMATE, BASIC]
  renderPlans()
  const table = await screen.findByRole('table', {}, SLOW)
  expect(within(table).queryByRole('columnheader', { name: 'Đang bán' })).toBeNull()
  expect(within(table).queryAllByRole('switch')).toHaveLength(0)
  const basic = within(table).getAllByRole('row').find((row) => row.querySelector('td')?.textContent?.startsWith('Basic'))
  expect(basic?.querySelector('td')?.textContent).toBe('BasicBASIC')
  const add = screen.getByRole('button', { name: 'Thêm gói' })
  expect(add).toBeDisabled()
  expect(add).toHaveAccessibleDescription('Hạng nào cũng đã có gói. Sửa gói đang có, hoặc xoá gói không còn công ty dùng để thêm gói khác.')
})

test('adding the free tier: only that tier, Ultimate credits locked as unlimited, sent on sale with no credits', async () => {
  const user = userEvent.setup()
  backend.routes['GET /api/subscription/plans'] = [BASIC, PRO]
  backend.routes['POST /api/subscription/plans'] = { ...ULTIMATE, id: 9, planCode: 'ULTIMATE-X', name: 'QA Ultimate', priceVnd: 4990000 }
  renderPlans()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm gói' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('combobox', { name: 'Hạng' })).toHaveTextContent('Ultimate')
  expect(within(dialog).queryByRole('switch')).toBeNull()
  const credits = within(dialog).getByRole('spinbutton', { name: 'Credit mỗi tháng' })
  expect(credits).toBeDisabled()
  expect(credits).toHaveAccessibleDescription('Hạng Ultimate luôn không giới hạn credit.')
  await user.type(within(dialog).getByRole('textbox', { name: 'Tên gói' }), 'QA Ultimate')
  await user.type(within(dialog).getByRole('spinbutton', { name: 'Giá mỗi tháng' }), '4990000')
  await user.click(within(dialog).getByRole('button', { name: 'Thêm gói' }))
  expect(await screen.findByText('Đã thêm gói QA Ultimate', {}, SLOW)).toBeInTheDocument()
  const post = backend.calls.find((call) => call.method === 'POST')
  expect(post?.body).toMatchObject({ name: 'QA Ultimate', tier: 'ULTIMATE', priceVnd: 4990000, monthlyCredits: null, active: true })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('a plan a company is on: Delete is dimmed with a reason that does not mention stopping sales', async () => {
  const user = userEvent.setup()
  backend.routes['GET /api/subscription/plans'] = [BASIC, PRO]
  renderPlans()
  const table = await screen.findByRole('table', {}, SLOW)
  await user.click(within(table).getByRole('button', { name: 'Thao tác với Basic' }))
  const blocked = await screen.findByRole('menuitem', { name: /Xoá/ })
  expect(blocked).toHaveAttribute('aria-disabled', 'true')
  expect(blocked).toHaveTextContent('Còn 1 công ty đang dùng nên chưa xoá được')
})
