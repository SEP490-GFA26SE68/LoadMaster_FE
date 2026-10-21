import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { SubscriptionHistoryPage } from './SubscriptionHistoryPage'

vi.mock('./contracts-api', () => ({
  listContracts: vi.fn().mockResolvedValue({
    items: [
      {
        id: 101,
        contractNumber: 'CTR-2026-001',
        companyId: 1,
        companyName: 'Công ty TNHH Vận tải Long Bình',
        companyCode: 'LOG-001',
        planId: 1,
        planName: 'Gói Doanh Nghiệp Pro',
        planTier: 'PRO',
        priceVnd: 4500000,
        billingCycle: 'MONTHLY',
        creditsGranted: 2000,
        startDate: '2026-10-01T00:00:00Z',
        endDate: '2026-11-01T00:00:00Z',
        status: 'ACTIVE',
        adminName: 'Dương Thị Kim Oanh',
        adminEmail: 'qtcongty@loadmaster.vn',
        adminPhone: '0901234567',
      },
    ],
    totalElements: 1,
    totalPages: 1,
    page: 0,
    size: 10,
  }),
}))

describe('SubscriptionHistoryPage', () => {
  beforeEach(() => {
    signedInAs('systemManager')
  })

  it('renders dedicated subscription history page with contracts table and details modal', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/nen-tang/lich-su-goi']}>
              <SubscriptionHistoryPage />
            </MemoryRouter>
            <Toaster />
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Lịch sử Gói cước')).toBeInTheDocument()
    expect(await screen.findByText('CTR-2026-001')).toBeInTheDocument()
    expect(screen.getByText('Công ty TNHH Vận tải Long Bình')).toBeInTheDocument()
    expect(screen.getByText('Gói Doanh Nghiệp Pro')).toBeInTheDocument()

    // Click "Xem chi tiết"
    const viewBtn = screen.getByRole('button', { name: /Xem chi tiết.*CTR-2026-001/i })
    await user.click(viewBtn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Chi tiết Hợp đồng Gói cước/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/CTR-2026-001/)).toBeInTheDocument()
    expect(within(dialog).getByText('qtcongty@loadmaster.vn')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
