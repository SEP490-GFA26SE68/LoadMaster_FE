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

test('renders table of trial requests with status badge colors and opens processing dialog', async () => {
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
  // Point 2: Specific status badge
  expect(within(table).getByText('Chờ duyệt')).toBeInTheDocument()

  // Point 5: Click "Xử lý đơn" button
  const processBtn = within(table).getByRole('button', { name: /Xử lý đơn/i })
  await user.click(processBtn)

  const dialog = await screen.findByRole('dialog', {}, SLOW)
  expect(within(dialog).getByText(/Xử lý đơn đăng ký dùng thử/i)).toBeInTheDocument()
  expect(within(dialog).getByDisplayValue('Công ty Vận tải ABC')).toBeInTheDocument()
})

test('approval flow displays customer info, plan capabilities, duration options, double check confirmation and submits', async () => {
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

  const approveSpy = vi.spyOn(trialApi, 'approveTrialRequest').mockResolvedValue({
    ...mockItem,
    status: 'APPROVED',
  })

  renderTrialRequests()
  const table = await screen.findByRole('table', {}, SLOW)
  await user.click(within(table).getByRole('button', { name: /Xử lý đơn/i }))

  const dialog = await screen.findByRole('dialog', {}, SLOW)

  // Verify customer info displayed in dialog
  expect(within(dialog).getByText('Nguyễn Văn A')).toBeInTheDocument()
  expect(within(dialog).getByText('vana@example.com')).toBeInTheDocument()
  expect(within(dialog).getByText('0901234567')).toBeInTheDocument()

  // Verify role badge
  expect(within(dialog).getAllByText(/Company Admin/i).length).toBeGreaterThanOrEqual(1)

  // Point 1: Verify duration buttons (3, 7, 14, 30 ngày)
  expect(within(dialog).getByRole('button', { name: /3 ngày/i })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /7 ngày/i })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /14 ngày/i })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /30 ngày/i })).toBeInTheDocument()

  // Click on 7 ngày option
  await user.click(within(dialog).getByRole('button', { name: /7 ngày/i }))

  // Point 6: Click "Tiếp tục kiểm tra thông tin" for Double Check
  const doubleCheckBtn = within(dialog).getByRole('button', { name: /Tiếp tục kiểm tra thông tin/i })
  await user.click(doubleCheckBtn)

  // Verify Double Check step screen is shown
  expect(within(dialog).getByText(/Xác nhận lại thông tin bàn giao \(Double Check\)/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/7 ngày/i)).toBeInTheDocument()

  // Submit approval on confirmation step
  const submitBtn = within(dialog).getByRole('button', { name: /Xác nhận duyệt & Tạo công ty/i })
  await user.click(submitBtn)

  await waitFor(() => {
    expect(approveSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        companyName: 'Công ty Vận tải ABC',
        trialDays: 7,
      }),
    )
  })
})

test('rejection inside processing dialog displays business rules and submits rejection with email note', async () => {
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

  const rejectSpy = vi.spyOn(trialApi, 'rejectTrialRequest').mockResolvedValue({
    ...mockItem,
    status: 'REJECTED',
  })

  renderTrialRequests()
  const table = await screen.findByRole('table', {}, SLOW)
  // Point 5: Table row has NO standalone "Từ chối" button. It opens processing dialog
  expect(within(table).queryByRole('button', { name: /^Từ chối$/i })).toBeNull()
  await user.click(within(table).getByRole('button', { name: /Xử lý đơn/i }))

  const dialog = await screen.findByRole('dialog', {}, SLOW)
  // Switch to "Từ chối yêu cầu" tab
  const rejectTab = within(dialog).getByRole('button', { name: /Từ chối yêu cầu/i })
  await user.click(rejectTab)

  // Verify business rules options are displayed
  expect(within(dialog).getByText(/Thông tin doanh nghiệp hoặc Mã số thuế không hợp lệ/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/Doanh nghiệp \/ Đơn vị đã từng được cấp tài khoản dùng thử/i)).toBeInTheDocument()

  // Submit rejection
  const confirmRejectBtn = within(dialog).getByRole('button', { name: /Xác nhận từ chối & Gửi email/i })
  await user.click(confirmRejectBtn)

  await waitFor(() => {
    expect(rejectSpy).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        reason: expect.stringContaining('Thông tin doanh nghiệp hoặc Mã số thuế'),
      }),
    )
  })
})

test('approved item renders "Xem chi tiết" button and opens details dialog', async () => {
  const user = userEvent.setup()
  const mockApprovedItem: trialApi.TrialAccountRequestResponse = {
    id: 3,
    fullName: 'Lê Hoàng Long',
    email: 'long@hoanglong.vn',
    phoneNumber: '0933445566',
    companyName: 'Công ty Hoàng Long',
    createdCompanyName: 'Công ty TNHH Hoàng Long Express',
    companyCode: 'COMP-HOANGLONG',
    taxCode: '0108877665',
    status: 'APPROVED',
    approvedByName: 'System Manager',
    createdAt: '2026-10-18T10:00:00Z',
    resolvedAt: '2026-10-19T10:00:00Z',
    note: 'Đã duyệt qua liên hệ guest #3',
  }

  vi.spyOn(trialApi, 'listTrialRequests').mockResolvedValue({
    success: true,
    data: [mockApprovedItem],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    last: true,
  })

  renderTrialRequests()
  const table = await screen.findByRole('table', {}, SLOW)
  // Point 4: Approved request has "Xem chi tiết" button
  const viewBtn = within(table).getByRole('button', { name: /Xem chi tiết/i })
  await user.click(viewBtn)

  const dialog = await screen.findByRole('dialog', {}, SLOW)
  expect(within(dialog).getByText(/Chi tiết đơn dùng thử #3/i)).toBeInTheDocument()
  expect(within(dialog).getByText('Lê Hoàng Long')).toBeInTheDocument()
  expect(within(dialog).getByText('long@hoanglong.vn')).toBeInTheDocument()
  expect(within(dialog).getByText('Công ty TNHH Hoàng Long Express')).toBeInTheDocument()
  expect(within(dialog).getByText(/COMP-HOANGLONG/i)).toBeInTheDocument()
})

test('sorts trial requests so pending items appear first', async () => {
  const items: trialApi.TrialAccountRequestResponse[] = [
    {
      id: 1,
      fullName: 'Approved User',
      email: 'approved@example.com',
      status: 'APPROVED',
      createdAt: '2026-10-20T10:00:00Z',
    },
    {
      id: 2,
      fullName: 'Pending User',
      email: 'pending@example.com',
      status: 'PENDING',
      createdAt: '2026-10-19T10:00:00Z',
    },
  ]

  vi.spyOn(trialApi, 'listTrialRequests').mockResolvedValue({
    success: true,
    data: items,
    page: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
    last: true,
  })

  renderTrialRequests()
  const table = await screen.findByRole('table', {}, SLOW)
  const rows = within(table).getAllByRole('row')
  // Row 0 is header. Row 1 should be Pending User (weight 1), Row 2 should be Approved User (weight 2)
  expect(within(rows[1]!).getByText('Pending User')).toBeInTheDocument()
  expect(within(rows[2]!).getByText('Approved User')).toBeInTheDocument()
})
