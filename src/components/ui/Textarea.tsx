import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { disabledClass, FieldLabel, FieldMessage, fieldBoxClass, focusClass, readOnlyClass } from './field-styles'

/** Ô nhập nhiều dòng, cùng kiểu với Input (`field-styles.tsx`, V2.3). */
type TextareaProps = ComponentProps<'textarea'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export function Textarea({
  className,
  label,
  hint,
  error,
  id,
  rows = 3,
  ...props
}: TextareaProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const describedById = `${fieldId}-mo-ta`
  const invalid = Boolean(error)

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <FieldLabel htmlFor={fieldId}>{label}</FieldLabel> : null}

      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={invalid || undefined}
        aria-describedby={hint || error ? describedById : undefined}
        className={cn('w-full resize-y px-3 py-2.5 placeholder:text-text-3', fieldBoxClass(invalid), focusClass, disabledClass, readOnlyClass, className)}
        {...props}
      />

      <FieldMessage id={describedById} error={error} hint={hint} />
    </div>
  )
}
