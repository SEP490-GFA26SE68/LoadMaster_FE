import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'
import { TrialAgreementBanner } from './TrialAgreementBanner'

describe('TrialAgreementBanner', () => {
  const pendingAgreement: CompanyAgreement = {
    id: 1,
    companyId: 10,
    companyName: 'Công ty Vận tải An Bình',
    companyCode: 'AB-LOG',
    taxCode: '0102030405',
    agreementType: 'TRIAL_TERMS',
    agreementCode: 'AGR-TRIAL-1',
    title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
    content: 'Điều khoản dịch vụ thử nghiệm...',
    status: 'PENDING',
    deadlineAt: '2026-10-25T14:00:00',
    isExpired: false,
    hoursRemaining: 68,
    createdAt: '2026-10-22T14:00:00',
  }

  it('renders warning banner with countdown and sign button when agreement is PENDING', async () => {
    const user = userEvent.setup()
    const onSignClick = vi.fn()

    render(
      <I18nProvider>
        <TrialAgreementBanner agreement={pendingAgreement} onOpenSignDialog={onSignClick} />
      </I18nProvider>,
    )

    expect(screen.getByText(/Ký Thỏa thuận Dịch vụ Thử nghiệm/i)).toBeInTheDocument()
    expect(screen.getByText(/68 giờ/i)).toBeInTheDocument()

    const signBtn = screen.getByRole('button', { name: /Ký thỏa thuận ngay/i })
    await user.click(signBtn)
    expect(onSignClick).toHaveBeenCalledTimes(1)
  })

  it('renders danger locked banner when agreement is EXPIRED', () => {
    const expiredAgreement: CompanyAgreement = {
      ...pendingAgreement,
      status: 'EXPIRED',
      isExpired: true,
      hoursRemaining: 0,
    }

    render(
      <I18nProvider>
        <TrialAgreementBanner agreement={expiredAgreement} onOpenSignDialog={vi.fn()} />
      </I18nProvider>,
    )

    expect(screen.getByText(/Thỏa thuận đã quá hạn 3 ngày/i)).toBeInTheDocument()
    expect(screen.getByText(/Tài khoản đã bị tạm khóa/i)).toBeInTheDocument()
  })

  it('renders nothing when agreement is already SIGNED or null', () => {
    const signedAgreement: CompanyAgreement = {
      ...pendingAgreement,
      status: 'SIGNED',
      signedAt: '2026-10-22T15:00:00',
      signerName: 'Nguyễn Văn A',
    }

    const { container, rerender } = render(
      <I18nProvider>
        <TrialAgreementBanner agreement={signedAgreement} onOpenSignDialog={vi.fn()} />
      </I18nProvider>,
    )
    expect(container.firstChild).toBeNull()

    rerender(
      <I18nProvider>
        <TrialAgreementBanner agreement={null} onOpenSignDialog={vi.fn()} />
      </I18nProvider>,
    )
    expect(container.firstChild).toBeNull()
  })
})
