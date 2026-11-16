import type { Dictionary } from '../types'
import type { subscriptionLocked as subscriptionSource, trialLocked as source } from '../vi/support-trial-locked'

export const trialLocked = {
  badge: 'Account locked',
  signOut: 'Sign out',
  title: 'Account temporarily locked: the service agreement was not signed within 72 hours',
  body: 'Under LoadMaster rules, a trial company must sign the electronic agreement within 72 hours of activation. The operating screens are paused.',
  pendingTitle: 'Your unlock request has been received',
  pendingNote: 'The support team will review the request and reopen your account as soon as possible.',
  formTitle: 'Ask support to unlock the account',
  reasonLabel: 'Why should the account be reopened',
  reasonPlaceholder: 'For example: we were travelling and could not sign within 72 hours; please unlock the account so we can sign again.',
  reasonRequired: 'Enter why the account should be reopened',
  submit: 'Send unlock request',
  sent: 'Unlock request sent.',
  ticketTitle: 'Trial account unlock request - {name}',
  signTitle: 'Sign the agreement online',
  signHint: 'Sign the agreement now to unlock the account.',
  signNow: 'Sign the agreement now',
  signed: 'Agreement signed. Your account has been reopened.',
  signAuto: 'Signing reopens the account at once, no approval needed.',
  signAutoTag: 'Reopens at once',
  agreementCompany: 'Company:',
  agreementCode: 'Agreement code:',
  signUnlock: 'Sign the agreement to unlock now',
  helpToggle: 'Need technical help or having trouble signing?',
  helpLabel: 'What do you need help with',
  helpPlaceholder: 'Describe the error or problem you hit when signing…',
  helpSubmit: 'Send support request',
} satisfies Dictionary<typeof source>

export const subscriptionLocked = {
  badge: 'Plan expired',
  signOut: 'Sign out',
  title: 'Your company’s plan has expired',
  body: 'Your company has no active LoadMaster plan. Every operating feature (trips, dispatch, warehouse and load optimisation) is paused.',
  nextTitle: 'Need to keep using the system?',
  nextBody: 'Ask your company admin to renew or subscribe to a plan.',
  signOutLong: 'Sign out of the system',
  recheck: 'Check again',
  stillLocked: 'Your company still has no active plan.',
} satisfies Dictionary<typeof subscriptionSource>
