import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

async function chooseSavedVersion(user: ReturnType<typeof userEvent.setup>, month: string) {
  await user.click(await screen.findByRole('button', { name: 'Xem phiên bản đã lưu' }))
  const dialog = await screen.findByRole('dialog', { name: 'Các phiên bản đã lưu' })
  await user.click(within(dialog).getByRole('button', { name: `Chọn phiên bản ${month}` }))
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

test('loads company pay rates, calculates a monthly payroll, and shows the driver statement after locking', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const drivers = [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, handlingAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }]
  let payrollPeriod: { period: string; status: string; drivers: typeof drivers } | null = null
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
    ]),
    [`GET /api/company/payroll/periods/${period}`]: () => payrollPeriod
      ? reply(payrollPeriod)
      : { status: 404, body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' } },
    [`POST /api/company/payroll/periods/${period}/calculate`]: () => {
      payrollPeriod = { period, status: 'DRAFT', drivers }
      return reply(payrollPeriod)
    },
    [`POST /api/company/payroll/periods/${period}/lock`]: () => {
      payrollPeriod = { period, status: 'LOCKED', drivers }
      return reply(payrollPeriod)
    },
    [`GET /api/company/payroll/periods/${period}/drivers/21`]: reply({
      calculated: true,
      period,
      status: 'LOCKED',
      driverId: 21,
      driverName: 'Nguyen Van An',
      baseSalaryVnd: 8_000_000,
      totalKg: 500,
      rateVndPerKg: 100,
      kgAmountVnd: 50_000,
      commissionPercent: 15,
      handlingFeeVndPerKg: 150,
      handlingDriverPercent: 85,
      handlingAmountVnd: 120_000,
      totalSalaryVnd: 8_170_000,
      trips: [{ tripId: 42, tripCode: 'TRIP-0042', planKg: 1_000, sharePercent: 50, allocatedKg: 500, kgAmountVnd: 50_000, handlingAmountVnd: 120_000, totalAmountVnd: 170_000 }],
    }),
    'GET /api/company/payroll/trips/42/drivers': reply([{ driverId: 21, driverName: 'Nguyen Van An', sharePercent: 50 }]),
  })

  renderPayroll()
  expect(await screen.findByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tính bảng lương' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(`POST /api/company/payroll/periods/${period}/calculate`))
  expect(screen.getByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nguyen Van An' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Chốt bảng lương' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chốt bảng lương' }))

  expect(await screen.findByRole('button', { name: 'Nguyen Van An' })).toBeInTheDocument()
  expect(screen.getAllByText('8.170.000 ₫').length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: 'Nguyen Van An' }))
  expect(await screen.findByText('TRIP-0042')).toBeInTheDocument()
  expect(await screen.findByText('Khối lượng phương án')).toBeInTheDocument()
  expect(screen.getAllByText('Tiền bốc dỡ').length).toBeGreaterThan(0)
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain('GET /api/company/payroll/trips/42/drivers'))
})

