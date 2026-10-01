import type { Dictionary } from '../types'
import type { runs as source } from '../vi/runs'

export const runs = {
  title: 'Optimization runs',
  objective: 'Objective',
  algorithm: 'Algorithm',
  objectives: {
    MAX_VOLUME: 'Maximize volume',
    AXLE_BALANCE: 'Balance axle load',
  },
  algorithms: {
    EP_DBLF: 'EP + DBLF',
    GENETIC_ALGORITHM: 'Genetic (GA)',
  },
  status: {
    COMPLETED: 'Has a result',
    FAILED: 'No result',
  },
  failures: {
    REQUEST_REJECTED: 'The request was rejected',
    SERVICE_UNAVAILABLE: 'The optimization service did not respond',
  },
  count: { one: '{count} run', other: '{count} runs' },
  empty: 'This trip has not been optimized yet.',
  columns: {
    at: 'Time',
    runner: 'Run by',
    choice: 'Objective · algorithm',
    limits: 'Limit · seed',
    status: 'Result',
    plan: 'Plan',
    approval: 'Approval',
  },
  approval: {
    approved: 'Approved',
    pending: 'Awaiting approval',
  },
  limitSeconds: '{seconds} s',
  seed: 'seed {seed}',
  noValue: '—',
  planMetrics: 'Volume {volume} · payload {payload}',
  unplaced: { one: '{count} package not placed', other: '{count} packages not placed' },
  allPlaced: 'All {count} packages placed',
  openPlan: 'Open plan {revision} in the Planner',
} satisfies Dictionary<typeof source>
