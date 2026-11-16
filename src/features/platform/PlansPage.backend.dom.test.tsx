import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test, vi } from 'vitest'
import type { PlanDto } from '@/lib/billing-backend-api'
import { I18nProvider } from '@/lib/i18n'
import { failure, noContent, useFakeBackend } from '@/test/billing-backend-fetch'
import { PlansPage } from './PlansPage'

/**
 * Danh mục gói khi nối backend: liệt kê mọi gói kể cả gói đã ngừng bán (`paged=true`), công tắc bán, thêm gói vào hạng nào cũng được
 * (máy chủ từ chối gói thứ hai mở bán cùng hạng — 409), Ultimate luôn không giới hạn, xoá gói không còn công ty dùng.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()
const SLOW = { timeout: 5000 }
const LIST = 'GET /api/subscription/plans?paged=true&page=0&size=100'

const BASIC: PlanDto = {
  id: 1, planCode: 'BASIC', name: 'Basic', priceVnd: 490000, tier: 'BASIC', monthlyCredits: 100, algorithmTier: 'EP_DBLF',
  features: '["OPTIMIZATION_3D","ROUTE_OPTIMIZATION"]', billingCycle: 'MONTHLY', maxVehicles: 5, maxMonthlyJobs: 100, active: true, activeCompanyCount: 1,
}
const PRO: PlanDto = { ...BASIC, id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA', activeCompanyCount: 0 }
const OLD_PRO: PlanDto = { ...PRO, id: 4, planCode: 'PRO-OLD', name: 'Pro cũ', priceVnd: 1290000, active: false }

const listOf = (...plans: PlanDto[]) => ({ success: true, data: plans, page: 0, size: 100, totalElements: plans.length, totalPages: 1, last: true })

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

test('every plan, stopped ones included, with an on-sale switch and the plan code under the name', async () => {
  backend.routes[LIST] = listOf(PRO, OLD_PRO, BASIC)
  renderPlans()
  const table = await screen.findByRole('table', {}, SLOW)
  expect(within(table).getByRole('columnheader', { name: 'Đang bán' })).toBeInTheDocument()
  expect(within(table).getByRole('switch', { name: 'Đang bán gói Pro cũ' })).not.toBeChecked()
  expect(within(table).getByRole('switch', { name: 'Đang bán gói Pro' })).toBeChecked()
  const basic = within(table).getAllByRole('row').find((row) => row.querySelector('td')?.textContent?.startsWith('Basic'))
  expect(basic?.querySelector('td')?.textContent).toBe('BasicBASIC')
  expect(screen.getByRole('button', { name: 'Thêm gói' })).toBeEnabled()
})

test('putting a stopped plan on sale while its tier has one: the server refuses (409) and the reason shows', async () => {
  const user = userEvent.setup()
  backend.routes[LIST] = listOf(PRO, OLD_PRO)
  backend.routes['GET /api/subscription/plans/4'] = OLD_PRO
  backend.routes['PUT /api/subscription/plans/4'] = () => failure(409)
  renderPlans()
  const table = await screen.findByRole('table', {}, SLOW)
  await user.click(within(table).getByRole('switch', { name: 'Đang bán gói Pro cũ' }))
  expect(await screen.findByText('Hạng gói này đã có gói đang bán.', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ planCode: 'PRO-OLD', active: true })
})

test('adding a plan to a taken tier with the on-sale switch off sends it stopped; Ultimate credits locked as unlimited', async () => {
  const user = userEvent.setup()
  backend.routes[LIST] = listOf(BASIC, PRO)
  backend.routes['POST /api/subscription/plans'] = { ...PRO, id: 9, planCode: 'PRO-X', name: 'Pro 2', active: false }
  renderPlans()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm gói' }))
  const dialog = await screen.findByRole('dialog')
  const tier = within(dialog).getByRole('combobox', { name: 'Hạng' })
  expect(tier).toHaveTextContent('Ultimate')
  const credits = within(dialog).getByRole('spinbutton', { name: 'Credit mỗi tháng' })
  expect(credits).toBeDisabled()
  expect(credits).toHaveAccessibleDescription('Hạng Ultimate luôn không giới hạn credit.')
  await user.click(tier)
  await user.click(await screen.findByRole('option', { name: 'Pro' }))
  expect(credits).toBeEnabled()
  await user.type(within(dialog).getByRole('textbox', { name: 'Tên gói' }), 'Pro 2')
  await user.type(within(dialog).getByRole('spinbutton', { name: 'Giá mỗi tháng' }), '1590000')
  await user.type(credits, '600')
  await user.click(within(dialog).getByRole('switch', { name: 'Mở bán ngay' }))
  await user.click(within(dialog).getByRole('button', { name: 'Thêm gói' }))
  expect(await screen.findByText('Đã thêm gói Pro 2', {}, SLOW)).toBeInTheDocument()
  const post = backend.calls.find((call) => call.method === 'POST')
  expect(post?.body).toMatchObject({ name: 'Pro 2', tier: 'PRO', priceVnd: 1590000, monthlyCredits: 600, active: false })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('a plan a company is on: Delete is dimmed with the reason; a free plan is deleted', async () => {
  const user = userEvent.setup()
  backend.routes[LIST] = listOf(BASIC, PRO)
  backend.routes['DELETE /api/subscription/plans/2'] = () => noContent()
  renderPlans()
  const table = await screen.findByRole('table', {}, SLOW)
  await user.click(within(table).getByRole('button', { name: 'Thao tác với Basic' }))
  const blocked = await screen.findByRole('menuitem', { name: /Xoá/ })
  expect(blocked).toHaveAttribute('aria-disabled', 'true')
  expect(blocked).toHaveTextContent('Còn 1 công ty đang dùng, ngừng bán thay vì xoá')
  await user.keyboard('{Escape}')
  await user.click(within(table).getByRole('button', { name: 'Thao tác với Pro' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Xoá' }))
  await user.click(await screen.findByRole('button', { name: 'Xoá gói' }))
  expect(await screen.findByText('Đã xoá gói Pro', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.some((call) => call.method === 'DELETE' && call.url === 'http://be.test/api/subscription/plans/2')).toBe(true)
})
