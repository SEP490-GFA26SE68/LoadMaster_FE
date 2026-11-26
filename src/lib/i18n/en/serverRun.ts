import type { Dictionary } from '../types'
import type { serverRun as source } from '../vi/serverRun'

export const serverRun = {
  time: {
    ms: '{ms} ms',
    seconds: '{seconds} s',
  },
  clock: {
    label: 'Time running',
    limit: 'Limit {limit}',
    finishing: 'Time limit reached — the optimizer is finishing up…',
  },
  steps: {
    label: 'Steps of this run',
    queue: { label: 'Waiting for a turn', note: 'The run is waiting for the optimizer to pick it up.' },
    compute: { label: 'Computing three plans', note: 'The optimizer is packing the trip cargo into the vehicle.' },
    build: { label: 'Trying first layouts', note: 'Placing packages into the cargo space in several different ways.' },
    improve: { label: 'Looking for better layouts', note: 'Searching for layouts that carry more and balance better than the ones found so far.' },
    select: { label: 'Picking three plans and scoring them', note: 'Picking plans A · B · C and scoring each by its own profile.' },
    save: { label: 'Checking and saving results', note: 'Re-checking the constraints of each plan, then saving.' },
  },
  algorithm: 'Algorithm running',
  live: {
    layouts: 'Layouts tried',
    placed: 'Most packages placed',
    placedValue: '{placed} / {total} packages',
    volume: 'Best volume fill',
  },
  inputs: {
    title: 'Inputs of this run',
    packages: 'Packages',
    stops: 'Stops',
    vehicle: 'Vehicle',
  },
  compare: {
    runComputation: 'Computation time of the run',
    placed: 'Packages placed',
    placedValue: '{placed} / {total}',
    placedRange: '{min}–{max} / {total}',
    thumbnail: 'Layout of plan {label}: {placed} / {total} packages in the cargo space, seen from the rear door',
    profile: {
      A: 'Puts carrying as much cargo as possible in one trip first.',
      B: 'Puts a safe load first: a low, centered center of gravity and balanced axles.',
      C: 'Puts fast unloading at each stop first: few packages to unload and reload.',
      default: 'Default profile: balances cargo carried against the penalties.',
    },
    bars: {
      title: 'Points added and taken away',
      plus: '+{points}',
      minus: '−{points}',
      biggest: 'Largest penalty: {name}, {points} points.',
      noPenalty: 'No penalty takes points from this plan.',
    },
    axle: {
      usage: '{load} / {limit}',
      over: 'Over by {kg}',
    },
    sameAs: {
      text: 'Same layout as plan {label}: identical picture and figures. The score may differ because this plan is scored by its own profile.',
    },
  },
} satisfies Dictionary<typeof source>
