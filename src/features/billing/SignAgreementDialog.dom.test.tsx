import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'
import { SignAgreementDialog } from './SignAgreementDialog'

const mockAuthUser = vi.hoisted(() => ({
  user: {
    id: 'US-0001',
    fullName: 'Đỗ Hoàng Nam',
    email: 'nam@acme.vn',
    phone: '0918923451',
    role: 'companyAdmin',
    status: 'active',
  },
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuthUser,
  useAuthSafe: () => mockAuthUser,
}))

const sampleAgreement: CompanyAgreement = {
  id: '10',
  companyId: '1',
  companyName: 'Công ty Cổ phần Vận tải Tân Cảng',
  agreementCode: 'AGR-TEST-10',
  title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
  content: 'Toàn văn điều khoản...',
  status: 'PENDING',
  deadlineAt: '2026-11-12T10:00:00Z',
  signedAt: null,
  signerName: 'Đỗ Hoàng Nam',
  signerPhone: '0918923451',
  ipAddress: null,
  isExpired: false,
  hoursRemaining: 71,
}

describe('SignAgreementDialog', () => {
  const onSign = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderDialog(open = true) {
    return render(
      <I18nProvider>
        <SignAgreementDialog agreement={sampleAgreement} open={open} onClose={onClose} onSign={onSign} />
      </I18nProvider>
    )
  }

  test('điền sẵn tên và số điện thoại, yêu cầu tick điều khoản', async () => {
    renderDialog()

    const nameInput = screen.getByLabelText(/Họ và tên người ký/) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/Số điện thoại/) as HTMLInputElement

    expect(nameInput.value).toBe('Đỗ Hoàng Nam')
    expect(phoneInput.value).toBe('0918923451')

    // Bấm Ký mà chưa tick checkbox -> Không submit được
    const submitBtn = screen.getByRole('button', { name: /^Ký thoả thuận$/ })
    await userEvent.click(submitBtn)

    expect(onSign).not.toHaveBeenCalled()
  })

  test('khi tick đồng ý và bấm submit thì mở Double-check confirmation trước khi ký', async () => {
    renderDialog()

    // 1. Tick đồng ý điều khoản
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    // 2. Bấm Ký thỏa thuận
    const submitBtn = screen.getByRole('button', { name: /^Ký thoả thuận$/ })
    await userEvent.click(submitBtn)

    // 3. Phải mở Double-check ConfirmDialog
    await waitFor(() => {
      expect(screen.getByText(/Xác nhận ký Thỏa thuận dịch vụ thử nghiệm/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Tôi xác nhận ký/i })).toBeInTheDocument()
    })

    // Chưa gọi onSign trước khi xác nhận ở Double-check
    expect(onSign).not.toHaveBeenCalled()

    // 4. Bấm "Tôi xác nhận ký"
    const confirmBtn = screen.getByRole('button', { name: /Tôi xác nhận ký/i })
    await userEvent.click(confirmBtn)

    // Lúc này mới gọi onSign
    expect(onSign).toHaveBeenCalledWith({
      signerName: 'Đỗ Hoàng Nam',
      signerPhone: '0918923451',
      confirmTerms: true,
    })
  })
})
