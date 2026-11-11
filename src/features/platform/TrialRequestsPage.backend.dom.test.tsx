import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { envelope, stubBackend } from '@/test/fake-backend'
import { TrialRequestsPage } from './TrialRequestsPage'

/**
 * Yêu cầu dùng thử khi nối backend (`companies`, danh mục gói `billing`):
 * - Phân loại xử lý: System Manager thẩm định (PENDING -> PENDING_ADMIN_CREATION), System Admin tạo tài khoản (APPROVED).
 * - Cả 2 luồng duyệt và từ chối đều có cơ chế Double Check xác nhận 2 bước.
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
const AI_REJECTED = {
  id: 3, fullName: 'Nguyễn Văn An', email: 'an@fake.vn', phoneNumber: '0912345678', companyName: 'Anpha Fake', taxCode: '0000000000',
  interestedPlanId: 1, interestedPlanName: 'Basic', status: 'REJECTED', aiPrecheckStatus: 'FAILED', handledByName: 'AI tự xử lý',
  createdAt: '2026-10-23 08:30:00',
}
const PLAN = {
  id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA', features: '[]',
  billingCycle: 'MONTHLY', maxVehicles: 20, maxMonthlyJobs: 500, active: true, activeCompanyCount: 0,
}

let backend: ReturnType<typeof stubBackend>

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  backend = stubBackend({
    'GET /api/trial-requests': { body: { success: true, data: [APPROVED, PENDING, AI_REJECTED], page: 0, totalPages: 1, last: true } },
    'GET /api/subscription/plans': { body: [PLAN] },
    'POST /api/trial-requests/2/manager-approve': { body: envelope({ ...PENDING, status: 'PENDING_ADMIN_CREATION', managerReviewedByName: 'Manager Hoàng' }) },
    'POST /api/trial-requests/2/manager-reject': { body: envelope({ ...PENDING, status: 'REJECTED' }) },
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
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/nen-tang/yeu-cau-dung-thu']}>
            <TrialRequestsPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('pending requests first; approving sends company, tax code, plan, trial days with double-check', async () => {
  const user = userEvent.setup()
  renderPage()
  const table = await screen.findByRole('table', {}, SLOW)
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining('Lê Thị Hoa'),
    expect.stringContaining('Trần Văn Bình'),
    expect.stringContaining('Nguyễn Văn An'),
  ])
  expect(rows[0]).toHaveTextContent('Chờ duyệt')
  expect(rows[1]).toHaveTextContent('Đã duyệt')
  expect(rows[2]).toHaveTextContent('Từ chối')

  await user.click(screen.getByRole('button', { name: 'Xem yêu cầu của Lê Thị Hoa' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt' }))
  expect(await within(dialog).findByRole('textbox', { name: 'Tên công ty' })).toHaveValue('Hoa Logistics')
  expect(await within(dialog).findByRole('combobox', { name: 'Gói dùng thử' })).toHaveTextContent('Pro')
  const days = within(dialog).getByRole('spinbutton', { name: 'Số ngày dùng thử' })
  await user.clear(days)
  await user.type(days, '30')
  await user.click(within(dialog).getByRole('button', { name: 'Khởi tạo tài khoản' }))

  // Double check confirmation dialog
  const confirm = await screen.findByRole('dialog', { name: 'Xác nhận tạo tài khoản doanh nghiệp' })
  expect(confirm).toHaveTextContent('Hoa Logistics')
  await user.click(within(confirm).getByRole('button', { name: 'Khởi tạo tài khoản' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const approve = backend.calls.find((call) => call.method === 'POST' && call.path === '/api/trial-requests/2/approve')
  expect(approve?.body).toEqual({ companyName: 'Hoa Logistics', companyCode: 'HOA_LOGISTICS', taxCode: '0398765432', planId: 2, trialDays: 30, trialCredits: 100 })
  expect(await screen.findByText('Đã duyệt yêu cầu của Lê Thị Hoa.')).toBeInTheDocument()
})

test('rejecting fills reason from standard reason, shows double-check confirmation, and sends it', async () => {
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

  // Double check confirmation dialog
  const confirm = await screen.findByRole('dialog', { name: 'Xác nhận từ chối đơn dùng thử' })
  expect(confirm).toHaveTextContent('Hoa Logistics')
  await user.click(within(confirm).getByRole('button', { name: 'Xác nhận từ chối' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const reject = backend.calls.find((call) => call.method === 'POST' && (call.path === '/api/trial-requests/2/reject' || call.path === '/api/trial-requests/2/manager-reject'))
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

test('systemAdmin never sees pending requests or AI-rejected requests in trial requests table', async () => {
  signedInAs('systemAdmin')
  renderPage()
  const table = await screen.findByRole('table', {}, SLOW)
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows.some((row) => row.textContent?.includes('Nguyễn Văn An'))).toBe(false)
  expect(rows.some((row) => row.textContent?.includes('Lê Thị Hoa'))).toBe(false)
  expect(rows.some((row) => row.textContent?.includes('Trần Văn Bình'))).toBe(true)
})
