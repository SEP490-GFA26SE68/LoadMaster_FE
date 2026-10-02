import { Eye, Link2, Link2Off, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { RequirementRow } from './requirements-api'
import { useRequirementsTable } from './requirements-table-context'

/**
 * Menu thao tác ở cuối dòng yêu cầu giao (FE-4b-02). Ai cũng có "Xem chi tiết". Quản lý công ty: Sửa, Xoá. Điều phối viên: Đưa vào
 * chuyến, hoặc Gỡ khỏi chuyến khi yêu cầu đã vào chuyến. Thao tác kho sẽ từ chối hiện mờ kèm lý do ngay dưới nhãn (AGENTS mục 5),
 * không để bấm rồi mới báo lỗi.
 */
export function RequirementRowMenu({ row }: { row: RequirementRow }) {
  const t = useT()
  const { canEdit, canAssign, onAction } = useRequirementsTable()
  const { status, id } = row.requirement
  const pending = status === 'PENDING'
  const onlyPending = pending ? null : t('requirements.menu.onlyPending')
  const unassignBlock = status === 'ASSIGNED' && row.trip?.phase === 'planning' ? null : t('requirements.menu.tripLocked')

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('requirements.menu.open', { id })}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <MenuAction icon={<Eye strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.view')} block={null} onSelect={() => onAction('view', row)} />
        {canAssign ? (
          pending ? (
            <MenuAction icon={<Link2 strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.assign')} block={null} onSelect={() => onAction('assign', row)} />
          ) : (
            <MenuAction icon={<Link2Off strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.unassign')} block={unassignBlock} onSelect={() => onAction('unassign', row)} />
          )
        ) : null}
        {canEdit ? (
          <>
            <MenuAction icon={<Pencil strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.edit')} block={row.closed ? t('requirements.menu.closed') : null} onSelect={() => onAction('edit', row)} />
            <DropdownMenuSeparator />
            <MenuAction icon={<Trash2 strokeWidth={1.5} aria-hidden />} label={t('requirements.menu.delete')} block={onlyPending} danger onSelect={() => onAction('delete', row)} />
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
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {block !== null ? <span className="text-caption text-text-3">{block}</span> : null}
      </span>
    </DropdownMenuItem>
  )
}
