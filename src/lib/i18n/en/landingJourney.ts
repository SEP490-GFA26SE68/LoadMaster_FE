import type { Dictionary } from '../types'
import type { landingJourney as source } from '../vi/landingJourney'

/**
 * The two middle parts of the landing page: the "Three familiar problems" strip in the dark opening block (`LandingProblems`) and "One
 * trip on LoadMaster" (`#cach-hoat-dong`, `LandingJourney`) — five legs of a trip, one role each, beside a truck that sticks while
 * scrolling. Every number here has a source: the sample run of the simulated optimizer in the browser, a constant in the code, or the
 * threshold of an automated benchmark; the source sentence goes with the number. No MOCK RESULT label on public pages.
 */
export const landingJourney = {
  problems: {
    title: 'Three familiar problems on a delivery trip',
    lede: 'Small things that slow the whole trip down — and how LoadMaster handles them from the planning stage.',
    buried: {
      problem: 'At stop 2, the cargo for stop 2 is buried deep in the truck.',
      answer: 'Cargo is loaded in delivery order: the last stop sits deepest, the first stop by the door.',
    },
    axle: {
      problem: 'There is room left in the body, but nobody knows the rear axle is overloaded.',
      answer: 'Front and rear axle loads are shown against the truck limits; over the limit, the plan cannot be approved.',
    },
    wrong: {
      problem: 'A package goes onto the wrong truck, or off at the wrong stop.',
      answer: 'Every package is checked at staging, loading and unloading — scan the code, type the code or confirm by hand.',
    },
  },
  title: 'One trip on LoadMaster',
  lede: 'Five legs, one approved plan.',
  chaptersLabel: 'The five legs of a trip',
  chapters: {
    plan: {
      title: 'Plan the trip and pick a plan',
      text: 'Optimize the stop order, then load in 3D: one run, three plans to approve.',
    },
    load: {
      title: 'Stage and load at the warehouse',
      text: 'The last stop goes in first, deepest; each package counts only once checked.',
    },
    road: {
      title: 'On the road',
      text: 'Watch the truck and its arrival against each deadline; handle road incidents.',
    },
    stop: {
      title: 'At the stop',
      text: 'Cargo for the current stop sits by the door; the driver unloads each one through a check.',
    },
    done: {
      title: 'Delivered, reported, paid',
      text: 'The report shows arrival against deadlines; the manager closes driver payroll.',
    },
  },
  truck: {
    door: 'Rear door',
  },
  plans: {
    caption: 'The three plans of the sample run, side by side',
    metric: 'Metric',
    source: 'Numbers from the {count}-package sample run in this browser; "Best" only compares the three plans.',
    pending: 'Computing the sample run…',
    off: 'This browser does not run the sample optimizer (data saver is on or Web Workers are missing), so the table has no numbers.',
    error: 'The sample run could not be computed in this browser, so the table has no numbers.',
  },
  facts: {
    credit: {
      value: { one: '{count} credit', other: '{count} credits' },
      label: 'per run',
      source: 'A constant of the app.',
    },
    speed: {
      value: '< {seconds} s',
      label: 'for {count} packages',
      source: 'Benchmark threshold, dev machine.',
    },
  },
  verify: {
    label: 'Three ways to check a package',
    levels: {
      qr: 'Scan the QR code',
      code: 'Type the package code',
      manual: 'Confirm by hand, pending dispatcher approval',
    },
  },
  route: {
    depot: 'Depot',
    deadlines: 'Deadline status of each stop',
  },
  stop: {
    source: 'Counted on plan {label} of the sample run.',
  },
  payslip: {
    title: 'Driver payslip',
    note: 'Commission and handling pay follow the weight delivered in the month.',
  },
} satisfies Dictionary<typeof source>
