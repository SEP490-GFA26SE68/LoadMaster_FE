/**
 * Đồng hồ của hộp thoại chạy tối ưu máy chủ. Mỗi lần đọc trạng thái job, đồng hồ neo lại theo `elapsedMs` của máy chủ (máy chủ không trả
 * thì giữ mốc cũ, lần đầu tính từ lúc hộp thoại thấy job chạy), giữa hai lần đọc thì tự chạy theo giờ của trình duyệt. Không bao giờ giật
 * lùi: neo mới thấp hơn chỗ đồng hồ đang đứng thì đồng hồ đứng đó. Thuần — giờ hiện tại là tham số.
 */
export type ClockAnchor = {
  /** Thời gian đã chạy tại `atMs`, mili giây. */
  readonly baseMs: number
  /** Giờ của trình duyệt lúc neo (`Date.now()`). */
  readonly atMs: number
}

/** Thời gian đã chạy theo một mốc neo, tại giờ `nowMs`. */
export function clockElapsed(anchor: ClockAnchor, nowMs: number): number {
  return anchor.baseMs + Math.max(0, nowMs - anchor.atMs)
}

/** Mốc neo mới sau một lần đọc: theo máy chủ khi có số, không thì giữ mốc cũ; không bao giờ lùi sau chỗ mốc cũ đang chỉ. */
export function anchorClock(previous: ClockAnchor | null, serverElapsedMs: number | null, nowMs: number): ClockAnchor {
  const projected = previous === null ? 0 : clockElapsed(previous, nowMs)
  if (serverElapsedMs === null) return previous ?? { baseMs: 0, atMs: nowMs }
  return { baseMs: Math.max(serverElapsedMs, projected), atMs: nowMs }
}

/** `mm:ss` (phút có thể quá 59): 83.400 ms → "01:23". Làm tròn xuống tới giây. */
export function formatClock(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** Phần giới hạn thời gian đã dùng: 0–1, dừng ở đầy; `over` khi đã tới giới hạn. `null` khi không biết giới hạn. */
export function timeShare(elapsedMs: number, limitSec: number | null | undefined): { readonly fraction: number; readonly over: boolean } | null {
  if (limitSec === null || limitSec === undefined || !(limitSec > 0)) return null
  const ratio = elapsedMs / (limitSec * 1000)
  return { fraction: Math.min(1, Math.max(0, ratio)), over: ratio >= 1 }
}
