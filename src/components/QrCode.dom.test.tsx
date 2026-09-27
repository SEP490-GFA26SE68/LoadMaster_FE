import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { QrCode } from './QrCode'

/** Mã QR của kiện (LM-104): một hình có tên truy cập, vẽ bằng đúng một path, in được mã dưới hình. */
test('renders one path inside an image named after the token', () => {
  render(
    <I18nProvider>
      <QrCode token="PKG-001" size={120} showToken />
    </I18nProvider>,
  )
  const image = screen.getByRole('img', { name: 'Mã QR PKG-001' })
  expect(image).toHaveAttribute('width', '120')
  expect(image).toHaveAttribute('viewBox', '0 0 29 29')
  const paths = image.querySelectorAll('path')
  expect(paths).toHaveLength(1)
  expect(paths[0]?.getAttribute('d')).toMatch(/^M4 4h7v1h-7z/)
  expect(screen.getByText('PKG-001')).toBeInTheDocument()
})

test('a custom label replaces the default accessible name', () => {
  render(
    <I18nProvider>
      <QrCode token="PKG-001" label="Nhãn kiện Tủ lạnh Aqua" />
    </I18nProvider>,
  )
  expect(screen.getByRole('img', { name: 'Nhãn kiện Tủ lạnh Aqua' })).toBeInTheDocument()
  expect(screen.queryByText('PKG-001')).not.toBeInTheDocument()
})
