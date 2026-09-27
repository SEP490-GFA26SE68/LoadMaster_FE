import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { disabledClass, FieldLabel, FieldMessage, fieldBoxClass, focusClass, focusWithinClass, readOnlyClass } from './field-styles'

/**
 * Ô nhập V2.3 (`field-styles.tsx`): cao 40px, viền `--line-strong`, bo 10px; focus viền cyan + quầng 3px.
 * Nhãn 13/600 phía trên, gợi ý hoặc lỗi 12,5px phía dưới.
 */
type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  label?: ReactNode
  /** Gợi ý dưới ô nhập */
  hint?: ReactNode
  /** Thông báo lỗi — thay chỗ gợi ý và đổi viền sang danger */
  error?: ReactNode
  required?: boolean
  /** Số dùng mono, canh phải */
  numeric?: boolean
  /** Hậu tố đơn vị: kg, m³, cm… */
  suffix?: ReactNode
}

export function Input({ className, label, hint, error, required, numeric = false, suffix, id, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedById = `${inputId}-mo-ta`
  const invalid = Boolean(error)

  const control = (
    <input
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={hint || error ? describedById : undefined}
      className={cn(
        'placeholder:text-text-3',
        numeric && 'text-right font-mono',
        suffix
          ? 'h-auto w-full min-w-0 border-none bg-transparent px-0 text-body text-text outline-none'
          : cn('h-10 w-full min-w-0 px-3', fieldBoxClass(invalid), focusClass, disabledClass, readOnlyClass),
        className,
      )}
      {...props}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <FieldLabel htmlFor={inputId} required={required}>
          {label}
        </FieldLabel>
      ) : null}

      {suffix ? (
        <div className={cn('flex h-10 items-center gap-2 px-3', fieldBoxClass(invalid), focusWithinClass)}>
          {control}
          <span className="shrink-0 text-small text-ink-3">{suffix}</span>
        </div>
      ) : (
        control
      )}

      <FieldMessage id={describedById} error={error} hint={hint} />
    </div>
  )
}
