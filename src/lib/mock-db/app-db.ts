import { clockSpeedFrom, SEED_ANCHOR_DATE, vnDate } from './clock'
import { createMockDb } from './mock-db'
import type { MockDb } from './types'

/** Độ trễ giả của kho dùng chung, đủ để thấy trạng thái đang tải mà không làm chậm thao tác. */
const APP_LATENCY_MS = 300

let appDb: MockDb | undefined

/**
 * Kho dùng chung cho mọi `features/<tên>/<tên>-api.ts` (D-06): tạo ở lần gọi đầu, đã nạp seed, có độ trễ giả.
 * Dữ liệu mất khi tải lại trang. Seed neo theo hôm nay (giờ Việt Nam) để bảng điều khiển và danh sách chuyến luôn có "hôm nay"
 * (D-44); dưới Vitest neo `SEED_ANCHOR_DATE` cho test tất định. Test logic kho tự tạo kho riêng bằng `createMockDb`.
 *
 * Đồng hồ của kho (FE-6-08, D-85): mở trang kèm `?toc-do=<n>` thì chạy nhanh n lần kể từ lúc tạo kho, suốt đời của tab — tham số chỉ
 * đọc một lần ở đây, đổi route trong app không đổi tốc độ. Không có tham số, và dưới Vitest, đồng hồ là giờ máy.
 */
export function getMockDb(): MockDb {
  appDb ??= createMockDb({
    latencyMs: APP_LATENCY_MS,
    today: import.meta.env.MODE === 'test' ? SEED_ANCHOR_DATE : vnDate(new Date()),
    speed: import.meta.env.MODE === 'test' || typeof window === 'undefined' ? 1 : clockSpeedFrom(window.location.search),
    // Mã QR của kiện đăng ký mới: ngẫu nhiên thật trong app, tất định dưới Vitest
    ...(import.meta.env.MODE === 'test' ? {} : { random: Math.random }),
  })
  return appDb
}
