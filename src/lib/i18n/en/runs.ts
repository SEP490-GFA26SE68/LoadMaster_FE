import type { Dictionary } from '../types'
import type { runs as source } from '../vi/runs'

export const runs = {
  title: 'Optimization runs',
  objective: 'Objective',
  algorithm: 'Algorithm',
  objectives: {
    MAX_VOLUME: 'Maximize volume',
    AXLE_BALANCE: 'Balance axle load',
    MIN_REHANDLING: 'Least rehandling',
  },
  algorithms: {
    EP_DBLF: 'EP + DBLF (mock)',
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
    choice: 'Algorithm',
    limits: 'Limit · seed',
    status: 'Result',
    plan: 'Plans A · B · C',
    approval: 'Approval',
  },
  approval: {
    approved: 'Approved',
    pending: 'Awaiting approval',
  },
  approvedPlans: 'Plan {labels}',
  limitSeconds: '{seconds} s',
  seed: 'seed {seed}',
  noValue: '—',
  planAllPlaced: '{volume} · all placed',
  planUnplaced: { one: '{volume} · {count} not placed', other: '{volume} · {count} not placed' },
  openPlan: 'Open plan {revision} in the Planner',
  compare: 'Compare',
  openCompare: 'Compare the plans of run {run}',
} satisfies Dictionary<typeof source>
