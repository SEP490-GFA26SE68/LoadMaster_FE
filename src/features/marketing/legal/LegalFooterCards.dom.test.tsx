import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LegalFooterCards } from './LegalFooterCards'

/**
 * Khi `SITE_INFO` có thông tin thật thì thẻ "Còn câu hỏi?" của hai trang pháp lý tự hiện đúng thông tin đó. Giá trị dưới đây chỉ là dữ
 * liệu của test (không phải thông tin của LoadMaster); bản thật đang để trống nên `PrivacyPage` / `TermsPage` kiểm ngược lại.
 */
vi.mock('@/lib/site-info', () => ({
  SITE_INFO: {
    name: 'LoadMaster',
    supportEmail: 'hotro@vi-du.test',
    phone: '000 0000 0000',
    address: 'Địa chỉ thử nghiệm của test',
    taxCode: '0000000000',
  },
}))

test('the closing card shows the contact lines SITE_INFO has, the phone as a tel: link without spaces', () => {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/dieu-khoan-su-dung']}>
        <LegalFooterCards doc="terms" />
      </MemoryRouter>
    </I18nProvider>,
  )
  expect(screen.getByRole('link', { name: 'Hoặc viết tới hotro@vi-du.test.' })).toHaveAttribute('href', 'mailto:hotro@vi-du.test')
  expect(screen.getByRole('link', { name: 'Điện thoại: 000 0000 0000' })).toHaveAttribute('href', 'tel:00000000000')
  expect(screen.getByText('Địa chỉ: Địa chỉ thử nghiệm của test')).toBeInTheDocument()
  expect(screen.getByText('Mã số thuế: 0000000000')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Đọc Chính sách bảo mật' })).toHaveAttribute('href', '/chinh-sach-bao-mat')
})
