import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  BILLING_CAPABILITIES,
  cancelSubscription,
  getCreditBalance,
  getSubscriptionView,
  listCreditTransactions,
  listInvoices,
  listPayments,
  listPlansOnSale,
  subscribe,
  topUpCredits,
} from './billing-api'
import { fetchCheckout, settlePayment } from './payment-api'
import { confirmServerPayment, type ServerPaymentPurpose } from './server-payment-api'

/**
 * Hook Query của gói cước và credit của công ty (FE-8-03, FE-8-04). Mọi khoá dưới `['billing']` (cùng khoá với thẻ Credit của Thiết lập
 * tối ưu): đăng ký, huỷ, nạp, xử lý thanh toán đều làm mới cả nhóm — gói, số dư, các lịch sử và thẻ Credit đổi cùng lúc. `staleTime: 0`
 * vì vòng đời gói chạy theo đồng hồ (gói hết hạn, thanh toán gia hạn xuất hiện khi có người đọc). Lịch sử thanh toán chỉ đọc khi nguồn dữ
 * liệu có nó, hoá đơn cũng vậy (`BILLING_CAPABILITIES`).
 */
const KEY = ['billing'] as const
const FRESH = { staleTime: 0 } as const

export function useSubscriptionQuery() {
  return useQuery({ queryKey: [...KEY, 'subscription'], queryFn: getSubscriptionView, ...FRESH })
}

export function useCreditBalanceQuery() {
  return useQuery({ queryKey: [...KEY, 'balance'], queryFn: getCreditBalance, ...FRESH })
}

export function useCreditTransactionsQuery() {
  return useQuery({ queryKey: [...KEY, 'credit-transactions'], queryFn: listCreditTransactions, ...FRESH })
}

export function usePaymentsQuery() {
  return useQuery({ queryKey: [...KEY, 'payments'], queryFn: listPayments, enabled: BILLING_CAPABILITIES.payments, ...FRESH })
}

export function useInvoicesQuery() {
  return useQuery({ queryKey: [...KEY, 'invoices'], queryFn: listInvoices, enabled: BILLING_CAPABILITIES.invoices, ...FRESH })
}

export function usePlansOnSaleQuery() {
  return useQuery({ queryKey: [...KEY, 'plans-on-sale'], queryFn: listPlansOnSale, ...FRESH })
}

/** Giao dịch của trang thanh toán giả lập. */
export function useCheckoutQuery(paymentId: string) {
  return useQuery({ queryKey: [...KEY, 'payment', paymentId], queryFn: () => fetchCheckout(paymentId), enabled: paymentId !== '', retry: false, ...FRESH })
}

function refresh(client: QueryClient) {
  return Promise.all([client.invalidateQueries({ queryKey: KEY }), client.invalidateQueries({ queryKey: ['notifications'] })])
}

export function useSubscribeMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (planId: string) => subscribe(planId), onSuccess: () => refresh(client) })
}

export function useCancelSubscriptionMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: cancelSubscription, onSuccess: () => refresh(client) })
}

export function useTopUpMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (credits: number) => topUpCredits(credits), onSuccess: () => refresh(client) })
}

export function useSettlePaymentMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentId, outcome }: { paymentId: string; outcome: 'SUCCESS' | 'FAILED' }) => settlePayment(paymentId, outcome),
    onSuccess: () => refresh(client),
  })
}

/** Xác nhận thanh toán ở cổng thử của backend rồi đọc lại kết quả (trang `/thanh-toan/ket-qua`). */
export function useConfirmServerPaymentMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ reference, purpose }: { reference: string; purpose: ServerPaymentPurpose }) => confirmServerPayment(reference, purpose),
    onSuccess: () => refresh(client),
  })
}
