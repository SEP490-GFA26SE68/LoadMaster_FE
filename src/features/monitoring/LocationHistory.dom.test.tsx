import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LocationHistory } from './LocationHistory'

vi.mock('./useMonitoringQuery', () => ({
  useLocationHistoryQuery: () => ({
    data: Array.from({ length: 7 }, (_, index) => ({
      lat: 10.8 + index * 0.001,
      lng: 106.7,
      speedKmh: 30 + index,
      heading: 90,
      recordedAt: `2026-10-18T09:0${index}:00.000Z`,
      source: 'GPS',
    })),
  }),
}))

test('lịch sử vị trí hiện sáu điểm mới nhất mỗi trang; trang sau hiện điểm cũ hơn', async () => {
  const user = userEvent.setup()
  render(<I18nProvider><LocationHistory tripId="TRIP-A" /></I18nProvider>)
  const table = screen.getByRole('table', { name: 'Các điểm gần nhất, mới nhất trước.' })
  expect(within(table).getAllByRole('row')).toHaveLength(7)
  expect(table).toHaveTextContent('16:06')
  expect(table).not.toHaveTextContent('16:00')
  expect(screen.getByText('1–6 / 7')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  expect(table).toHaveTextContent('16:00')
  expect(table).not.toHaveTextContent('16:06')
  expect(screen.getByText('7–7 / 7')).toBeInTheDocument()
})
