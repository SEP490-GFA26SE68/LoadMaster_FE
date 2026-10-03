import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { Toaster } from 'sonner'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import type { EtaRiskAlert, TripMonitoring } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { EtaRiskWatcher } from './EtaRiskWatcher'
import { listTripMonitoring } from './monitoring-api'

/**
 * Toast nguy cơ trễ hạn (FE-6-09). Lớp API được giả để test tự đặt cảnh báo kho trả về; luật phát cảnh báo của kho kiểm ở
 * `tracking.test.ts`. Giờ trong câu là giờ Việt Nam của mốc ISO.
 */
vi.mock('./monitoring-api', () => ({ listTripMonitoring: vi.fn() }))
const fleet = vi.mocked(listTripMonitoring)

const alert = (eventId: string, status: EtaRiskAlert['status'], stopNumber: number): EtaRiskAlert => ({
  eventId, status, stopNumber, at: '2026-09-14T08:10:00.000Z', tripId: 'TRIP-015', stopId: `STOP-0${stopNumber}`,
  eta: '2026-09-14T08:40:00.000Z', deadline: '2026-09-14T09:00:00.000Z',
})
const monitoring = (alerts: EtaRiskAlert[]): TripMonitoring[] => [{ tripId: 'TRIP-015', location: null, stops: [], alerts, exceptions: [], refreshMs: null, isMockResult: true }]

beforeEach(() => {
  fleet.mockReset()
})

function renderWatcher(role: Role) {
  signedInAs(role)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidated = vi.spyOn(client, 'invalidateQueries')
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <EtaRiskWatcher />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  const bellRefreshes = () => invalidated.mock.calls.filter(([filters]) => JSON.stringify(filters?.queryKey) === '["notifications"]').length
  return { client, bellRefreshes }
}

test('the dispatcher gets a toast for each alert raised while watching; alerts that were already there only refresh the bell', async () => {
  fleet.mockResolvedValue(monitoring([alert('EV-000900', 'AT_RISK', 1)]))
  const { client, bellRefreshes } = renderWatcher('dispatcher')
  await waitFor(() => expect(bellRefreshes()).toBe(1))
  expect(screen.queryByText(/TRIP-015/)).not.toBeInTheDocument()

  // Lần đọc sau: thêm một điểm sát hạn và một điểm trễ hạn dự kiến
  fleet.mockResolvedValue(monitoring([alert('EV-000900', 'AT_RISK', 1), alert('EV-000901', 'AT_RISK', 2), alert('EV-000902', 'MISSED', 3)]))
  await client.invalidateQueries({ queryKey: ['trips', 'monitoring'] })
  expect(await screen.findByText('Chuyến TRIP-015: điểm 2 sát hạn giao')).toBeInTheDocument()
  expect(screen.getByText('Chuyến TRIP-015: điểm 3 dự kiến trễ hạn giao')).toBeInTheDocument()
  expect(screen.getAllByText('Dự kiến đến 15:40 14/09 · hạn giao 16:00 14/09')).toHaveLength(2)
  expect(screen.queryByText('Chuyến TRIP-015: điểm 1 sát hạn giao')).not.toBeInTheDocument()
  expect(bellRefreshes()).toBe(2)

  // Đọc lại cùng dữ liệu: không toast nào thêm, chuông không đọc lại
  await client.invalidateQueries({ queryKey: ['trips', 'monitoring'] })
  await waitFor(() => expect(fleet).toHaveBeenCalledTimes(3))
  expect(screen.getAllByText(/^Chuyến TRIP-015/)).toHaveLength(2)
  expect(bellRefreshes()).toBe(2)
})

test('nothing in transit: one read, no toast, the bell is left alone', async () => {
  fleet.mockResolvedValue([])
  const { bellRefreshes } = renderWatcher('dispatcher')
  await waitFor(() => expect(fleet).toHaveBeenCalledTimes(1))
  expect(bellRefreshes()).toBe(0)
})

test.each(['manager', 'warehouse', 'driver', 'companyAdmin'] as const)('the %s is not notified of late risk: the watcher does not read the store', async (role) => {
  fleet.mockResolvedValue(monitoring([alert('EV-000900', 'AT_RISK', 1)]))
  renderWatcher(role)
  // chờ phiên dựng xong rồi mới khẳng định là không đọc
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(fleet).not.toHaveBeenCalled()
})
