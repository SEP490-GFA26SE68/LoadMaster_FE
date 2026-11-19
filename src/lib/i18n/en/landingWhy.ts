import type { Dictionary } from '../types'
import type { landingWhy as source } from '../vi/landingWhy'

/**
 * The "Why loading by hand does not scale" strip at the end of the dark opening block of the landing page (`features/marketing/why`):
 * the visitor picks a number of stops and of packages, and the page counts in place the orderings through the stops (n!) and the
 * orientation choices (six per package) — a pure count in `why-count.ts`, nobody's measurement. Large numbers are written "a × 10^b";
 * `approx` is how a screen reader says them.
 */
export const landingWhy = {
  title: 'Why hand loading falls short',
  stops: {
    label: 'Stops',
    value: { one: '{count} stop', other: '{count} stops' },
  },
  packages: {
    label: 'Packages',
  },
  orders: { one: 'Orders to visit {count} stop', other: 'Orders to visit {count} stops' },
  orientations: { one: 'Orientations of {count} package', other: 'Orientations of {count} packages' },
  approx: 'about {mantissa} times 10 to the power of {exponent}',
  digits: { one: 'a {count}-digit number', other: 'a {count}-digit number' },
  closing: {
    one: 'Each package has {base} orientations, before its spot is even chosen. LoadMaster weighs them for you and returns {count} plan.',
    other: 'Each package has {base} orientations, before its spot is even chosen. LoadMaster weighs them for you and returns {count} plans.',
  },
} satisfies Dictionary<typeof source>
