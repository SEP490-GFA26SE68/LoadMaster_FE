import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'

import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'

import { PayrollPage } from './PayrollPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['payroll']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'payroll',
}))

afterEach(() => vi.unstubAllGlobals())

function reply(data: unknown) {
  return { body: envelope(data) }
}

function renderPayroll() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/bang-luong']}>
          <PayrollPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('loads company pay rates, calculates a monthly payroll, and shows the driver statement', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, rateVndPerKm: 2_000 },
    ]),
    [`GET /api/company/payroll/periods/${period}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
    [`POST /api/company/payroll/periods/${period}/calculate`]: reply({
      period,
      status: 'DRAFT',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, totalKm: 60, kmAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }],
    }),
    [`GET /api/company/payroll/periods/${period}/drivers/21`]: reply({
      calculated: true,
      period,
      status: 'DRAFT',
      driverId: 21,
      driverName: 'Nguyen Van An',
      baseSalaryVnd: 8_000_000,
      totalKg: 500,
      rateVndPerKg: 100,
      kgAmountVnd: 50_000,
      totalKm: 60,
      rateVndPerKm: 2_000,
      kmAmountVnd: 120_000,
      totalSalaryVnd: 8_170_000,
      trips: [{ tripId: 42, tripCode: 'TRIP-0042', planKg: 1_000, planKm: 120, sharePercent: 50, allocatedKg: 500, allocatedKm: 60, kgAmountVnd: 50_000, kmAmountVnd: 120_000, totalAmountVnd: 170_000 }],
    }),
    'GET /api/company/payroll/trips/42/drivers': reply([{ driverId: 21, driverName: 'Nguyen Van An', sharePercent: 50 }]),
  })

  renderPayroll()
  expect(await screen.findByText('Chưa có bảng lương cho tháng này')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tính bảng lương' }))

  expect(await screen.findByRole('button', { name: 'Nguyen Van An' })).toBeInTheDocument()
  expect(screen.getAllByText('8.170.000 ₫').length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: 'Nguyen Van An' }))
  expect(await screen.findByText('TRIP-0042')).toBeInTheDocument()
  expect(await screen.findByText('Khối lượng phương án')).toBeInTheDocument()
  expect(screen.getAllByText('Tiền theo quãng đường').length).toBeGreaterThan(0)
  expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(`POST /api/company/payroll/periods/${period}/calculate`)
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain('GET /api/company/payroll/trips/42/drivers'))
})
