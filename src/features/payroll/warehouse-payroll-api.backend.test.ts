import { afterEach, expect, test, vi } from 'vitest'

import { envelope, stubBackend } from '@/test/fake-backend'

import {
  calculateWarehousePayrollPeriod,
  createWarehousePayrollRate,
  fetchOwnWarehousePayroll,
  fetchWarehousePayrollPeriod,
  fetchWarehousePayrollRates,
  fetchWarehousePayrollStatement,
  lockWarehousePayrollPeriod,
  setWarehouseWorkerBaseSalary,
} from './warehouse-payroll-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['payroll']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'payroll',
}))

const reply = (data: unknown) => ({ body: envelope(data) })

const periodDto = {
  period: '2026-11',
  status: 'DRAFT',
  workers: [
    {
      workerId: 15,
      workerName: 'Lê Văn Hải',
      baseSalaryVnd: 7_000_000,
      loadedPackages: 120,
      loadedKg: '1840.50',
      loadedAmountVnd: '184050.00',
      kpiAchieved: true,
      kpiBonusVnd: '500000.00',
      totalSalaryVnd: '7684050.00',
    },
  ],
}

afterEach(() => vi.unstubAllGlobals())

test('reads rate versions with numbers from BigDecimal strings and ids as strings', async () => {
  stubBackend({
    'GET /api/company/warehouse-payroll/settings': reply([
      { id: 3, effectiveFrom: '2026-11-01', baseSalaryVnd: '7000000.00', rateVndPerKg: '100.00', kpiTargetKg: '1500.00', kpiBonusVnd: '500000.00', periodStatus: 'LOCKED' },
      { id: 4, effectiveFrom: '2026-12-01', baseSalaryVnd: 7_500_000, rateVndPerKg: 120, kpiTargetKg: null, kpiBonusVnd: 0, periodStatus: null },
    ]),
  })

  await expect(fetchWarehousePayrollRates()).resolves.toStrictEqual([
    { id: '3', effectiveFrom: '2026-11-01', baseSalaryVnd: 7_000_000, rateVndPerKg: 100, kpiTargetKg: 1500, kpiBonusVnd: 500_000, periodStatus: 'LOCKED' },
    { id: '4', effectiveFrom: '2026-12-01', baseSalaryVnd: 7_500_000, rateVndPerKg: 120, kpiTargetKg: null, kpiBonusVnd: 0, periodStatus: null },
  ])
})

test('saving a rate without a KPI target sends null for both KPI fields', async () => {
  const { calls } = stubBackend({
    'PUT /api/company/warehouse-payroll/settings': reply({
      id: 5, effectiveFrom: '2026-12-01', baseSalaryVnd: 7_000_000, rateVndPerKg: 100, kpiTargetKg: null, kpiBonusVnd: 0, periodStatus: null,
    }),
  })

  await createWarehousePayrollRate({ effectiveFrom: '2026-12-01', baseSalaryVnd: 7_000_000, rateVndPerKg: 100, kpiTargetKg: null, kpiBonusVnd: 300_000 })
  expect(calls[0]?.body).toStrictEqual({ effectiveFrom: '2026-12-01', baseSalaryVnd: 7_000_000, rateVndPerKg: 100, kpiTargetKg: null, kpiBonusVnd: null })
})

