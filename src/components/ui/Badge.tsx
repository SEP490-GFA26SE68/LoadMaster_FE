import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Chip trạng thái và nhãn nhỏ theo V2.3 (`design/v2.3/tokens/v3.css` `.st`, `.tag`).
 *
 * - `shape="chip"` (mặc định): cao 26, chữ 12,5/600, nền tint không viền. Chấm kể trạng thái theo **ngữ pháp chấm**:
 *   `solid` = trạng thái · `ring` (vòng rỗng) = chờ người kế tiếp · `halo` (có quầng) = đang chạy · `spin` = đang tính.
 * - `shape="tag"`: nhãn 20 px, chữ 11,5/600 — phiên bản, "Đã chỉnh tay", MOCK RESULT (`tone="mock"`: viền hổ phách, nền trong).
 * - `outlined`: thêm viền cùng tông, cho trạng thái cần người dùng xử lý ("Cần xem lại").
 */
const badgeVariants = cva(['inline-flex shrink-0 items-center whitespace-nowrap border font-semibold leading-none'], {
  variants: {
    shape: {
      chip: 'h-[26px] gap-[7px] rounded-md px-2.5 text-fine',
      tag: 'h-5 gap-1 rounded-sm px-[7px] text-note',
    },
    tone: {
      neutral: 'bg-badge-neutral-bg text-badge-neutral-fg',
      info: 'bg-badge-info-bg text-badge-info-fg',
      cyan: 'bg-badge-cyan-bg text-badge-cyan-fg',
      success: 'bg-badge-success-bg text-badge-success-fg',
      warning: 'bg-badge-warning-bg text-badge-warning-fg',
      danger: 'bg-badge-danger-bg text-badge-danger-fg',
      violet: 'bg-badge-violet-bg text-badge-violet-fg',
      mock: 'bg-transparent text-badge-warning-fg',
    },
    outlined: { true: '', false: 'border-transparent' },
  },
  compoundVariants: [
    { tone: 'neutral', outlined: true, className: 'border-badge-neutral-border' },
    { tone: ['info', 'cyan'], outlined: true, className: 'border-badge-info-border' },
    { tone: 'success', outlined: true, className: 'border-badge-success-border' },
    { tone: ['warning', 'mock'], outlined: true, className: 'border-badge-warning-border' },
    { tone: 'danger', outlined: true, className: 'border-badge-danger-border' },
    { tone: 'violet', outlined: true, className: 'border-badge-violet-border' },
    { shape: 'tag', tone: 'mock', className: 'tracking-[0.4px]' },
  ],
  defaultVariants: { shape: 'chip', tone: 'neutral', outlined: false },
})

type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>
export type BadgeTone = Tone
export type BadgeDot = 'solid' | 'ring' | 'halo' | 'spin'

/** Màu chấm theo tông: bậc 500 của thang V2.3, đậm hơn chữ để đọc được ở 7 px. */
const DOT_COLOR: Record<Tone, string> = {
  neutral: 'var(--n-400)',
  info: 'var(--cyan-500)',
  cyan: 'var(--cyan-500)',
  success: 'var(--green-500)',
  warning: 'var(--amber-500)',
  danger: 'var(--red-500)',
  violet: 'var(--violet-500)',
  mock: 'var(--amber-500)',
}

const DOT_SHAPE: Record<BadgeDot, string> = {
  solid: 'bg-(--dot)',
  ring: 'bg-bg shadow-[inset_0_0_0_2px_var(--dot)]',
  halo: 'bg-(--dot) shadow-[0_0_0_3px_color-mix(in_srgb,var(--dot)_25%,transparent)]',
  spin: 'bg-[conic-gradient(var(--dot)_0_70%,color-mix(in_srgb,var(--dot)_20%,transparent)_0)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--dot)_18%,transparent)]',
}

type BadgeProps = ComponentProps<'span'> &
  Omit<VariantProps<typeof badgeVariants>, 'tone'> & {
    tone?: Tone
    /** Chấm 7 px đầu chip. `true` = `solid`. */
    dot?: boolean | BadgeDot
    /** Tông của chấm khi khác tông chip — "Đã huỷ": chip xám, chấm đỏ. */
    dotTone?: Tone
  }

export function Badge({ className, shape, tone = 'neutral', outlined, dot = false, dotTone, children, style, ...props }: BadgeProps) {
  const dotKind: BadgeDot | null = dot === true ? 'solid' : dot || null
  return (
    <span
      className={cn(badgeVariants({ shape, tone, outlined: outlined ?? tone === 'mock' }), className)}
      style={dotKind ? { ...style, ['--dot' as string]: DOT_COLOR[dotTone ?? tone] } : style}
      {...props}
    >
      {dotKind ? <span aria-hidden className={cn('size-[7px] flex-none rounded-full', DOT_SHAPE[dotKind])} /> : null}
      {children}
    </span>
  )
}
