import { normalizeQrToken } from '@/lib/mock-db'
import type { IncomingPackage, IncomingShipment } from './receiving-api'

/**
 * Phép tính thuần của màn nhận hàng (LM-104): tìm kiện đang chờ theo mã quét, tiến độ từng lô, danh sách vừa nhận. Không quyết định
 * lỗi: mã không khớp kiện đang chờ thì màn gửi thẳng cho kho để kho trả đúng mã lỗi (mã lạ, lô của công ty khác, kiện đã nhận).
 */

export type IncomingMatch = { readonly item: IncomingPackage; readonly row: IncomingShipment }

/** Kiện đang chờ quét có mã QR này (so theo dạng chuẩn, như kho). */
export function pendingByToken(rows: readonly IncomingShipment[], token: string): IncomingMatch | undefined {
  const wanted = normalizeQrToken(token)
  for (const row of rows) {
    const item = row.pending.find((candidate) => candidate.package.qrToken === wanted)
    if (item) return { item, row }
  }
  return undefined
}

export type ShipmentProgress = { readonly received: number; readonly total: number; readonly percent: number }

export function shipmentProgress(row: IncomingShipment): ShipmentProgress {
  const received = row.received.length
  const total = received + row.pending.length
  return { received, total, percent: total === 0 ? 0 : (received / total) * 100 }
}

export type RecentReceipt = IncomingMatch & { readonly at: string }

/** Kiện đã nhận, mới nhất trước — theo giờ quét kho ghi trên kiện. */
export function recentReceipts(rows: readonly IncomingShipment[], limit: number): RecentReceipt[] {
  const all = rows.flatMap((row) =>
    row.received.flatMap((item) => (item.package.received ? [{ item, row, at: item.package.received.at }] : [])),
  )
  return all.toSorted((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit)
}

export function pendingCount(rows: readonly IncomingShipment[]): number {
  return rows.reduce((sum, row) => sum + row.pending.length, 0)
}
