import type { Dictionary } from '../types'
import type { landingMotion as source } from '../vi/landingMotion'

/** Motion copy on the landing page: what Lumo says, the loading-rule band's opening line and the scroll-linked ribbon below it. */
export const landingMotion = {
  lumo: {
    says: '{name} says:',
    facts: 'These are the app’s own fixed numbers, not figures from any one trip.',
  },
  statement: {
    kicker: 'The loading rule',
  },
  ribbon: {
    label: 'What LoadMaster handles on a trip',
    plan3d: '3D loading in unloading order',
    qr: 'Every parcel checked by QR code',
    route: 'Optimized routes with arrival times',
    approve: 'Plans approved before loading',
    axle: 'Front and rear axle load estimates',
    pickup: 'Pickups along the way',
    monitor: 'Live trip monitoring',
    report: 'A report after every trip',
  },
} satisfies Dictionary<typeof source>
