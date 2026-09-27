import type { ComponentProps, ReactNode } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'

/**
 * Vật liệu V2.3 cho mọi thứ nằm trên hoặc sát khung 3D của Planner (`design/v2.3/screens/web/Planner3D*`): kính tối `.glass-dark`
 * (nền đặc dự phòng đã có trong `index.css`), nút `Button variant="glass"`, ô chọn và nhãn trên nền tối. Chỉ dùng trong viewer3d;
 * màn khác dùng component chung.
 */

/**
 * Vùng nền tối: vòng focus `--cyan-300` (AGENTS mục 4: `--primary` không đủ tương phản trên nền tối), ô chọn native và thanh cuộn
 * theo nền tối. Đặt ở gốc của từng panel.
 */
export const DARK_SCOPE = '[--primary:var(--cyan-300)] [color-scheme:dark] text-glass-dark-text'

/** Panel kính nổi trên khung 3D. */
export const GLASS_PANEL = cn('glass-dark rounded-xl', DARK_SCOPE)

/** Khối con trong panel kính (`.stat`, `.lsec`, `.cell` của bản mẫu): nền tối hơn một nấc, viền mảnh. */
export const DARK_SUBCARD = 'rounded-lg border border-glass-dark-border bg-canvas-2/45'

/** Ô chọn / ô tìm native trên nền tối — 56 px cảm ứng, 36 px từ `xl`. */
export const DARK_FIELD = cn(
  'h-14 min-w-0 rounded-md border border-sky-glass-border bg-sky-glass px-2.5 text-body-lg text-glass-dark-text xl:h-9 xl:text-small',
  'placeholder:text-glass-dark-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  'disabled:opacity-45 [&>option]:bg-panel-dark',
)

/**
 * Trạng thái bật của nút kính (`.gb.on`, `.seg2 .on`): nền cyan đặc mờ + viền trong cyan, như Xếp/Dỡ của thanh trên. Bản mẫu tô
 * gradient; AGENTS mục 5 chỉ cho gradient ở nút chính.
 */
export const GLASS_PRESSED = 'aria-pressed:border-transparent aria-pressed:bg-cyan-400/25 aria-pressed:text-sky-text aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-cyan-300/50'

/** Chữ phụ trên kính tối. */
export const MUTED = 'text-glass-dark-muted'

export type GlassOption<T extends string | number> = { value: T; label: ReactNode; ariaLabel?: string; disabled?: boolean }

/**
 * Nhóm nút chọn một trên kính tối (`.seg2`, `.tabs2`, `.seg3`): rãnh tối, ô đang chọn kính cyan. Mỗi ô là một nút `aria-pressed`
 * như `SegmentedControl` — bàn phím và trình đọc màn hình giữ nguyên cách dùng.
 */
export function GlassSegmented<T extends string | number>({ options, value, onChange, ariaLabel, className, itemClassName }: {
  options: readonly GlassOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  itemClassName?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex gap-0.5 rounded-md border border-sky-glass-border bg-canvas-2 p-0.75', className)}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex min-h-14 flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent px-2.5 text-body-lg font-semibold whitespace-nowrap xl:min-h-8 xl:text-small',
            'text-glass-dark-muted transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass hover:text-sky-text',
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
            GLASS_PRESSED,
            itemClassName,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export type GlassChipTone = 'ok' | 'warn' | 'bad' | 'grey' | 'cyan'

const CHIP_TONE: Record<GlassChipTone, string> = {
  ok: 'bg-green-500/20 text-green-200 inset-ring-green-500/45',
  warn: 'bg-amber-500/15 text-amber-200 inset-ring-amber-500/45',
  bad: 'bg-red-500/20 text-red-200 inset-ring-red-500/55',
  grey: 'bg-sky-glass text-glass-dark-text inset-ring-sky-glass-border',
  cyan: 'bg-cyan-400/15 text-cyan-100 inset-ring-cyan-300/45',
}

/**
 * Nhãn trạng thái trên kính tối (`.gtag`, `.pill`): nền tint trong, viền trong cùng tông, chữ sáng. Bản `pill` cao 28 cho trạng thái
 * chính của editor ("Có thể đặt"), bản thường 22, `tag` 20 cho chú giải.
 */
export function GlassChip({ tone, size = 'md', className, children, ...props }: ComponentProps<'span'> & {
  tone: GlassChipTone; size?: 'tag' | 'md' | 'pill'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-sm font-semibold whitespace-nowrap inset-ring',
        size === 'pill' ? 'h-7 px-2.5 text-lede [&_svg]:size-4' : size === 'tag' ? 'h-5 px-1.5 text-note [&_svg]:size-3' : 'h-5.5 px-2 text-caption [&_svg]:size-3.5',
        CHIP_TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/** Ô số điểm giao tô màu định danh (`.mk`): luôn kèm số, trình đọc màn hình đọc "Điểm N" (mục 10). */
export function StopMark({ stop, decorative = false, className }: {
  stop: number
  /** Chữ bên cạnh đã nói điểm giao ("PKG-… · Điểm 3"): ô chỉ để nhìn, trình đọc màn hình bỏ qua. */
  decorative?: boolean
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn('grid size-5.5 flex-none place-items-center rounded-sm font-display text-note leading-none font-semibold', className)}
      style={{ background: stopColor(stop), color: stopForeground(stop) }}
    >
      {decorative ? null : <span className="sr-only">{t('viewer.selected.stop')} </span>}
      {format.integer(stop)}
    </span>
  )
}

/** Số lớn trên kính kèm đơn vị hoặc mẫu số nhỏ: đếm và tỷ lệ Archivo 650; số đo và mã (`mono`) JetBrains Mono như mục 4. */
export function GlassValue({ value, unit, mono = false, className }: { value: ReactNode; unit?: ReactNode; mono?: boolean; className?: string }) {
  return (
    <span className={cn(mono ? 'font-mono font-medium' : 'font-display font-[650]', 'text-sky-text tabular-nums', className)}>
      {value}{unit !== undefined ? <small className={cn('ml-0.5 text-caption font-medium', MUTED)}>{unit}</small> : null}
    </span>
  )
}
