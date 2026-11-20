import type { Dictionary } from '../types'
import type { landingStage as source } from '../vi/landingStage'

/**
 * Landing sample-trip 3D stage: extra copy for the truck pulling away, reaching stop 1 and unloading (trip card, transition card, stage
 * description), the A · B · C plan picker and the stop 1 row of the figures strip.
 */
export const landingStage = {
  title: 'Sample trip 3D stage',
  departed: 'Left the depot',
  arrived: 'At stop {number}',
  unloading: 'Unloading {done} / {total} at stop {number}',
  delivered: 'Stop {number} delivered',
  arrival: 'Stop {number} · {name}',
  caption: 'Once loaded, the rear doors close, the truck drives to stop 1 and unloads only that stop’s cargo, in the plan’s unloading order.',
  plans: {
    title: 'One run, three plans',
    note: 'Same {count} packages, three goals. Pick a plan to see the truck loaded its way.',
    pending: 'The three plans appear once the optimizer has finished.',
    name: 'Plan {label} — {objective}',
    best: 'Best',
    volume: 'Volume used',
    axleGap: 'Axle load gap',
    axleGapValue: '{value} pts',
    rehandling: 'Rehandling',
    unplaced: 'Not placed',
  },
  stop: {
    title: 'At stop {number} · {name}',
    count: 'Packages for the stop',
    moved: 'Moved to reach them',
    foreign: 'Other stops’ packages in its zone',
    stray: 'Its packages outside its zone',
  },
} satisfies Dictionary<typeof source>
