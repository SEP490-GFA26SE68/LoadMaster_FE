import { afterEach, expect, test, vi } from 'vitest'

import { envelope, stubBackend } from '@/test/fake-backend'

import {
  calculateDispatcherPayrollPeriod,
  createDispatcherPayrollRate,
  fetchDispatcherPayrollPeriod,
  fetchDispatcherPayrollRates,
  fetchDispatcherPayrollStatement,
  fetchOwnDispatcherPayroll,
  lockDispatcherPayrollPeriod,
  updateDispatcherPayrollLine,
} from './dispatcher-payroll-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['payroll']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'payroll',
}))

const period = {
  period: '2026-11',
  status: 'DRAFT',
  dispatchers: [
    {
      dispatcherId: 31,
      dispatcherName: 'Nguyễn Thanh Tùng',
      baseSalaryVnd: 10_000_000,
      overtimeDays: 3,
      overtimeAmountVnd: 300_000,
      kpiAmountVnd: 1_000_000,
      totalSalaryVnd: 11_300_000,
    },
  ],
}

const reply = (data: unknown) => ({ body: envelope(data) })

afterEach(() => vi.unstubAllGlobals())

test('reads dispatcher payroll settings and a monthly period from the server API', async () => {
  stubBackend({
    'GET /api/company/dispatcher-payroll/settings': reply([
      { id: 4, effectiveFrom: '2026-11-01', baseSalaryVnd: 10_000_000, overtimeVndPerHour: 50_000, overtimeHoursPerDay: 2 },
    ]),
    'GET /api/company/dispatcher-payroll/periods/2026-11': reply(period),
    'GET /api/company/dispatcher-payroll/periods/2026-11/dispatchers/31': reply({
      calculated: true,
      period: '2026-11',
      status: 'DRAFT',
      dispatcherId: 31,
      dispatcherName: 'Nguyễn Thanh Tùng',
      baseSalaryVnd: 10_000_000,
      overtimeVndPerHour: 50_000,
      overtimeHoursPerDay: 2,
      overtimeDays: 3,
      overtimeAmountVnd: 300_000,
      kpiAmountVnd: 1_000_000,
      totalSalaryVnd: 11_300_000,
    }),
  })

  await expect(fetchDispatcherPayrollRates()).resolves.toHaveLength(1)
  await expect(fetchDispatcherPayrollPeriod('2026-11')).resolves.toStrictEqual(period)
  await expect(fetchDispatcherPayrollStatement('2026-11', '31')).resolves.toMatchObject({ calculated: true, totalSalaryVnd: 11_300_000 })
})

test('creates a dispatcher rate, calculates, updates overtime and KPI, and locks', async () => {
  const { calls } = stubBackend({
    'PUT /api/company/dispatcher-payroll/settings': reply({
      id: 5, effectiveFrom: '2026-12-01', baseSalaryVnd: 11_000_000, overtimeVndPerHour: 55_000, overtimeHoursPerDay: 2.5,
    }),
    'POST /api/company/dispatcher-payroll/periods/2026-11/calculate': reply(period),
    'PUT /api/company/dispatcher-payroll/periods/2026-11/dispatchers/31': reply({
      ...period,
      dispatchers: [{ ...period.dispatchers[0], overtimeDays: 4, overtimeAmountVnd: 400_000, totalSalaryVnd: 11_400_000 }],
    }),
    'POST /api/company/dispatcher-payroll/periods/2026-11/lock': reply({ ...period, status: 'LOCKED' }),
  })

  await createDispatcherPayrollRate({
    effectiveFrom: '2026-12-01',
    baseSalaryVnd: 11_000_000,
    overtimeVndPerHour: 55_000,
    overtimeHoursPerDay: 2.5,
  })
  await calculateDispatcherPayrollPeriod('2026-11')
  await updateDispatcherPayrollLine('2026-11', 31, { overtimeDays: 4, kpiAmountVnd: 1_000_000 })
  await lockDispatcherPayrollPeriod('2026-11')

  expect(calls.map(({ method, path }) => `${method} ${path}`)).toStrictEqual([
    'PUT /api/company/dispatcher-payroll/settings',
    'POST /api/company/dispatcher-payroll/periods/2026-11/calculate',
    'PUT /api/company/dispatcher-payroll/periods/2026-11/dispatchers/31',
    'POST /api/company/dispatcher-payroll/periods/2026-11/lock',
  ])
})

test('dispatcher reads their own payslip', async () => {
  stubBackend({
    'GET /api/dispatcher/payroll': reply({
      calculated: true,
      period: '2026-11',
      status: 'LOCKED',
      dispatcherId: 31,
      dispatcherName: 'Nguyễn Thanh Tùng',
      baseSalaryVnd: 10_000_000,
      overtimeVndPerHour: 50_000,
      overtimeHoursPerDay: 2,
      overtimeDays: 3,
      overtimeAmountVnd: 300_000,
      kpiAmountVnd: 1_000_000,
      totalSalaryVnd: 11_300_000,
    }),
  })

  await expect(fetchOwnDispatcherPayroll('2026-11')).resolves.toMatchObject({ calculated: true, status: 'LOCKED' })
})
