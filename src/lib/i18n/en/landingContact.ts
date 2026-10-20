import type { Dictionary } from '../types'
import type { landingContact as source } from '../vi/landingContact'

/** Guest contact form on the landing page: data consent, anti-spam, and the honest demo note. */
export const landingContact = {
  title: 'Contact',
  consent: {
    label: 'I agree that LoadMaster may use these details to contact me about the service',
    privacy: 'Read the privacy policy',
    newTab: '(opens in a new tab)',
  },
  errors: {
    consentRequired: 'Tick the consent box to send your request',
  },
  trap: 'Company website',
  retry: 'Your request was not sent. Please try again in a moment.',
  demo: {
    label: 'Demo',
    note: 'Your request is only kept in this browser and does not reach the LoadMaster team. The fastest way to reach the team is an email to',
    sent: 'The demo only keeps your request in this browser, so the LoadMaster team has not received it. To talk to us, send an email to',
  },
} satisfies Dictionary<typeof source>
