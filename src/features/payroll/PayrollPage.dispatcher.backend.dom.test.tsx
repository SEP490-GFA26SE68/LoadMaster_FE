import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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

test('manager calculates dispatcher payroll and sees the table only after locking', async () => {
  const user = userEvent.setup()
  const period = currentMonth()
  const dispatchers = [{
    dispatcherId: 31,
    dispatcherName: 'Nguyễn Thanh Tùng',
    baseSalaryVnd: 10_000_000,
    overtimeDays: 3,
    overtimeAmountVnd: 300_000,
    kpiAmountVnd: 0,
    totalSalaryVnd: 10_300_000,
  }]
  let payrollPeriod: { period: string; status: string; kpiAmountVnd: number; dispatchers: typeof dispatchers } | null = null
  let rate = {
    id: 7,
    effectiveFrom: '2026-11-01',
    baseSalaryVnd: 10_000_000,
    overtimeVndPerHour: 50_000,
    overtimeHoursPerDay: 2,
    overtimeDaysPerMonth: 4,
    kpiAmountVnd: 1_500_000,
  }
  const { calls } = stubBackend({
    ...driverStubs(period),
    'GET /api/company/dispatcher-payroll/settings': () => reply([rate]),
    [`GET /api/company/dispatcher-payroll/periods/${period}`]: () => payrollPeriod
      ? reply(payrollPeriod)
      : { status: 404, body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' } },
    [`POST /api/company/dispatcher-payroll/periods/${period}/calculate`]: () => {
      payrollPeriod = { period, status: 'DRAFT', kpiAmountVnd: 1_500_000, dispatchers: [...dispatchers] }
      return reply(payrollPeriod)
    },
    [`POST /api/company/dispatcher-payroll/periods/${period}/lock`]: () => {
      payrollPeriod = { ...(payrollPeriod as NonNullable<typeof payrollPeriod>), status: 'LOCKED' }
      return reply(payrollPeriod)
    },
    [`PUT /api/company/dispatcher-payroll/periods/${period}/dispatchers/31`]: () => {
      const next = [{
        ...dispatchers[0],
        kpiAmountVnd: 1_500_000,
        totalSalaryVnd: 11_800_000,
      }]
      payrollPeriod = { ...(payrollPeriod as NonNullable<typeof payrollPeriod>), dispatchers: next }
      return reply(payrollPeriod)
    },
    'PUT /api/company/dispatcher-payroll/settings': ({ body }) => {
      rate = { ...rate, ...(body as typeof rate) }
      return reply(rate)
    },
    [`GET /api/company/dispatcher-payroll/periods/${period}/dispatchers/31`]: () => reply({
      calculated: true,
      period,
      status: payrollPeriod?.status ?? 'LOCKED',
      dispatcherId: 31,
      dispatcherName: 'Nguyễn Thanh Tùng',
      baseSalaryVnd: 10_000_000,
      overtimeVndPerHour: 50_000,
      overtimeHoursPerDay: 2,
      overtimeDays: 3,
      overtimeAmountVnd: 300_000,
      kpiAmountVnd: payrollPeriod?.dispatchers[0].kpiAmountVnd ?? 0,
      totalSalaryVnd: payrollPeriod?.dispatchers[0].totalSalaryVnd ?? 10_300_000,
    }),
  })

  renderPayroll()
  await user.click(await screen.findByRole('tab', { name: 'Điều phối' }))
  expect(await screen.findByText('Mức lương điều phối')).toBeInTheDocument()
  expect(await screen.findByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tính bảng lương' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(
    `POST /api/company/dispatcher-payroll/periods/${period}/calculate`,
  ))
  expect(screen.getByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nguyễn Thanh Tùng' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Chốt bảng lương' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chốt bảng lương' }))

  expect(await screen.findByRole('button', { name: 'Nguyễn Thanh Tùng' })).toBeInTheDocument()
  const kpi = screen.getByRole('combobox', { name: 'KPI tháng của Nguyễn Thanh Tùng' })
  expect(kpi).toBeEnabled()
  await user.click(kpi)
  await user.click(await screen.findByRole('option', { name: 'Đạt' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(
    `PUT /api/company/dispatcher-payroll/periods/${period}/dispatchers/31`,
  ))
  expect((await screen.findAllByText('11.800.000 ₫')).length).toBeGreaterThan(0)

  await user.click(screen.getByRole('button', { name: 'Nguyễn Thanh Tùng' }))
  const details = await screen.findByRole('dialog', { name: /Chi tiết lương/ })
  expect(details).toHaveTextContent(/Tăng ca =/)
  await user.click(within(details).getByRole('button', { name: 'Đóng' }))

  await user.click(screen.getByRole('button', { name: 'Xem phiên bản đã lưu' }))
  const versions = await screen.findByRole('dialog', { name: 'Các phiên bản đã lưu' })
  expect(versions).toHaveTextContent('2026-11')
  expect(within(versions).getByRole('columnheader', { name: 'Giờ/ngày' })).toBeInTheDocument()
  expect(within(versions).getByRole('columnheader', { name: 'Ngày/tháng' })).toBeInTheDocument()
  expect(within(versions).getByRole('columnheader', { name: 'KPI tháng' })).toBeInTheDocument()
  expect(versions).toHaveTextContent('1.500.000 ₫')
  expect(versions).toHaveTextContent('Bản nháp')
  expect(within(versions).getByRole('button', { name: 'Chốt phiên bản 2026-11' })).toBeInTheDocument()
  await user.click(within(versions).getByRole('button', { name: 'Sửa phiên bản 2026-11' }))
  expect(screen.queryByRole('dialog', { name: 'Các phiên bản đã lưu' })).not.toBeInTheDocument()
  expect(screen.getByLabelText(/Áp dụng từ tháng/)).toHaveValue('2026-11')
  const kpiBonus = screen.getByRole('spinbutton', { name: /Số tiền KPI khi đạt/ })
  await user.clear(kpiBonus)
  await user.type(kpiBonus, '2000000')
  await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mức lương' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(
    'PUT /api/company/dispatcher-payroll/settings',
  ))
  const saved = calls.find((call) => call.method === 'PUT' && call.path === '/api/company/dispatcher-payroll/settings')
  expect(saved?.body).toMatchObject({ effectiveFrom: '2026-11-01', kpiAmountVnd: 2_000_000 })
})
