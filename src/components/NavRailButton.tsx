import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type NavRailButtonProps = ComponentProps<'button'> & {
  icon: LucideIcon
  /** Nhãn của nút — thành `aria-label` (thanh 60px chỉ đủ chỗ cho icon), trừ khi `text` hiện chữ. */
  label: string
  /** Lớp đè góc trên icon, ví dụ chấm tin chưa đọc. */
  badge?: ReactNode
  /** Nội dung chữ hiện cạnh icon (ô tìm nhanh "Tìm nhanh · Ctrl K" ở màn rộng). Có `text` thì nút giãn theo chữ. */
  text?: ReactNode
}

/**
 * Nút hành động trên dải trời (tìm nhanh LM-099, chuông thông báo LM-098) — V2.3 `.icon-glass`: kính sáng mờ 36px bo 10px, icon
 * trắng 85 %. Dùng làm con của `DialogTrigger`/`DropdownMenuTrigger` (`asChild`): nhận `ref` và `data-state`; đang mở thì viền
 * `--cyan-300`. Vòng focus `--cyan-300`: `--primary` (cyan-700) không đủ tương phản trên nền trời tối.
 */
export function NavRailButton({ icon: Icon, label, badge, text, className, 'aria-label': ariaLabel, ...props }: NavRailButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      className={cn(
        'relative flex h-9 flex-none items-center justify-center gap-2 rounded-md border border-sky-glass-border bg-sky-glass',
        'text-sky-text-2 transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass-hover hover:text-sky-text',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300',
        'data-[state=open]:border-cyan-300 data-[state=open]:text-sky-text',
        text ? 'px-3' : 'w-9',
        className,
      )}
      {...props}
    >
      <Icon className="size-4.5 flex-none" strokeWidth={1.5} aria-hidden />
      {text}
      {badge}
    </button>
  )
}
