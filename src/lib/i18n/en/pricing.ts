import type { Dictionary } from '../types'
import type { pricing as source } from '../vi/pricing'

export const pricing = {
  title: 'Pricing',
  lede: 'The plans differ in credits per month and algorithm tier. Everything else comes with every plan.',
  cta: 'Talk to us',
  perMonth: '/ month',
  credits: 'Credits per month',
  unlimitedCredits: 'Unlimited credits',
  algorithm: 'Algorithm tier',
  tiers: { EP_DBLF: 'Standard', EP_DBLF_GA: 'Advanced', EP_DBLF_GA_AI: 'Advanced' },
  extras: 'On top of the shared part',
  commonOnly: 'Everything every plan has.',
  features: {
    OPTIMIZATION_3D: '3D load optimization, three plans per run',
    ROUTE_OPTIMIZATION: 'Delivery route optimization',
    ADVANCED_ALGORITHM: 'Advanced algorithm tier',
    UNLIMITED_CREDITS: 'Unlimited optimization runs',
  },
  common: {
    title: 'Every plan includes',
  },
  credit: {
    title: 'How credits work',
    run: { one: '{count} credit buys one 3D load optimization run.', other: '{count} credits buy one 3D load optimization run.' },
    plans: 'Each run gives {count} plans to compare — and still counts as one run.',
    route: 'Delivery route optimization uses no credits.',
    summary: {
      one: '{count} credit buys one 3D load optimization run with {plans} plans to compare.',
      other: '{count} credits buy one 3D load optimization run with {plans} plans to compare.',
    },
  },
  notes: {
    title: 'Before you choose',
    tier: 'The algorithm tier is the level of optimization a plan gets once LoadMaster runs in production. This demo optimizes at the {tier} tier for every plan, so every plan gives the same result here.',
    provisional: 'Prices and credits of plans tagged “{tag}” are not final and may change before the service goes live.',
    signUp: 'Want to use a plan? Send a contact request and the LoadMaster team opens a company account after talking with you.',
  },
  contactPlan: 'Talk to us',
  contactPlanName: 'about the {name} plan',
  manage: 'Manage your company plan',
  loading: 'Loading pricing',
  empty: 'No plan is on sale right now.',
  error: 'Could not load the pricing.',
  retry: 'Try again',
} satisfies Dictionary<typeof source>
