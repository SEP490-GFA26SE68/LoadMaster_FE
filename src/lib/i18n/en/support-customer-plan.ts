import type { Dictionary } from '../types'
import type { customerPlan as source } from '../vi/support-customer-plan'

export const customerPlan = {
  title: 'Change a customer’s plan',
  description: 'Update or upgrade a customer company’s plan right away, as asked in a support request.',
  company: 'Customer company',
  current: 'Current plan:',
  none: 'None',
  plan: 'Plan to apply',
  planOption: '{name} — {price}/month ({credits})',
  unlimited: 'Unlimited',
  credits: '{amount} credits',
  close: 'Close',
  submit: 'Update plan now',
  updated: 'Plan {plan} applied to {company}.',
  companyFallback: 'the company',
  quickTitle: 'Quick plan change',
  ticketClosed: 'This support request is closed — reopen it before changing the plan.',
} satisfies Dictionary<typeof source>
