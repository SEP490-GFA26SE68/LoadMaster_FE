import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function driverStubs(period: string) {
  return {
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
    ]),
    [`GET /api/company/payroll/periods/${period}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
  }
}

function renderPayroll() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/bang-luong']}>
          <PayrollPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('manager calculates dispatcher payroll and saves overtime days and KPI', async () => {
  const user = userEvent.setup()
  const period = currentMonth()
  const { calls } = stubBackend({
    ...driverStubs(period),
    'GET /api/company/dispatcher-payroll/settings': reply([
      { id: 7, effectiveFrom: '2026-11-01', baseSalaryVnd: 10_000_000, overtimeVndPerHour: 50_000, overtimeHoursPerDay: 2 },
    ]),
    [`GET /api/company/dispatcher-payroll/periods/${period}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
    [`POST /api/company/dispatcher-payroll/periods/${period}/calculate`]: reply({
      period,
      status: 'DRAFT',
      dispatchers: [{
        dispatcherId: 31,
        dispatcherName: 'Nguyễn Thanh Tùng',
        baseSalaryVnd: 10_000_000,
        overtimeDays: 0,
        overtimeAmountVnd: 0,
        kpiAmountVnd: 0,
        totalSalaryVnd: 10_000_000,
      }],
    }),
    [`PUT /api/company/dispatcher-payroll/periods/${period}/dispatchers/31`]: reply({
      period,
      status: 'DRAFT',
      dispatchers: [{
        dispatcherId: 31,
        dispatcherName: 'Nguyễn Thanh Tùng',
        baseSalaryVnd: 10_000_000,
        overtimeDays: 3,
        overtimeAmountVnd: 300_000,
        kpiAmountVnd: 1_500_000,
        totalSalaryVnd: 11_800_000,
      }],
    }),
    [`GET /api/company/dispatcher-payroll/periods/${period}/dispatchers/31`]: reply({
      calculated: true,
      period,
      status: 'DRAFT',
      dispatcherId: 31,
      dispatcherName: 'Nguyễn Thanh Tùng',
      baseSalaryVnd: 10_000_000,
      overtimeVndPerHour: 50_000,
      overtimeHoursPerDay: 2,
      overtimeDays: 3,
      overtimeAmountVnd: 300_000,
      kpiAmountVnd: 1_500_000,
      totalSalaryVnd: 11_800_000,
    }),
  })

  renderPayroll()
  await user.click(await screen.findByRole('tab', { name: 'Điều phối' }))
  expect(await screen.findByText('Mức lương điều phối')).toBeInTheDocument()
  expect(await screen.findByText('Chưa có bảng lương cho tháng này')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tính bảng lương' }))

  expect(await screen.findByRole('button', { name: 'Nguyễn Thanh Tùng' })).toBeInTheDocument()
  const days = screen.getByRole('spinbutton', { name: 'Ngày tăng ca của Nguyễn Thanh Tùng' })
  await user.clear(days)
  await user.type(days, '3')
  const kpi = screen.getByRole('spinbutton', { name: 'KPI tháng của Nguyễn Thanh Tùng' })
  await user.clear(kpi)
  await user.type(kpi, '1500000')
  fireEvent.blur(kpi)

  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(
    `PUT /api/company/dispatcher-payroll/periods/${period}/dispatchers/31`,
  ))
  expect((await screen.findAllByText('11.800.000 ₫')).length).toBeGreaterThan(0)

  await user.click(screen.getByRole('button', { name: 'Nguyễn Thanh Tùng' }))
  expect(await screen.findByText(/Tăng ca =/)).toBeInTheDocument()
})
