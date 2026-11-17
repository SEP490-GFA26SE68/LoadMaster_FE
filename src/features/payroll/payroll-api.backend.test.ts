import { afterEach, expect, test, vi } from 'vitest'

import { envelope, stubBackend } from '@/test/fake-backend'

import {
  calculatePayrollPeriod,
  createPayrollRate,
  fetchPayrollDriverStatement,
  fetchPayrollPeriod,
  fetchPayrollRates,
  fetchTripPayrollDrivers,
  lockPayrollPeriod,
  setDriverBaseSalary,
  setTripPayrollDrivers,
} from './payroll-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['payroll']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'payroll',
}))

const payroll = {
  period: '2026-11',
  status: 'DRAFT',
  drivers: [
    {
      driverId: 21,
      driverName: 'Nguyễn Văn An',
      baseSalaryVnd: 8_000_000,
      totalKg: 500,
      kgAmountVnd: 50_000,
      handlingAmountVnd: 120_000,
      totalSalaryVnd: 8_170_000,
    },
  ],
}

const reply = (data: unknown) => ({ body: envelope(data) })

afterEach(() => vi.unstubAllGlobals())

test('reads company payroll settings and a monthly payroll with the server API', async () => {
  const { calls } = stubBackend({
    'GET /api/company/payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 },
    ]),
    'GET /api/company/payroll/periods/2026-11': reply(payroll),
    'GET /api/company/payroll/periods/2026-11/drivers/21': reply({
      calculated: true,
      period: '2026-11',
      status: 'DRAFT',
      driverId: 21,
      driverName: 'Nguyễn Văn An',
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
  })

  await expect(fetchPayrollRates()).resolves.toMatchObject([{ effectiveFrom: '2026-11-01', rateVndPerKg: 100 }])
  await expect(fetchPayrollPeriod('2026-11')).resolves.toMatchObject(payroll)
  await expect(fetchPayrollDriverStatement('2026-11', '21')).resolves.toMatchObject({ driverName: 'Nguyễn Văn An' })
  expect(calls.map(({ method, path }) => `${method} ${path}`)).toStrictEqual([
    'GET /api/company/payroll/settings',
    'GET /api/company/payroll/periods/2026-11',
    'GET /api/company/payroll/periods/2026-11/drivers/21',
  ])
})

test('creates an immutable company rate version, calculates the month, then locks it', async () => {
  const { calls } = stubBackend({
    'PUT /api/company/payroll/settings': ({ body }) => reply({ id: 5, ...(body as object) }),
    'POST /api/company/payroll/periods/2026-11/calculate': reply(payroll),
    'POST /api/company/payroll/periods/2026-11/lock': reply({ ...payroll, status: 'LOCKED' }),
  })

  await createPayrollRate({ effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 })
  await calculatePayrollPeriod('2026-11')
  await lockPayrollPeriod('2026-11')

  expect(calls.map(({ method, path }) => `${method} ${path}`)).toStrictEqual([
    'PUT /api/company/payroll/settings',
    'POST /api/company/payroll/periods/2026-11/calculate',
    'POST /api/company/payroll/periods/2026-11/lock',
  ])
  expect(calls[0]?.body).toStrictEqual({ effectiveFrom: '2026-11-01', baseSalaryVnd: 8_000_000, rateVndPerKg: 100, commissionPercent: 15, handlingFeeVndPerKg: 150, handlingDriverPercent: 85 })
})

test('loads and saves equal productivity shares for the drivers on one trip', async () => {
  const shareRows = [{ driverId: 21, driverName: 'Nguyễn Văn An', sharePercent: 50 }, { driverId: 22, driverName: 'Trần Văn Bình', sharePercent: 50 }]
  const { calls } = stubBackend({
    'GET /api/company/payroll/trips/42/drivers': reply(shareRows),
    'PUT /api/company/payroll/trips/42/drivers': reply(shareRows),
  })

  await expect(fetchTripPayrollDrivers(42)).resolves.toMatchObject(shareRows)
  await expect(setTripPayrollDrivers(42, [21, 22])).resolves.toMatchObject(shareRows)
  expect(calls[1]?.body).toStrictEqual({ driverIds: [21, 22] })
})

test('saves driver base salary override for next month', async () => {
  const { calls } = stubBackend({
    'PUT /api/company/payroll/drivers/21/base-salary': reply({
      id: 1,
      driverId: 21,
      driverName: 'Nguyễn Văn An',
      effectiveFrom: '2026-12-01',
      baseSalaryVnd: 9_000_000,
    }),
  })

  const result = await setDriverBaseSalary({ driverId: 21, effectiveFrom: '2026-12-01', baseSalaryVnd: 9_000_000 })
  expect(result).toMatchObject({ driverId: 21, baseSalaryVnd: 9_000_000, effectiveFrom: '2026-12-01' })
  expect(calls[0]?.path).toBe('/api/company/payroll/drivers/21/base-salary')
  expect(calls[0]?.body).toStrictEqual({ effectiveFrom: '2026-12-01', baseSalaryVnd: 9_000_000 })
})
