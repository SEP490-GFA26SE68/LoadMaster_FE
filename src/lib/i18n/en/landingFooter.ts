import type { Dictionary } from '../types'
import type { landingFooter as source } from '../vi/landingFooter'

export const landingFooter = {
  title: 'Footer',
  label: 'LoadMaster information and links',
  description:
    '3D load planning and loading optimization for small and medium transport companies in Vietnam: plan trips, optimize routes, then the warehouse loads and the driver unloads from the same approved plan.',
  contact: {
    email: 'Support email',
    phone: 'Phone',
    address: 'Address',
  },
  cta: 'Talk to us about your fleet',
  columns: {
    product: 'Product',
    roles: 'Built for',
    support: 'Support',
    account: 'Account',
  },
  links: {
    features: 'Features',
    how: 'How it works',
    plans: 'Plans',
    pricing: 'Pricing',
    contact: 'Ask for a consultation',
    email: 'Support email',
    signIn: 'Sign in',
    openApp: 'Open the app',
    trial: 'Try for free',
    registerNow: 'Get started',
  },
  copyright: '© {year} {name}',
  taxCode: 'Tax code {code}',
  /** Ghi công thiết kế: giữ nguyên chữ ở mọi ngôn ngữ (tên riêng). */
  credit: 'Design by Kangnahyun',
  backToTop: 'Back to top',
  pageTop: 'Top of page',
} satisfies Dictionary<typeof source>
