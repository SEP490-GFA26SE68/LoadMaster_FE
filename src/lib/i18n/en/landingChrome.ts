import type { Dictionary } from '../types'
import type { landingChrome as source } from '../vi/landingChrome'

/** Header and shared chrome of the public pages (landing, pricing, privacy policy). */
export const landingChrome = {
  title: 'Public page chrome',
  home: 'LoadMaster home',
  nav: 'Site sections',
  menu: 'Site menu',
  features: 'Features',
  how: 'How it works',
  pricing: 'Pricing',
  contact: 'Contact',
  signIn: 'Sign in',
  openApp: 'Open the app',
} satisfies Dictionary<typeof source>
