import type { Dictionary } from '../types'
import type { landingWhy as source } from '../vi/landingWhy'

/**
 * The "Why loading by hand does not scale" strip at the end of the dark opening block of the landing page (`features/marketing/why`):
 * the visitor picks a number of stops and of packages, and the page counts in place the orderings through the stops (n!) and the
 * orientation choices (six per package) — a pure count in `why-count.ts`, nobody's measurement. Large numbers are written "a × 10^b";
 * `approx` is how a screen reader says them.
 */
export const landingWhy = {
  title: 'Why loading by hand does not scale',
  stops: {
    label: 'Stops',
    value: { one: '{count} stop', other: '{count} stops' },
  },
  packages: {
    label: 'Packages',
  },
  orders: { one: 'Orders to visit {count} stop', other: 'Orders to visit {count} stops' },
  orientations: { one: 'Orientation choices for {count} package', other: 'Orientation choices for {count} packages' },
  approx: 'about {mantissa} times 10 to the power of {exponent}',
  digits: { one: 'a number {count} digit long', other: 'a number {count} digits long' },
  closing: {
    one: 'Each package has {base} orientations, before even picking its position. The LoadMaster optimizer goes through them for you and returns {count} plan.',
    other: 'Each package has {base} orientations, before even picking its position. The LoadMaster optimizer goes through them for you and returns {count} plans.',
  },
} satisfies Dictionary<typeof source>
