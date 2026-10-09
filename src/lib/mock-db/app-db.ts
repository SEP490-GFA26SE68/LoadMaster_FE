import { clockSpeedFrom, SEED_ANCHOR_DATE, vnDate } from './clock'
import { createMockDbParts, type MockDbParts } from './mock-db'
import { createTabSync, withTabSync, type TabSync } from './tab-sync'
import type { MockDb } from './types'

/** Độ trễ giả của kho dùng chung, đủ để thấy trạng thái đang tải mà không làm chậm thao tác. */
const APP_LATENCY_MS = 300

/** Tên kênh giữa các tab; đổi số khi dạng thông điệp của `tab-sync.ts` đổi. */
const TAB_CHANNEL = 'loadmaster-mock-db-v1'

let appDb: MockDb | undefined
const remoteListeners = new Set<() => void>()

/**
 * Kho dùng chung cho mọi `features/<tên>/<tên>-api.ts` (D-06): tạo ở lần gọi đầu, đã nạp seed, có độ trễ giả.
 * Dữ liệu mất khi tải lại trang. Seed neo theo hôm nay (giờ Việt Nam) để bảng điều khiển và danh sách chuyến luôn có "hôm nay"
 * (D-44); dưới Vitest neo `SEED_ANCHOR_DATE` cho test tất định. Test logic kho tự tạo kho riêng bằng `createMockDb`.
 *
 * Đồng hồ của kho (FE-6-08, D-85): mở trang kèm `?toc-do=<n>` thì chạy nhanh n lần kể từ lúc tạo kho, suốt đời của tab — tham số chỉ
 * đọc một lần ở đây, đổi route trong app không đổi tốc độ. Không có tham số, và dưới Vitest, đồng hồ là giờ máy.
 *
 * Nhiều tab (FE-BL-06): các tab cùng trình duyệt dùng chung dữ liệu qua `tab-sync.ts` — tab mở sau lấy trạng thái của tab đang mở (và
 * cả đồng hồ của nó, nên `?toc-do` của tab sau bị bỏ qua), phiên đăng nhập vẫn riêng từng tab. Chỉ một tab thì không có gì thay đổi.
 */
export function getMockDb(): MockDb {
  if (appDb === undefined) {
    const parts = createMockDbParts({
      latencyMs: APP_LATENCY_MS,
      today: import.meta.env.MODE === 'test' ? SEED_ANCHOR_DATE : vnDate(new Date()),
      speed: import.meta.env.MODE === 'test' || typeof window === 'undefined' ? 1 : clockSpeedFrom(window.location.search),
      // Mã QR của kiện đăng ký mới: ngẫu nhiên thật trong app, tất định dưới Vitest
      ...(import.meta.env.MODE === 'test' ? {} : { random: Math.random }),
    })
    const sync = openTabSync(parts)
    appDb = sync === null ? parts.db : withTabSync(parts.db, sync)
  }
  return appDb
}

/**
 * Đăng ký nghe việc kho vừa được thay bằng dữ liệu của tab khác (đã gộp thành một thông báo) để làm mới màn hình. Không có đồng bộ
 * (một tab, Vitest, trình duyệt không có `BroadcastChannel`) thì không bao giờ được gọi. Trả hàm huỷ đăng ký.
 */
export function onRemoteDbChange(listener: () => void): () => void {
  remoteListeners.add(listener)
  return () => void remoteListeners.delete(listener)
}

/**
 * Mở kênh giữa các tab. Chỉ trong trình duyệt: Node cũng có `BroadcastChannel`, và dưới Vitest nó nối các worker với nhau — test không
 * được nói chuyện với nhau. Không có kênh thì không đồng bộ, không lỗi.
 */
function openTabSync({ state, clock }: MockDbParts): TabSync | null {
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  try {
    // Chỉ các tab cùng trình duyệt và cùng nguồn gốc thấy nhau: đây không thay được backend, máy khác không thấy gì
    const sync = createTabSync({ state, clock, channel: new BroadcastChannel(TAB_CHANNEL) })
    sync.onRemoteChange(() => {
      for (const listener of remoteListeners) listener()
    })
    return sync
  } catch {
    return null
  }
}
