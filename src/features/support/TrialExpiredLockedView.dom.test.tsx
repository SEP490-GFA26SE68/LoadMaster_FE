import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { TrialExpiredLockedView } from './TrialExpiredLockedView'

const mockAuth = vi.hoisted(() => ({
  user: {
    id: 'US-MANAGER-1',
    fullName: 'Trần Điều Phối',
    email: 'dispatcher@gamma.vn',
    phone: '0981999002',
    role: 'dispatcher' as const,
    status: 'active' as const,
    subscriptionExpired: true,
  },
  signOut: vi.fn(),
  refreshUser: vi.fn(),
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
  useAuthSafe: () => mockAuth,
}))

describe('TrialExpiredLockedView - Màn hình khóa khi gói cước của công ty hết hạn', () => {
  test('hiển thị thông báo gói cước của doanh nghiệp đã hết hạn', () => {
    render(
      <I18nProvider>
        <TrialExpiredLockedView />
      </I18nProvider>,
    )

    expect(screen.getByText(/Gói cước của doanh nghiệp đã hết hạn/i)).toBeInTheDocument()
    expect(screen.getByText(/Gói cước hết hạn/i)).toBeInTheDocument()
    expect(screen.getByText(/dispatcher@gamma.vn/i)).toBeInTheDocument()
  })

  test('hiển thị hướng dẫn liên hệ Quản trị công ty', () => {
    render(
      <I18nProvider>
        <TrialExpiredLockedView />
      </I18nProvider>,
    )

    expect(screen.getByText(/Liên hệ Quản trị công ty/i)).toBeInTheDocument()
  })

  test('cho phép người dùng bấm đăng xuất khỏi hệ thống', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <TrialExpiredLockedView />
      </I18nProvider>,
    )

    const logoutButtons = screen.getAllByRole('button', { name: /Đăng xuất/i })
    expect(logoutButtons.length).toBeGreaterThan(0)

    await user.click(logoutButtons[0]!)
    expect(mockAuth.signOut).toHaveBeenCalled()
  })

  test('"Kiểm tra lại" đọc lại hồ sơ; gói vẫn chưa có hiệu lực thì nói tại chỗ', async () => {
    const user = userEvent.setup()
    mockAuth.refreshUser.mockResolvedValueOnce({ ...mockAuth.user, subscriptionExpired: true })
    render(
      <I18nProvider>
        <TrialExpiredLockedView />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Kiểm tra lại' }))
    expect(mockAuth.refreshUser).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent('Doanh nghiệp vẫn chưa có gói cước đang hiệu lực.')
  })
})
