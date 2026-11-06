import { render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { VehicleStatusBadge, VehicleStatusCell } from './VehicleStatusBadge'

afterEach(() => {
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

const VEHICLE_STATUSES = [
  ['available', 'Sẵn sàng', 'Available'],
  ['in_use', 'Đang chạy chuyến', 'In trip'],
  ['maintenance', 'Bảo dưỡng', 'Maintenance'],
  ['AVAILABLE', 'Sẵn sàng', 'Available'],
  ['IN_TRIP', 'Đang chạy chuyến', 'In trip'],
  ['MAINTENANCE', 'Bảo dưỡng', 'Maintenance'],
  ['RETIRED', 'Ngừng sử dụng', 'Retired'],
] as const

for (const locale of ['vi', 'en'] as const) {
  test.each(VEHICLE_STATUSES)(`${locale}: vehicle status %s renders its actual meaning`, (status, vi, en) => {
    window.history.replaceState(null, '', `/?lang=${locale}`)
    render(<I18nProvider><VehicleStatusBadge status={status} /></I18nProvider>)
    expect(screen.getByText(locale === 'vi' ? vi : en)).toBeInTheDocument()
  })

  test.each([undefined, null, 'RUNNING', 'COMPLETED', 'SUCCESS', 'UNKNOWN', 'constructor', 42, {}])(
    `${locale}: missing or invalid vehicle status %s stays unknown without crashing`,
    (status: unknown) => {
      window.history.replaceState(null, '', `/?lang=${locale}`)
      render(<I18nProvider><VehicleStatusBadge status={status} /></I18nProvider>)
      expect(screen.getByText(locale === 'vi' ? 'Chưa rõ trạng thái' : 'Unknown status')).toBeInTheDocument()
      expect(screen.queryByText(locale === 'vi' ? 'Sẵn sàng' : 'Available')).not.toBeInTheDocument()
    },
  )
}

test('a cell with an omitted status does not invent an available vehicle', () => {
  window.history.replaceState(null, '', '/?lang=vi')
  render(<I18nProvider><VehicleStatusCell /></I18nProvider>)
  expect(screen.getByText('Chưa rõ trạng thái')).toBeInTheDocument()
})
