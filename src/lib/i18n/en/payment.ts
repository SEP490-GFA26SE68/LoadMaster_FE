import type { Dictionary } from '../types'
import type { payment as source } from '../vi/payment'

export const payment = {
  title: 'Simulated payment',
  loading: 'Loading the transaction',
  notice: 'This is the demo’s simulated payment page: there is no real payment gateway and no money is taken.',
  description: 'Description',
  code: 'Transaction code',
  status: 'Status',
  purposes: {
    SUBSCRIBE: 'Subscribe to plan {plan}',
    RENEWAL: 'Renew plan {plan}',
    TOPUP: 'Top up {credits} credits',
  },
  hint: 'Success: the plan is activated or the credits are added, exactly once. Failure or Cancel: the balance does not change.',
  success: 'Success',
  failure: 'Failure',
  cancel: 'Cancel',
  settled: {
    title: 'This transaction was already processed',
    description: 'Transaction {code} already has a result: {status}. Each transaction is processed only once.',
  },
  notFound: {
    title: 'Transaction not found',
    description: 'The code does not exist, or it belongs to another company.',
  },
  error: 'Could not load the transaction.',
  retry: 'Try again',
  toBilling: 'Back to plan and credits',
  toasts: {
    SUBSCRIBE: 'Subscribed to plan {plan}',
    RENEWAL: 'Renewed plan {plan}',
    TOPUP: 'Added {credits} credits',
    FAILED: 'The payment did not go through, the balance is unchanged',
    CANCELLED: 'Payment cancelled, the balance is unchanged',
  },
  server: {
    title: 'Confirm payment',
    loading: 'Confirming with the server',
    notice: 'The server uses a test payment gateway: there is no real gateway and no money is taken.',
    purposes: { SUBSCRIBE: 'Subscribe to a plan', TOPUP: 'Credit top-up' },
    hint: 'Confirm so the server records a successful payment: the plan is activated or the credits are added, exactly once. The result is read back from the server.',
    confirm: 'Confirm payment',
    cancel: 'Cancel',
    cancelled: 'Not paid — the plan and balance are unchanged',
    notConfirmed: 'The server has not recorded this payment (gateway code {code}). The plan and balance are unchanged.',
    retry: 'Try again',
    notFound: 'The link is missing the transaction code or the payment type.',
  },
} satisfies Dictionary<typeof source>
