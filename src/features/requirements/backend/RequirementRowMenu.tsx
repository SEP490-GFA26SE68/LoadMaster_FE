import {
  Eye,
  Link2,
  Link2Off,
  MoreHorizontal,
  Pencil,
  Trash2,
  Truck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { RequirementRow } from './requirements-api'
import { useRequirementsTable } from './requirements-table-context'
import { REQUIREMENT_SERVER_SUPPORT } from './requirements-capabilities'

/**
 * Menu thao tác ở cuối dòng yêu cầu giao khi đọc ghi máy chủ (FE-4b-02). Ai cũng có "Xem chi tiết". Điều phối viên (`requirements.edit`,
 * `trips.edit`): Sửa, Xoá, Đưa vào chuyến, hoặc Gỡ khỏi chuyến khi yêu cầu đã vào chuyến. Thao tác máy chủ sẽ từ chối hiện mờ kèm lý do
 * ngay dưới nhãn (AGENTS mục 5): xoá chỉ yêu cầu còn chờ và không giữ kiện nào. Dòng của máy chủ không mang pha chuyến, nên chuyến đã
 * sang xếp hàng thì máy chủ từ chối gỡ (`TRIP_NOT_EDITABLE`).
 */
export function RequirementRowMenu({ row }: { row: RequirementRow }) {
  const t = useT()
  const { canEdit, canAssign, onAction } = useRequirementsTable()
  const { status, id } = row.requirement
  const pending = status === 'PENDING'
  const onlyPending = pending ? null : t('requirements.menu.onlyPending')
  const unassignBlock = status === 'ASSIGNED' ? null : t('requirements.menu.tripLocked')
  const deleteBlock = onlyPending ?? (row.requirement.packageIds.length > 0 ? t('requirements.menu.hasPackages') : null)
  const { manage, unassign } = REQUIREMENT_SERVER_SUPPORT
  const canOpenForm = canEdit && (manage || row.requirement.lat === undefined)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('requirements.menu.open', { id })}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={16}
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <MenuAction icon={<Eye strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.view')} block={null} onSelect={() => onAction('view', row)} />

        {row.requirement.tripId ? (
          <MenuAction
            icon={<Truck strokeWidth={1.5} aria-hidden />}
            label={t('requirements.menu.viewTrip')}
            block={null}
            onSelect={() => onAction('viewTrip', row)}
          />
        ) : null}

        {canAssign ? (
          pending ? (
            <MenuAction icon={<Link2 strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.assign')} block={null} onSelect={() => onAction('assign', row)} />
          ) : unassign ? (
            <MenuAction icon={<Link2Off strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.unassign')} block={unassignBlock} onSelect={() => onAction('unassign', row)} />
          ) : null
        ) : null}
        {canOpenForm ? (
          <MenuAction icon={<Pencil strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.edit')} block={row.closed ? t('requirements.menu.closed') : null} onSelect={() => onAction('edit', row)} />
        ) : null}
        {canEdit && manage ? (
          <>
            <DropdownMenuSeparator />
            <MenuAction icon={<Trash2 strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.delete')} block={deleteBlock} danger onSelect={() => onAction('delete', row)} />
          </>
        ) : null}
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
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="whitespace-normal">{label}</span>

        {block !== null ? (
          <span className="whitespace-normal wrap-break-word text-caption leading-relaxed text-text-3">
            {block}
          </span>
        ) : null}
      </span>
    </DropdownMenuItem>
  )
}
