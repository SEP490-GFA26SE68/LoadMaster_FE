import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

vi.mock('@/features/billing/useAgreementQuery', () => ({
  useMyAgreementQuery: () => ({ data: null, isPending: false }),
  useSignAgreementMutation: () => ({ mutate: vi.fn(), isPending: false }),
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

describe('TrialAccountLockedView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTickets.list = []
  })

  test('renders locked announcement and request form when no pending ticket exists', async () => {
    renderComponent()

    expect(await screen.findByText(/Tài khoản tạm thời bị khóa/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gửi yêu cầu mở khóa/i })).toBeInTheDocument()
  })

  test('submitting unlock form calls createSupportTicket with TRIAL_ACCOUNT_UNLOCK', async () => {
    const user = userEvent.setup()
    mockCreateTicket.mockResolvedValueOnce({
      id: '101',
      code: 'TCK-20261110-0101',
      kind: 'TRIAL_ACCOUNT_UNLOCK',
      title: 'Yêu cầu mở khóa tài khoản dùng thử',
      description: 'Chúng tôi bị trễ hạn ký thỏa thuận do công tác',
      status: 'OPEN',
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    renderComponent()

    await screen.findByText(/Tài khoản tạm thời bị khóa/i)
    const textarea = screen.getByRole('textbox', { name: /Lý do đề nghị mở lại tài khoản/i })
    await user.type(textarea, 'Chúng tôi bị trễ hạn ký thỏa thuận do công tác')

    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu mở khóa/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'TRIAL_ACCOUNT_UNLOCK',
          description: expect.stringContaining('công tác'),
        }),
      )
    })
  })

  test('displays existing pending ticket status if user already submitted unlock request', async () => {
    mockTickets.list = [
      {
        id: '202',
        code: 'TCK-20261110-0202',
        companyId: '10',
        senderId: 'US-999',
        senderName: 'Đỗ Hoàng Nam',
        kind: 'TRIAL_ACCOUNT_UNLOCK',
        title: 'Yêu cầu mở khóa tài khoản',
        description: 'Đã gửi trước đó',
        status: 'OPEN',
        replies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    renderComponent()

    expect(await screen.findByText(/TCK-20261110-0202/)).toBeInTheDocument()
    expect(screen.getByText(/Yêu cầu mở khóa của bạn đang được tiếp nhận/i)).toBeInTheDocument()
  })
})
