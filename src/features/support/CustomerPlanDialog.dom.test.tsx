import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import * as authApi from '@/features/auth/auth-api'
import * as apiClient from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { CustomerPlanDialog } from './CustomerPlanDialog'

afterEach(() => {
  vi.restoreAllMocks()
})

test('SystemSupporter can select a customer company and immediately change its plan via POST /api/contracts', async () => {
  const user = userEvent.setup()
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  const apiSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/companies/options') {
      return {
        success: true,
        data: [
          { id: 1, companyName: 'Acme Logistics Validation' },
        ],
      } as unknown as never
    }
    if (path === '/api/subscription/plans') {
      return [
        { id: 1, planCode: 'BASIC_MONTHLY', name: 'Basic', priceVnd: 1200000, tier: 'BASIC', monthlyCredits: 3000, active: true },
        { id: 2, planCode: 'PRO_MONTHLY', name: 'Pro', priceVnd: 4900000, tier: 'PRO', monthlyCredits: 15000, active: true },
        { id: 3, planCode: 'ULTIMATE_MONTHLY', name: 'Ultimate', priceVnd: 7900000, tier: 'ULTIMATE', monthlyCredits: 30000, active: true },
      ] as unknown as never
    }
    if (path === '/api/contracts' && (!init || !init.method || init.method === 'GET')) {
      return [
        {
          id: 2,
          companyId: 1,
          companyName: 'Acme Logistics Validation',
          planId: 1,
          planName: 'Basic',
          planTier: 'BASIC',
          price: 1200000,
          status: 'ACTIVE',
          expiresAt: '2026-11-19T10:00:00',
        },
      ] as unknown as never
    }
    if (path === '/api/contracts' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { companyId: number; planId: number }
      return {
        id: 2,
        companyId: body.companyId,
        companyName: 'Acme Logistics Validation',
        planId: body.planId,
        planName: 'Pro',
        planTier: 'PRO',
        price: 4900000,
        status: 'ACTIVE',
        expiresAt: '2026-11-19T20:00:00',
      } as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()

  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <CustomerPlanDialog onClose={onClose} />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )

  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText(/Acme Logistics Validation/)).toBeInTheDocument()

  const planSelect = within(dialog).getByLabelText('Gói cước áp dụng')
  await user.selectOptions(planSelect, '2')

  await user.click(within(dialog).getByRole('button', { name: 'Cập nhật gói ngay' }))

  expect(apiSpy).toHaveBeenCalledWith(
    '/api/contracts',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ companyId: 1, planId: 2, autoRenew: true }),
    }),
  )
})

test('CompanyPanel fetches real per-company credit balance and transactions, and allows SystemSupporter to update plan when ticket is open (Options M1 & C1)', async () => {
  const { CompanyPanel } = await import('./CompanyPanel')
  const user = userEvent.setup()
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  const apiSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/subscription/plans') {
      return [
        { id: 1, planCode: 'BASIC_MONTHLY', name: 'Basic', priceVnd: 1200000, tier: 'BASIC', monthlyCredits: 3000, active: true },
        { id: 2, planCode: 'PRO_MONTHLY', name: 'Pro', priceVnd: 4900000, tier: 'PRO', monthlyCredits: 15000, active: true },
        { id: 3, planCode: 'ULTIMATE_MONTHLY', name: 'Ultimate', priceVnd: 7900000, tier: 'ULTIMATE', monthlyCredits: 30000, active: true },
      ] as unknown as never
    }
    if (path === '/api/credits/balance?companyId=1') {
      return {
        success: true,
        data: { companyId: 1, balance: 2450, isUnlimited: false },
      } as unknown as never
    }
    if (path.startsWith('/api/credits/transactions?companyId=1')) {
      return {
        success: true,
        data: {
          content: [
            { id: 101, amount: 500, type: 'PURCHASE', reference: 'VNPAY_1', refunded: false, createdAt: '2026-10-19T10:00:00Z' },
          ],
        },
      } as unknown as never
    }
    if (path.startsWith('/api/contracts') && (!init || !init.method || init.method === 'GET')) {
      return [
        {
          id: 2,
          companyId: 1,
          companyName: 'Acme Logistics Validation',
          planId: 1,
          planName: 'Basic',
          planTier: 'BASIC',
          price: 1200000,
          status: 'ACTIVE',
          expiresAt: '2026-11-19T10:00:00',
        },
      ] as unknown as never
    }
    if (path === '/api/contracts' && init?.method === 'POST') {
      return {
        id: 2,
        companyId: 1,
        companyName: 'Acme Logistics Validation',
        planId: 3,
        planName: 'Ultimate',
        planTier: 'ULTIMATE',
        price: 7900000,
        status: 'ACTIVE',
        expiresAt: '2026-11-19T20:00:00',
      } as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <CompanyPanel companyId="1" ticketClosed={false} />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )

  const panel = await screen.findByRole('region', { name: 'Thông tin công ty' })
  expect(await within(panel).findByText('Acme Logistics Validation')).toBeInTheDocument()
  expect(await within(panel).findByText('2.450')).toBeInTheDocument()
  expect(await within(panel).findByText('+500')).toBeInTheDocument()
  expect(await within(panel).findByRole('option', { name: /Ultimate/ })).toBeInTheDocument()

  const select = within(panel).getByLabelText('Đổi gói nhanh')
  await user.selectOptions(select, '3')
  await user.click(within(panel).getByRole('button', { name: 'Cập nhật gói ngay' }))

  expect(apiSpy).toHaveBeenCalledWith(
    '/api/contracts',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ companyId: 1, planId: 3, autoRenew: true }),
    }),
  )
})

