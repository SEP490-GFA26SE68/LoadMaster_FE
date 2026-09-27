import { createContext, use } from 'react'
import type { OrderRow } from './orders-api'

export type OrderAction = 'edit' | 'assign' | 'unassign' | 'cancel'

/**
 * Phần thay đổi theo thời gian mà ô của bảng đơn hàng cần (quyền ghi, hàm thao tác). Hàm `cell` khai ở mức module vì TanStack Table
 * v9 dựng ô như component: dựng lại cột là gỡ menu thao tác đang mở (AGENTS mục 5, `users-table-context.ts`).
 */
export type OrdersTableContextValue = {
  readonly canEdit: boolean
  /** Chuyến còn nhận / bỏ được đơn (đang lập kế hoạch) — bỏ gán đơn ở chuyến đã sang vận hành thì kho từ chối. */
  readonly planningTripIds: ReadonlySet<string>
  readonly onAction: (action: OrderAction, row: OrderRow) => void
}

export const OrdersTableContext = createContext<OrdersTableContextValue | null>(null)

export function useOrdersTable(): OrdersTableContextValue {
  const value = use(OrdersTableContext)
  if (!value) throw new Error('Ô bảng đơn hàng phải nằm trong <OrdersTableContext>')
  return value
}