test('allows company manager to adjust driver base salary starting next month', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod(date)
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
    ]),
    [`GET /api/company/payroll/periods/${period}`]: reply({
      period,
      status: 'LOCKED',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, handlingAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }],
    }),
    [`GET /api/company/payroll/periods/${period}/drivers/21`]: reply({
      calculated: true,
      period,
      status: 'LOCKED',
      driverId: 21,
      driverName: 'Nguyen Van An',
      baseSalaryVnd: 8_000_000,
      totalKg: 500,
      rateVndPerKg: 100,
      kgAmountVnd: 50_000,
      commissionPercent: 15,
      handlingFeeVndPerKg: 150,
      handlingDriverPercent: 85,
      handlingAmountVnd: 120_000,
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
      { id: 4, effectiveFrom: `${currentMonth}-01`, baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
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
  const perKgInput = screen.getByLabelText(/Cước theo khối lượng/)
  const commissionInput = screen.getByLabelText(/Hoa hồng tài xế trên cước/)
  const handlingFeeInput = screen.getByLabelText(/Phí bốc dỡ/)
  const handlingPercentInput = screen.getByLabelText(/Tài xế hưởng phí bốc dỡ/)

  await user.type(baseSalaryInput, '8000000')
  await user.type(perKgInput, '100')
  await user.type(commissionInput, '15')
  await user.type(handlingFeeInput, '150')
  await user.type(handlingPercentInput, '85')
  await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mức lương' }))

  expect(await screen.findByText('Mức lương mới chỉ được áp dụng từ tháng sau (hoặc từ tháng này đối với công ty mới).')).toBeInTheDocument()
})

test('rate form says what is wrong: required, too many decimals, above 100', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  stubBackend({
    'GET /api/company/payroll/settings': reply([]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
  })

  renderPayroll()
  await user.type(await screen.findByLabelText(/Lương cứng mỗi tài xế/), '15000000')
  await user.type(screen.getByLabelText(/Cước theo khối lượng/), '40000')
  await user.type(screen.getByLabelText(/Hoa hồng tài xế trên cước/), '0.2222')
  await user.type(screen.getByLabelText(/Tài xế hưởng phí bốc dỡ/), '101')
  await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mức lương' }))

  expect(await screen.findAllByText('Vui lòng nhập giá trị.')).toHaveLength(1) // phí bốc dỡ để trống
  expect(screen.getByText('Phần trăm tối đa hai chữ số thập phân, ví dụ 15 hoặc 15,25.')).toBeInTheDocument()
  expect(screen.getByText('Phần trăm phải từ 0 đến 100.')).toBeInTheDocument()
})

test('clicking a saved rate version populates form for editing and allows updating it', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod(date)

  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: `${nextMonth}-01`, baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
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
      commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85,
    }),
  })

  renderPayroll()
  await chooseSavedVersion(user, nextMonth)

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
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, handlingAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }],
    }),
    [`POST /api/company/payroll/periods/${period}/lock`]: reply({
      period,
      status: 'LOCKED',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 500, kgAmountVnd: 50_000, handlingAmountVnd: 120_000, totalSalaryVnd: 8_170_000 }],
    }),
  })

  renderPayroll()
  const lockButton = await screen.findByRole('button', { name: 'Chốt bảng lương' })
  await user.click(lockButton)

  const dialog = await screen.findByRole('dialog')
  expect(dialog).toBeInTheDocument()
  expect(screen.getByText(/phiên bản đang chốt/i)).toBeInTheDocument()
  expect(calls.map(({ method, path }) => `${method} ${path}`)).not.toContain(`POST /api/company/payroll/periods/${period}/lock`)

  const confirmButton = within(dialog).getByRole('button', { name: 'Chốt bảng lương' })
  await user.click(confirmButton)

  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(`POST /api/company/payroll/periods/${period}/lock`))
})

test('deletes a draft before editing its saved rate and calculating again', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const draft = {
    period,
    status: 'DRAFT',
    drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 0, kgAmountVnd: 0, handlingAmountVnd: 0, totalSalaryVnd: 8_000_000 }],
  }
  let deleted = false
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: `${period}-01`, baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
    ]),
    [`GET /api/company/payroll/periods/${period}`]: () => deleted
      ? { status: 404, body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' } }
      : reply(draft),
    [`DELETE /api/company/payroll/periods/${period}`]: () => {
      deleted = true
      return reply(null)
    },
    'PUT /api/company/payroll/settings': ({ body }) => reply({ id: 4, ...(body as object) }),
    [`POST /api/company/payroll/periods/${period}/calculate`]: reply(draft),
  })

  renderPayroll()
  const deleteButton = await screen.findByRole('button', { name: 'Xóa bản nháp' })
  await user.click(deleteButton)
  expect(calls.map(({ method, path }) => `${method} ${path}`)).not.toContain(`DELETE /api/company/payroll/periods/${period}`)
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xóa bản nháp' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(`DELETE /api/company/payroll/periods/${period}`))
  expect(await screen.findByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()

  await chooseSavedVersion(user, period)
  const salary = screen.getByRole('spinbutton', { name: /Lương cứng mỗi tài xế/ })
  await user.clear(salary)
  await user.type(salary, '9000000')
  await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mức lương' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain('PUT /api/company/payroll/settings'))
  await user.click(screen.getByRole('button', { name: 'Tính bảng lương' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(`POST /api/company/payroll/periods/${period}/calculate`))
})

test('refreshes a later draft after its saved company rate changes', async () => {
  const user = userEvent.setup()
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod(date)
  let salary = 20_000
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': () => reply([
      { id: 4, effectiveFrom: `${currentMonth}-01`, baseSalaryVnd: salary, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
    ]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: {
      status: 404,
      body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' },
    },
    [`GET /api/company/payroll/periods/${nextMonth}`]: () => reply({
      period: nextMonth,
      status: 'DRAFT',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: salary, totalKg: 0, kgAmountVnd: 0, handlingAmountVnd: 0, totalSalaryVnd: salary }],
    }),
    'PUT /api/company/payroll/settings': ({ body }) => {
      salary = (body as { baseSalaryVnd: number }).baseSalaryVnd
      return reply({ id: 4, ...(body as object) })
    },
  })

  renderPayroll()
  await screen.findByRole('button', { name: 'Xem phiên bản đã lưu' })
  fireEvent.change(screen.getByLabelText('Kỳ lương'), { target: { value: nextMonth } })
  expect(await screen.findByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nguyen Van An' })).not.toBeInTheDocument()
  await chooseSavedVersion(user, currentMonth)
  const salaryInput = screen.getByRole('spinbutton', { name: /Lương cứng mỗi tài xế/ })
  await user.clear(salaryInput)
  await user.type(salaryInput, '30000')
  await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mức lương' }))

  await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.path === `/api/company/payroll/periods/${nextMonth}`).length).toBeGreaterThan(1))
  expect(screen.getByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nguyen Van An' })).not.toBeInTheDocument()
})

