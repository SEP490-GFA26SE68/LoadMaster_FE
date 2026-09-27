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
    EP_DBLF: 'EP-DBLF (extreme points, deepest–bottom–left)',
    GENETIC_ALGORITHM: 'Genetic algorithm',
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
} satisfies Dictionary<typeof source>
