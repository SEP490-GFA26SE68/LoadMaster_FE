import type { Dictionary } from '../types'
import type { agreement as source } from '../vi/billing-agreement'

export const agreement = {
  code: 'Code {code}',
  company: 'Company: {name}',
  banner: {
    expiredTitle: 'The agreement was not signed in time — the account is flagged and restricted',
    expiredBody: 'The 72 hours to sign the trial service agreement have passed. Operations are restricted and account will be deleted after 30 days. Please sign the agreement to unlock.',
    signNow: 'Sign the agreement',
    signToUnlock: 'Sign agreement to unlock',
    pendingTitle: 'The trial service agreement needs signing',
    hoursLeft: '{hours} hours left',
    pendingBody: 'The agreement must be signed within 3 days of the account being activated. Past that, the company account locks itself even if the trial is still running.',
  },
  sign: {
    deadline: 'The agreement stays open for at most 3 days (72 hours) after the account is issued. If it is not signed before {date}, the company account locks itself.',
    deadlineUnknown: 'The agreement stays open for at most 3 days (72 hours) after the account is issued. If it is not signed in time, the company account locks itself.',
    contentTitle: 'Agreement content',
    signerTitle: 'Signing representative',
    signerName: 'Signer full name',
    signerPhone: 'Phone number',
    confirm:
      'I have read, understood and agree to the terms of the LoadMaster trial service, and confirm I am authorised to sign this agreement on behalf of the company.',
    errors: {
      signerNameRequired: 'Enter the signer full name',
      signerPhoneRequired: 'Enter the signer phone number',
      confirmRequired: 'Agree to the terms before signing',
    },
    cancel: 'Cancel',
    submit: 'Sign the agreement',
    doubleCheck: {
      title: 'Confirm signing the trial service agreement',
      description: 'You are signing the electronic agreement for {company}. The agreement is legally binding as soon as you confirm.',
      confirm: 'I confirm and sign',
      back: 'Go back',
    },
  },
  view: {
    badgeSigned: 'Signed',
    badgeExpired: 'Overdue',
    badgePending: 'Awaiting signature',
    legalTitle: 'Signing details',
    statusLabel: 'Status',
    statusSigned: 'Signed electronically',
    statusExpired: 'Signing overdue',
    statusPending: 'Awaiting signature',
    deadlineLabel: 'Sign by',
    hoursLeft: '{hours} hours left',
    signerLabel: 'Signer',
    signedAtLabel: 'Signed at',
    signerPhoneLabel: 'Signer phone',
    ipLabel: 'IP address at signing',
    contentTitle: 'Agreement document',
    close: 'Close',
  },
} satisfies Dictionary<typeof source>
