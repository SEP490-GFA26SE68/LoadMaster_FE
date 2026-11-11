import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'
import { TrialAgreementNotifier } from './TrialAgreementNotifier'

const mockAuthUser = vi.hoisted(() => ({
  user: {
    id: 'US-0001',
    fullName: 'Đỗ Hoàng Nam',
    email: 'nam@acme.vn',
    phone: '0918923451',
    role: 'companyAdmin',
    status: 'active',
  },
  refreshUser: vi.fn(),
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuthUser,
  useAuthSafe: () => mockAuthUser,
}))

const mockAgreementData = vi.hoisted(() => ({
  agreement: null as CompanyAgreement | null,
}))

vi.mock('./agreements-api', () => ({
  fetchMyAgreement: vi.fn(() => Promise.resolve(mockAgreementData.agreement)),
  signAgreement: vi.fn(() => Promise.resolve({ ...mockAgreementData.agreement, status: 'SIGNED' })),
}))

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TrialAgreementNotifier />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('TrialAgreementNotifier', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    mockAuthUser.user = {
      id: 'US-0001',
      fullName: 'Đỗ Hoàng Nam',
      email: 'nam@acme.vn',
      phone: '0918923451',
      role: 'companyAdmin',
      status: 'active',
    }
  })

  test('tự động bật modal ký và hiển thị banner khi thỏa thuận đang chờ ký (PENDING)', async () => {
    mockAgreementData.agreement = {
      id: '10',
      companyId: '1',
      companyName: 'Công ty Cổ phần Vận tải Tân Cảng',
      agreementCode: 'AGR-TEST-10',
      title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
      content: 'Nội dung điều khoản thỏa thuận...',
      status: 'PENDING',
      deadlineAt: '2026-11-12T10:00:00Z',
      signedAt: null,
      signerName: 'Đỗ Hoàng Nam',
      signerPhone: '0918923451',
      ipAddress: null,
      isExpired: false,
      hoursRemaining: 71,
    }

    renderComponent()

    // 1. Phải hiển thị banner cảnh báo với số giờ còn lại
    await waitFor(() => {
      expect(screen.getByText(/Còn 71 giờ/)).toBeInTheDocument()
    })

    // 2. Modal phải tự động bật lên (chứa họ tên và sđt điền sẵn)
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/Họ và tên người ký/) as HTMLInputElement
      expect(nameInput.value).toBe('Đỗ Hoàng Nam')
    })
  })

  test('hiển thị banner đỏ cảnh báo bị gắn cờ khi thỏa thuận EXPIRED', async () => {
    mockAuthUser.user.status = 'flagged'
    mockAgreementData.agreement = {
      id: '11',
      companyId: '1',
      companyName: 'Công ty Cổ phần Vận tải Tân Cảng',
      agreementCode: 'AGR-TEST-11',
      title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
      content: 'Nội dung điều khoản thỏa thuận...',
      status: 'EXPIRED',
      deadlineAt: '2026-11-05T10:00:00Z',
      signedAt: null,
      signerName: 'Đỗ Hoàng Nam',
      signerPhone: '0918923451',
      ipAddress: null,
      isExpired: true,
      hoursRemaining: 0,
    }

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/tài khoản đã bị gắn cờ và tạm khoá chức năng/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Ký thỏa thuận để mở khóa/i })).toBeInTheDocument()
    })
  })

  test('không hiển thị banner hay modal nếu thỏa thuận đã SIGNED', async () => {
    mockAgreementData.agreement = {
      id: '12',
      companyId: '1',
      companyName: 'Công ty Cổ phần Vận tải Tân Cảng',
      agreementCode: 'AGR-TEST-12',
      title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
      content: 'Nội dung điều khoản...',
      status: 'SIGNED',
      deadlineAt: '2026-11-12T10:00:00Z',
      signedAt: '2026-11-09T10:00:00Z',
      signerName: 'Đỗ Hoàng Nam',
      signerPhone: '0918923451',
      ipAddress: '127.0.0.1',
      isExpired: false,
      hoursRemaining: 0,
    }

    renderComponent()

    await waitFor(() => {
      expect(screen.queryByText(/Thỏa thuận/)).not.toBeInTheDocument()
    })
  })
})