test('locks a later saved version from the versions dialog and shows that payroll table', async () => {
  const user = userEvent.setup()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const nextMonth = nextMonthPeriod()
  const nextDrivers = [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 9_000_000, totalKg: 0, kgAmountVnd: 0, handlingAmountVnd: 0, totalSalaryVnd: 9_000_000 }]
  let nextPeriod: { period: string; status: string; drivers: typeof nextDrivers } | null = null
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: `${currentMonth}-01`, baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85, periodStatus: 'LOCKED' },
      { id: 5, effectiveFrom: `${nextMonth}-01`, baseSalaryVnd: 9_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85, periodStatus: null },
    ]),
    [`GET /api/company/payroll/periods/${currentMonth}`]: reply({
      period: currentMonth,
      status: 'LOCKED',
      drivers: [{ driverId: 21, driverName: 'Nguyen Van An', baseSalaryVnd: 8_000_000, totalKg: 0, kgAmountVnd: 0, handlingAmountVnd: 0, totalSalaryVnd: 8_000_000 }],
    }),
    [`GET /api/company/payroll/periods/${nextMonth}`]: () => nextPeriod
      ? reply(nextPeriod)
      : { status: 404, body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' } },
    [`POST /api/company/payroll/periods/${nextMonth}/calculate`]: () => {
      nextPeriod = { period: nextMonth, status: 'DRAFT', drivers: nextDrivers }
      return reply(nextPeriod)
    },
    [`POST /api/company/payroll/periods/${nextMonth}/lock`]: () => {
      nextPeriod = { period: nextMonth, status: 'LOCKED', drivers: nextDrivers }
      return reply(nextPeriod)
    },
  })

  renderPayroll()
  expect(await screen.findByText(`Bảng lương tháng ${currentMonth}`)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xem phiên bản đã lưu' }))
  const versions = await screen.findByRole('dialog', { name: 'Các phiên bản đã lưu' })
  expect(versions).toHaveTextContent('Đã chốt')
  expect(versions).toHaveTextContent('Bản nháp')
  await user.click(within(versions).getByRole('button', { name: `Chốt phiên bản ${nextMonth}` }))
  await user.click(within(await screen.findByRole('dialog', { name: `Chốt phiên bản ${nextMonth}?` })).getByRole('button', { name: 'Chốt' }))

  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual(expect.arrayContaining([
    `POST /api/company/payroll/periods/${nextMonth}/calculate`,
    `POST /api/company/payroll/periods/${nextMonth}/lock`,
  ])))
  expect(await screen.findByText(`Bảng lương tháng ${nextMonth}`)).toBeInTheDocument()
})
