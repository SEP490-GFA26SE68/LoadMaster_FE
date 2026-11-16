import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Nhãn + ô + lỗi (hoặc gợi ý) của form đăng ký công khai; lỗi thay chỗ gợi ý. */
export function RegistrationField({
  id,
  label,
  required = false,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium text-ink-strong">
        {label}
        {required ? <> <span aria-hidden="true" className="text-danger">*</span></> : null}
      </label>
      {children}
      {error ? (
        <span className="text-caption text-danger">{error}</span>
      ) : hint ? (
        <span className="text-caption text-ink-3">{hint}</span>
      ) : null}
    </div>
  )
}
