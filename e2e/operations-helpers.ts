import type { Locator, Page } from '@playwright/test'
import { MOCK_DB } from './spec-flow-helpers'

/**
 * Bước vận hành ghi thẳng vào kho của trang (FE-6-02 → FE-6-06), cho kịch bản không kiểm chính thao tác đó: soạn, xếp, dỡ hàng trăm
 * kiện bằng hộp đối chiếu thì mỗi kiện một lượt gõ mã. Mọi kiện vẫn đi qua hàm đối chiếu của kho bằng mã QR của nó (`src/test/trip-flow.ts`)
 * dưới phiên đang đăng nhập — kho không có lối ghi nào không đối chiếu. Màn đang mở **không** tự đọc lại: rời màn rồi vào lại
 * (`navigateInApp`), hoặc làm bước kế tiếp bằng giao diện.
 */
const FLOW = '/src/test/trip-flow.ts'

type Flow = typeof import('@/test/trip-flow')
type Db = typeof import('@/lib/mock-db')

/** Kiện của phương án kho đang làm theo, theo thứ tự xếp. */
export function loadingOrderOf(page: Page, tripId: string): Promise<string[]> {
  return page.evaluate(async ({ db, flow, tripId }) => {
    const { getMockDb } = (await import(db)) as Db
    return ((await import(flow)) as Flow).loadingOrder(getMockDb(), tripId)
  }, { db: MOCK_DB, flow: FLOW, tripId })
}

/** Kho soạn mọi kiện chưa soạn của chuyến đang ở kho, trừ `except`. */
export function stageInStore(page: Page, tripId: string, except: readonly string[] = []): Promise<void> {
  return page.evaluate(async ({ db, flow, tripId, except }) => {
    const { getMockDb } = (await import(db)) as Db
    await ((await import(flow)) as Flow).stageAll(getMockDb(), tripId, except)
  }, { db: MOCK_DB, flow: FLOW, tripId, except: [...except] })
}

/** Kho xếp các kiện chưa có kết quả theo thứ tự xếp, dừng trước kiện `until` (vắng: xếp hết; không tự hoàn tất xếp). */
export function loadInStore(page: Page, tripId: string, until?: string): Promise<void> {
  return page.evaluate(async ({ db, flow, tripId, until }) => {
    const { getMockDb } = (await import(db)) as Db
    await ((await import(flow)) as Flow).loadAll(getMockDb(), tripId, until)
  }, { db: MOCK_DB, flow: FLOW, tripId, until })
}

/** Chuyến đã duyệt đi tới "Xếp xong — chờ xuất phát": bắt đầu, soạn đủ, xếp đủ, hoàn tất xếp. */
export function loadTripInStore(page: Page, tripId: string): Promise<void> {
  return page.evaluate(async ({ db, flow, tripId }) => {
    const { getMockDb } = (await import(db)) as Db
    await ((await import(flow)) as Flow).loadTrip(getMockDb(), tripId)
  }, { db: MOCK_DB, flow: FLOW, tripId })
}

/** Tài xế đến điểm `stopNumber` rồi dỡ mọi kiện của điểm đó, trừ `except`; không hoàn tất điểm. */
export function unloadStopInStore(page: Page, tripId: string, stopNumber: number, except: readonly string[] = []): Promise<void> {
  return page.evaluate(async ({ db, flow, tripId, stopNumber, except }) => {
    const { getMockDb } = (await import(db)) as Db
    await ((await import(flow)) as Flow).unloadStop(getMockDb(), tripId, stopNumber, except)
  }, { db: MOCK_DB, flow: FLOW, tripId, stopNumber, except: [...except] })
}

/**
 * Gõ một mã vào hộp đối chiếu (`PackageVerify`) đang mở và gửi — mức 2 của đối chiếu; máy chạy test không có `BarcodeDetector` nên hộp
 * mở sẵn ở tab "Gõ mã". Nhãn ô nhập theo ngôn ngữ đang chọn.
 */
export async function typeVerifyCode(dialog: Locator, code: string, label: string | RegExp = 'Mã QR hoặc mã bên gửi') {
  const input = dialog.getByRole('textbox', { name: label })
  await input.fill(code)
  await input.press('Enter')
}
