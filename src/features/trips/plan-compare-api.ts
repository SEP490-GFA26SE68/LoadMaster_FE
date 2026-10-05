/**
 * Hàm → endpoint backend (FE-0-09, issue BE S5b-07); nối backend chỉ thay thân hàm.
 *   fetchRunComparison → GET /api/v1/load-plans/compare · mức hạn các điểm: GET /api/trips/{id}/eta
 */
import { getMockDb, type OptimizationRun, type Revision, type Trip, type TripEta } from '@/lib/mock-db'

/**
 * Dữ liệu của màn so sánh ba phương án ứng viên của một lần chạy (FE-5b-06). `run` là `null` khi chuyến không có lần chạy mang mã đó.
 * `revisions` là mọi revision của chuyến — thẻ cần biết phương án nào đã có bản duyệt. `eta` là giờ đến dự kiến và mức hạn của từng điểm
 * (`null` khi chuyến chưa tối ưu tuyến): ba phương án cùng một tuyến nên màn hiện một lần.
 */
export type RunComparison = {
  readonly trip: Trip
  readonly run: OptimizationRun | null
  readonly revisions: readonly Revision[]
  readonly eta: TripEta | null
  /** Họ tên người chạy; `null` khi kho không biết (lần chạy không có phiên, tài khoản đã xoá). */
  readonly runnerName: string | null
}

// GET /api/v1/load-plans/compare · GET /api/trips/{id}/eta
export async function fetchRunComparison(tripId: string, runId: string): Promise<RunComparison> {
  const db = getMockDb()
  const [trip, runs, revisions, eta, users] = await Promise.all([
    db.getTrip(tripId), db.listOptimizationRuns(tripId), db.listRevisions(tripId), db.getTripEta(tripId), db.listUsers(),
  ])
  const run = runs.find((item) => item.id === runId) ?? null
  return { trip, run, revisions, eta, runnerName: run?.by ? (users.find((user) => user.id === run.by)?.fullName ?? null) : null }
}
