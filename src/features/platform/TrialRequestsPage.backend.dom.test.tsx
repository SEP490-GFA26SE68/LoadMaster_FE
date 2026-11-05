import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { TrialRequestsPage } from './TrialRequestsPage'

/**
 * Yêu cầu dùng thử khi nối backend (`companies`, danh mục gói `billing`): chờ duyệt đứng đầu, duyệt gửi tên công ty, mã số thuế, gói và số
 * ngày dùng thử; từ chối gửi lý do theo lý do chuẩn.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['companies', 'billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'companies' || feature === 'billing',
}))

const SLOW = { timeout: 5000 }

const APPROVED = {
  id: 1, fullName: 'Trần Văn Bình', email: 'binh@vantaibinh.vn', companyName: 'Vận tải Bình An', taxCode: '0312345678', interestedPlanId: 2,
  interestedPlanName: 'Pro', status: 'APPROVED', approvedByName: 'Nguyễn Thị Quản Trị', createdCompanyName: 'Vận tải Bình An',
  createdAt: '2026-10-20 09:00:00', resolvedAt: '2026-10-21 10:00:00',
}
const PENDING = {
  id: 2, fullName: 'Lê Thị Hoa', email: 'hoa@hoalogistics.vn', phoneNumber: '0909123456', companyName: 'Hoa Logistics', taxCode: '0398765432',
  interestedPlanId: 2, interestedPlanName: 'Pro', status: 'PENDING', createdAt: '2026-10-22 08:30:00',
}
const PLAN = {
  id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA', features: '[]',
  billingCycle: 'MONTHLY', maxVehicles: 20, maxMonthlyJobs: 500, active: true, activeCompanyCount: 0,
}

let backend: ReturnType<typeof stubBackend>

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  backend = stubBackend({
    'GET /api/trial-requests': { body: { success: true, data: [APPROVED, PENDING], page: 0, totalPages: 1, last: true } },
    'GET /api/subscription/plans': { body: [PLAN] },
    'POST /api/trial-requests/2/approve': { body: envelope({ ...PENDING, status: 'APPROVED' }) },
    'POST /api/trial-requests/2/reject': { body: envelope({ ...PENDING, status: 'REJECTED' }) },
  })
})
afterEach(() => vi.unstubAllGlobals())

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/nen-tang/yeu-cau-dung-thu']}>
          <TrialRequestsPage />
        </MemoryRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('pending requests first; approving sends the company, tax code, plan and trial days', async () => {
  const user = userEvent.setup()
  renderPage()
  const table = await screen.findByRole('table', {}, SLOW)
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining('Lê Thị Hoa'), expect.stringContaining('Trần Văn Bình')])
  expect(rows[0]).toHaveTextContent('Chờ duyệt')
  expect(rows[1]).toHaveTextContent('Đã duyệt')

  await user.click(screen.getByRole('button', { name: 'Xem yêu cầu của Lê Thị Hoa' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt' }))
  expect(await within(dialog).findByRole('textbox', { name: 'Tên công ty' })).toHaveValue('Hoa Logistics')
  expect(await within(dialog).findByRole('combobox', { name: 'Gói dùng thử' })).toHaveTextContent('Pro')
  const days = within(dialog).getByRole('spinbutton', { name: 'Số ngày dùng thử' })
  await user.clear(days)
  await user.type(days, '30')
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt và tạo công ty' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const approve = backend.calls.find((call) => call.method === 'POST' && call.path === '/api/trial-requests/2/approve')
  expect(approve?.body).toEqual({ companyName: 'Hoa Logistics', taxCode: '0398765432', planId: 2, trialDays: 30 })
  expect(await screen.findByText('Đã duyệt yêu cầu của Lê Thị Hoa.')).toBeInTheDocument()
})

test('rejecting fills the reason from the standard reason and sends it', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Xem yêu cầu của Lê Thị Hoa' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Từ chối' }))
  await user.click(await within(dialog).findByRole('radio', { name: 'Doanh nghiệp đã từng được dùng thử' }))
  expect(within(dialog).getByRole('textbox', { name: 'Lý do từ chối' })).toHaveValue(
    'Doanh nghiệp hoặc người đại diện của bạn đã được dùng thử trước đây. Vui lòng liên hệ để đăng ký gói chính thức.',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Từ chối yêu cầu' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const reject = backend.calls.find((call) => call.method === 'POST' && call.path === '/api/trial-requests/2/reject')
  expect(reject?.body).toEqual({ reason: 'Doanh nghiệp hoặc người đại diện của bạn đã được dùng thử trước đây. Vui lòng liên hệ để đăng ký gói chính thức.' })
})

test('a processed request only shows its outcome, no approve or reject', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Xem yêu cầu của Trần Văn Bình' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Nguyễn Thị Quản Trị')).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Duyệt' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: 'Từ chối' })).toBeNull()
})
