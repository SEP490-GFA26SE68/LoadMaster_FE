import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test, vi, afterEach } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { TrialRequestsPage } from './TrialRequestsPage'
import * as trialApi from './trial-requests-api'

const SLOW = { timeout: 5000 }

afterEach(() => {
  vi.restoreAllMocks()
})

function renderTrialRequests() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemManager')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/nen-tang/yeu-cau-dung-thu']}>
            <TrialRequestsPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return client
}

test('renders empty state when there are no trial requests', async () => {
  vi.spyOn(trialApi, 'listTrialRequests').mockResolvedValueOnce({
    success: true,
    data: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 1,
    last: true,
  })

  renderTrialRequests()
  expect(await screen.findByText('Chưa có yêu cầu dùng thử', {}, SLOW)).toBeInTheDocument()
})

test('renders table of trial requests with details and opens approval dialog', async () => {
  const user = userEvent.setup()
  const mockItem: trialApi.TrialAccountRequestResponse = {
    id: 1,
    fullName: 'Nguyễn Văn A',
    email: 'vana@example.com',
    phoneNumber: '0901234567',
    companyName: 'Công ty Vận tải ABC',
    interestedPlanId: 2,
    interestedPlanName: 'Pro',
    status: 'PENDING',
    createdAt: '2026-10-19T10:00:00Z',
  }

  vi.spyOn(trialApi, 'listTrialRequests').mockResolvedValue({
    success: true,
    data: [mockItem],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    last: true,
  })

  renderTrialRequests()
  const table = await screen.findByRole('table', {}, SLOW)
  expect(within(table).getByText('Nguyễn Văn A')).toBeInTheDocument()
  expect(within(table).getByText('vana@example.com')).toBeInTheDocument()
  expect(within(table).getByText('Chờ duyệt')).toBeInTheDocument()

  // Click Duyệt button
  const approveBtn = within(table).getByRole('button', { name: /Duyệt/i })
  await user.click(approveBtn)

  const dialog = await screen.findByRole('dialog', {}, SLOW)
  expect(within(dialog).getByText(/Duyệt đơn & Tạo công ty dùng thử/i)).toBeInTheDocument()
  expect(within(dialog).getByDisplayValue('Công ty Vận tải ABC')).toBeInTheDocument()
})

test('clicking reject button opens reject dialog with reason input', async () => {
  const user = userEvent.setup()
  const mockItem: trialApi.TrialAccountRequestResponse = {
    id: 2,
    fullName: 'Trần Thị B',
    email: 'thib@example.com',
    phoneNumber: '0912345678',
    status: 'PENDING',
    createdAt: '2026-10-19T11:00:00Z',
  }

  vi.spyOn(trialApi, 'listTrialRequests').mockResolvedValue({
    success: true,
    data: [mockItem],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    last: true,
  })

  renderTrialRequests()
  const table = await screen.findByRole('table', {}, SLOW)
  const rejectBtn = within(table).getByRole('button', { name: /Từ chối/i })
  await user.click(rejectBtn)

  const dialog = await screen.findByRole('dialog', {}, SLOW)
  expect(within(dialog).getByText(/Từ chối yêu cầu dùng thử/i)).toBeInTheDocument()
  expect(within(dialog).getByPlaceholderText(/Nhập lý do từ chối/i)).toBeInTheDocument()
})
