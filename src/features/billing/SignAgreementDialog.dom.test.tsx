import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'
import { SignAgreementDialog } from './SignAgreementDialog'

describe('SignAgreementDialog', () => {
  const agreement: CompanyAgreement = {
    id: 1,
    companyId: 10,
    companyName: 'Công ty Vận tải An Bình',
    companyCode: 'AB-LOG',
    taxCode: '0102030405',
    agreementType: 'TRIAL_TERMS',
    agreementCode: 'AGR-TRIAL-1',
    title: 'Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster',
    content: 'ĐIỀU KHOẢN VÀ ĐIỀU KIỆN SỬ DỤNG DỊCH VỤ THỬ NGHIỆM LOADMASTER...',
    status: 'PENDING',
    deadlineAt: '2026-10-25T14:00:00',
    isExpired: false,
    hoursRemaining: 68,
    createdAt: '2026-10-22T14:00:00',
  }

  it('validates required inputs and checkbox before enabling sign button', async () => {
    const user = userEvent.setup()
    const onSign = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <I18nProvider>
        <SignAgreementDialog
          agreement={agreement}
          open={true}
          onClose={onClose}
          onSign={onSign}
          defaultSignerName="Nguyễn Văn A"
          defaultSignerPhone="0912345678"
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Thỏa thuận Sử dụng Dịch vụ Thử nghiệm LoadMaster')).toBeInTheDocument()
    expect(screen.getByText(/AGR-TRIAL-1/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ĐIỀU KHOẢN VÀ ĐIỀU KIỆN/i).length).toBeGreaterThanOrEqual(1)

    const submitBtn = screen.getByRole('button', { name: /Xác nhận ký thỏa thuận/i })
    // Disabled initially because checkbox is not checked
    expect(submitBtn).toBeDisabled()

    const checkbox = screen.getByRole('checkbox', { name: /Tôi đã đọc, hiểu rõ và đồng ý/i })
    await user.click(checkbox)

    // Now enabled
    expect(submitBtn).not.toBeDisabled()

    await user.click(submitBtn)
    expect(onSign).toHaveBeenCalledWith({
      signerName: 'Nguyễn Văn A',
      signerPhone: '0912345678',
      confirmTerms: true,
    })
  })
})
