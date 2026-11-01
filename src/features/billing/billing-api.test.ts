import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as authApi from '@/features/auth/auth-api'
import * as apiClient from '@/lib/api-client'
import {
  getCreditBalance,
  getCurrentSubscription,
  listCreditTransactions,
  listPayments,
  listPlansOnSale,
  subscribe,
  topUpCredits,
} from './billing-api'
import { fetchCheckout, settlePayment } from './payment-api'

afterEach(() => {
  vi.restoreAllMocks()
})

test('when authenticated with Keycloak, billing-api and payment-api call Backend endpoints', async () => {
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string) => {
    if (path === '/api/subscription/plans') {
      return [
        {
          id: 1,
          planCode: 'BASIC_MONTHLY',
          name: 'Basic',
          priceVnd: 1_200_000,
          tier: 'BASIC',
          monthlyCredits: 3000,
          algorithmTier: 'EP_DBLF',
          features: 'OPTIMIZATION_3D,ROUTE_OPTIMIZATION',
          billingCycle: 'MONTHLY',
          active: true,
          activeCompanyCount: 0,
        },
        {
          id: 2,
          planCode: 'PRO_MONTHLY',
          name: 'Pro',
          priceVnd: 4_900_000,
          tier: 'PRO',
          monthlyCredits: 15000,
          algorithmTier: 'EP_DBLF_GA',
          features: 'OPTIMIZATION_3D,ROUTE_OPTIMIZATION,ADVANCED_ALGORITHM',
          billingCycle: 'MONTHLY',
          active: true,
          activeCompanyCount: 1,
        },
      ] as unknown as never
    }
    if (path === '/api/subscription/current') {
      return {
        success: true,
        data: {
          subscriptionId: 10,
          planId: 2,
          planName: 'Pro',
          tier: 'PRO',
          status: 'ACTIVE',
          startedAt: '2026-10-19T10:00:00',
          expiresAt: '2026-11-19T10:00:00',
          autoRenew: false,
          creditsBalance: 15000,
          creditsMonthlyGrant: 15000,
          algorithmTier: 'EP_DBLF_GA',
        },
      } as unknown as never
    }
    if (path === '/api/credits/balance') {
      return {
        success: true,
        data: { companyId: 1, balance: 15000, isUnlimited: false },
      } as unknown as never
    }
    if (path.startsWith('/api/credits/transactions')) {
      return {
        success: true,
        data: {
          content: [
            {
              id: 101,
              amount: 15000,
              type: 'MONTHLY_GRANT',
              reference: 'MONTHLY_RENEWAL',
              refunded: false,
              createdAt: '2026-10-19T10:00:00',
            },
          ],
        },
      } as unknown as never
    }
    if (path === '/api/subscription/subscribe') {
      return {
        success: true,
        data: {
          id: 501,
          transactionId: 'VNPAY_SUB123456',
          paymentUrl: '/api/payment/mock-checkout?txnRef=VNPAY_SUB123456',
          status: 'PENDING',
        },
      } as unknown as never
    }
    if (path === '/api/credits/topup') {
      return {
        success: true,
        data: {
          id: 502,
          transactionId: 'VNPAY_TOP123456',
          paymentUrl: '/api/payment/mock-checkout?txnRef=VNPAY_TOP123456',
          status: 'PENDING',
        },
      } as unknown as never
    }
    if (path.startsWith('/api/payment/mock-checkout')) {
      return {
        success: true,
        txnRef: 'VNPAY_TOP123456',
      } as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  const plans = await listPlansOnSale()
  expect(plans).toHaveLength(2)
  expect(plans[0]).toMatchObject({ id: '1', name: 'Basic', priceVnd: 1_200_000, monthlyCredits: 3000 })

  const current = await getCurrentSubscription()
  expect(current?.plan.name).toBe('Pro')
  expect(current?.subscription.status).toBe('ACTIVE')

  const balance = await getCreditBalance()
  expect(balance).toEqual({ balance: 15000, unlimited: false })

  const txs = await listCreditTransactions()
  expect(txs).toHaveLength(1)
  expect(txs[0]).toMatchObject({ type: 'MONTHLY_GRANT', amount: 15000 })

  const subPayment = await subscribe('2')
  expect(subPayment.id).toBe('VNPAY_SUB123456')
  expect(subPayment.purpose).toBe('SUBSCRIBE')
  expect(subPayment.amountVnd).toBe(4_900_000)

  const topupPayment = await topUpCredits(50)
  expect(topupPayment.id).toBe('VNPAY_TOP123456')
  expect(topupPayment.purpose).toBe('TOPUP')

  const checkout = await fetchCheckout('VNPAY_TOP123456')
  expect(checkout.payment.id).toBe('VNPAY_TOP123456')

  const settled = await settlePayment('VNPAY_TOP123456', 'SUCCESS')
  expect(settled.status).toBe('SUCCESS')

  const allPayments = await listPayments()
  expect(allPayments.some((p) => p.id === 'VNPAY_TOP123456' && p.status === 'SUCCESS')).toBe(true)
  expect(apiFetchSpy).toHaveBeenCalled()
})
