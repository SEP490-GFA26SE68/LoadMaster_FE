import {
  Building2,
  ChartColumn,
  Headset,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/user'

/** Icon của từng vai trò: thiết bị chính của vai trò đó (điều phối: máy tính, kho: máy tính bảng, tài xế: điện thoại) hoặc việc nó làm. */
export const ROLE_ICON: Readonly<Record<Role, LucideIcon>> = {
  systemAdmin: ShieldCheck,
  systemManager: SlidersHorizontal,
  systemSupporter: Headset,
  companyAdmin: Building2,
  manager: ChartColumn,
  dispatcher: Monitor,
  warehouse: Tablet,
  driver: Smartphone,
}

/**
 * Nhãn vai trò (V2.3): nền slate, bo 6 px, icon của vai trò kèm tên vai trò từ từ điển. Vai trò là ngữ cảnh chứ không phải trạng
 * thái nên không dùng chip viên thuốc. Icon chỉ để nhìn (`aria-hidden`): tên vai trò đã nói đủ.
 */
export function RoleBadge({ role, size = 'md' }: { role: Role; size?: 'sm' | 'md' }) {
  const t = useT()
  const Icon = ROLE_ICON[role]
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-sm bg-tint-slate font-medium text-tint-slate-fg',
        size === 'sm' ? 'min-h-5 gap-1 px-1.5 text-micro' : 'min-h-5.5 gap-1.5 px-2 text-caption',
      )}
    >
      <Icon aria-hidden className={cn('flex-none', size === 'sm' ? 'size-3' : 'size-3.5')} strokeWidth={1.5} />
      <span className="truncate">{t(`roles.${role}`)}</span>
    </span>
  )
}
