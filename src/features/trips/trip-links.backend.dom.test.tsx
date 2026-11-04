import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { describeEvent } from '@/features/admin/audit-log'
import { VehicleStateBanner } from '@/features/fleet/VehicleStateBanner'
import { VehicleStatusCell } from '@/features/fleet/VehicleStatusBadge'
import type { FleetVehicleState } from '@/features/fleet/vehicle-status'
import { RecentTripsTable } from '@/features/manager/RecentTripsTable'
import type { DashboardTripRow } from '@/features/manager/dashboard-summary'
import { PACKAGE_POOL_SUPPORT } from '@/features/package-pool/package-pool-api'
import { createFormatter } from '@/lib/format'
import { createTranslator, I18nProvider } from '@/lib/i18n'
import { tripLinkable } from './trips-capabilities'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Chuyến đọc backend mà màn khác vẫn đọc kho mẫu: mã chuyến của kho mẫu (TRIP-2026-0914) không có ở máy chủ, nên Chi tiết chuyến mở
 * ra là "Không tìm thấy". Các màn đó hiện mã chuyến dạng chữ thường — không liên kết, không mở Planner, bấm dòng không đi đâu.
 */
const TRIP_ID = 'TRIP-2026-0914'

function renderWithApp(node: React.ReactNode) {
  return render(<I18nProvider><MemoryRouter>{node}</MemoryRouter></I18nProvider>)
}

test('chỉ mã chuyến cùng nguồn với màn chuyến mới mở được Chi tiết chuyến', () => {
  expect(tripLinkable(false)).toBe(false)
  expect(tripLinkable(true)).toBe(true)
  expect(PACKAGE_POOL_SUPPORT.tripLinks).toBe(false)
})

test('xe đang chạy chuyến của kho mẫu: mã chuyến là chữ, không liên kết', () => {
  const state: FleetVehicleState = { vehicleId: 'VEHICLE-001', status: 'in_use', tripId: TRIP_ID, tripPhase: 'delivering' }
  const { unmount } = renderWithApp(<VehicleStatusCell state={state} />)
  expect(screen.getByText(TRIP_ID)).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  unmount()
  renderWithApp(<VehicleStateBanner state={state} />)
  expect(screen.getByText(new RegExp(TRIP_ID))).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('bảng chuyến gần đây của bảng điều khiển: không liên kết tới chuyến hay Planner', () => {
  const row: DashboardTripRow = {
    id: TRIP_ID, name: 'Tuyến Biên Hoà – Dĩ An', scheduledDate: '2026-09-14', vehicleId: 'VEHICLE-001', driverId: null, status: 'PLANNED',
    sub: null, cancelled: false, packageCount: 132, cargoWeightKg: 2400, volumePercent: 80, isMockResult: true,
    plan: { tripId: TRIP_ID, revisionId: 'REV-001', jobId: 'MOCK-1' }, deliveredWeightKg: 0, finishedItems: 0, cleanItems: 0, issueCount: 0,
    vehicleName: 'Hino 500 · 51C-123.45', driverName: null,
  }
  renderWithApp(<RecentTripsTable trips={[row]} />)
  expect(screen.getByText(TRIP_ID)).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('nhật ký và chuông: chuyến của kho mẫu hiện tên, không liên kết', () => {
  const event = { id: 'EV-1', at: '2026-09-13T11:05:00.000Z', actorId: null, companyId: 'LOG-001', action: 'trip.cancelled', target: { type: 'trip', id: TRIP_ID }, params: {} } as const
  const directory = { users: new Map(), trips: new Map([[TRIP_ID, 'Tuyến Biên Hoà – Dĩ An']]), vehicles: new Map() }
  const { target } = describeEvent(event, directory, createTranslator('vi'), createFormatter('vi-VN'), () => true)
  expect(target).toStrictEqual({ id: TRIP_ID, label: 'Tuyến Biên Hoà – Dĩ An', href: null })
})
