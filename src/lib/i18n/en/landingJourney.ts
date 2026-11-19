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
  lede: 'Five legs, four roles, one approved plan. Scroll down to follow the truck through each leg.',
  chaptersLabel: 'The five legs of a trip',
  chapters: {
    plan: {
      title: 'Plan the trip and pick a plan',
      text: 'The dispatcher adds delivery requirements to the trip, optimizes the stop order, then runs the 3D loading optimizer. One run gives three plans; compare them side by side, adjust by hand if needed, then approve one.',
    },
    load: {
      title: 'Stage and load at the warehouse',
      text: 'The warehouse stages the cargo, then loads it in the order of the approved plan: the last stop goes in first and sits deepest. A package only counts as loaded once it has been checked.',
    },
    road: {
      title: 'On the road',
      text: 'The truck follows the optimized stop order. The dispatcher watches the truck position and the estimated arrival against each deadline, and handles incidents on the road.',
    },
    stop: {
      title: 'At the stop',
      text: 'The cargo for the current stop sits by the door. The driver unloads each package through the check dialog; a package the customer refuses stays on the truck and becomes a return when the stop is completed.',
    },
    done: {
      title: 'Delivered, reported, paid',
      text: 'Once the last stop is done, the trip is Delivered. The trip report records the actual arrival against each deadline; the company manager reads the dashboard and closes the monthly driver payroll.',
    },
  },
  truck: {
    door: 'Rear door',
  },
  plans: {
    caption: 'The three plans of the sample run, side by side',
    metric: 'Metric',
    source: 'Numbers from the {count}-package sample run the simulated optimizer just computed in your browser — the same run as the 3D stage at the top of the page. "Best" compares the three plans, it is not a benchmark.',
    pending: 'Computing the sample run…',
    off: 'This browser does not run the sample optimizer (data saver is on or Web Workers are missing), so the table has no numbers.',
    error: 'The sample run could not be computed in this browser, so the table has no numbers.',
  },
  facts: {
    credit: {
      value: { one: '{count} credit', other: '{count} credits' },
      label: 'for one run, all three plans',
      source: 'A constant of the app. Optimizing the stop order costs no credits.',
    },
    speed: {
      value: '< {seconds} s',
      label: 'for {count} packages, all three plans',
      source: 'Threshold of the automated benchmark for the simulated optimizer, measured on a development machine — other machines may differ.',
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
    source: 'Counted on plan {label} of the sample run at the top of the page.',
  },
  payslip: {
    title: 'Driver payslip',
    note: 'Commission and handling pay follow the cargo weight of the trips delivered in the month, at the company rates.',
  },
} satisfies Dictionary<typeof source>
