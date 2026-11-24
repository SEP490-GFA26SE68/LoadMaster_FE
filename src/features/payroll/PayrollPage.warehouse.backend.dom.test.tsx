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

const reply = (data: unknown) => ({ body: envelope(data) })
const notFound = { status: 404, body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' } }

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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

test('manager calculates warehouse payroll, locks it, then reads a worker statement with the trips loaded', async () => {
  const user = userEvent.setup()
  const period = currentMonth()
  const worker = {
    workerId: 15,
    workerName: 'Lê Văn Hải',
    baseSalaryVnd: 7_000_000,
    loadedPackages: 120,
    loadedKg: 1840.5,
    loadedAmountVnd: 184_050,
    kpiAchieved: true,
    kpiBonusVnd: 500_000,
    totalSalaryVnd: 7_684_050,
  }
  let payrollPeriod: { period: string; status: string; workers: (typeof worker)[] } | null = null
  const rate = {
    id: 3,
    effectiveFrom: `${period}-01`,
    baseSalaryVnd: 7_000_000,
    rateVndPerKg: 100,
    kpiTargetKg: 1500,
    kpiBonusVnd: 500_000,
    periodStatus: null as string | null,
  }
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([]),
    [`GET /api/company/payroll/periods/${period}`]: notFound,
    'GET /api/company/warehouse-payroll/settings': () => reply([{ ...rate, periodStatus: payrollPeriod?.status ?? null }]),
    [`GET /api/company/warehouse-payroll/periods/${period}`]: () => (payrollPeriod ? reply(payrollPeriod) : notFound),
    [`POST /api/company/warehouse-payroll/periods/${period}/calculate`]: () => {
      payrollPeriod = { period, status: 'DRAFT', workers: [worker] }
      return reply(payrollPeriod)
    },
    [`POST /api/company/warehouse-payroll/periods/${period}/lock`]: () => {
      payrollPeriod = { period, status: 'LOCKED', workers: [worker] }
      return reply(payrollPeriod)
    },
    [`GET /api/company/warehouse-payroll/periods/${period}/workers/15`]: () => reply({
      calculated: true,
      period,
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
      trips: [{ tripId: 42, tripCode: 'TRIP-2026-1105', loadedDate: `${period}-05`, loadedPackages: 80, loadedKg: 1200 }],
    }),
  })

  renderPayroll()
  await user.click(await screen.findByRole('tab', { name: 'Kho' }))
  expect(await screen.findByText('Mức lương nhân viên kho')).toBeInTheDocument()
  expect(await screen.findByText('Vui lòng vào chọn phiên bản chốt bảng lương')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Tính bảng lương' }))
  await waitFor(() => expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain(
    `POST /api/company/warehouse-payroll/periods/${period}/calculate`,
  ))
  // Bản nháp chưa hiện bảng: bảng lương chỉ hiện phiên bản đã chốt, như hai tab kia
  expect(screen.queryByRole('button', { name: 'Lê Văn Hải' })).not.toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: 'Chốt bảng lương' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chốt bảng lương' }))

  const row = (await screen.findByRole('button', { name: 'Lê Văn Hải' })).closest('tr')
  expect(row).not.toBeNull()
  expect(row).toHaveTextContent('120')
  expect(row).toHaveTextContent('7.684.050 ₫')
  expect(screen.getByRole('columnheader', { name: 'Thưởng KPI' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Lê Văn Hải' }))
  const details = await screen.findByRole('dialog', { name: /Chi tiết lương · Lê Văn Hải/ })
  expect(await within(details).findByText('TRIP-2026-1105')).toBeInTheDocument()
  expect(details).toHaveTextContent('Tiền theo kg =')
  expect(within(details).getByRole('heading', { name: 'Điều chỉnh lương cứng' })).toBeInTheDocument()
})