test('a month without payroll is null; calculate and lock map the worker rows', async () => {
  stubBackend({
    'GET /api/company/warehouse-payroll/periods/2026-10': { status: 404, body: { success: false, code: 'PAYROLL_PERIOD_NOT_FOUND', message: 'not found' } },
    'POST /api/company/warehouse-payroll/periods/2026-11/calculate': reply(periodDto),
    'POST /api/company/warehouse-payroll/periods/2026-11/lock': reply({ ...periodDto, status: 'LOCKED' }),
  })

  await expect(fetchWarehousePayrollPeriod('2026-10')).resolves.toBeNull()
  const worker = {
    workerId: '15',
    workerName: 'Lê Văn Hải',
    baseSalaryVnd: 7_000_000,
    loadedPackages: 120,
    loadedKg: 1840.5,
    loadedAmountVnd: 184_050,
    kpiAchieved: true,
    kpiBonusVnd: 500_000,
    totalSalaryVnd: 7_684_050,
  }
  await expect(calculateWarehousePayrollPeriod('2026-11')).resolves.toStrictEqual({ period: '2026-11', status: 'DRAFT', workers: [worker] })
  await expect(lockWarehousePayrollPeriod('2026-11')).resolves.toMatchObject({ status: 'LOCKED', workers: [worker] })
})

test('other errors of the period read are not swallowed', async () => {
  stubBackend({
    'GET /api/company/warehouse-payroll/periods/2026-11': { status: 409, body: { success: false, code: 'PAYROLL_RATE_NOT_CONFIGURED', message: 'no rate' } },
  })
  await expect(fetchWarehousePayrollPeriod('2026-11')).rejects.toMatchObject({ code: 'PAYROLL_RATE_NOT_CONFIGURED' })
})

test('the base-salary override goes to the worker id with the effective month', async () => {
  const { calls } = stubBackend({ 'PUT /api/company/warehouse-payroll/workers/15/base-salary': reply(null) })
  await setWarehouseWorkerBaseSalary({ workerId: '15', effectiveFrom: '2026-12-01', baseSalaryVnd: 8_000_000 })
  expect(calls[0]?.body).toStrictEqual({ effectiveFrom: '2026-12-01', baseSalaryVnd: 8_000_000 })
})

test('a locked statement carries the figures and the trips loaded', async () => {
  stubBackend({
    'GET /api/company/warehouse-payroll/periods/2026-11/workers/15': reply({
      calculated: true,
      period: '2026-11',
      status: 'LOCKED',
      workerId: 15,
      workerName: 'Lê Văn Hải',
      baseSalaryVnd: '7000000.00',
      loadedPackages: 120,
      loadedKg: '1840.50',
      rateVndPerKg: '100.00',
      loadedAmountVnd: '184050.00',
      kpiTargetKg: '1500.00',
      kpiAchieved: true,
      kpiBonusVnd: '500000.00',
      totalSalaryVnd: '7684050.00',
      trips: [{ tripId: 42, tripCode: 'TRIP-2026-1105', loadedDate: '2026-11-05', loadedPackages: 80, loadedKg: '1200.00' }],
    }),
  })

  const statement = await fetchWarehousePayrollStatement('2026-11', '15')
  expect(statement).toMatchObject({
    calculated: true,
    status: 'LOCKED',
    workerId: '15',
    baseSalaryVnd: 7_000_000,
    loadedKg: 1840.5,
    rateVndPerKg: 100,
    kpiTargetKg: 1500,
    totalSalaryVnd: 7_684_050,
  })
  expect(statement.calculated && statement.trips).toStrictEqual([
    { tripId: '42', tripCode: 'TRIP-2026-1105', loadedAt: expect.stringMatching(/^2026-11-05T/), loadedPackages: 80, loadedKg: 1200 },
  ])
})

test('the own payslip of a month that is not locked only has the base salary', async () => {
  const { calls } = stubBackend({
    'GET /api/warehouse/payroll': reply({ calculated: false, period: '2026-11', status: 'DRAFT', workerId: 15, workerName: 'Lê Văn Hải', baseSalaryVnd: 7_000_000, trips: [] }),
  })

  await expect(fetchOwnWarehousePayroll('2026-11')).resolves.toStrictEqual({
    calculated: false,
    period: '2026-11',
    status: 'DRAFT',
    workerId: '15',
    workerName: 'Lê Văn Hải',
    baseSalaryVnd: 7_000_000,
  })
  expect(calls[0]?.query).toStrictEqual({ period: '2026-11' })
})
