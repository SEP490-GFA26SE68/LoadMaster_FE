import type { Dictionary } from '../types'
import type { profile as source } from '../vi/profile'

export const profile = {
  title: 'My profile',
  identity: {
    label: 'Account',
    email: 'Email',
    depot: 'Depot',
    note: 'Your email, role and depot are changed by an administrator.',
    phone: 'Phone number',
    serverNote: 'Your name, email and phone number belong to your account on the server. An administrator edits the name and phone number on the Users screen.',
  },
  account: {
    title: 'Password',
    description: 'Your sign-in password is managed by Keycloak. Change it on the account page, which opens in a new tab.',
    changePassword: 'Change password',
    newTab: '(opens in a new tab)',
  },
  details: {
    title: 'Personal details',
    description: 'You can edit your name and phone number.',
    fullName: 'Full name',
    phone: 'Phone number',
    save: 'Save changes',
    saved: 'Profile saved',
  },
  password: {
    title: 'Change password',
    description: 'Use the new password from your next sign-in.',
    current: 'Current password',
    next: 'New password',
    nextHint: 'At least {min} characters',
    confirm: 'Confirm new password',
    submit: 'Change password',
    changed: 'Password changed',
  },
  errors: {
    fullNameRequired: 'Enter your full name',
    fullNameTooLong: 'Full name can be at most 80 characters',
    phoneRequired: 'Enter a phone number',
    phoneInvalid: 'Phone number must have 10 digits and start with 0',
    currentRequired: 'Enter your current password',
    currentIncorrect: 'Current password is incorrect',
    nextTooShort: 'The new password needs at least {min} characters',
    confirmMismatch: 'The passwords do not match',
  },
} satisfies Dictionary<typeof source>
