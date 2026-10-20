import type { Dictionary } from '../types'
import type { landingStory as source } from '../vi/landingStory'

export const landingStory = {
  lumo: {
    says: '{name} says:',
    hero: {
      preparing: 'I’m asking the simulated optimizer to plan a sample trip.',
      intake: 'Each stop’s packages wait in a lane of that stop’s colour.',
      optimize: 'The truck is split into zones: last stop deepest, first stop by the door.',
      loading: 'The last stop’s cargo goes on first. Each box leaves its lane as it goes in.',
      ready: 'Loaded and ready to leave. The figures below are from this very run.',
      readyPartial: 'Some packages didn’t fit. The figures below show this run as it is.',
      fallback: 'The truck view can’t be shown here, so here’s an illustration instead.',
    },
    facts: 'These are the app’s own fixed numbers, not figures from any one trip.',
    how: {
      intake: 'Every package gets its own QR label, so it can be checked when staging, loading and unloading.',
      plan: 'Stops come from delivery requests; route optimization sets the order and estimates arrival times.',
      optimize: 'Compare the plans side by side, adjust by hand if needed, then approve — the warehouse only gets the approved version.',
      operate: 'The warehouse checks each package as it goes on, the driver as it comes off — both from the approved plan.',
      done: 'Once the last stop is done, the trip report is ready.',
    },
    plans: 'Not sure which plan fits? Send a request and the LoadMaster team will advise for your fleet.',
    contact: 'Need a quote, a demo or contract details? Pick it under “What do you need” so the team answers the right question.',
  },
  statement: 'What comes off last goes on first. What comes off first sits by the door. At each stop, you take that stop’s cargo.',
} satisfies Dictionary<typeof source>
