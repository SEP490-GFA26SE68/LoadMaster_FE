import type { Dictionary } from '../types'
import type { trialLocked as source } from '../vi/support-trial-locked'

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
} satisfies Dictionary<typeof source>
