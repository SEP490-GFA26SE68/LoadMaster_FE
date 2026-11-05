import type { Dictionary } from '../types'
import type { pricing as source } from '../vi/pricing'

export const pricing = {
  title: 'Pricing',
  lede: 'The plans differ in credits per month and algorithm tier. Every plan includes 3D load optimization and route optimization.',
  cta: 'Talk to us',
  creditNote: '1 credit is one 3D load optimization run, which gives three plans to compare. Route optimization uses no credits.',
  perMonth: '/ month',
  credits: 'Credits per month',
  algorithm: 'Algorithm tier',
  tiers: { EP_DBLF: 'Standard', EP_DBLF_GA: 'Advanced', EP_DBLF_GA_AI: 'Advanced' },
  tierNote: 'The demo currently optimizes at the Standard tier for every plan.',
  includes: 'Includes',
  features: {
    OPTIMIZATION_3D: '3D load optimization, three plans per run',
    ROUTE_OPTIMIZATION: 'Delivery route optimization',
    ADVANCED_ALGORITHM: 'Advanced algorithm tier',
    UNLIMITED_CREDITS: 'Unlimited optimization runs',
  },
  contactPlan: 'Talk to us',
  contactPlanName: 'about the {name} plan',
  manage: 'Manage your company plan',
  signUpNote: 'Want to use a plan? Send a contact request and the LoadMaster team opens a company account after talking with you.',
  loading: 'Loading pricing',
  empty: 'No plan is on sale right now.',
  error: 'Could not load the pricing.',
  retry: 'Try again',
} satisfies Dictionary<typeof source>
