import { Gem, Package, Snowflake, TriangleAlert, Wine, type LucideIcon } from 'lucide-react'
import type { HandlingClass } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Chip loại hàng của kiện (FE-3b-04, D-69). Màu là tint theo **nghĩa cố định** (AGENTS mục 4), không phải màu định danh: hàng thường
 * là ngữ cảnh (slate), bốn loại còn lại đều cần người xếp chú ý (amber). Loại hàng nhận ra bằng icon và chữ, không bằng màu — không
 * dùng tám màu điểm giao.
 */
const LOOK: Readonly<Record<HandlingClass, { icon: LucideIcon; tint: string }>> = {
  STANDARD: { icon: Package, tint: 'bg-tint-slate text-tint-slate-fg' },
  FRAGILE: { icon: Wine, tint: 'bg-tint-amber text-tint-amber-fg' },
  REFRIGERATED: { icon: Snowflake, tint: 'bg-tint-amber text-tint-amber-fg' },
  HAZARDOUS: { icon: TriangleAlert, tint: 'bg-tint-amber text-tint-amber-fg' },
  HIGH_VALUE: { icon: Gem, tint: 'bg-tint-amber text-tint-amber-fg' },
}

export function HandlingClassChip({ handlingClass, className }: { handlingClass: HandlingClass; className?: string }) {
  const t = useT()
  const { icon: Icon, tint } = LOOK[handlingClass]
  return (
    <span className={cn('inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-fine leading-none font-semibold whitespace-nowrap', tint, className)}>
      <Icon aria-hidden className="size-4 flex-none" strokeWidth={1.5} />
      {t(`common.handlingClasses.${handlingClass}`)}
    </span>
  )
}
