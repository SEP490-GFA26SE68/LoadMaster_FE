import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Card } from '@/components/ui/Card'
import { I18nProvider } from '@/lib/i18n'
import type { TripException } from '@/lib/mock-db'
import { TripExceptionList } from './TripExceptionList'

vi.mock('./useMonitoringQuery', () => ({
  useEscalateExceptionMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useResolveExceptionMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))

const exception = (id: string, description: string): TripException => ({
  id,
  tripId: 'TRIP-A',
  type: 'TRAFFIC',
  description,
  delayMinutes: 10,
  status: 'OPEN',
  reportedAt: '2026-10-18T09:00:00.000Z',
  reportedBy: '4',
})

test('sự cố của chuyến hiện một sự cố mỗi trang, mới nhất trước', async () => {
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <Card className="flex flex-col">
        <TripExceptionList
          tripId="TRIP-A"
          exceptions={[exception('EXC-1', 'Kẹt xe cũ'), exception('EXC-2', 'Kẹt xe mới')]}
          userNames={{ '4': 'Lê Thị Mai' }}
          canResolve={false}
          canEscalate={false}
          onReroute={() => {}}
        />
      </Card>
    </I18nProvider>,
  )
  const list = screen.getByRole('list', { name: 'Sự cố của chuyến' })
  expect(list.querySelectorAll(':scope > li')).toHaveLength(1)
  expect(list).toHaveTextContent('EXC-2')
  expect(list).toHaveTextContent('Kẹt xe mới')
  expect(list).not.toHaveTextContent('EXC-1')
  expect(screen.getByText('1–1 / 2')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(list.querySelectorAll(':scope > li')).toHaveLength(1)
  expect(list).toHaveTextContent('EXC-1')
  expect(list).not.toHaveTextContent('EXC-2')
})
