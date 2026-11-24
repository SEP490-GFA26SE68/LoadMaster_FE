import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'

import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'

import { WarehousePayslipPage } from './WarehousePayslipPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['payroll']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'payroll',
}))

afterEach(() => vi.unstubAllGlobals())

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/phieu-luong']}>
          <WarehousePayslipPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('a month that is not locked shows only the base salary and says the rest waits for the manager', async () => {
  stubBackend({
    'GET /api/warehouse/payroll': {
      body: envelope({ calculated: false, period: '2026-11', status: 'DRAFT', workerId: 15, workerName: 'Lê Văn Hải', baseSalaryVnd: 7_000_000, trips: [] }),
    },
  })

  renderPage()
  expect(await screen.findByRole('heading', { name: 'Chi tiết lương · Lê Văn Hải' })).toBeInTheDocument()
  expect(screen.getByText('7.000.000 ₫')).toBeInTheDocument()
  expect(screen.getByText(/Bảng lương tháng này chưa chốt/)).toBeInTheDocument()
  expect(screen.queryByText('Chuyến đã xếp trong tháng')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về màn kho' })).toHaveAttribute('href', '/kho')
})

test('a locked month shows the full statement with the trips loaded', async () => {
  const { calls } = stubBackend({
    'GET /api/warehouse/payroll': {
      body: envelope({
        calculated: true,
        period: '2026-11',
        status: 'LOCKED',
        workerId: 15,
        workerName: 'Lê Văn Hải',
        baseSalaryVnd: 7_000_000,
        loadedPackages: 120,
        loadedKg: 1840.5,
        rateVndPerKg: 100,
        loadedAmountVnd: 184_050,
        kpiTargetKg: 1500,
        kpiAchieved: true,
        kpiBonusVnd: 500_000,
        totalSalaryVnd: 7_684_050,
        trips: [{ tripId: 42, tripCode: 'TRIP-2026-1105', loadedDate: '2026-11-05', loadedPackages: 80, loadedKg: 1200 }],
      }),
    },
  })

  renderPage()
  expect(await screen.findByText('TRIP-2026-1105')).toBeInTheDocument()
  expect(screen.getByText('Đã chốt')).toBeInTheDocument()
  expect(screen.getByText('7.684.050 ₫')).toBeInTheDocument()
  expect(screen.getByText('05/11/2026')).toBeInTheDocument()
  expect(screen.queryByText(/Bảng lương tháng này chưa chốt/)).not.toBeInTheDocument()
  expect(calls[0]?.query.period).toMatch(/^\d{4}-\d{2}$/)
})

test('without any payslip for the month the page says the manager has not calculated it yet', async () => {
  stubBackend({
    'GET /api/warehouse/payroll': {
      body: envelope({ calculated: false, period: '2026-11', workerId: 15, workerName: 'Lê Văn Hải', trips: [] }),
    },
  })

  renderPage()
  expect(await screen.findByText('Chưa có bảng lương cho tháng này')).toBeInTheDocument()
})
