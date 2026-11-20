import type { Dictionary } from '../types'
import type { seo as source } from '../vi/seo'

export const seo = {
  pages: {
    landing:
      'LoadMaster helps small and mid-sized trucking companies plan trips, optimize routes and build 3D load plans; the warehouse loads and the driver unloads from the same approved plan.',
    pricing: 'The LoadMaster plans on sale: monthly price, monthly credits and the optimization tier of each plan.',
    privacy: 'What data LoadMaster collects, what it is used for, where it is sent and stored, and how you ask to see, correct or delete yours.',
    terms: 'LoadMaster terms of use: accounts, trials, plans and credits, and your responsibility when you use optimization results.',
    samplePlan: 'A 3D load plan for a sample trip, computed in your browser by the LoadMaster simulated optimizer.',
  },
} satisfies Dictionary<typeof source>
