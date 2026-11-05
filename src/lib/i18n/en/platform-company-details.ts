import type { Dictionary } from '../types'
import type { companyDetails as source } from '../vi/platform-company-details'

/** Company details dialog of the Companies screen on the server (`platform/ViewCompanyDetailsDialog`). */
export const companyDetails = {
  description: 'Code {code}',
  company: {
    title: 'Company',
    taxCode: 'Tax code',
    billingEmail: 'Billing email',
    status: 'Status',
    createdAt: 'Created',
    notUpdated: 'Not provided',
  },
  plan: {
    title: 'Subscription plan',
    name: 'Plan',
    status: 'Plan status',
    expires: 'Expires',
    users: 'Users',
    none: 'This company has no subscription plan.',
    notLoaded: 'The company plan could not be read.',
  },
  agreement: {
    title: 'Service agreement',
    status: 'Status',
    signed: 'Signed',
    expired: 'Signing deadline passed',
    pending: { one: 'Awaiting signature — {count} hour left', other: 'Awaiting signature — {count} hours left' },
    code: 'Agreement code',
    deadline: 'Sign by',
    signer: 'Signed by',
    signedAt: 'Signed at',
    view: 'View document',
    none: 'This company has no service agreement.',
    loading: 'Loading agreement',
  },
  edit: 'Edit details',
  close: 'Close',
} satisfies Dictionary<typeof source>
