import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'

import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'

import { nextMonthPeriod } from './payroll-api'
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

test('allows company manager to adjust driver base salary starting next month', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod(date)
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, rateVndPerKm: 2_000 },
    ]),
    [`GET /api/company/payroll/periods/${period}`]: reply({
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
      trips: [],
    }),
    'PUT /api/company/payroll/drivers/21/base-salary': reply({
      id: 1,
      driverId: 21,
      driverName: 'Nguyen Van An',
      effectiveFrom: `${nextMonth}-01`,
      baseSalaryVnd: 9_500_000,
    }),
  })

  renderPayroll()
  expect(await screen.findByRole('button', { name: 'Nguyen Van An' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Nguyen Van An' }))

  expect(await screen.findByRole('region', { name: 'Điều chỉnh lương cứng' })).toBeInTheDocument()
  const input = screen.getByLabelText(/Mức lương mới/)
  await user.type(input, '9500000')
  await user.click(screen.getByRole('button', { name: 'Lưu mức lương mới' }))

  expect(await screen.findByText('Đã lưu mức lương cứng cho tài xế từ tháng sau.')).toBeInTheDocument()
  expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain('PUT /api/company/payroll/drivers/21/base-salary')
})

test('effectiveFrom input sets min month to current month when company has no rates, and next month when rates exist', async () => {
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod(date)

  stubBackend({
    'GET /api/company/payroll/settings': reply([]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
  })

  const { unmount } = renderPayroll()
  const inputNew = await screen.findByLabelText(/Áp dụng từ tháng/)
  expect(inputNew).toHaveAttribute('min', currentMonth)
  expect(inputNew).toHaveValue(currentMonth)

  unmount()

  stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: `${currentMonth}-01`, baseSalaryVnd: 8_000_000, rateVndPerKg: 100, rateVndPerKm: 2_000 },
    ]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
  })

  renderPayroll()
  const inputExisting = await screen.findByLabelText(/Áp dụng từ tháng/)
  await waitFor(() => expect(inputExisting).toHaveAttribute('min', nextMonth))
  expect(inputExisting).toHaveValue(nextMonth)
})

test('displays translated error message when createPayrollRate fails because effective date is too early', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  stubBackend({
    'GET /api/company/payroll/settings': reply([]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
    'PUT /api/company/payroll/settings': {
      status: 400,
      body: { success: false, code: 'PAYROLL_RATE_EFFECTIVE_DATE_TOO_EARLY', message: 'Too early' },
    },
  })

  renderPayroll()
  const baseSalaryInput = await screen.findByLabelText(/Lương cứng mỗi tài xế/)
  const perKgInput = screen.getByLabelText(/Đơn giá theo khối lượng/)
  const perKmInput = screen.getByLabelText(/Đơn giá theo quãng đường/)

  await user.type(baseSalaryInput, '8000000')
  await user.type(perKgInput, '100')
  await user.type(perKmInput, '2000')
  await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mức lương' }))

  expect(await screen.findByText('Mức lương mới chỉ được áp dụng từ tháng sau (hoặc từ tháng này đối với công ty mới).')).toBeInTheDocument()
})

test('clicking a saved rate version populates form for editing and allows updating it', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod(date)

  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: `${nextMonth}-01`, baseSalaryVnd: 8_000_000, rateVndPerKg: 100, rateVndPerKm: 2_000 },
    ]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
    'PUT /api/company/payroll/settings': reply({
      id: 4,
      effectiveFrom: `${nextMonth}-01`,
      baseSalaryVnd: 9_000_000,
      rateVndPerKg: 100,
      rateVndPerKm: 2_000,
    }),
  })

  renderPayroll()
  const versionButton = await screen.findByRole('button', { name: new RegExp(nextMonth) })
  await user.click(versionButton)

  const baseSalaryInput = screen.getByLabelText(/Lương cứng mỗi tài xế/)
  expect(baseSalaryInput).toHaveValue(8_000_000)

  await user.clear(baseSalaryInput)
  await user.type(baseSalaryInput, '9000000')
  const saveButton = screen.getByRole('button', { name: 'Lưu phiên bản mức lương' })
  await waitFor(() => expect(saveButton).not.toBeDisabled())
  await user.click(saveButton)

  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain('PUT /api/company/payroll/settings'))
})

test('clicking lock period opens confirmation dialog warning that the month cannot be changed', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([]),
    [`GET /api/company/payroll/periods/${period}`]: reply({
      period,
      status: 'DRAFT',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, totalKm: 60, kmAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }],
    }),
    [`POST /api/company/payroll/periods/${period}/lock`]: reply({
      period,
      status: 'LOCKED',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, totalKm: 60, kmAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }],
    }),
  })

  renderPayroll()
  const lockButton = await screen.findByRole('button', { name: 'Chốt bảng lương' })
  await user.click(lockButton)

  const dialog = await screen.findByRole('dialog')
  expect(dialog).toBeInTheDocument()
  expect(screen.getByText(/khi bạn chốt thì tháng này không thể thay đổi/i)).toBeInTheDocument()
  expect(calls.map(({ method, path }) => `${method} ${path}`)).not.toContain(`POST /api/company/payroll/periods/${period}/lock`)

  const confirmButton = within(dialog).getByRole('button', { name: 'Chốt bảng lương' })
  await user.click(confirmButton)

  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(`POST /api/company/payroll/periods/${period}/lock`))
})

