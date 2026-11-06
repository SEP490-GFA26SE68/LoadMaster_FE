import { useMemo } from 'react'
import { describeLogRow, type AuditDirectory, type CanOpen } from '@/features/admin/audit-log'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCan } from '@/features/auth/useCan'
import { tripLinkable } from '@/features/trips/trips-capabilities'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { AuditEvent } from '@/lib/mock-db'
import { mockBellRow, type BellRow } from './bell-row'
import { driverNotice, driverNoticeEvent, NOTIFICATION_WINDOW_DAYS, operationHrefs, type NotificationViewer } from './notifications'
import { serverNotifications, serverScreens } from './notifications-api'
import { markNotificationsRead, useReadNotifications } from './read-state'
import { serverBellRows } from './server-notifications'
import { useMarkServerNotificationsRead, useNotificationsQuery, useServerNotificationsQuery } from './useNotificationsQuery'

/** Những gì `describeLogRow` cần để đọc một sự kiện. */
type RowContext = { readonly directory: AuditDirectory; readonly t: TFunction; readonly format: Formatter; readonly can: CanOpen }

/**
 * Dòng của chuông từ kho mẫu là dòng nhật ký (`describeLogRow`) cộng hai việc riêng của chuông: thông báo về chuyến của tài xế nói bằng
 * câu của tài xế và chỉ kèm chi tiết họ cần (`driverNotice`); kho và tài xế mở chuyến ở màn của vai trò (`operation`, từ `operationHrefs`),
 * vì họ không mở được trang chuyến mà nhật ký dẫn tới.
 */
function notificationRow(event: AuditEvent, viewer: NotificationViewer, operation: string | null, { directory, t, format, can }: RowContext): BellRow {
  const notice = viewer.role === 'driver' ? driverNotice(event, viewer.id) : null
  const row = describeLogRow(notice === null ? event : driverNoticeEvent(event, notice), directory, t, format, can)
  return mockBellRow({
    ...row,
    action: notice === null ? row.action : t(`notifications.driver.${notice}`),
    target: { ...row.target, href: row.target.href ?? operation },
  })
}

/** Danh sách của chuông, không phụ thuộc nguồn: dòng đã dịch, đã đọc chưa, đánh dấu đã đọc, trạng thái tải. */
export type BellFeed = {
  readonly rows: readonly BellRow[]
  readonly isUnread: (id: string) => boolean
  readonly markRead: (ids: readonly string[]) => void
  readonly isPending: boolean
  readonly isError: boolean
  readonly refetch: () => void
  /** Lần đọc gần nhất (ms) — "hôm nay" của danh sách. */
  readonly updatedAt: number
  readonly windowDays: number
}

/**
 * Nguồn của chuông: máy chủ khi nhóm `notifications` nối backend (đã đọc giữ ở máy chủ), không thì nhật ký kho mẫu (đã đọc giữ trong tab,
 * `read-state.ts`). Cả hai đọc lại theo `refetchInterval` của Query.
 */
export function useBellFeed(): BellFeed {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const { user } = useAuth()
  const server = serverNotifications()
  const mockQuery = useNotificationsQuery()
  const serverQuery = useServerNotificationsQuery()
  const markServer = useMarkServerNotificationsRead()
  const read = useReadNotifications(user?.id ?? '')
  const viewerId = user?.id
  const role = user?.role
  const mockFeed = mockQuery.data
  const serverFeed = serverQuery.data

  const rows = useMemo(() => {
    if (viewerId === undefined || role === undefined) return []
    if (server) {
      if (!serverFeed) return []
      const screens = serverScreens()
      const links = {
        trips: tripLinkable(true) && can('trips.view'),
        warehouse: screens.warehouse,
        driver: screens.driver,
        billing: screens.billing && can('billing.manage'),
      }
      return serverBellRows(serverFeed, role, links, t, format)
    }
    if (!mockFeed) return []
    const viewer = { id: viewerId, role }
    const hrefs = operationHrefs(mockFeed.events, viewer)
    const context = { directory: mockFeed.directory, t, format, can }
    return mockFeed.events.map((event, index) => notificationRow(event, viewer, hrefs[index] ?? null, context))
  }, [server, serverFeed, mockFeed, t, format, can, viewerId, role])

  if (server) {
    const readOnServer = new Set((serverFeed?.items ?? []).filter((item) => item.read).map((item) => item.id))
    return {
      rows,
      isUnread: (id) => !readOnServer.has(id),
      markRead: (ids) => {
        const unread = ids.filter((id) => !readOnServer.has(id))
        if (unread.length > 0) markServer.mutate(unread)
      },
      isPending: serverQuery.isPending,
      isError: serverQuery.isError,
      refetch: () => void serverQuery.refetch(),
      updatedAt: serverQuery.dataUpdatedAt,
      windowDays: serverFeed?.windowDays ?? NOTIFICATION_WINDOW_DAYS,
    }
  }
  return {
    rows,
    isUnread: (id) => !read.has(id),
    markRead: (ids) => {
      if (viewerId !== undefined) markNotificationsRead(viewerId, ids)
    },
    isPending: mockQuery.isPending,
    isError: mockQuery.isError,
    refetch: () => void mockQuery.refetch(),
    updatedAt: mockQuery.dataUpdatedAt,
    windowDays: NOTIFICATION_WINDOW_DAYS,
  }
}
