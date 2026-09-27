import { Ban, Link2, Link2Off, MoreHorizontal, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { OrderRow } from './orders-api'
import { useOrdersTable } from './orders-table-context'

/**
 * Menu thao tác ở cuối dòng đơn hàng (LM-104): Sửa, Gán vào chuyến, Bỏ gán, Huỷ. Thao tác kho sẽ từ chối (đơn không còn chờ gán, chuyến
 * đã sang vận hành) hiện mờ kèm lý do ngay dưới nhãn (AGENTS mục 5), không để bấm rồi mới báo lỗi. Đơn đã giao / đã huỷ không có menu.
 */
export function OrderRowMenu({ row }: { row: OrderRow }) {
  const t = useT()
  const { planningTripIds, onAction } = useOrdersTable()
  const { status } = row.order
  if (status === 'delivered' || status === 'cancelled') return null
  const pending = status === 'pending'
  const onlyPending = pending ? null : t('orders.menu.onlyPending')
  const unassignBlock = row.trip && planningTripIds.has(row.trip.id) ? null : t('orders.menu.tripLocked')

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('orders.menu.open', { id: row.order.id })}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <MenuAction icon={<Pencil strokeWidth={1.5} aria-hidden />} label={t('orders.menu.edit')} block={onlyPending} onSelect={() => onAction('edit', row)} />
        {pending ? (
          <MenuAction icon={<Link2 strokeWidth={1.5} aria-hidden />} label={t('orders.menu.assign')} block={null} onSelect={() => onAction('assign', row)} />
        ) : (
          <MenuAction icon={<Link2Off strokeWidth={1.5} aria-hidden />} label={t('orders.menu.unassign')} block={unassignBlock} onSelect={() => onAction('unassign', row)} />
        )}
        <DropdownMenuSeparator />
        <MenuAction icon={<Ban strokeWidth={1.5} aria-hidden />} label={t('orders.menu.cancel')} block={onlyPending} danger onSelect={() => onAction('cancel', row)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuAction({ icon, label, block, danger = false, onSelect }: {
  icon: ReactNode
  label: string
  block: string | null
  danger?: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem
      disabled={block !== null}
      onSelect={onSelect}
      tone={danger && block === null ? 'danger' : undefined}
      className={cn(block !== null && 'h-auto items-start py-1.5')}
    >
      {icon}
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {block !== null ? <span className="text-caption text-text-3">{block}</span> : null}
      </span>
    </DropdownMenuItem>
  )
}
