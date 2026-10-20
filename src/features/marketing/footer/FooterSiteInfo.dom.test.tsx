import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { PublicFooter } from '../PublicFooter'

/**
 * Khi `SITE_INFO` có thông tin thật thì chân trang hiện đúng thông tin đó, không cần sửa component. Giá trị dưới đây chỉ là dữ liệu của
 * test (không phải thông tin của LoadMaster); bản thật đang để trống nên `PublicFooter.dom.test.tsx` kiểm ngược lại.
 */
vi.mock('@/lib/site-info', () => ({
  SITE_INFO: {
    name: 'LoadMaster',
    url: 'https://loadmaster.vn',
    supportEmail: 'hotro@loadmaster.vn',
    phone: '028 0000 0000',
    address: 'Địa chỉ thử nghiệm của test',
    taxCode: '0000000000',
  },
}))

test('phone, address and tax code appear once SITE_INFO has them: the phone as a tel: link without spaces', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <PublicFooter />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  const footer = screen.getByRole('contentinfo')
  expect(within(footer).getByRole('link', { name: '028 0000 0000' })).toHaveAttribute('href', 'tel:02800000000')
  expect(within(footer).getByText('Điện thoại')).toBeInTheDocument()
  expect(within(footer).getByText('Địa chỉ')).toBeInTheDocument()
  expect(within(footer).getByText('Địa chỉ thử nghiệm của test')).toBeInTheDocument()
  expect(within(footer).getByText('Mã số thuế 0000000000')).toBeInTheDocument()
})
