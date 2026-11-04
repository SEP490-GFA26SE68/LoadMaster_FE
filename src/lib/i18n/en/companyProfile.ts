import type { Dictionary } from '../types'
import type { companyProfile as source } from '../vi/companyProfile'

export const companyProfile = {
  title: 'Company details',
  loading: 'Loading the company details',
  retry: 'Try again',
  identity: {
    label: 'Company',
    code: 'Company code',
    taxCode: 'Tax code',
    createdAt: 'Created on',
    depot: 'Departure depot',
    serverNote: 'The company code, tax code and status are changed by a LoadMaster system administrator.',
    note: 'The company code and departure depot are changed by a LoadMaster system administrator.',
  },
  form: {
    title: 'General details',
    serverDescription: 'The company name and billing email. The server does not store the company address or phone number yet.',
    description: 'The company name, address and phone number.',
    name: 'Company name',
    billingEmail: 'Billing email',
    address: 'Address',
    phone: 'Company phone number',
    save: 'Save changes',
    saved: 'Company details saved',
  },
} satisfies Dictionary<typeof source>
