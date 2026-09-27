/**
 * Phương án đã chờ duyệt bao lâu (thẻ hàng đợi `/duyet`, LM-104): dưới 1 phút là "vừa gửi", rồi phút, giờ, ngày — làm tròn xuống.
 * Mốc tương lai (đồng hồ máy lệch) coi như vừa gửi.
 */
export type WaitingAge = { readonly unit: 'justNow' } | { readonly unit: 'minutes' | 'hours' | 'days'; readonly count: number }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function waitingAge(submittedAt: string, now: Date): WaitingAge {
  const elapsed = now.getTime() - Date.parse(submittedAt)
  if (!(elapsed >= MINUTE)) return { unit: 'justNow' }
  if (elapsed < HOUR) return { unit: 'minutes', count: Math.floor(elapsed / MINUTE) }
  if (elapsed < DAY) return { unit: 'hours', count: Math.floor(elapsed / HOUR) }
  return { unit: 'days', count: Math.floor(elapsed / DAY) }
}
