import { found, nextId, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import type { OptimizationRun } from './source-types'

type RunMethods = Pick<Review1Db, 'listOptimizationRuns' | 'recordFailedRun'>

/**
 * Lịch sử lần chạy tối ưu của chuyến (LM-104). Lần chạy ra kết quả do `addRevision` ghi cùng revision (`db-revisions.ts`); ở đây là
 * đọc lịch sử và ghi lần chạy không ra kết quả.
 */
export function runMethods(ctx: DbContext): RunMethods {
  const { trips, runs } = ctx.state
  return {
    listOptimizationRuns: (tripId) =>
      ctx.respond(() => {
        found(trips, 'trips', tripId)
        return [...runs.values()].filter((run) => run.tripId === tripId)
      }),
    recordFailedRun: (tripId, { objective, algorithm, failureCode }) =>
      ctx.respond(() => {
        found(trips, 'trips', tripId)
        const run: OptimizationRun = {
          id: nextId('RUN', runs.keys()), tripId, objective, algorithm, status: 'FAILED', at: ctx.nowIso(), by: ctx.state.session.userId, failureCode,
        }
        runs.set(run.id, structuredClone(run))
        ctx.log('optimization.failed', { type: 'trip', id: tripId }, { objective, algorithm, reasonCode: failureCode })
        return run
      }),
  }
}
