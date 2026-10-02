import type { SeedData } from './seed'

/** ISO 8601 UTC có giờ (`…T…Z`) — mốc thời gian của seed. Ngày chạy `YYYY-MM-DD` không khớp nên không bị dời. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

/** Khoảng cách tối thiểu giữa sự kiện seed muộn nhất và "bây giờ". */
const MARGIN_MS = 5 * 60 * 1000

function shiftValue(value: unknown, shiftMs: number): unknown {
  if (typeof value === 'string') return TIMESTAMP.test(value) ? new Date(Date.parse(value) - shiftMs).toISOString() : value
  if (Array.isArray(value)) return value.map((item) => shiftValue(item, shiftMs))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shiftValue(item, shiftMs)]))
  }
  return value
}

/**
 * Seed neo theo ngày (D-44) đặt các việc "hôm nay" ở giờ cố định (duyệt 09:00, lập kế hoạch 11:40…). Mở app sớm hơn các giờ đó thì
 * lịch sử có sự kiện ở tương lai: "Đã duyệt lúc 09:00" khi mới 7 giờ, và sự kiện mới lại nằm dưới sự kiện seed trong nhật ký.
 * Khi `now` sớm hơn sự kiện seed muộn nhất, mọi mốc giờ của seed lùi cùng một khoảng để sự kiện muộn nhất cách `now` 5 phút — thứ tự
 * và khoảng cách giữa các việc giữ nguyên, ngày chạy của chuyến không đổi. Hạn của yêu cầu giao là mốc ở tương lai, không phải việc đã
 * xảy ra: giữ nguyên giờ đã hẹn. Test neo ngày cũ nên không bị dời.
 */
export function shiftSeedTimes(seed: SeedData, now: Date): SeedData {
  const latest = seed.events.at(-1)?.at
  if (latest === undefined) return seed
  const shiftMs = Date.parse(latest) + MARGIN_MS - now.getTime()
  if (shiftMs <= 0) return seed
  const shifted = shiftValue(seed, shiftMs) as SeedData
  const deadlineOf = new Map(seed.requirements.map((requirement) => [requirement.id, requirement.deadline]))
  return { ...shifted, requirements: shifted.requirements.map((requirement) => ({ ...requirement, deadline: deadlineOf.get(requirement.id) ?? requirement.deadline })) }
}
