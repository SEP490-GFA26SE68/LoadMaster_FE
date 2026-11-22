import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'

import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'

import { DispatcherPayslipPage } from './DispatcherPayslipPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['payroll']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'payroll',
}))

afterEach(() => vi.unstubAllGlobals())

function reply(data: unknown) {
  return { body: envelope(data) }
}

function renderPayslip() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/phieu-luong']}>
          <DispatcherPayslipPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('dispatcher sees a locked payslip with the three pay parts', async () => {
  const date = new Date()
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  stubBackend({
    'GET /api/dispatcher/payroll': reply({
      calculated: true,
      period,
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

  renderPayslip()
  expect(await screen.findByText('Chi tiết lương · Nguyễn Thanh Tùng')).toBeInTheDocument()
  expect(screen.getByText('Đã chốt')).toBeInTheDocument()
  expect(screen.getAllByText('11.300.000 ₫').length).toBeGreaterThan(0)
  expect(screen.getByText(/Tăng ca =/)).toBeInTheDocument()
})

test('dispatcher sees an empty state when the month has not been calculated', async () => {
  stubBackend({
    'GET /api/dispatcher/payroll': reply({
      calculated: false,
      period: '2026-11',
      status: null,
      dispatcherId: 31,
      dispatcherName: 'Nguyễn Thanh Tùng',
    }),
  })

  renderPayslip()
  expect(await screen.findByText('Chưa có bảng lương cho tháng này')).toBeInTheDocument()
})
