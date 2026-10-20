import type { Dictionary } from '../types'
import type { landingStory as source } from '../vi/landingStory'

export const landingStory = {
  lumo: {
    says: '{name} says:',
    hero: {
      preparing: 'The simulated optimizer plans this sample trip right in your browser.',
      intake: 'Each stop’s packages wait in a lane of that stop’s color.',
      optimize: 'The truck is split into zones by stop, one color per stop.',
      loading: 'The last stop’s cargo goes on first. Each box leaves its lane as it goes in.',
      ready: 'Loaded and ready to depart. The figures below are from the plan just computed.',
      readyPartial: 'Some packages could not be placed. The figures below show the plan as computed.',
      depart: 'The truck pulls out; the driver unloads in the plan’s order.',
      fallback: 'The truck view can’t be shown here, so here’s an illustration instead.',
    },
    facts: 'These are the app’s own fixed numbers, not figures from any one trip.',
    how: {
      intake: 'Every package gets its own QR label, so it can be verified when staging, loading and unloading.',
      plan: 'Stops come from delivery requirements; route optimization sets the order and estimates arrival times.',
      optimize: 'Only the approved plan reaches the warehouse and the driver; changing the truck or packages means optimizing again.',
      operate: 'The warehouse verifies each package as it goes on, the driver as it comes off — both from the approved plan.',
      done: 'Once the last stop is done, the trip report is ready.',
    },
    plans: 'Not sure which plan fits? Send a request and the LoadMaster team will suggest one for your fleet.',
    contact: 'Need a quote, a demo or contract details? Pick it under “What do you need?” so the team answers the right question.',
  },
  statement: 'What comes off last goes on first. What comes off first sits by the door. Each stop unloads only its own cargo.',
} satisfies Dictionary<typeof source>
