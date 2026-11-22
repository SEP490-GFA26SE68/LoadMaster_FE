import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { MonitoringTrip } from './monitoring-api'
import { MonitoringTripList } from './MonitoringTripList'

const trip = (tripId: string): MonitoringTrip => ({
  tripId,
  name: tripId,
  vehicleName: `Xe ${tripId}`,
  driverName: 'Tài xế A',
  depot: { name: 'Kho', lat: 10.9, lng: 106.8 },
  stops: [{ id: `${tripId}-1`, number: 1, name: 'Điểm 1' }],
})

const TRIPS = [trip('TRIP-A'), trip('TRIP-B'), trip('TRIP-C')]

function List({ trips = TRIPS, selected = 'TRIP-A' }: { trips?: MonitoringTrip[]; selected?: string | null }) {
  const [selectedId, setSelectedId] = useState(selected)
  return (
    <I18nProvider>
      <MonitoringTripList
        liveOf={() => undefined}
        visible={trips}
        counts={{ late: 0, incidents: 0 }}
        filter={{ late: false, incidents: false }}
        onToggle={() => {}}
        onClear={() => {}}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </I18nProvider>
  )
}

test('khung chuyến cạnh bản đồ hiện hai dòng mỗi trang; trang sau hiện chuyến còn lại', async () => {
  const user = userEvent.setup()
  render(<List />)
  const list = screen.getByRole('list', { name: 'Chuyến đang vận chuyển' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(list).toHaveTextContent('TRIP-A')
  expect(list).toHaveTextContent('TRIP-B')
  expect(list).not.toHaveTextContent('TRIP-C')
  expect(screen.getByText('1–2 / 3')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  expect(list).toHaveTextContent('TRIP-C')
  expect(list).not.toHaveTextContent('TRIP-A')
  expect(screen.getByText('3–3 / 3')).toBeInTheDocument()
})

test('chọn chuyến ở trang sau thì danh sách nhảy tới trang đó', async () => {
  render(<List selected="TRIP-C" />)
  const list = screen.getByRole('list', { name: 'Chuyến đang vận chuyển' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  expect(list).toHaveTextContent('TRIP-C')
})

test('hai chuyến thì không hiện phân trang', () => {
  render(<List trips={[trip('TRIP-A'), trip('TRIP-B')]} />)
  expect(screen.queryByRole('navigation', { name: 'Trang danh sách chuyến' })).toBeNull()
  expect(within(screen.getByRole('list', { name: 'Chuyến đang vận chuyển' })).getAllByRole('listitem')).toHaveLength(2)
})
