import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Nghĩa cố định của năm cặp tint (AGENTS mục 4): không mượn màu sang nghĩa khác. */
export type KpiTone = 'blue' | 'green' | 'amber' | 'violet' | 'slate'

const TONE_CLASS: Record<KpiTone, string> = {
  blue: 'bg-tint-blue text-tint-blue-fg',
  green: 'bg-tint-green text-tint-green-fg',
  amber: 'bg-tint-amber text-tint-amber-fg',
  violet: 'bg-tint-violet text-tint-violet-fg',
  slate: 'bg-tint-slate text-tint-slate-fg',
}

/**
 * Ô số liệu dùng chung: icon trên nền tint, số lớn 26 px Archivo 700 rộng 112 % (chữ số đều nhau), nhãn, và một dòng ghi chú nói
 * số đến từ đâu. Số KPI không dùng mono: mono dành cho mã (V2.3).
 *
 * - V2.3: mặc định là **card nền đặc** (bo 14, viền, `--card-shadow`) — kính sáng của V2 đã bỏ. `variant="sky"` là ô kính tối chỉ
 *   đặt trên dải trời (Bảng điều khiển, `ThanhPhan.jpg` "Ô số liệu kính"); ở đó bỏ icon tint, chữ trắng.
 *
 * - Số đã được format theo ngôn ngữ ở nơi gọi (`useFormat()`), ô chỉ trình bày. Mọi số cùng màu mực — màu chỉ ở icon.
 * - Vỏ ngoài là `role="group"` có `aria-label` = nhãn: test và trình đọc màn hình đọc đúng số của ô đó chứ không bắt nhầm số
 *   trùng ở bảng bên dưới.
 * - `value` và `unit` là hai text node liền nhau, không khoảng trắng giữa — `"7/ 12 chuyến"`; khoảng cách nhìn thấy là margin.
 * - Không có chip chênh lệch so với kỳ trước (LM-052, D-20). `badge` cạnh nhãn dành cho nhãn nguồn như MOCK RESULT.
 * - Có `onPress` thì ô là công tắc lọc: một `<button aria-pressed>` nằm **trong** vỏ group (vỏ giữ vai trò nhóm có nhãn), phủ cả ô.
 */
export function KpiTile({
  label,
  value,
  unit,
  note,
  badge,
  icon: Icon,
  tone = 'blue',
  pressed,
  onPress,
  variant = 'card',
}: {
  label: string
  /** Đã format theo ngôn ngữ đang chọn. */
  value: string
  unit?: string
  note?: string
  badge?: ReactNode
  icon?: LucideIcon
  tone?: KpiTone
  /** Ô đang là bộ lọc hiện hành. Chỉ có nghĩa khi có `onPress`. */
  pressed?: boolean
  onPress?: () => void
  variant?: 'card' | 'sky'
}) {
  const sky = variant === 'sky'
  const shell = sky
    ? 'rounded-lg border border-sky-glass-border bg-sky-glass backdrop-blur-[18px]'
    : 'rounded-lg border border-border bg-bg shadow-card'
  const body = (
    <>
      {Icon && !sky ? (
        <span aria-hidden className={`grid size-10 flex-none place-items-center rounded-md ${TONE_CLASS[tone]}`}>
          <Icon className="size-5" strokeWidth={1.5} />
        </span>
      ) : null}

      <span className="flex min-w-0 flex-col gap-1">
        <span className={`font-display text-[26px] leading-[1.1] font-bold tabular-nums font-stretch-112% ${sky ? 'text-sky-text' : 'text-ink-strong'}`}>
          {value}
          {unit ? <span className={`ml-1 font-sans text-body font-normal ${sky ? 'text-sky-text-3' : 'text-ink-2'}`}>{unit}</span> : null}
        </span>
        <span className={`flex flex-wrap items-center gap-2 text-body ${sky ? 'text-sky-text-3' : 'text-ink-2'}`}>
          {label}
          {badge}
        </span>
        {note ? <span className={`text-note ${sky ? 'text-sky-text-2' : 'text-ink-3'}`}>{note}</span> : null}
      </span>
    </>
  )

  if (onPress) {
    return (
      <div
        role="group"
        aria-label={label}
        data-pressed={pressed ? 'true' : 'false'}
        className={cn(
          'flex transition-[border-color,box-shadow] duration-(--dur-fast) ease-standard',
          shell,
          // Rê chuột đổi viền, không phóng to; đang lọc: viền primary đậm gấp đôi (vòng 1px bên trong).
          pressed ? 'border-primary shadow-[inset_0_0_0_1px_var(--primary)]' : 'has-[>button:hover]:border-cyan-300',
        )}
      >
        <button
          type="button"
          aria-pressed={pressed ?? false}
          onClick={onPress}
          className="flex min-h-21 w-full cursor-pointer items-center gap-3.5 rounded-lg px-4.5 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {body}
        </button>
      </div>
    )
  }

  return (
    <div role="group" aria-label={label} className={cn('flex min-h-21 items-center gap-3.5 px-4.5 py-3.5', shell)}>
      {body}
    </div>
  )
}
