import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { SupportTicket } from '@/lib/mock-db'
import { TrialAccountLockedView } from './TrialAccountLockedView'

const mockAuthUser = vi.hoisted(() => ({
  user: {
    id: 'US-999',
    fullName: 'Đỗ Hoàng Nam',
    email: 'nam@acme.vn',
    phone: '0918923451',
    role: 'companyAdmin',
    status: 'flagged' as const,
  },
  logout: vi.fn(),
  signOut: vi.fn(),
  refreshUser: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuthUser,
  useAuthSafe: () => mockAuthUser,
}))

const mockTickets = vi.hoisted(() => ({
  list: [] as SupportTicket[],
}))

const mockCreateTicket = vi.hoisted(() => vi.fn())

vi.mock('./support-api', async () => {
  const actual = await vi.importActual<typeof import('./support-api')>('./support-api')
  return {
    ...actual,
    listSupportTickets: vi.fn(() => Promise.resolve(mockTickets.list)),
    createSupportTicket: mockCreateTicket,
  }
})

const mockAgreementData = vi.hoisted(() => ({
  data: {
    id: 500,
    companyId: 100,
    companyName: 'Công ty Cổ phần Vận tải Acme',
    companyCode: 'ACME-LOG',
    taxCode: '0318923451',
    agreementCode: 'AGR-ACME-01',
    agreementType: 'TRIAL_TERMS' as const,
    title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
    content: 'Nội dung điều khoản thỏa thuận dịch vụ thử nghiệm LoadMaster...',
    status: 'EXPIRED' as const,
    deadlineAt: '2026-11-10T10:00:00Z',
    signedAt: null,
    signerName: 'Đỗ Hoàng Nam',
    signerEmail: 'nam@acme.vn',
    signerPhone: '0918923451',
  },
  isPending: false,
}))

const mockSignMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}))

vi.mock('@/features/billing/useAgreementQuery', () => ({
  useMyAgreementQuery: () => mockAgreementData,
  useSignAgreementMutation: () => mockSignMutation,
}))

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TrialAccountLockedView />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('TrialAccountLockedView - Phương án A (Self-Service Unlock)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTickets.list = []
  })

  test('renders locked announcement and prominent self-service button to sign agreement directly', async () => {
    renderComponent()

    expect(await screen.findByText(/Tài khoản tạm thời bị khóa/i)).toBeInTheDocument()
    // Nút Hero CTA tự phục vụ ký để mở khóa phải xuất hiện nổi bật
    const signBtn = screen.getByRole('button', { name: /Ký thỏa thuận để mở khóa ngay/i })
    expect(signBtn).toBeInTheDocument()
    expect(screen.getByText(/Công ty Cổ phần Vận tải Acme/i)).toBeInTheDocument()
  })

  test('clicking hero sign button opens SignAgreementDialog', async () => {
    const user = userEvent.setup()
    renderComponent()

    const signBtn = await screen.findByRole('button', { name: /Ký thỏa thuận để mở khóa ngay/i })
    await user.click(signBtn)

    // Dialog mở ra
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Ký thoả thuận/i })).toBeInTheDocument()
  })

  test('completing sign agreement calls signAgreementMutation and triggers auth.refreshUser', async () => {
    const user = userEvent.setup()
    mockSignMutation.mutateAsync.mockResolvedValueOnce({
      id: 500,
      status: 'SIGNED',
      signedAt: new Date().toISOString(),
      signerName: 'Đỗ Hoàng Nam',
    })

    renderComponent()

    const signBtn = await screen.findByRole('button', { name: /Ký thỏa thuận để mở khóa ngay/i })
    await user.click(signBtn)

    const dialog = await screen.findByRole('dialog')
    // 1. Click checkbox xác nhận điều khoản
    const checkbox = within(dialog).getByRole('checkbox')
    await user.click(checkbox)

    // 2. Click nút Ký thoả thuận
    const submitBtn = within(dialog).getByRole('button', { name: /Ký thoả thuận/i })
    await user.click(submitBtn)

    // 3. Double-check ConfirmDialog xuất hiện, click "Tôi xác nhận ký"
    const confirmBtn = await screen.findByRole('button', { name: /Tôi xác nhận ký/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mockSignMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmTerms: true,
          signerName: 'Đỗ Hoàng Nam',
        }),
      )
      expect(mockAuthUser.refreshUser).toHaveBeenCalled()
    })
  })

  test('provides optional secondary technical assistance section for help inquiries', async () => {
    const user = userEvent.setup()
    mockCreateTicket.mockResolvedValueOnce({
      id: '101',
      code: 'TCK-20261111-0101',
      kind: 'TECHNICAL',
      title: 'Hỗ trợ kỹ thuật mở khóa tài khoản',
      description: 'Gặp sự cố khi ký thỏa thuận',
      status: 'OPEN',
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    renderComponent()

    // Bấm mở rộng phần trợ giúp kỹ thuật
    const helpToggle = await screen.findByText(/Cần trợ giúp kỹ thuật hoặc gặp sự cố khi ký/i)
    await user.click(helpToggle)

    const textarea = screen.getByRole('textbox', { name: /Nội dung cần hỗ trợ/i })
    await user.type(textarea, 'Gặp sự cố khi ký thỏa thuận')

    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu hỗ trợ/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateTicket).toHaveBeenCalled()
    })
  })
})
