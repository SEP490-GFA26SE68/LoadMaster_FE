import { roundKg } from '@/domain/geometry'
import { matchesQuery, normalizeSearchText } from '@/lib/list-filter'
import type { DeliveryStop, OrderStatus } from '@/lib/mock-db'
import type { OrderPackage, OrderRow } from './orders-api'

/**
 * Phép tính thuần của màn Đơn hàng (LM-104): lọc danh sách, nhóm kiện theo loại cho ô chọn kiện, gợi ý điểm giao trùng tên khách.
 */

/** Giá trị tham số `trang-thai` trên URL, tiếng Việt không dấu (D-52). */
export const ORDER_STATUS_SLUGS: Readonly<Record<OrderStatus, string>> = {
  pending: 'cho-gan',
  assigned: 'da-gan',
  delivered: 'da-giao',
  cancelled: 'da-huy',
}

export const ORDER_STATUS_ORDER: readonly OrderStatus[] = ['pending', 'assigned', 'delivered', 'cancelled']

export function statusFromSlug(slug: string): OrderStatus | null {
  return ORDER_STATUS_ORDER.find((status) => ORDER_STATUS_SLUGS[status] === slug) ?? null
}

export function filterOrderRows(rows: readonly OrderRow[], query: string, statusSlug: string): OrderRow[] {
  const status = statusFromSlug(statusSlug)
  return rows.filter((row) => (status === null || row.order.status === status)
    && matchesQuery([row.order.id, row.order.customerName, row.order.deliveryAddress, row.order.contactName, row.trip?.id, row.trip?.name], query))
}

export type PackageGroup = { readonly typeId: string; readonly name: string; readonly items: readonly OrderPackage[] }

/** Kiện chọn được, nhóm theo loại kiện (thứ tự xuất hiện), trong nhóm theo mã. */
export function groupByType(packages: readonly OrderPackage[], unknownName: string): PackageGroup[] {
  const groups = new Map<string, OrderPackage[]>()
  for (const item of packages) groups.set(item.package.packageTypeId, [...(groups.get(item.package.packageTypeId) ?? []), item])
  return [...groups].map(([typeId, items]) => ({
    typeId,
    name: items[0]?.type?.name ?? unknownName,
    items: items.toSorted((a, b) => a.package.id.localeCompare(b.package.id)),
  }))
}

/** Tổng khối lượng của các kiện đã chọn, theo khối lượng loại kiện. */
export function selectedWeightKg(packages: readonly OrderPackage[], selectedIds: readonly string[]): number {
  const chosen = new Set(selectedIds)
  return roundKg(packages.reduce((sum, item) => sum + (chosen.has(item.package.id) ? (item.type?.weightKg ?? 0) : 0), 0))
}

/** Điểm giao có tên trùng tên khách hàng (bỏ dấu, không phân biệt hoa thường) — chọn sẵn khi gán đơn. */
export function matchingStopId(customerName: string, stops: readonly DeliveryStop[]): string | undefined {
  const wanted = normalizeSearchText(customerName)
  return stops.find((stop) => normalizeSearchText(stop.name) === wanted)?.id
}
