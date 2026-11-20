import type { Dictionary } from '../types'
import type { legal as source } from '../vi/legal'

export const legal = {
  docs: {
    label: 'Terms and policies',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
  },
  updated: 'Last updated: {date}',
  print: 'Print this page',
  summary: {
    title: 'In short',
    note: 'A summary for quick reading; the full text is in the sections below.',
  },
  toc: {
    title: 'Contents',
    count: { one: '{count} section', other: '{count} sections' },
  },
  related: {
    title: 'Read alongside',
    privacy: 'The privacy policy says what data LoadMaster collects, where it is sent and where it is stored.',
    privacyAction: 'Read the privacy policy',
    terms: 'The terms of use cover accounts, plans, credits and your responsibility when you use optimization results.',
    termsAction: 'Read the terms of use',
  },
  closing: {
    title: 'Still have a question?',
    body: 'Send a question about this page through the contact form on the About page.',
    action: 'Open the contact form',
    email: 'Or write to {email}.',
    phone: 'Phone: {phone}',
    address: 'Address: {address}',
    taxCode: 'Tax code: {code}',
  },
} satisfies Dictionary<typeof source>
