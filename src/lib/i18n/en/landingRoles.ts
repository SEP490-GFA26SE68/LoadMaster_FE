import type { Dictionary } from '../types'
import type { landingRoles as source } from '../vi/landingRoles'

/**
 * The "One trip, four screens" part of the landing page (`#vai-tro`, `features/marketing/roles`): the four roles of one trip, each a tab
 * with a device frame that redraws the real app screen and two points about what that person does there. Words inside the frames come
 * from the branch of the real screen when it has them; this branch only adds what is specific to this part. The frames are illustrations
 * (`aria-hidden`): `text` is the equivalent wording for screen readers. No MOCK RESULT label on public pages.
 */
export const landingRoles = {
  title: 'One trip, four screens',
  lede: 'Same trip, a screen for each job.',
  tabsLabel: 'Roles in one trip',
  screens: {
    dispatcher: 'Monitoring screen, on a computer',
    warehouse: 'Loading screen, on a warehouse tablet',
    driver: 'Stop screen, on a phone',
    companyManager: 'Dashboard, on a computer',
  },
  points: {
    dispatcher: {
      p1: 'Where the truck is, which stop is next — and whether the position is GPS or simulated.',
      p2: 'Expected arrival beside each stop\'s deadline, mandatory rests included.',
    },
    warehouse: {
      p1: 'One package per screen: which one, into which stop\'s zone of the truck.',
      p2: 'A package only counts as loaded once verified — scan, type the code, or confirm by hand.',
    },
    driver: {
      p1: 'The next stop, expected arrival and deadline; one main button per step.',
      p2: 'Unload each package through the verification box; refused packages stay on the truck.',
    },
    companyManager: {
      p1: 'Trip figures by period, each number with its source, ready to export.',
      p2: 'Read-only view of trips and plans, and the monthly driver payroll.',
    },
  },
  mobileApp: 'Drivers and warehouse workers also have their own mobile app — not on the app stores yet.',
  source: 'Numbers in the picture come from the {count}-package sample trip; arrivals assume straight lines, leaving the depot at {time}.',
  frame: {
    trip: 'Sample trip',
    headingTo: 'Heading to stop {number}',
    stopTimes: 'Expected {eta} · due {deadline}',
    depot: 'Depot',
    loaded: 'Loaded',
    front: 'Front',
    rearDoor: 'Rear door',
    toUnload: { one: '{count} package to unload', other: '{count} packages to unload' },
    kpi: {
      packages: 'Packages',
      stops: 'Stops',
      weight: 'Cargo weight',
      payload: 'Payload used',
    },
    chart: 'Weight by stop',
  },
  text: {
    dispatcher: 'Illustration of the Monitoring screen: a route diagram from the depot through {count} stops, the truck heading to stop {number}, its position simulated. Whole route: {summary}.',
    stop: 'Stop {number} · {name}: expected {eta}, deadline {deadline} — {status}.',
    warehouse: 'Illustration of the loading screen: {loaded} / {total} packages loaded. The package to load is {id}, {size}, {weight}, into the zone of stop {number} · {name}, {place}. The step\'s button is "{action}".',
    driver: 'Illustration of the stop screen: stop {number} / {total} · {name}, expected arrival {eta}, deadline {deadline} — {status}. {count} packages to unload. The step\'s button is "{action}".',
    companyManager: 'Illustration of the dashboard: {packages} packages, {stops} stops, {weight} of cargo, {percent} of the truck\'s payload. Weight by stop:',
    stopWeight: 'Stop {number} · {name}: {weight}.',
  },
} satisfies Dictionary<typeof source>
