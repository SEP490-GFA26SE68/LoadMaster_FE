import { KeyRound, Lock, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Preview, SheetCard } from '../SheetLayout'

/** Lớp của `DropdownMenuContent` / `DropdownMenuItem` / `DropdownMenuSeparator`: mục Radix chỉ dựng được trong một menu đang mở. */
const ITEM = 'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-body text-text whitespace-nowrap [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3'

function Item({ icon, highlighted, children }: { icon: ReactNode; highlighted?: boolean; children: ReactNode }) {
  return <div className={cn(ITEM, highlighted && 'bg-n-50')}>{icon}{children}</div>
}

/**
 * Menu thao tác của một dòng người dùng (`UserRowMenu`), mở sẵn: mục đang trỏ, đường chia, và mục bị chặn mờ đi kèm lý do ngay dưới
 * nhãn — tài khoản đang đăng nhập không tự xoá được. Bản xem trước `inert`.
 */
export function MenuCard() {
  const t = useT()
  const title = t('designSystem.components.menu.title')
  return (
    <SheetCard title={title}>
      <Preview label={title} className="block">
        <div className="w-75 max-w-full overflow-hidden rounded-lg bg-bg p-1.5 shadow-e2">
          <Item highlighted icon={<Pencil strokeWidth={1.5} aria-hidden />}>{t('admin.users.menu.edit')}</Item>
          <Item icon={<Lock strokeWidth={1.5} aria-hidden />}>{t('admin.users.menu.lock')}</Item>
          <Item icon={<KeyRound strokeWidth={1.5} aria-hidden />}>{t('admin.users.menu.resetPassword')}</Item>
          <div className="mx-1 my-1.5 h-px bg-line-soft" />
          <div className={cn(ITEM, 'h-auto items-start py-1.5 text-n-600 whitespace-normal')}>
            <Trash2 strokeWidth={1.5} aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span>{t('admin.users.menu.delete')}</span>
              <span className="text-caption text-text-3">{t('admin.users.blocked.self')}</span>
            </span>
          </div>
        </div>
      </Preview>
      <p className="m-0 text-fine text-ink-3">{t('designSystem.components.menu.help')}</p>
    </SheetCard>
  )
}
