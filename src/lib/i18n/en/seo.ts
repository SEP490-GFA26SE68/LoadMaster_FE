import type { Dictionary } from '../types'
import type { seo as source } from '../vi/seo'

export const seo = {
  imageAlt: 'LoadMaster logo and a truck body loaded with packages colored by delivery stop',
  pages: {
    landing: {
      title: 'LoadMaster — 3D load planning for trucks',
      description:
        'Build trips, optimize routes and 3D load plans by delivery stop for transport companies. The warehouse loads and the driver unloads from the same approved plan.',
    },
    pricing: {
      title: 'Pricing · LoadMaster',
      description:
        'LoadMaster plans are priced by 3D load optimization runs per month; route optimization uses no credits. Send a request to find the plan that fits your fleet.',
    },
    privacy: {
      title: 'Privacy policy · LoadMaster',
      description: 'How LoadMaster uses and protects the information you send through the contact form on the introduction page.',
    },
  },
} satisfies Dictionary<typeof source>
