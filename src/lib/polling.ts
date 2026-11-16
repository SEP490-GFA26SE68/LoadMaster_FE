/**
 * Nhịp đọc lại (`refetchInterval` của TanStack Query) không gõ mãi vào một máy chủ đang lỗi: mỗi lần đọc lại thất bại liên tiếp thì
 * nhịp giãn gấp đôi (tối đa `MAX_POLL_INTERVAL_MS`), tới `MAX_POLL_FAILURES` lần thì dừng hẳn. Đọc được một lần (mở lại màn, focus lại
 * cửa sổ, ghi dữ liệu làm mới khoá) là nhịp về như cũ. "Một lần thất bại" là một lần Query chuyển sang lỗi — đã qua các lượt `retry`.
 */
export const MAX_POLL_FAILURES = 5
export const MAX_POLL_INTERVAL_MS = 5 * 60_000

/** Phần trạng thái Query cần để đếm lỗi liên tiếp; `query` truyền vào là chính object Query (dùng làm khoá đếm). */
export type PolledQuery = {
  readonly state: { readonly dataUpdatedAt: number; readonly errorUpdatedAt: number; readonly errorUpdateCount: number }
}

/** Số lỗi đã có lúc lần đọc thành công gần nhất của mỗi Query — lỗi liên tiếp là phần tăng thêm từ đó. */
const errorsAtLastSuccess = new WeakMap<PolledQuery, number>()

export function consecutiveFailures(query: PolledQuery): number {
  const { dataUpdatedAt, errorUpdatedAt, errorUpdateCount } = query.state
  if (errorUpdatedAt <= dataUpdatedAt) {
    errorsAtLastSuccess.set(query, errorUpdateCount)
    return 0
  }
  return errorUpdateCount - (errorsAtLastSuccess.get(query) ?? 0)
}

/** Nhịp đọc lại cho `refetchInterval`: `intervalMs` khi máy chủ trả lời được, giãn khi lỗi liên tiếp, `false` khi dừng. */
export function pollInterval(query: PolledQuery, intervalMs: number | false | null | undefined): number | false {
  if (intervalMs === false || intervalMs === null || intervalMs === undefined) return false
  const failures = consecutiveFailures(query)
  if (failures >= MAX_POLL_FAILURES) return false
  return failures === 0 ? intervalMs : Math.min(intervalMs * 2 ** failures, Math.max(intervalMs, MAX_POLL_INTERVAL_MS))
}
