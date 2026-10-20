import type { Dictionary } from '../types'
import type { landingStage as source } from '../vi/landingStage'

/** Landing sample-trip 3D stage: extra copy for the truck pulling away (trip card, stage description). */
export const landingStage = {
  title: 'Sample trip 3D stage',
  departed: 'Left the depot',
  caption: 'Once loaded, the rear doors close and the truck pulls away.',
} satisfies Dictionary<typeof source>
