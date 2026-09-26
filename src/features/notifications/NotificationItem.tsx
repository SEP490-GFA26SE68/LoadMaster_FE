import { Ban, Flag, PackageCheck, PackageX, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { KpiTone } from '@/components/KpiTile'
import { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import type { AuditLogRow } from '@/features/admin/audit-log'
import { auditActionLook } from '@/features/admin/audit-look'
import type { AuditAction } from '@/lib/mock-db'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Ô icon 32px (V2.3 `.nt .ic`): nền bậc 50, icon bậc 700, viền trong bậc 200 của cùng tông. */
const TILE: Record<KpiTone, string> = {
  blue: 'bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_var(--cyan-200)]',
  green: 'bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_var(--green-200)]',
  amber: 'bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_var(--amber-200)]',
  violet: 'bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_var(--violet-200)]',
  slate: 'bg-n-100 text-n-700 shadow-[inset_0_0_0_1px_var(--n-200)]',
}

/**
 * Sự kiện vận hành mà chuông báo cho điều phối và quản lý có icon riêng, rõ hơn icon nhóm của nhật ký (MenuToanCuc V2.3). "Xếp xong"
 * tông tím: V2.3 dành tím cho "đã xếp xong", như chip trạng thái. Sự kiện khác (tài khoản của quản trị viên) theo icon và tint của
 * bảng nhật ký.
 */
const OPERATION_LOOK: Partial<Record<AuditAction, { icon: LucideIcon; tone: KpiTone }>> = {
  'loading.completed': { icon: PackageCheck, tone: 'violet' },
  'loading.missing': { icon: PackageX, tone: 'amber' },
  'delivery.issue': { icon: TriangleAlert, tone: 'amber' },
  'delivery.completed': { icon: Flag, tone: 'green' },
  'trip.cancelled': { icon: Ban, tone: 'amber' },
}

const ITEM = cn(
  'relative grid h-auto grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-md py-2.75 pr-3 pl-5.5 whitespace-normal',
  '[&_svg]:size-4 [&_svg]:text-current',
)

/**
 * Một thông báo (LM-098, V2.3): ô icon theo loại sự kiện · nhãn hành động của nhật ký và giờ · đối tượng (tên hiện tại, mã mono) ·
 * người làm và chi tiết của sự kiện — chỉ những gì nhật ký ghi, không thêm số nào. Chưa đọc thì nền `--cyan-50`, chấm cyan, chữ đậm
 * và chữ ẩn "Chưa đọc" — không chỉ dựa vào màu. Bấm (hoặc Enter) mở đối tượng và đánh dấu đã đọc; đối tượng không còn trang để mở
 * (tài khoản đã xoá, email lạ khi đăng nhập sai) thì chỉ đánh dấu đã đọc.
 */
export function NotificationItem({ row, unread, when, onSelect }: {
  row: AuditLogRow
  unread: boolean
  /** Giờ đã format: "14:30", hoặc kèm ngày nếu không phải hôm nay. */
  when: string
  onSelect: () => void
}) {
  const t = useT()
  const { icon: Icon, tone } = OPERATION_LOOK[row.actionCode] ?? auditActionLook(row.actionCode)
  const meta = [row.actor, row.details].filter((part) => part !== '').join(' · ')
  const body = (
    <>
      {unread ? (
        <span
          aria-hidden
          className="absolute top-4.5 left-2.25 size-1.75 rounded-full bg-cyan-500 shadow-[0_0_0_3px_color-mix(in_srgb,var(--cyan-500)_16%,transparent)]"
        />
      ) : null}
      <span aria-hidden className={cn('grid size-8 place-items-center rounded-md', TILE[tone])}>
        <Icon strokeWidth={1.5} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-2.5">
          <span data-part="action" className={cn('min-w-0 text-body text-ink-strong', unread ? 'font-semibold' : 'font-medium')}>
            {row.action}
          </span>
          <time dateTime={row.at} className="ml-auto flex-none text-fine text-ink-3 tabular-nums">{when}</time>
        </span>
        <span data-part="target" className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-small text-ink-2">
          {row.target.label ? (
            <>
              <span className="min-w-0 truncate">{row.target.label}</span>
              <span className="flex-none text-ink-3"> · </span>
            </>
          ) : null}
          <span className="flex-none font-mono text-caption text-ink-3">{row.target.id}</span>
        </span>
        {meta ? <span data-part="meta" className="mt-px truncate text-fine text-ink-3">{meta}</span> : null}
      </span>
      {unread ? <span className="sr-only">{t('notifications.unread')}</span> : null}
    </>
  )
  const className = cn(ITEM, unread && 'bg-cyan-50/60 data-[highlighted]:bg-cyan-50')
  if (!row.target.href) {
    return <DropdownMenuItem className={className} onSelect={onSelect}>{body}</DropdownMenuItem>
  }
  return (
    <DropdownMenuItem asChild className={className} onSelect={onSelect}>
      <Link to={row.target.href}>{body}</Link>
    </DropdownMenuItem>
  )
}
