import { cn } from '@/lib/utils'

/**
 * Nhóm nút chọn một — preset camera, chế độ tô màu, tốc độ phát, kỳ báo cáo. V2.3 `.seg`: rãnh `--n-100` bo 10px, ô đang chọn nền
 * trắng chữ đậm có bóng nhẹ. Bản `md` 30px chữ 13px; bản `sm` gọn cho thanh timeline. `floating`: panel nổi trên khung 3D được
 * thêm bóng `--e2` (mục 5).
 */
export type SegmentedOption<T extends string | number> = {
  value: T
  label: string
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  mono = false,
  floating = true,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'md' | 'sm'
  mono?: boolean
  /** Panel nổi trên nền tối: nền trắng + bóng --e2 */
  floating?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-0.5 bg-n-100',
        size === 'md' ? 'rounded-md p-0.75' : 'rounded-sm p-0.5',
        floating && 'shadow-e2',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'whitespace-nowrap font-medium transition-colors duration-(--dur-fast) ease-standard',
              'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
              size === 'md'
                ? 'h-7.5 rounded-sm px-3 text-small'
                : 'h-5.5 rounded-xs px-2 text-micro',
              mono && 'font-mono',
              active
                ? 'bg-bg font-semibold text-ink-strong shadow-e1'
                : 'text-ink-2 hover:text-ink-1',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
