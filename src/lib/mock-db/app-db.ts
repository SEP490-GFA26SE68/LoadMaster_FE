import { SEED_ANCHOR_DATE, vnDate } from './clock'
import { createMockDb } from './mock-db'
import type { MockDb } from './types'

/** Độ trễ giả của kho dùng chung, đủ để thấy trạng thái đang tải mà không làm chậm thao tác. */
const APP_LATENCY_MS = 300

let appDb: MockDb | undefined

/**
 * Kho dùng chung cho mọi `features/<tên>/<tên>-api.ts` (D-06): tạo ở lần gọi đầu, đã nạp seed, có độ trễ giả.
 * Dữ liệu mất khi tải lại trang. Seed neo theo hôm nay (giờ Việt Nam) để bảng điều khiển và danh sách chuyến luôn có "hôm nay"
 * (D-44); dưới Vitest neo `SEED_ANCHOR_DATE` cho test tất định. Test logic kho tự tạo kho riêng bằng `createMockDb`.
 */
export function getMockDb(): MockDb {
  appDb ??= createMockDb({
    latencyMs: APP_LATENCY_MS,
    today: import.meta.env.MODE === 'test' ? SEED_ANCHOR_DATE : vnDate(new Date()),
    // Mã QR của kiện đăng ký mới: ngẫu nhiên thật trong app, tất định dưới Vitest
    ...(import.meta.env.MODE === 'test' ? {} : { random: Math.random }),
  })
  return appDb
}
