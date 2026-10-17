import { afterEach, expect, test, vi } from 'vitest'
import type { CurrentSubscriptionDto } from '@/lib/billing-backend-api'
import { envelope, useFakeBackend } from '@/test/billing-backend-fetch'
import { confirmServerPayment, paymentStartOf } from './server-payment-api'

/**
 * Thanh toán qua backend: URL thanh toán backend trả quyết định bước kế tiếp; xác nhận ở cổng thử rồi đọc lại kết quả từ backend — mã
 * cổng một mình không đủ để báo thành công.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

afterEach(() => {
  vi.useRealTimers()
})

const ACTIVE: CurrentSubscriptionDto = {
  subscriptionId: 3, planId: 1, planName: 'Basic', tier: 'BASIC', status: 'ACTIVE', startedAt: '2026-10-17T10:00:00', expiresAt: '2026-11-17T10:00:00',
  autoRenew: true, creditsBalance: 100, creditsMonthlyGrant: 100, algorithmTier: 'EP_DBLF',
}
function thrownCode(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return undefined
}

const checkout = (code: string) => ({ success: true, message: 'Mock payment executed successfully', txnRef: 'MOCK_A1', callbackResult: { RspCode: code, Message: 'x' } })

test('URL của cổng thử là trang xác nhận; mã giao dịch lấy từ transactionId, vắng thì từ txnRef của URL', () => {
  const url = '/api/payment/mock-checkout?txnRef=MOCK_A1'
  expect(paymentStartOf({ id: 1, transactionId: 'MOCK_A1', paymentUrl: url, status: 'PENDING' }, 'TOPUP')).toStrictEqual({ kind: 'confirm', reference: 'MOCK_A1', purpose: 'TOPUP' })
  expect(paymentStartOf({ id: 1, transactionId: null, paymentUrl: url, status: 'PENDING' }, 'SUBSCRIBE')).toStrictEqual({ kind: 'confirm', reference: 'MOCK_A1', purpose: 'SUBSCRIBE' })
})

test('URL tuyệt đối của cổng thật thì chuyển hẳn sang; không có URL mà gói đã ACTIVE là kích hoạt ngay; còn lại là lỗi thanh toán', () => {
  const vnpay = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=VNPAY_1'
  expect(paymentStartOf({ id: 1, transactionId: 'VNPAY_1', paymentUrl: vnpay, status: 'PENDING' }, 'TOPUP')).toStrictEqual({ kind: 'redirect', url: vnpay })
  expect(paymentStartOf({ id: null, transactionId: null, paymentUrl: null, status: 'ACTIVE' }, 'SUBSCRIBE')).toStrictEqual({ kind: 'activated' })
  expect(thrownCode(() => paymentStartOf(null, 'TOPUP'))).toBe('PAYMENT_FAILED')
  expect(thrownCode(() => paymentStartOf({ id: 1, transactionId: null, paymentUrl: '/khac', status: 'PENDING' }, 'TOPUP'))).toBe('PAYMENT_FAILED')
})

test('nạp credit: thành công khi sổ cái có lượt mua mang đúng mã giao dịch', async () => {
  backend.replies = [
    checkout('00'),
    envelope({ content: [{ id: 9, amount: 50, type: 'PURCHASE', reference: 'MOCK_A1', refunded: false, createdAt: '2026-10-17T10:00:00' }], last: true }),
  ]
  expect(await confirmServerPayment('MOCK_A1', 'TOPUP')).toStrictEqual({ status: 'SUCCESS', purpose: 'TOPUP', credits: 50 })
  expect(backend.calls.map((call) => `${call.method} ${call.url}`)).toStrictEqual([
    'GET http://be.test/api/payment/mock-checkout?txnRef=MOCK_A1',
    'GET http://be.test/api/credits/transactions?page=0&size=50',
  ])
})

test('nạp credit: cổng báo 00 nhưng sổ cái không có lượt mua đó thì chưa ghi nhận', async () => {
  backend.replies = [checkout('00'), envelope({ content: [{ id: 2, amount: 500, type: 'PURCHASE', reference: 'MOCK_KHAC', refunded: false, createdAt: null }], last: true })]
  expect(await confirmServerPayment('MOCK_A1', 'TOPUP')).toStrictEqual({ status: 'NOT_CONFIRMED', purpose: 'TOPUP', gatewayCode: '00' })
})

test('đăng ký: thành công khi cổng báo 00 và gói của công ty đang ACTIVE; sai chữ ký (97) thì chưa ghi nhận', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-17T04:00:00Z'))
  backend.replies = [checkout('00'), envelope(ACTIVE), checkout('97'), envelope(ACTIVE)]
  expect(await confirmServerPayment('MOCK_A1', 'SUBSCRIBE')).toStrictEqual({ status: 'SUCCESS', purpose: 'SUBSCRIBE', planName: 'Basic' })
  expect(backend.calls[1]?.url).toBe('http://be.test/api/subscription/current')
  expect(await confirmServerPayment('VNPAY_B2', 'SUBSCRIBE')).toStrictEqual({ status: 'NOT_CONFIRMED', purpose: 'SUBSCRIBE', gatewayCode: '97' })
})
