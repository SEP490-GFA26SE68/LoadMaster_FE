import { nextId, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { DEFAULT_RUN_ALGORITHM, type OptimizationRun } from './source-types'

type RunMethods = Pick<Review1Db, 'listOptimizationRuns' | 'recordFailedRun'>

/**
 * Lịch sử lần chạy tối ưu của chuyến (LM-104). Lần chạy ra kết quả do `saveOptimizationRun` / `addRevision` ghi cùng revision
 * (`db-revisions.ts`); ở đây là đọc lịch sử và ghi lần chạy không ra kết quả. Lần chạy thuộc công ty của chuyến (D-64).
 */
export function runMethods(ctx: DbContext): RunMethods {
  const { runs } = ctx.state
  return {
    listOptimizationRuns: (tripId) =>
      ctx.respond(() => {
        ctx.scope.trips.read(tripId)
        return [...runs.values()].filter((run) => run.tripId === tripId)
      }),
    recordFailedRun: (tripId, { failureCode, algorithm = DEFAULT_RUN_ALGORITHM }) =>
      ctx.respond(() => {
        ctx.scope.trips.own(tripId)
        const run: OptimizationRun = {
          id: nextId('RUN', runs.keys()), tripId, algorithm, status: 'FAILED', at: ctx.nowIso(), by: ctx.state.session.userId, failureCode,
        }
        runs.set(run.id, structuredClone(run))
        ctx.log('optimization.failed', { type: 'trip', id: tripId }, { algorithm, reasonCode: failureCode })
        return run
      }),
  }
}