test('CompanyPanel disables inline plan update when the support ticket is CLOSED (Option M1)', async () => {
  const { CompanyPanel } = await import('./CompanyPanel')
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string) => {
    if (path === '/api/subscription/plans') {
      return [
        { id: 1, planCode: 'BASIC_MONTHLY', name: 'Basic', priceVnd: 1200000, tier: 'BASIC', monthlyCredits: 3000, active: true },
      ] as unknown as never
    }
    if (path === '/api/credits/balance?companyId=1') {
      return {
        success: true,
        data: { companyId: 1, balance: 1200, isUnlimited: false },
      } as unknown as never
    }
    if (path.startsWith('/api/credits/transactions?companyId=1')) {
      return {
        success: true,
        data: { content: [] },
      } as unknown as never
    }
    if (path.startsWith('/api/contracts')) {
      return [
        {
          id: 2,
          companyId: 1,
          companyName: 'Acme Logistics Validation',
          planId: 1,
          planName: 'Basic',
          planTier: 'BASIC',
          price: 1200000,
          status: 'ACTIVE',
          expiresAt: '2026-11-19T10:00:00',
        },
      ] as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <CompanyPanel companyId="1" ticketClosed />
      </I18nProvider>
    </QueryClientProvider>,
  )

  const panel = await screen.findByRole('region', { name: 'Thông tin công ty' })
  expect(await within(panel).findByText('Acme Logistics Validation')).toBeInTheDocument()
  expect(within(panel).getByText(/Yêu cầu hỗ trợ đã đóng/)).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Cập nhật gói ngay' })).toBeDisabled()
})

test('CompanyPanel disables lower or equal tier plans when customer subscription is ACTIVE on Pro', async () => {
  const { CompanyPanel } = await import('./CompanyPanel')
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string) => {
    if (path === '/api/subscription/plans') {
      return [
        { id: 1, planCode: 'BASIC_MONTHLY', name: 'Basic', priceVnd: 1200000, tier: 'BASIC', monthlyCredits: 3000, active: true },
        { id: 2, planCode: 'PRO_MONTHLY', name: 'Pro', priceVnd: 4900000, tier: 'PRO', monthlyCredits: 10000, active: true },
        { id: 3, planCode: 'ULTIMATE_MONTHLY', name: 'Ultimate', priceVnd: 7900000, tier: 'ULTIMATE', monthlyCredits: 30000, active: true },
      ] as unknown as never
    }
    if (path === '/api/credits/balance?companyId=1') {
      return {
        success: true,
        data: { companyId: 1, balance: 10000, isUnlimited: false },
      } as unknown as never
    }
    if (path.startsWith('/api/credits/transactions?companyId=1')) {
      return {
        success: true,
        data: { content: [] },
      } as unknown as never
    }
    if (path.startsWith('/api/contracts')) {
      return [
        {
          id: 2,
          companyId: 1,
          companyName: 'Acme Logistics Validation',
          planId: 2,
          planName: 'Pro',
          planTier: 'PRO',
          price: 4900000,
          status: 'ACTIVE',
          expiresAt: '2026-11-19T10:00:00',
        },
      ] as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <CompanyPanel companyId="1" ticketClosed={false} />
      </I18nProvider>
    </QueryClientProvider>,
  )

  const panel = await screen.findByRole('region', { name: 'Thông tin công ty' })
  const basicOption = await within(panel).findByRole('option', { name: /Basic/ })
  const proOption = await within(panel).findByRole('option', { name: /Pro/ })
  const ultimateOption = await within(panel).findByRole('option', { name: /Ultimate/ })

  expect(basicOption).toBeDisabled()
  expect(proOption).toBeDisabled()
  expect(ultimateOption).not.toBeDisabled()
})




