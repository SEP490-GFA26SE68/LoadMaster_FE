import { Bell, Check } from 'lucide-react'
import { useMemo } from 'react'
import { NavRailButton } from '@/components/NavRailButton'
import { Badge } from '@/components/ui/Badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Spinner } from '@/components/ui/Spinner'
import { describeLogRow } from '@/features/admin/audit-log'
import { useAuth } from '@/features/auth/AuthProvider'
import { useFormat, useT } from '@/lib/i18n'
import { hasNotifications, NOTIFICATION_WINDOW_DAYS } from './notifications'
import { NotificationItem } from './NotificationItem'
import { markNotificationsRead, useReadNotifications } from './read-state'
import { useNotificationsQuery } from './useNotificationsQuery'

/**
 * Chuông thông báo trên thanh điều hướng (LM-098, D-55; V2.3 MenuToanCuc): chấm hổ phách trên icon khi có tin chưa đọc — số nằm trong
 * nhãn đọc của nút và chip cạnh tiêu đề danh sách. Danh sách (nền trắng đặc, không kính) là sự kiện nhật ký liên quan vai trò — mới
 * nhất trước, 7 ngày, tối đa 20, không gồm việc chính mình làm. Mở chuông là đọc lại kho; "Đánh dấu đã đọc" giữ trong phiên. Vai trò
 * không có loại thông báo nào (kho, tài xế) thì không có chuông: không hiện nút không làm gì (D-20).
 */
export function NotificationBell() {
  const t = useT()
  const format = useFormat()
  const { user } = useAuth()
  const query = useNotificationsQuery()
  const read = useReadNotifications(user?.id ?? '')
  const feed = query.data
  const rows = useMemo(
    () => (feed ? feed.events.map((event) => describeLogRow(event, feed.directory, t, format)) : []),
    [feed, t, format],
  )
  if (!user || !hasNotifications(user.role)) return null

  const userId = user.id
  const unreadCount = rows.filter((row) => !read.has(row.id)).length
  // "Hôm nay" theo lần đọc kho gần nhất, không theo đồng hồ lúc vẽ
  const today = format.date(new Date(query.dataUpdatedAt))
  const whenOf = (at: string) =>
    format.date(at) === today ? format.time(at) : t('notifications.dateTime', { time: format.time(at), date: format.dayMonth(at) })

  function handleOpenChange(open: boolean) {
    if (open) void query.refetch()
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <NavRailButton
          icon={Bell}
          label={t('notifications.label')}
          aria-label={unreadCount > 0 ? t('notifications.labelUnread', { count: unreadCount }) : undefined}
          badge={
            unreadCount > 0 ? (
              <span
                aria-hidden
                data-unread-dot
                className="absolute top-1.75 right-2 size-1.75 rounded-full bg-amber-500 shadow-[0_0_0_2px_var(--sky-end)]"
              />
            ) : null
          }
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="flex w-102 max-w-[calc(100vw-32px)] flex-col p-0">
        <div className="flex min-h-13 items-center gap-2.5 border-b border-line-soft py-2 pr-2.5 pl-4.5">
          <DropdownMenuLabel className="p-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">
            {t('notifications.title')}
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <>
              <Badge shape="tag" tone="cyan">{t('notifications.unreadCount', { count: unreadCount })}</Badge>
              <DropdownMenuItem
                className="ml-auto h-8 gap-1.5 px-2.5 text-small font-semibold text-cyan-700 [&_svg]:size-3.75 [&_svg]:text-current"
                onSelect={(event) => {
                  // Giữ danh sách mở để thấy mọi dòng đã chuyển sang đã đọc
                  event.preventDefault()
                  markNotificationsRead(userId, rows.map((row) => row.id))
                }}
              >
                <Check strokeWidth={2} aria-hidden />
                {t('notifications.markAllRead')}
              </DropdownMenuItem>
            </>
          ) : null}
        </div>

        <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-1.5">
          {query.isPending ? (
            <p className="flex items-center gap-2 px-3 py-6 text-body text-ink-2">
              <Spinner />
              {t('notifications.loading')}
            </p>
          ) : query.isError ? (
            <>
              <p className="px-3 pt-4 pb-2 text-body text-ink-2">{t('notifications.error')}</p>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  void query.refetch()
                }}
              >
                {t('notifications.retry')}
              </DropdownMenuItem>
            </>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-body text-ink-2">{t('notifications.empty', { days: NOTIFICATION_WINDOW_DAYS })}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {rows.map((row) => (
                <NotificationItem
                  key={row.id}
                  row={row}
                  unread={!read.has(row.id)}
                  when={whenOf(row.at)}
                  onSelect={() => markNotificationsRead(userId, [row.id])}
                />
              ))}
            </div>
          )}
        </div>

        <p className="border-t border-line-soft bg-n-25 px-4.5 pt-2.5 pb-3 text-fine text-ink-3">
          {t('notifications.scope', { days: NOTIFICATION_WINDOW_DAYS })}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
