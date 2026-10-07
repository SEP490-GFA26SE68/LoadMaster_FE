import type { Dictionary } from '../types'
import type { billing as source } from '../vi/billing'

export const billing = {
  title: 'Plan and credits',
  loading: 'Loading the plan',
  errorTitle: 'Could not load the plan',
  retry: 'Try again',
  topUp: 'Top up credits',
  pay: 'Pay',
  payFor: 'Pay transaction {code}',
  pending: {
    RENEWAL: 'The renewal payment for plan {plan} ({amount}) is waiting. The plan expires on {date} if it is not paid.',
    SUBSCRIBE: 'The payment to subscribe to plan {plan} ({amount}) is not finished.',
  },
  plan: {
    title: 'Current plan',
    status: { ACTIVE: 'Active', CANCELLED: 'Cancelled — still valid', EXPIRED: 'Expired' },
    started: 'Started',
    expires: 'Expires',
    autoRenew: 'Auto-renew',
    autoRenewOn: 'On',
    autoRenewOff: 'Off',
    price: 'Price per month',
    credits: 'Credits per month',
    cancel: 'Cancel plan',
    expiredNote: 'The plan has expired, so optimisation cannot run. The credit balance is kept; choose a new plan to continue.',
    cancelledNote: 'The plan is cancelled. It can be used until {date}, then expires and does not renew.',
  },
  noPlan: {
    title: 'The company has no plan yet',
    description: 'Choose a plan to run 3D optimisation. Credits you top up are kept when a plan expires.',
  },
  choose: {
    title: 'Choose a plan',
    subscribe: 'Subscribe',
    subscribeTo: 'Subscribe to plan {name}',
    credits: '{credits} credits per month',
    none: 'No plan is on sale right now.',
  },
  credit: {
    title: 'Credits',
    balance: 'Balance',
    note: 'Each 3D optimisation run uses 1 credit; the unlimited plan uses 0.',
    unlimitedNote: 'The plan is unlimited, so the balance is not reduced by optimisation runs.',
  },
  cancelDialog: {
    title: 'Cancel plan {plan}?',
    description: 'The plan stays usable until {date}, then expires and does not renew. The credit balance is kept.',
    cancel: 'Keep the plan',
    confirm: 'Cancel plan',
  },
  cancelled: 'Plan {plan} cancelled. It can be used until {date}.',
  topUpDialog: {
    title: 'Top up credits',
    description: '{price} per credit. You finish on the payment page; credits are only added when the payment succeeds.',
    pack: '{credits} credits',
    packAmount: '{amount}',
    cancel: 'Cancel',
    confirm: 'Continue to payment',
  },
  history: {
    title: 'History',
    tabs: { credit: 'Credits', payments: 'Payments' },
  },
  ledger: {
    columns: { time: 'Time', type: 'Type', amount: 'Credits', reference: 'Reference', note: 'Note' },
    types: { MONTHLY_GRANT: 'Monthly grant', PURCHASE: 'Purchase', USAGE: 'Usage', REFUND: 'Refund' },
    usage: { RESERVED: 'On hold', DEDUCTED: 'Deducted', REFUNDED: 'Refunded' },
    empty: 'No credit transactions yet.',
  },
  payments: {
    columns: { time: 'Time', code: 'Transaction', purpose: 'For', amount: 'Amount', status: 'Status', actions: 'Actions' },
    purposes: { SUBSCRIBE: 'Subscribe to a plan', RENEWAL: 'Plan renewal', TOPUP: 'Credit top-up' },
    statuses: { PENDING: 'Awaiting payment', SUCCESS: 'Succeeded', FAILED: 'Failed' },
    empty: 'No payments yet.',
  },
} satisfies Dictionary<typeof source>
