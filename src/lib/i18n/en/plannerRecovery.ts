import type { Dictionary } from '../types'
import type { plannerRecovery as source } from '../vi/plannerRecovery'

export const plannerRecovery = {
  crash: {
    code: 'Error',
    title: 'Could not open the 3D plan',
    description: 'The plan viewer failed while drawing. Reload the page; if it still fails, open the trip again from Trip details.',
    reload: 'Reload page',
    backToTrip: 'Back to Trip details',
  },
  unknownStops: {
    title: 'The plan does not match the trip stops',
    description: {
      one: '{count} package in the plan does not belong to any stop of the trip ({codes}). Optimize again to get a new plan.',
      other: '{count} packages in the plan do not belong to any stop of the trip ({codes}). Optimize again to get a new plan.',
    },
  },
  otherVehicle: 'The plan was computed for the vehicle used before the change: its packages no longer fit the current vehicle, so they are not drawn in it. Optimize again to get a plan for this vehicle.',
} satisfies Dictionary<typeof source>
